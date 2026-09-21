/**
 * components/AdminPeriodRecap.jsx
 * Rekap Admin: filter tahun/triwulan/bulan/Minggu ke- + tabel UPT + grafik
 */
import { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/db'
import Badge from './Badge'
import {
  formatPeriodLabel,
  labelBulan,
  labelTriwulan,
  namaBulan,
  sortPeriods,
  weeksOfMonth,
  pickCurrentPeriod,
} from '../lib/periods'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ChevronLeft, ChevronRight, Loader2, Building2, Download } from 'lucide-react'
import { exportTabelRekapRingkasan } from '../lib/excelExport'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function formatRp(n) {
  return `Rp ${Number(n || 0).toLocaleString('id-ID')}`
}

export default function AdminPeriodRecap({ compact = false, levelFilter = null, userUptKey = null }) {
  const [periods, setPeriods] = useState([])
  const [jenisDataList, setJenisDataList] = useState([])
  const [uptList, setUptList] = useState([])
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [triwulanKe, setTriwulanKe] = useState(1)
  const [bulan, setBulan] = useState(1)
  const [periodId, setPeriodId] = useState('')
  const [jdId, setJdId] = useState('all')
  const [uptFilter, setUptFilter] = useState(userUptKey ?? 'all')
  const [rekapRows, setRekapRows] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const selectedJd = jdId === 'all' ? null : jenisDataList.find(j => j.id === jdId)
  const isBulanan = selectedJd?.level_utama === 'bulan'

  const relevantPeriods = useMemo(() => {
    if (isBulanan) {
      return sortPeriods(periods.filter(p => p.level === 'bulan' && Number(p.tahun) === Number(tahun)))
    }
    return sortPeriods(periods.filter(p => p.level === 'minggu' && Number(p.tahun) === Number(tahun)))
  }, [periods, tahun, isBulanan])

  const activePeriod = relevantPeriods.find(p => p.id === periodId) || relevantPeriods[0] || null
  const periodLabel = formatPeriodLabel(activePeriod)

  const years = useMemo(() => {
    const set = new Set(periods.map(p => p.tahun).filter(Boolean))
    const list = [...set].sort((a, b) => a - b)
    return list.length ? list : [new Date().getFullYear()]
  }, [periods])

  useEffect(() => { loadMeta() }, [])

  useEffect(() => {
    if (!relevantPeriods.length) return
    if (isBulanan) {
      const match = relevantPeriods.find(p => Number(p.bulan) === Number(bulan)) || relevantPeriods[0]
      if (match && match.id !== periodId) setPeriodId(match.id)
    } else {
      // Gunakan periodId saat ini untuk cari minggu_ke yang sedang aktif
      const currentMingguKe = relevantPeriods.find(p => p.id === periodId)?.minggu_ke || 1
      const match = relevantPeriods.find(p =>
        Number(p.bulan) === Number(bulan) && Number(p.minggu_ke) === currentMingguKe
      ) || relevantPeriods.find(p => Number(p.bulan) === Number(bulan)) || relevantPeriods[0]
      if (match && match.id !== periodId) setPeriodId(match.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahun, bulan, isBulanan, relevantPeriods.length])

  useEffect(() => {
    if (activePeriod) {
      if (activePeriod.triwulan_ke) setTriwulanKe(activePeriod.triwulan_ke)
      else if (activePeriod.bulan) setTriwulanKe(Math.ceil(activePeriod.bulan / 3))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeriod?.id])

  useEffect(() => {
    if (activePeriod) loadValues()
  }, [activePeriod?.id, jdId])

  async function loadMeta() {
    setLoading(true)
    const [{ data: p }, { data: jds }, { data: upts }] = await Promise.all([
      db.from('periods').select('*'),
      db.from('jenis_data').select('*').eq('aktif', true).order('created_at'),
      db.from('upt_list').select('*').eq('aktif', true).order('label'),
    ])
    const allP = sortPeriods(p || [])
    setPeriods(allP)
    setJenisDataList((jds || []).filter(j => !levelFilter || j.level_utama === levelFilter))
    setUptList(upts || [])
    // Minggu yang sedang berjalan; jika tidak ada, minggu terakhir yang sudah lewat
    const defaultWeek = pickCurrentPeriod((p || []).filter(x => x.level === 'minggu'))
    if (defaultWeek) {
      setTahun(defaultWeek.tahun)
      setBulan(defaultWeek.bulan)
      setTriwulanKe(defaultWeek.triwulan_ke || 1)
      setPeriodId(defaultWeek.id)
    }
    setLoading(false)
  }

  async function loadValues() {
    if (!activePeriod) return
    setLoading(true)

    // Jika level periode aktif adalah bulan atau sedang mode bulanan,
    // sertakan seluruh ID minggu dalam bulan tersebut agar data mingguan terakumulasi
    let targetPeriodIds = [activePeriod.id]
    if (activePeriod.level === 'bulan' || isBulanan) {
      const targetBulan = activePeriod.bulan || bulan
      const targetTahun = activePeriod.tahun || tahun
      const weeks = weeksOfMonth(periods, targetTahun, targetBulan)
      targetPeriodIds = Array.from(new Set([activePeriod.id, ...weeks.map(w => w.id)]))
    }

    const [{ data: rek }, { data: ent }] = await Promise.all([
      db.from('rekap_nilai').select('*').in('period_id', targetPeriodIds),
      db.from('data_entries').select('id, upt_key, jenis_data_id, period_id').in('period_id', targetPeriodIds),
    ])
    setRekapRows(rek || [])
    setEntries(ent || [])
    setLoading(false)
  }


  const tableRows = useMemo(() => {
    const jds = selectedJd ? [selectedJd] : jenisDataList.filter(j => j.level_utama === 'minggu')
    const upts = uptFilter === 'all' ? uptList : uptList.filter(u => u.key === uptFilter)
    const rows = []
    upts.forEach(upt => {
      jds.forEach(jd => {
        // Cek data baik pada jenis data ini langsung maupun pasangan mingguannya (jika level bulan agregasi)
        const partnerId = jd.pasangan_mingguan_id
        const recs = rekapRows.filter(r =>
          r.upt_key === upt.key &&
          (r.jenis_data_id === jd.id || (partnerId && r.jenis_data_id === partnerId))
        )
        const entCount = entries.filter(e =>
          e.upt_key === upt.key &&
          (e.jenis_data_id === jd.id || (partnerId && e.jenis_data_id === partnerId))
        ).length
        const peserta = recs.filter(r => r.field_key === 'jumlah_peserta').reduce((a, r) => a + num(r.value), 0)
        const pagu = recs.filter(r => r.field_key.includes('pagu')).reduce((a, r) => a + num(r.value), 0)
        const realisasi = recs.filter(r => r.field_key.includes('realisasi_anggaran') || r.field_key === 'realisasi_anggaran').reduce((a, r) => a + num(r.value), 0)
        const pelatihanKeys = recs.filter(r => r.field_key === 'nama_pelatihan' && (r.value_text || r.value))
        const pelatihan = pelatihanKeys.length || (recs.length ? 1 : 0)
        const hasData = recs.length > 0 || entCount > 0
        rows.push({
          upt_key: upt.key,
          upt_label: upt.label,
          jenis: jd.judul,
          pelatihan,
          peserta: peserta || entCount,
          pagu,
          realisasi,
          status: hasData ? 'Submitted' : 'Draft',
          terlambat: recs.some(r => r.terlambat),
        })
      })
    })
    return rows
  }, [rekapRows, entries, jenisDataList, uptList, selectedJd, uptFilter])

  const totals = useMemo(() => ({
    pelatihan: tableRows.reduce((a, r) => a + r.pelatihan, 0),
    peserta: tableRows.reduce((a, r) => a + r.peserta, 0),
    pagu: tableRows.reduce((a, r) => a + r.pagu, 0),
    realisasi: tableRows.reduce((a, r) => a + r.realisasi, 0),
  }), [tableRows])

  const chartPerUpt = useMemo(() => {
    const map = {}
    tableRows.forEach(r => {
      if (userUptKey && r.upt_key !== userUptKey) return
      if (!map[r.upt_label]) map[r.upt_label] = { name: r.upt_label, pelatihan: 0, peserta: 0, pagu: 0, realisasi: 0 }
      map[r.upt_label].pelatihan += r.pelatihan
      map[r.upt_label].peserta += r.peserta
      map[r.upt_label].pagu += r.pagu
      map[r.upt_label].realisasi += r.realisasi
    })
    return Object.values(map)
  }, [tableRows, userUptKey])

  const trendPeriods = useMemo(() => {
    if (isBulanan) {
      return relevantPeriods.map(m => ({
        name: namaBulan(m.bulan),
        label: formatPeriodLabel(m),
      }))
    }
    return sortPeriods(relevantPeriods.filter(p => Number(p.bulan) === Number(bulan))).map(w => ({
      name: `Minggu ke-${w.minggu_ke}`,
      label: formatPeriodLabel(w),
    }))
  }, [relevantPeriods, isBulanan, bulan])

  const periodIdx = relevantPeriods.findIndex(p => p.id === activePeriod?.id)

  function goPeriod(delta) {
    const next = relevantPeriods[periodIdx + delta]
    if (next) {
      setPeriodId(next.id)
      if (next.bulan) setBulan(next.bulan)
      if (next.triwulan_ke) setTriwulanKe(next.triwulan_ke)
      else if (next.bulan) setTriwulanKe(Math.ceil(next.bulan / 3))
    }
  }

  function handleTriwulan(q) {
    setTriwulanKe(q)
    const startM = (q - 1) * 3 + 1
    setBulan(startM)
  }

  // ── tampilan lengkap (full page) ──
  return (
    <div className="space-y-5">
      {!compact && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Rekap {isBulanan ? 'Bulanan' : 'Mingguan'} {userUptKey ? 'UPT Anda' : 'Admin'}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Data mengikuti periode <strong className="text-gray-800 dark:text-gray-200">{periodLabel || '-'}</strong>
          </p>
        </div>
      )}

      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="form-label">Tahun</label>
            <select className="form-select text-sm w-full" value={tahun} onChange={e => setTahun(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Triwulan</label>
            <select className="form-select text-sm w-full" value={triwulanKe} onChange={e => handleTriwulan(Number(e.target.value))}>
              {[1, 2, 3, 4].map(q => (
                <option key={q} value={q}>{labelTriwulan(q, tahun)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Bulan</label>
            <select className="form-select text-sm w-full" value={bulan} onChange={e => setBulan(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>{labelBulan(m, tahun)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">{isBulanan ? 'Tingkat Periode' : 'Periode (Minggu)'}</label>
            {isBulanan ? (
              <div className="h-[38px] px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 truncate">
                <span>1 Bulan Penuh ({namaBulan(bulan)} {tahun})</span>
              </div>
            ) : (
              <select
                className="form-select text-sm w-full"
                value={activePeriod?.id || ''}
                onChange={e => setPeriodId(e.target.value)}
              >
                {sortPeriods(relevantPeriods.filter(p => Number(p.bulan) === Number(bulan))).map(p => (
                  <option key={p.id} value={p.id}>{formatPeriodLabel(p)}</option>
                ))}
              </select>
            )}
          </div>
          {!userUptKey && (
            <div>
              <label className="form-label">UPT/Balai</label>
              <select className="form-select text-sm w-full" value={uptFilter} onChange={e => setUptFilter(e.target.value)}>
                <option value="all">Semua UPT/Balai</option>
                {uptList.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
              </select>
            </div>
          )}
        </div>
        <div>
          <label className="form-label">Jenis Data</label>
          <select className="form-select text-sm w-full max-w-md" value={jdId} onChange={e => setJdId(e.target.value)}>
            <option value="all">Semua Jenis Data ({levelFilter === 'bulan' ? 'Bulanan' : 'Mingguan'})</option>
            {jenisDataList.map(jd => (
              <option key={jd.id} value={jd.id}>
                {jd.judul} ({jd.level_utama === 'bulan' ? 'Bulanan' : 'Mingguan'})
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary text-xs" disabled={periodIdx <= 0} onClick={() => goPeriod(-1)}>
            <ChevronLeft size={14} /> {periodIdx > 0 ? formatPeriodLabel(relevantPeriods[periodIdx - 1]) : '-'}
          </button>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 px-2">{periodLabel}</span>
          <button type="button" className="btn-secondary text-xs" disabled={periodIdx < 0 || periodIdx >= relevantPeriods.length - 1} onClick={() => goPeriod(1)}>
            {periodIdx >= 0 && periodIdx < relevantPeriods.length - 1 ? formatPeriodLabel(relevantPeriods[periodIdx + 1]) : '-'}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Total Pelatihan</p>
          <p className="text-2xl font-bold tabular-nums">{totals.pelatihan.toLocaleString('id-ID')}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Total Peserta</p>
          <p className="text-2xl font-bold tabular-nums">{totals.peserta.toLocaleString('id-ID')}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Total Realisasi Anggaran</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatRp(totals.realisasi)}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 className="font-semibold text-sm">Rekap UPT/Balai: {periodLabel}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tabel rekapitulasi data {selectedJd?.judul || 'Semua Jenis Data'} ({uptFilter === 'all' ? 'Seluruh UPT' : (uptList.find(u => u.key === uptFilter)?.label || uptFilter)})
            </p>
          </div>
          <button
            type="button"
            onClick={() => exportTabelRekapRingkasan({
              periodLabel,
              filterInfo: {
                tahun,
                bulan: labelBulan(bulan, tahun),
                triwulan: labelTriwulan(triwulanKe, tahun),
                jenisData: selectedJd?.judul || 'Semua Jenis Data',
                upt: uptFilter === 'all' ? 'Semua UPT' : (uptList.find(u => u.key === uptFilter)?.label || uptFilter),
              },
              tableRows,
              totals
            })}
            className="btn-secondary text-xs py-1.5 px-3"
            title="Download tabel rekap ini ke file Excel (.xlsx)"
          >
            <Download size={14} />
            <span>Download Excel Rekap</span>
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/40 text-xs uppercase tracking-wide text-gray-500">
                <th className="text-left py-2.5 px-3">Nama UPT/Balai</th>
                <th className="text-left py-2.5 px-3">Jenis Data</th>
                <th className="text-right py-2.5 px-3">Pelatihan</th>
                <th className="text-right py-2.5 px-3">Peserta</th>
                <th className="text-right py-2.5 px-3">Pagu</th>
                <th className="text-right py-2.5 px-3">Realisasi</th>
                <th className="text-left py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {tableRows.map(r => (
                <tr key={`${r.upt_key}-${r.jenis}`} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                  <td className="py-2.5 px-3 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 size={14} className="text-blue-500" /> {r.upt_label}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">{r.jenis}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{r.pelatihan}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{r.peserta.toLocaleString('id-ID')}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatRp(r.pagu)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatRp(r.realisasi)}</td>
                  <td className="py-2.5 px-3">
                    <Badge variant={r.status === 'Submitted' ? 'success' : 'draft'}>{r.status}</Badge>{r.terlambat && <span className="ml-1 inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">Terlambat</span>}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold">
                <td className="py-2.5 px-3">TOTAL</td>
                <td className="py-2.5 px-3">-</td>
                <td className="py-2.5 px-3 text-right font-mono">{totals.pelatihan}</td>
                <td className="py-2.5 px-3 text-right font-mono">{totals.peserta.toLocaleString('id-ID')}</td>
                <td className="py-2.5 px-3 text-right font-mono">{formatRp(totals.pagu)}</td>
                <td className="py-2.5 px-3 text-right font-mono">{formatRp(totals.realisasi)}</td>
                <td className="py-2.5 px-3">-</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {chartPerUpt.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4">
            <h4 className="text-sm font-semibold mb-3">Tren peserta per UPT/Balai</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartPerUpt}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="pelatihan" name="Pelatihan" fill="#1B5FA8" />
                  <Bar dataKey="peserta" name="Peserta" fill="#2F9E6E" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card p-4">
            <h4 className="text-sm font-semibold mb-3">Pagu vs Realisasi</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartPerUpt}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip formatter={(v) => formatRp(v)} />
                  <Legend />
                  <Bar dataKey="pagu" name="Pagu" fill="#94a3b8" />
                  <Bar dataKey="realisasi" name="Realisasi" fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card p-4 lg:col-span-2">
            <h4 className="text-sm font-semibold mb-3">
              {isBulanan ? `Daftar Periode Bulanan (${tahun})` : `Urutan periode dalam bulan (${labelBulan(bulan, tahun)})`}
            </h4>
            <div className="flex flex-wrap gap-2">
              {trendPeriods.map(w => (
                <span
                  key={w.label}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border ${w.label === periodLabel
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                >
                  {w.label}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              {isBulanan
                ? 'Periode pelaporan bulanan, diurutkan per bulan dalam tahun berjalan.'
                : 'Empat periode pelaporan per bulan, diurutkan tahun lalu bulan lalu minggu ke-.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
