/**
 * views/admin/PermintaanHapus.jsx
 * Admin: setujui/tolak permintaan dari akun UPT — dua jenis, ditampilkan sebagai dua daftar terpisah:
 * 1. Persetujuan Data — UPT menekan "Kirim" pada suatu periode (status 'draft' di tabel periode_kirim, BELUM
 *    mengunci apa pun). Admin meninjau lalu menyetujui di sini (POST /api/periode-kirim/:id/setujui) -> status
 *    'disetujui' -> BARU SAAT ITU periode terkunci bagi UPT. UPT bisa membatalkan draft sendiri kapan pun tanpa
 *    izin (belum ada yang terkunci), jadi tidak ada tombol "Tolak" di sini — cukup tidak disetujui saja.
 * 2. Hapus & Buka Kunci — permintaan pada `permintaan_hapus`: hapus data mingguan/bulanan/berkas, atau buka
 *    kunci periode yang statusnya sudah 'disetujui' (tabel='periode_kirim'). Disetujui = aksi aslinya benar-benar
 *    dijalankan; ditolak = data/kunci tidak disentuh.
 */
import { useState, useEffect, useCallback } from 'react'
import { db, getFeatures } from '../../lib/db'
import InfoCard from '../../components/InfoCard'
import { Inbox, Check, X, Loader2, CheckCircle2, XCircle, Clock, FileCheck } from 'lucide-react'
import { formatPeriodLabel } from '../../lib/periods'

const TABLE_LABEL = {
  rekap_nilai: 'Data Mingguan/Bulanan',
  data_entries: 'Data Rincian (Nama)',
  dokumen_upload: 'Berkas Unggahan',
  periode_kirim: 'Buka Kunci Periode',
}

const isUnlock = item => item.tabel === 'periode_kirim'

