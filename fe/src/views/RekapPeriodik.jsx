/**
 * views/RekapPeriodik.jsx
 * Hasil REKAP TRIWULAN & TAHUNAN — baca saja. Angka otomatis dijumlahkan (SUM) dari data mingguan
 * yang diinput UPT, jadi tidak ada input/upload di sini.
 * Akun UPT hanya melihat data UPT-nya sendiri; Admin dapat memilih satu UPT atau semua UPT.
 */
import { useState, useEffect, useMemo } from 'react'
import { db } from '../lib/db'
import { useAuth } from '../AuthContext'
import StatCard from '../components/StatCard'
import * as XLSX from 'xlsx'
import { sanitizeRows } from '../lib/excelExport'
import { agregasiOf, applyAgregasi, combineUpt, AGREGASI_SHORT } from '../lib/agregasi'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  namaBulan, ROMAN_TRIWULAN, triwulanDariBulan, sortPeriods, weeksOfQuarter, weeksOfYear,
} from '../lib/periods'
import { Users, Landmark, GraduationCap, Download, Filter, Loader2, Hourglass, BarChart2 } from 'lucide-react'

const DANA = 'data_capaian_anggaran_per_sumber_dana'

// Angka ringkasan (kunci Jenis Data bawaan + kolom), sama dengan yang tampil di Dashboard
const METRICS = [
  { id: 'masy', label: 'Masyarakat Dilatih', jd: 'masyarakat', fields: ['jumlah_peserta'] },
  { id: 'apar', label: 'Aparatur Dilatih', jd: 'aparatur', fields: ['jumlah_peserta'] },
  { id: 'sdm', label: 'SDM Pelatih (Instruktur & WI)', jd: 'data_instruktur_dan_wi', fields: ['jumlah_instruktur_wi'] },
  { id: 'rm', label: 'Realisasi RM', jd: DANA, fields: ['realisasi_rm'], rp: true },
  { id: 'pnbp', label: 'Realisasi PNBP/BLU', jd: DANA, fields: ['realisasi_pnbp_blu'], rp: true },
  { id: 'sbsn', label: 'Realisasi SBSN', jd: DANA, fields: ['realisasi_sbsn'], rp: true },
  { id: 'total', label: 'Total Realisasi Anggaran', jd: DANA, fields: ['realisasi_rm', 'realisasi_pnbp_blu', 'realisasi_sbsn'], rp: true, bold: true },
]

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0)
const formatRp = n => `Rp ${num(n).toLocaleString('id-ID')}`
const fmt = (n, rp) => (rp ? formatRp(n) : num(n).toLocaleString('id-ID'))
const isRp = f => (f.label || '').includes('(Rp)')

