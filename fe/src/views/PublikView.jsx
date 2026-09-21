/**
 * views/PublikView.jsx
 * Halaman publik satu layar: ringkasan capaian per kategori data untuk satu tahun. Tanpa login, hanya angka agregat
 * (dari view v_publik_rekap; tidak ada nama/NIK/identitas pribadi).
 */
import { useState, useEffect, useMemo } from 'react'
import { db } from '../lib/db'
import { Waves, LogIn, Loader2, Globe } from 'lucide-react'

export default function PublikView({ onLoginClick }) {
  const [rekap, setRekap] = useState([])
  const [jenisData, setJenisData] = useState([])
  const [tahun, setTahun] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [{ data: jds }, { data: r }] = await Promise.all([
          db.from('jenis_data').select('id, judul').eq('publik_boleh_lihat', true).eq('aktif', true).order('judul'),
          db.from('v_publik_rekap').select('*'),
        ])
        setJenisData(jds || []); setRekap(r || [])
        const years = [...new Set((r || []).map(x => Number(x.tahun)))].sort((a, b) => b - a)
        if (years.length) setTahun(String(years[0]))
      } catch (err) { console.error('Error loading public data:', err) }
      setLoading(false)
    })()
  }, [])

  const years = useMemo(() => [...new Set(rekap.map(x => Number(x.tahun)))].sort((a, b) => b - a), [rekap])
  const rows = useMemo(() => {
    const totals = {}
    rekap.filter(x => String(x.tahun) === String(tahun)).forEach(x => { totals[x.jenis_data_id] = (totals[x.jenis_data_id] || 0) + (Number(x.total_baris) || 0) })
    return jenisData.map(j => ({ id: j.id, judul: j.judul, total: totals[j.id] || 0 }))
  }, [rekap, jenisData, tahun])
  const max = Math.max(1, ...rows.map(r => r.total))
  const total = rows.reduce((a, r) => a + r.total, 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F1A] text-gray-900 dark:text-gray-100 flex flex-col">
      <header className="bg-white dark:bg-[#0B1830] border-b border-gray-200 dark:border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white"><span className="font-bold">P</span></div>
          <div>
            <div className="font-bold text-sm leading-tight">PUSLATKP</div>
            <div className="text-[11px] text-gray-500 dark:text-white/50 leading-tight">Ringkasan Kinerja Pelatihan</div>
          </div>
        </div>
        <button onClick={onLoginClick} className="btn-primary text-xs"><LogIn size={14} /> Login Petugas</button>
      </header>

      <main className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-8 flex-1 space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-bold text-3xl font-display">Capaian Pelatihan</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Data agregat seluruh UPT. Identitas pribadi tidak ditampilkan.</p>
          </div>
          {years.length > 0 && (
            <select className="form-select text-sm w-auto" value={tahun} onChange={e => setTahun(e.target.value)} aria-label="Tahun">
              {years.map(y => <option key={y} value={y}>Tahun {y}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-500" /></div>
        ) : rows.length === 0 || years.length === 0 ? (
          <div className="card p-10 text-center text-gray-400"><Globe size={40} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Belum ada data yang dipublikasikan.</p></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="card p-6 text-white lg:sticky lg:top-6" style={{ background: 'var(--color-brand-blue)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">Total data terdata {tahun}</p>
              <p className="text-5xl font-bold font-mono tabular-nums mt-2">{total.toLocaleString('id-ID')}</p>
              <p className="text-xs text-white/60 mt-3">{rows.length} kategori data publik</p>
            </div>
            <div className="card p-6 lg:col-span-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">Per kategori</h2>
              <ul className="space-y-4">
                {rows.map(r => (
                  <li key={r.id}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium">{r.judul}</span>
                      <span className="font-mono tabular-nums">{r.total.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${(r.total / max) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800 py-5 text-center text-xs text-gray-400">
        PUSLATKP (Pusat Pelatihan Kelautan dan Perikanan) &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}
