/**
 * views/admin/TempatSampah.jsx
 * Admin: Tempat Sampah (pulihkan / hapus permanen data yang dihapus) + Catatan Penghapusan (log).
 */
import { useState, useEffect, useCallback } from 'react'
import { api, db } from '../../lib/db'
import InfoCard from '../../components/InfoCard'
import { Trash2, RotateCcw, Loader2, CheckCircle2, XCircle, AlertTriangle, ScrollText } from 'lucide-react'

const TABS = [
  ['sampah', Trash2, 'Tempat Sampah'],
  ['log', ScrollText, 'Catatan Aktivitas'],
]

const ACTION = {
  hapus: ['Hapus', 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'],
  hapus_massal: ['Hapus Massal', 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'],
  pulihkan: ['Pulihkan', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'],
  hapus_permanen: ['Hapus Permanen', 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'],
  hapus_permanen_otomatis: ['Dibuang Otomatis', 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'],
  hapus_upt: ['Hapus UPT', 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'],
  buat_periode: ['Buat Periode', 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'],
  ubah_periode: ['Ubah Deadline', 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'],
  arsip_unggah: ['Unggah Arsip', 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'],
  arsip_hapus: ['Hapus Arsip', 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'],
  impor_historis: ['Impor Historis', 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'],
}

const TABLE_LABEL = {
  rekap_nilai: 'Data Mingguan',
  data_entries: 'Data Bulanan (rincian nama)',
  dokumen_upload: 'Berkas Unggahan',
  daily_activity: 'Daily Activity',
  upt_list: 'UPT',
  profiles: 'Akun',
  jenis_data: 'Jenis Data',
  field_definitions: 'Kolom Jenis Data',
}

const fmtTime = iso => (iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-')

/** Ringkasan satu baris log dalam bahasa manusia. */
function summarize(row) {
  const d = row.detail || {}
  if (row.action === 'buat_periode') return `${d.jumlah} periode baru dibuat${d.dari ? ` (tahun ${d.dari}${d.sampai > d.dari ? '–' + d.sampai : ''})` : ''}${d.alasan ? ' — ' + d.alasan : ''}`
  if (row.action === 'ubah_periode') return `${d.jumlah} periode: ${Object.entries(d.perubahan || {}).map(([k, v]) => `${k} → ${v}`).join(', ')}`
  if (row.action === 'arsip_unggah' || row.action === 'arsip_hapus') return `${d.judul} (${d.tahun}, ${d.upt}) — ${d.berkas}`
  if (row.action === 'impor_historis') return `${d.jenis_data}: ${d.data_ditulis} data dari ${d.baris_valid} baris (${d.berkas || 'berkas'})${d.dilewati ? `, ${d.dilewati} baris dilewati` : ''}`
  if (row.action === 'hapus_upt') {
    return `${d.label || d.upt}: ${d.akun ?? 0} akun, ${d.data_mingguan ?? 0} data mingguan, ${d.data_bulanan ?? 0} data bulanan, ${d.berkas ?? 0} berkas, ${d.aktivitas ?? 0} aktivitas ikut terhapus`
  }
  const tabel = d.tabel && typeof d.tabel === 'object'
    ? Object.entries(d.tabel).map(([t, n]) => `${n} ${TABLE_LABEL[t] || t}`).join(', ')
    : `${d.jumlah ?? '?'} ${TABLE_LABEL[d.tabel] || d.tabel || 'data'}`
  const ctx = [d.jenis_data, d.upt, d.periode || d.tanggal].filter(Boolean).join(' · ')
  return [tabel, ctx, d.filter && !ctx ? d.filter : null, d.alasan].filter(Boolean).join(' — ')
}

import PageHeader from '../../components/PageHeader'

export default function TempatSampah() {
  const [tab, setTab] = useState('sampah')
  const [trash, setTrash] = useState(null) // { enabled, retentionDays, items }
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: t }, { data: logs }] = await Promise.all([
      api('/trash', { method: 'GET' }),
      db.from('audit_log').select('*')
        .in('action', Object.keys(ACTION))
        .order('created_at', { ascending: false })
        .limit(200),
    ])
    setTrash(t || { enabled: false, items: [] })
    setLog(logs || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  async function act(kind, item) {
    const text = kind === 'restore'
      ? `Pulihkan ${item.jumlah} data (${item.tabel_label}${item.upt ? ' · ' + item.upt : ''})?`
      : `HAPUS PERMANEN ${item.jumlah} data (${item.tabel_label}${item.upt ? ' · ' + item.upt : ''})?\n\nTindakan ini tidak bisa dibatalkan.`
    if (!confirm(text)) return
    setBusy(item.batch)
    const { error } = await api(`/trash/${kind === 'restore' ? 'restore' : 'purge'}`, { body: { batch: item.batch } })
    setBusy('')
    setToast(error
      ? { type: 'error', message: error.message }
      : { type: 'success', message: kind === 'restore' ? 'Data berhasil dipulihkan' : 'Data dibuang permanen' })
    load()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Tempat Sampah & Catatan Aktivitas" description={<>Data yang dihapus disimpan {trash?.retentionDays || 30} hari sebelum dibuang permanen. Semua penghapusan tercatat.</>} />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-fade-in ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
          {toast.type === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.message}
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-3">
        {TABS.map(([key, Icon, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${
              tab === key ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Icon size={15} />
            <span>{label}</span>
            {key === 'sampah' && trash?.items?.length > 0 && (
              <span className="bg-white/20 rounded-full px-1.5 text-[10px]">{trash.items.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : tab === 'sampah' ? (
        <InfoCard title="Data yang Dihapus">
          {trash && !trash.enabled && (
            <div className="flex gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-sm mb-4">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <p>
                Tempat sampah <strong>belum aktif</strong> di database ini, sehingga penghapusan saat ini bersifat permanen.
                Jalankan <code>database/migrasi_02_tempat_sampah.sql</code> di phpMyAdmin, lalu muat ulang halaman ini.
              </p>
            </div>
          )}
          {trash?.items?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-xs uppercase tracking-wide text-gray-500 text-left">
                    <th className="py-2 px-3">Data</th>
                    <th className="py-2 px-3">UPT</th>
                    <th className="py-2 px-3 text-right">Jumlah</th>
                    <th className="py-2 px-3">Dihapus oleh</th>
                    <th className="py-2 px-3">Waktu</th>
                    <th className="py-2 px-3 text-right">Sisa</th>
                    <th className="py-2 px-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {trash.items.map(it => (
                    <tr key={it.batch} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-gray-900 dark:text-white">{it.tabel_label}</p>
                        <p className="text-xs text-gray-400">{[it.jenis_data, it.periode].filter(Boolean).join(' · ') || '-'}</p>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{it.upt || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{it.jumlah}</td>
                      <td className="py-2.5 px-3 text-xs">{it.dihapus_oleh || <span className="text-gray-400">(akun sudah dihapus)</span>}</td>
                      <td className="py-2.5 px-3 text-xs whitespace-nowrap">{fmtTime(it.dihapus_pada)}</td>
                      <td className="py-2.5 px-3 text-right text-xs whitespace-nowrap">{it.sisa_hari} hari</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            disabled={busy === it.batch}
                            onClick={() => act('restore', it)}
                            className="btn-secondary text-xs text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60"
                          >
                            <RotateCcw size={13} /> Pulihkan
                          </button>
                          <button
                            disabled={busy === it.batch}
                            onClick={() => act('purge', it)}
                            className="p-1.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            title="Hapus permanen"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <Trash2 size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Tempat sampah kosong</p>
            </div>
          )}
        </InfoCard>
      ) : (
        <InfoCard title="Catatan Aktivitas Admin & Penghapusan (200 terbaru)">
          {log.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Belum ada catatan penghapusan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-xs uppercase tracking-wide text-gray-500 text-left">
                    <th className="py-2 px-3">Waktu</th>
                    <th className="py-2 px-3">Aksi</th>
                    <th className="py-2 px-3">Oleh</th>
                    <th className="py-2 px-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {log.map(row => {
                    const [label, cls] = ACTION[row.action] || [row.action, 'bg-gray-100 text-gray-700']
                    return (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 align-top">
                        <td className="py-2.5 px-3 text-xs whitespace-nowrap">{fmtTime(row.created_at)}</td>
                        <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${cls}`}>{label}</span></td>
                        <td className="py-2.5 px-3 text-xs">{row.detail?.oleh || '-'}</td>
                        <td className="py-2.5 px-3 text-xs text-gray-700 dark:text-gray-300">{summarize(row)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </InfoCard>
      )}
    </div>
  )
}