export default function RekapPeriodik() {
  const { isAdmin, uptKey } = useAuth()

  const [mode, setMode] = useState('triwulan') // 'triwulan' | 'tahun'
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [tw, setTw] = useState(triwulanDariBulan(new Date().getMonth() + 1))
  const [uptFilter, setUptFilter] = useState('all')
  const [jdId, setJdId] = useState('all')

  const [periods, setPeriods] = useState([])
  const [uptList, setUptList] = useState([])
  const [jenisData, setJenisData] = useState([])
  const [fieldDefs, setFieldDefs] = useState([])
  const [rows, setRows] = useState([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)

  useEffect(() => {
    loadMeta()
  }, [])

  async function loadMeta() {
    setLoadingMeta(true)
    const [{ data: p }, { data: upts }, { data: jds }, { data: fields }] = await Promise.all([
      db.from('periods').select('*').eq('level', 'minggu'),
      db.from('upt_list').select('*').eq('aktif', true).order('label'),
      db.from('jenis_data').select('*').eq('aktif', true).order('created_at'),
      db.from('field_definitions').select('*').eq('aktif', true).eq('level', 'minggu').order('urutan'),
    ])
    const list = sortPeriods(p || [])
    setPeriods(list)
    setUptList(upts || [])
    setJenisData((jds || []).filter(j => j.level_utama === 'minggu'))
    setFieldDefs(fields || [])
    // tahun bawaan: tahun berjalan bila ada periodenya, jika tidak tahun terakhir
    const years = [...new Set(list.map(x => Number(x.tahun)))].sort((a, b) => a - b)
    if (years.length && !years.includes(new Date().getFullYear())) setTahun(years[years.length - 1])
    setLoadingMeta(false)
  }

  const years = useMemo(() => {
    const y = [...new Set(periods.map(x => Number(x.tahun)))].sort((a, b) => a - b)
    return y.length ? y : [tahun]
  }, [periods, tahun])

  // Minggu-minggu yang dijumlahkan
  const weeks = useMemo(
    () => (mode === 'tahun' ? weeksOfYear(periods, tahun) : weeksOfQuarter(periods, tahun, tw)),
    [periods, tahun, tw, mode]
  )
  const weekKey = weeks.map(w => w.id).join(',')
  const weekIdsOrdered = weeks.map(w => w.id) // kronologis (terawal -> terakhir)

  useEffect(() => {
    if (!weeks.length) { setRows([]); return }
    let alive = true
    setLoadingRows(true)
    db.from('rekap_nilai')
      .select('jenis_data_id, upt_key, period_id, field_key, value')
      .in('period_id', weeks.map(w => w.id))
      .then(({ data }) => {
        if (!alive) return
        setRows(data || [])
        setLoadingRows(false)
      })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey])

  // UPT yang tampil (UPT yang sudah dihapus otomatis tidak ada di daftar ini)
  const scopeUpts = useMemo(() => {
    if (!isAdmin) return uptList.filter(u => u.key === uptKey)
    return uptFilter === 'all' ? uptList : uptList.filter(u => u.key === uptFilter)
  }, [isAdmin, uptKey, uptFilter, uptList])
  const scopeKeys = useMemo(() => new Set(scopeUpts.map(u => u.key)), [scopeUpts])
  const scoped = useMemo(() => rows.filter(r => scopeKeys.has(r.upt_key)), [rows, scopeKeys])

  const jdIdByKey = useMemo(() => Object.fromEntries(jenisData.map(j => [j.key, j.id])), [jenisData])

  // Nilai satu kolom untuk satu UPT pada rangkaian minggu (urut), sesuai cara rekap kolom itu:
  // angka kumulatif (pagu, realisasi, jumlah SDM) = nilai terakhir; angka lain dijumlahkan.
  const uptFieldValue = (jdId, uptKey, fieldKey, ids) => {
    const def = fieldDefs.find(f => f.jenis_data_id === jdId && f.field_key === fieldKey) || { field_key: fieldKey }
    const perWeek = ids.map(id => {
      const rs = scoped.filter(r => r.jenis_data_id === jdId && r.upt_key === uptKey && r.period_id === id && r.field_key === fieldKey && r.value !== null && r.value !== undefined)
      return rs.length ? rs.reduce((a, r) => a + Number(r.value), 0) : null
    })
    return applyAgregasi(perWeek, agregasiOf(def)) ?? 0
  }

  const sumMetric = (m, ids) => scopeUpts.reduce(
    (acc, u) => acc + m.fields.reduce((a, f) => a + uptFieldValue(jdIdByKey[m.jd], u.key, f, ids), 0),
    0,
  )

  // Sub-periode: triwulan -> 3 bulan; tahun -> 4 triwulan
  const subs = useMemo(() => {
    if (mode === 'tahun') {
      return [1, 2, 3, 4].map(q => ({
        key: q,
        label: `Triwulan ${ROMAN_TRIWULAN[q - 1]}`,
        ids: weeks.filter(w => Number(w.triwulan_ke) === q).map(w => w.id),
      }))
    }
    return [1, 2, 3].map(i => {
      const b = (tw - 1) * 3 + i
      return { key: b, label: namaBulan(b), ids: weeks.filter(w => Number(w.bulan) === b).map(w => w.id) }
    })
  }, [mode, tw, weeks])

  const summary = METRICS.map(m => ({
    ...m,
    has: scoped.some(r => r.jenis_data_id === jdIdByKey[m.jd]), // sudah ada isian UPT untuk jenis data ini?
    total: sumMetric(m, weekIdsOrdered),
    perSub: subs.map(s => sumMetric(m, s.ids)),
  }))
  const hasData = scoped.length > 0
  const periodLabel = mode === 'tahun' ? `Tahun ${tahun}` : `Triwulan ${ROMAN_TRIWULAN[tw - 1]} ${tahun}`

  const chartData = subs.map((s, i) => ({
    name: s.label,
    masyarakat: summary[0].perSub[i],
    aparatur: summary[1].perSub[i],
  }))

  // Tabel per Jenis Data mingguan: baris = UPT, kolom = seluruh kolom angka (dijumlahkan)
  const jdTables = useMemo(() => {
    const list = jdId === 'all' ? jenisData : jenisData.filter(j => j.id === jdId)
    return list.map(jd => {
      const fields = fieldDefs.filter(f => f.jenis_data_id === jd.id && f.tipe === 'angka')
      const jdRows = scoped.filter(r => r.jenis_data_id === jd.id)
      const perUpt = scopeUpts.map(u => {
        const totals = {}
        fields.forEach(f => {
          totals[f.field_key] = uptFieldValue(jd.id, u.key, f.field_key, weekIdsOrdered)
        })
        const filled = new Set(jdRows.filter(r => r.upt_key === u.key).map(r => r.period_id)).size
        return { upt: u, totals, filled }
      })
      const grand = {}
      fields.forEach(f => { grand[f.field_key] = combineUpt(perUpt.map(p => p.totals[f.field_key]), agregasiOf(f)) })
      return { jd, fields, perUpt, grand, filledWeeks: new Set(jdRows.map(r => r.period_id)).size }
    })
  }, [jenisData, jdId, fieldDefs, scoped, scopeUpts, weekKey])

  function handleExport() {
    const wb = XLSX.utils.book_new()
    const ringkasan = sanitizeRows(summary.map(m => {
      const row = { Indikator: m.label }
      subs.forEach((s, i) => { row[s.label] = m.perSub[i] })
      row[`Total ${periodLabel}`] = m.total
      return row
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ringkasan), 'Ringkasan')

    jdTables.forEach(t => {
      if (!t.fields.length) return
      const data = t.perUpt.map(p => {
        const row = { UPT: p.upt.label, 'Minggu Terisi': p.filled }
        t.fields.forEach(f => { row[f.label] = p.totals[f.field_key] })
        return row
      })
      if (t.perUpt.length > 1) {
        const row = { UPT: 'TOTAL', 'Minggu Terisi': '' }
        t.fields.forEach(f => { row[f.label] = t.grand[f.field_key] })
        data.push(row)
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sanitizeRows(data)), t.jd.judul.slice(0, 31))
    })

    const who = isAdmin ? (uptFilter === 'all' ? 'SemuaUPT' : (uptList.find(u => u.key === uptFilter)?.label || uptFilter)) : (uptList.find(u => u.key === uptKey)?.label || uptKey)
    XLSX.writeFile(wb, `Rekap_${periodLabel}_${who}.xlsx`.replace(/\s+/g, '_'))
  }

  const loading = loadingMeta || loadingRows

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-semibold text-2xl text-gray-900 dark:text-white">Rekap Triwulan & Tahun</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
              {isAdmin
                ? 'Dihitung otomatis dari data mingguan seluruh UPT.'
                : 'Dihitung otomatis dari data mingguan UPT Anda.'}
            </p>
          </div>
          <button onClick={handleExport} disabled={!hasData} className="btn-primary whitespace-nowrap self-start md:self-auto disabled:opacity-40">
            <Download size={15} />
            <span>Download Excel</span>
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          <Filter size={14} className="text-blue-500" />
          <span>Filter Periode</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[['triwulan', 'Triwulan'], ['tahun', 'Tahunan']].map(([k, text]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                mode === k
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {text}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="form-label text-xs">Tahun</label>
            <select value={tahun} onChange={e => setTahun(Number(e.target.value))} className="form-select text-sm w-full">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {mode === 'triwulan' && (
            <div>
              <label className="form-label text-xs">Triwulan</label>
              <select value={tw} onChange={e => setTw(Number(e.target.value))} className="form-select text-sm w-full">
                {[1, 2, 3, 4].map(q => <option key={q} value={q}>Triwulan {ROMAN_TRIWULAN[q - 1]} {tahun}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="form-label text-xs">Unit Pelaksana Teknis (UPT)</label>
            {isAdmin ? (
              <select value={uptFilter} onChange={e => setUptFilter(e.target.value)} className="form-select text-sm w-full">
                <option value="all">Semua UPT ({uptList.length} Balai)</option>
                {uptList.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
              </select>
            ) : (
              <div className="h-[38px] px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold flex items-center truncate">
                {uptList.find(u => u.key === uptKey)?.label || uptKey}
              </div>
            )}
          </div>
          <div>
            <label className="form-label text-xs">Jenis Data (Mingguan)</label>
            <select value={jdId} onChange={e => setJdId(e.target.value)} className="form-select text-sm w-full">
              <option value="all">Semua Jenis Data ({jenisData.length})</option>
              {jenisData.map(j => <option key={j.id} value={j.id}>{j.judul}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Periode: <strong className="text-gray-600 dark:text-gray-300">{periodLabel}</strong> · direkap dari {weeks.length} minggu pelaporan
        </p>
      </div>

      {loading ? (
        <div className="card flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : (
        <>
          {/* Kartu ringkasan */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-3">Ringkasan {periodLabel}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard icon={Users} color="bg-blue-600" label="Masyarakat Dilatih" value={summary[0].has ? summary[0].total.toLocaleString('id-ID') : '–'} note={summary[0].has ? '' : 'Menunggu input UPT'} />
              <StatCard icon={Landmark} color="bg-emerald-500" label="Aparatur Dilatih" value={summary[1].has ? summary[1].total.toLocaleString('id-ID') : '–'} note={summary[1].has ? '' : 'Menunggu input UPT'} />
              <StatCard icon={GraduationCap} color="bg-amber-500" label="SDM Pelatih (Instruktur & Widyaiswara)" value={summary[2].has ? summary[2].total.toLocaleString('id-ID') : '–'} note={summary[2].has ? '' : 'Menunggu input UPT'} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              {summary.slice(3).map(m => (
                <div key={m.id} className="card p-4">
                  <p className="text-xs text-gray-500">{m.label}</p>
                  <p className={`text-2xl font-bold tabular-nums ${m.bold ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>
                    {m.has ? formatRp(m.total) : '–'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {!hasData ? (
            <div className="card p-8 text-center text-sm text-gray-400">
              <Hourglass size={28} className="mx-auto mb-2 opacity-40" />
              Belum ada data mingguan pada {periodLabel}{isAdmin && uptFilter === 'all' ? '' : ' untuk UPT ini'}. Rekap akan tampil otomatis setelah UPT mengisi di menu Input Mingguan.
            </div>
          ) : (
            <>
              {/* Rincian per sub-periode + grafik */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="card overflow-x-auto lg:col-span-3">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <h4 className="font-semibold text-sm">Rincian per {mode === 'tahun' ? 'Triwulan' : 'Bulan'}</h4>
                    <p className="text-[11px] text-gray-400">Realisasi & jumlah SDM = nilai kumulatif di akhir {mode === 'tahun' ? 'triwulan' : 'bulan'}; kolom Total = nilai terakhir periode.</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/40 text-xs uppercase tracking-wide text-gray-500">
                        <th className="text-left py-2.5 px-3">Indikator</th>
                        {subs.map(s => <th key={s.key} className="text-right py-2.5 px-3 whitespace-nowrap">{s.label}</th>)}
                        <th className="text-right py-2.5 px-3">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {summary.map(m => (
                        <tr key={m.id} className={m.bold ? 'bg-gray-50 dark:bg-gray-800/50 font-semibold' : ''}>
                          <td className="py-2.5 px-3">{m.label}</td>
                          {m.perSub.map((v, i) => <td key={i} className="py-2.5 px-3 text-right font-mono whitespace-nowrap">{m.has ? fmt(v, m.rp) : '–'}</td>)}
                          <td className="py-2.5 px-3 text-right font-mono font-semibold whitespace-nowrap">{m.has ? fmt(m.total, m.rp) : '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="card p-4 lg:col-span-2">
                  <h4 className="text-sm font-semibold mb-3">Peserta Dilatih per {mode === 'tahun' ? 'Triwulan' : 'Bulan'}</h4>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="masyarakat" name="Masyarakat" fill="#1B5FA8" />
                        <Bar dataKey="aparatur" name="Aparatur" fill="#2F9E6E" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Tabel per Jenis Data */}
              <div className="space-y-4">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Rekap per Jenis Data — {periodLabel}</h2>
                {jdTables.map(t => (
                  <div key={t.jd.id} className="card overflow-x-auto">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
                      <h4 className="font-semibold text-sm">{t.jd.judul}</h4>
                      <span className="text-xs text-gray-400">{t.filledWeeks} dari {weeks.length} minggu terisi</span>
                    </div>
                    {t.fields.length === 0 ? (
                      <p className="p-4 text-xs text-gray-400">Jenis data ini tidak memiliki kolom angka untuk dijumlahkan.</p>
                    ) : t.filledWeeks === 0 ? (
                      <p className="p-4 text-xs text-gray-400 flex items-center gap-1.5"><Hourglass size={12} /> Menunggu input UPT untuk periode ini.</p>
                    ) : (
                      <table className="text-xs" style={{ minWidth: 'max-content', width: '100%' }}>
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800/40 uppercase tracking-wide text-gray-500">
                            <th className="text-left py-2.5 px-3 whitespace-nowrap">UPT/Balai</th>
                            <th className="text-right py-2.5 px-3 whitespace-nowrap">Minggu Terisi</th>
                            {t.fields.map(f => (
                              <th key={f.id} className="text-right py-2.5 px-3 whitespace-nowrap">
                                {f.label}
                                <span className="block text-[9px] normal-case font-normal text-gray-400">{AGREGASI_SHORT[agregasiOf(f)]}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {t.perUpt.map(p => (
                            <tr key={p.upt.key} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                              <td className="py-2.5 px-3 font-medium whitespace-nowrap">{p.upt.label}</td>
                              <td className="py-2.5 px-3 text-right font-mono">{p.filled}/{weeks.length}</td>
                              {t.fields.map(f => <td key={f.id} className="py-2.5 px-3 text-right font-mono whitespace-nowrap">{fmt(p.totals[f.field_key], isRp(f))}</td>)}
                            </tr>
                          ))}
                          {t.perUpt.length > 1 && (
                            <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold">
                              <td className="py-2.5 px-3">TOTAL</td>
                              <td className="py-2.5 px-3" />
                              {t.fields.map(f => <td key={f.id} className="py-2.5 px-3 text-right font-mono whitespace-nowrap">{fmt(t.grand[f.field_key], isRp(f))}</td>)}
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
                <p className="text-[11px] text-gray-400">
                  Tiap kolom direkap sesuai cara rekapnya: angka kumulatif (pagu, realisasi, jumlah SDM) memakai <strong>nilai terakhir</strong>, angka lain dijumlahkan. Cara rekap dapat diatur Admin di Kelola Jenis Data.
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
