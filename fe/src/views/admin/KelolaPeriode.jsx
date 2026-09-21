/**
 * views/admin/KelolaPeriode.jsx
 * Admin: melihat tahun periode yang tersedia, membuat tahun baru / tahun lampau (mis. 5 tahun ke belakang),
 * dan mengubah deadline per periode. Tahun berjalan & tahun depan dibuat otomatis oleh server.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { api, db } from '../../lib/db'
import InfoCard from '../../components/InfoCard'
import { sortPeriods, formatPeriodLabel, todayIso } from '../../lib/periods'
import { Loader2, CheckCircle2, XCircle, CalendarPlus, Lock, Unlock, History } from 'lucide-react'

const LEVELS = [['minggu', 'Minggu'], ['bulan', 'Bulan'], ['triwulan', 'Triwulan'], ['tahun', 'Tahun']]
const EXPECTED = 65 // 1 tahun + 4 triwulan + 12 bulan + 48 minggu

import PageHeader from '../../components/PageHeader'

export default function KelolaPeriode() {
  const thisYear = new Date().getFullYear()
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [dari, setDari] = useState(thisYear - 5)
  const [sampai, setSampai] = useState(thisYear - 1)
  const [tahun, setTahun] = useState(thisYear)
  const [level, setLevel] = useState('bulan')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await db.from('periods').select('*')
    setPeriods(sortPeriods(data || []))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const years = useMemo(() => {
    const m = new Map()
    periods.forEach(p => m.set(Number(p.tahun), (m.get(Number(p.tahun)) || 0) + 1))
    return [...m.entries()].sort((a, b) => b[0] - a[0])
  }, [periods])

  const rows = useMemo(() => periods.filter(p => Number(p.tahun) === Number(tahun) && p.level === level), [periods, tahun, level])
  const today = todayIso()

  async function generate(from, to) {
    setBusy(true)
    const { data, error } = await api('/periods/generate', { body: { dari: from, sampai: to } })
    setBusy(false)
    if (error) return setToast({ type: 'error', message: error.message })
    setToast({ type: 'success', message: data.jumlah ? `${data.jumlah} periode baru dibuat (tahun ${from}${to > from ? '–' + to : ''})` : 'Semua periode pada rentang itu sudah ada' })
    await load()
    setTahun(to)
  }

  async function saveDeadline(p, value) {
    if (!value || value === p.deadline) return
    const { error } = await db.from('periods').update({ deadline: value }).eq('id', p.id)
    if (error) return setToast({ type: 'error', message: error.message })
    setPeriods(list => list.map(x => (x.id === p.id ? { ...x, deadline: value } : x)))
    setToast({ type: 'success', message: `Deadline ${formatPeriodLabel(p)} diubah ke ${value}` })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Kelola Periode" description="Periode tahun berjalan dan tahun depan dibuat otomatis. Halaman ini untuk tahun lampau dan mengubah deadline." />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-fade-in ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
          {toast.type === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InfoCard title="Tahun yang Tersedia">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : years.length === 0 ? (
            <p className="text-sm text-gray-400">Belum ada periode.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 px-2">Tahun</th><th className="py-2 px-2">Periode</th><th className="py-2 px-2">Status</th><th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {years.map(([y, n]) => (
                  <tr key={y} className={Number(tahun) === y ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}>
                    <td className="py-2 px-2 font-semibold">{y}</td>
                    <td className="py-2 px-2 font-mono">{n} / {EXPECTED}</td>
                    <td className="py-2 px-2 text-xs">
                      {n >= EXPECTED ? <span className="text-emerald-600 dark:text-emerald-400">Lengkap</span> : <span className="text-amber-600">Belum lengkap</span>}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button className="text-xs text-blue-600 hover:underline" onClick={() => setTahun(y)}>Lihat</button>
                      {n < EXPECTED && (
                        <button className="text-xs text-amber-600 hover:underline ml-3" disabled={busy} onClick={() => generate(y, y)}>Lengkapi</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </InfoCard>

        <InfoCard title="Tambah Tahun">
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Membuat 65 periode per tahun (1 tahun, 4 triwulan, 12 bulan, 48 minggu). Periode yang sudah ada tidak ditimpa.
            </p>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="form-label text-xs">Dari tahun</label>
                <input type="number" value={dari} onChange={e => setDari(Number(e.target.value))} className="form-input w-28" min={2000} max={2100} />
              </div>
              <div>
                <label className="form-label text-xs">Sampai tahun</label>
                <input type="number" value={sampai} onChange={e => setSampai(Number(e.target.value))} className="form-input w-28" min={2000} max={2100} />
              </div>
              <button disabled={busy || dari > sampai} onClick={() => generate(dari, sampai)} className="btn-primary text-sm disabled:opacity-40">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <CalendarPlus size={15} />} Buat Periode
              </button>
            </div>
            <button
              disabled={busy}
              onClick={() => { setDari(thisYear - 5); setSampai(thisYear - 1); generate(thisYear - 5, thisYear - 1) }}
              className="btn-secondary text-xs"
            >
              <History size={14} /> Buat 5 tahun ke belakang ({thisYear - 5}–{thisYear - 1})
            </button>
            <p className="text-[11px] text-gray-400">
              Deadline tahun lampau sudah lewat. UPT <strong>tetap bisa</strong> mengisinya, tetapi datanya ditandai <strong>terlambat</strong> (merah). Untuk data lama, gunakan <strong>Arsip Historis</strong> atau <strong>Impor Data Historis</strong>.
            </p>
          </div>
        </InfoCard>
      </div>

      <InfoCard title={`Periode Tahun ${tahun}`}>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {LEVELS.map(([k, text]) => (
            <button
              key={k}
              onClick={() => setLevel(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${level === k ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            >
              {text}
            </button>
          ))}
          <span className="text-xs text-gray-400 ml-2">Deadline bukan kunci: mengisi setelah deadline tetap bisa, hanya ditandai terlambat. Ubah tanggal untuk memperpanjang tenggat.</span>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">Tidak ada periode {level} untuk tahun {tahun}. Buat tahunnya lebih dulu.</p>
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-900">
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 px-2">Periode</th><th className="py-2 px-2">Rentang</th><th className="py-2 px-2">Deadline</th><th className="py-2 px-2">Status Tenggat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map(p => {
                  const locked = p.deadline < today
                  return (
                    <tr key={p.id}>
                      <td className="py-2 px-2 font-medium whitespace-nowrap">{formatPeriodLabel(p)}</td>
                      <td className="py-2 px-2 text-xs text-gray-500 whitespace-nowrap">{p.tanggal_mulai} s/d {p.tanggal_selesai}</td>
                      <td className="py-2 px-2">
                        <input type="date" defaultValue={p.deadline} key={p.id + p.deadline} onBlur={e => saveDeadline(p, e.target.value)} className="form-input text-xs py-1" />
                      </td>
                      <td className="py-2 px-2 text-xs whitespace-nowrap">
                        {locked
                          ? <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400"><Lock size={12} /> Lewat (isi = terlambat)</span>
                          : <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Unlock size={12} /> Tepat waktu</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </InfoCard>
    </div>
  )
}