const STATUS_BADGE = {
  pending: ['Menunggu', 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'],
  disetujui: ['Disetujui', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'],
  ditolak: ['Ditolak', 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'],
}

const fmtTime = iso => (iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-')

import PageHeader from '../../components/PageHeader'

export default function PermintaanHapus() {
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [drafts, setDrafts] = useState([])
  const [uptList, setUptList] = useState([])
  const [periods, setPeriods] = useState([])
  const [busy, setBusy] = useState('')
  const [toast, setToast] = useState(null)
  const [showHistory, setShowHistory] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const feat = await getFeatures()
    if (!feat.permintaanHapus) { setEnabled(false); setLoading(false); return }
    const queries = [
      db.from('permintaan_hapus').select('*').order('created_at', { ascending: false }),
      db.from('upt_list').select('*'),
      db.from('periods').select('*'),
    ]
    if (feat.periodeKirim) queries.push(db.from('periode_kirim').select('*').eq('status', 'draft').order('terkirim_at', { ascending: false }))
    const [{ data: reqs }, { data: upts }, { data: pers }, draftRes] = await Promise.all(queries)
    setItems(reqs || [])
    setUptList(upts || [])
    setPeriods(pers || [])
    setDrafts(draftRes?.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const uptLabel = key => uptList.find(u => u.key === key)?.label || key
  const periodLabel = id => { const p = periods.find(x => x.id === id); return p ? formatPeriodLabel(p) : id }
  const pending = items.filter(i => i.status === 'pending')
  const history = items.filter(i => i.status !== 'pending')

  async function approveDraft(item) {
    if (!confirm(`Setujui data ${item.upt_key ? uptLabel(item.upt_key) : ''} untuk ${periodLabel(item.period_id)}?\n\nSemua jenis data periode ini akan langsung terkunci bagi UPT setelah disetujui.`)) return
    setBusy(item.id)
    const { error } = await db.periodeKirim.setujui(item.id)
    setBusy('')
    setToast(error ? { type: 'error', message: error.message } : { type: 'success', message: 'Data disetujui & periode terkunci.' })
    load()
  }

  async function approve(item) {
    const confirmMsg = isUnlock(item)
      ? `Buka kunci "${item.ringkasan}"?\n\nUPT bisa mengedit lagi seluruh jenis data periode ini sampai mereka "Kirim" ulang.`
      : `Setujui penghapusan "${item.ringkasan || TABLE_LABEL[item.tabel]}"?\n\nData akan benar-benar terhapus (masuk Tempat Sampah, dapat dipulihkan 30 hari).`
    if (!confirm(confirmMsg)) return
    setBusy(item.id)
    const { error, data } = await db.permintaanHapus.setujui(item.id)
    setBusy('')
    setToast(error
      ? { type: 'error', message: error.message }
      : { type: 'success', message: isUnlock(item) ? 'Disetujui — kunci periode dibuka.' : `Disetujui — ${data?.dihapus ?? item.jumlah_baris} data dihapus.` })
    load()
  }

  async function reject(item) {
    const catatan = prompt(
      isUnlock(item) ? 'Alasan menolak buka kunci (opsional, akan terlihat oleh UPT):' : 'Alasan penolakan (opsional, akan terlihat oleh UPT):',
      '',
    )
    if (catatan === null) return // batal
    setBusy(item.id)
    const { error } = await db.permintaanHapus.tolak(item.id, catatan)
    setBusy('')
    setToast(error ? { type: 'error', message: error.message } : { type: 'success', message: isUnlock(item) ? 'Permintaan buka kunci ditolak — data tetap terkunci.' : 'Permintaan ditolak.' })
    load()
  }

  if (loading) return <div className="card flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Permintaan"
        description="Data yang UPT kirim menunggu persetujuan Anda sebelum terkunci (Persetujuan Data). Setelah terkunci — atau untuk menghapus data — UPT mengajukan permintaan lagi di sini (Hapus & Buka Kunci)."
      />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-fade-in ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
          {toast.type === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.message}
        </div>
      )}

      {!enabled && (
        <div className="card p-6 text-sm text-amber-700 dark:text-amber-300">
          Fitur Permintaan belum aktif. Jalankan <code>database/migrasi_10_permintaan_hapus.sql</code> di
          phpMyAdmin, restart backend, lalu muat ulang halaman. Sampai migrasi dijalankan, akun UPT tetap menghapus
          data secara langsung seperti sebelumnya (tidak diblokir diam-diam).
        </div>
      )}

      {enabled && (
        <>
          <InfoCard title={`Persetujuan Data (${drafts.length})`}>
            {drafts.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <FileCheck size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Tidak ada data yang menunggu persetujuan.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {drafts.map(item => (
                  <div key={item.id} className="py-3 flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-white">
                        {uptLabel(item.upt_key)} <span className="text-gray-400 font-normal">· {periodLabel(item.period_id)}</span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Seluruh jenis data periode ini akan ikut terkunci bila disetujui.</p>
                      <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                        <Clock size={11} /> {item.terkirim_by_label || 'UPT'} · {fmtTime(item.terkirim_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        disabled={busy === item.id}
                        onClick={() => approveDraft(item)}
                        className="btn-primary text-xs !bg-emerald-600 hover:!bg-emerald-700"
                      >
                        {busy === item.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Setujui
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </InfoCard>

          <InfoCard title={`Hapus & Buka Kunci (${pending.length})`}>
            {pending.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Inbox size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Tidak ada permintaan yang menunggu.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {pending.map(item => (
                  <div key={item.id} className="py-3 flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-white">
                        {uptLabel(item.upt_key)} <span className="text-gray-400 font-normal">· {TABLE_LABEL[item.tabel] || item.tabel}</span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.ringkasan || `${item.jumlah_baris} baris`}</p>
                      {item.alasan && <p className="text-xs text-gray-400 mt-0.5 italic">Alasan UPT: "{item.alasan}"</p>}
                      <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                        <Clock size={11} /> {item.requested_by_label || 'UPT'} · {fmtTime(item.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        disabled={busy === item.id}
                        onClick={() => reject(item)}
                        className="btn-secondary text-xs text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60"
                      >
                        <X size={13} /> Tolak
                      </button>
                      <button
                        disabled={busy === item.id}
                        onClick={() => approve(item)}
                        className="btn-primary text-xs !bg-emerald-600 hover:!bg-emerald-700"
                      >
                        {busy === item.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Setujui
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </InfoCard>

          <InfoCard
            title={`Riwayat Hapus & Buka Kunci (${history.length})`}
            action={
              <button className="text-xs text-sky-600 hover:underline" onClick={() => setShowHistory(s => !s)}>
                {showHistory ? 'Sembunyikan' : 'Tampilkan'}
              </button>
            }
          >
            {showHistory && (history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Belum ada riwayat.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-xs uppercase tracking-wide text-gray-500 text-left">
                      <th className="py-2 px-3">UPT</th>
                      <th className="py-2 px-3">Data</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Ditinjau oleh</th>
                      <th className="py-2 px-3">Waktu</th>
                      <th className="py-2 px-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {history.map(item => {
                      const [label, cls] = STATUS_BADGE[item.status] || [item.status, 'bg-gray-100 text-gray-700']
                      return (
                        <tr key={item.id}>
                          <td className="py-2.5 px-3 whitespace-nowrap">{uptLabel(item.upt_key)}</td>
                          <td className="py-2.5 px-3 text-xs">{item.ringkasan || `${item.jumlah_baris} baris ${TABLE_LABEL[item.tabel] || item.tabel}`}</td>
                          <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${cls}`}>{label}</span></td>
                          <td className="py-2.5 px-3 text-xs">{item.reviewed_by_label || '-'}</td>
                          <td className="py-2.5 px-3 text-xs whitespace-nowrap">{fmtTime(item.reviewed_at)}</td>
                          <td className="py-2.5 px-3 text-xs text-gray-500">{item.catatan_admin || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </InfoCard>
        </>
      )}
    </div>
  )
}
