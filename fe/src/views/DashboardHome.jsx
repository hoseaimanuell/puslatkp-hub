/**
 * views/DashboardHome.jsx
 * Dashboard utama: ringkasan mingguan (dari isian data UPT) dan status pengisian. Isi kartu/grafik diatur Admin (Kelola Dashboard).
 * Tiap kartu grafik punya tombol untuk beralih tampilan grafik batang / tabel angka (state lokal, tidak disimpan).
 * Akun UPT hanya melihat data UPT-nya sendiri; Admin melihat semua UPT.
 */
import { useState, useEffect, useMemo } from 'react'
import { db, getFeatures } from '../lib/db'
import { useAuth } from '../AuthContext'
import StatCard from '../components/StatCard'
import InfoCard from '../components/InfoCard'
import Badge from '../components/Badge'
import { formatPeriodLabel, sortPeriods, pickCurrentPeriod } from '../lib/periods'
import { ICONS, DEFAULT_WIDGETS, groupWidgets } from '../lib/dashboardWidgets'
import { agregasiOf } from '../lib/agregasi'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  Users, Landmark, GraduationCap, BarChart3, ChevronLeft, ChevronRight, Hourglass, Loader2, Table2
} from 'lucide-react'

// Kunci Jenis Data bawaan yang menjadi sumber angka dashboard
const JD_MASYARAKAT = 'masyarakat'
const JD_APARATUR = 'aparatur'
const JD_INSTRUKTUR = 'data_instruktur_dan_wi'
const JD_SUMBER_DANA = 'data_capaian_anggaran_per_sumber_dana'

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0)
const formatRp = n => `Rp ${num(n).toLocaleString('id-ID')}`
const COMPACT = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 })
const compactNumber = (satuan, v) => (satuan === 'rupiah' ? 'Rp ' : '') + COMPACT.format(num(v))


import PageHeader from '../components/PageHeader'

export default function DashboardHome() {
  const { isAdmin, uptKey, profile } = useAuth()

  // Data mingguan dari isian UPT
  const [weeks, setWeeks] = useState([])
  const [periodId, setPeriodId] = useState('')
  const [tahun, setTahun] = useState(null)
  const [uptList, setUptList] = useState([])
  const [jenisData, setJenisData] = useState([])
  const [rekap, setRekap] = useState([])
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS)
  const [fieldDefs, setFieldDefs] = useState([])
  const [loadingRekap, setLoadingRekap] = useState(true)
  const [chartView, setChartView] = useState({}) // widget.id -> 'grafik' | 'tabel'

  useEffect(() => {
    loadMeta()
  }, [])

  useEffect(() => {
    if (periodId && weeks.length) loadRekap(periodId)
  }, [periodId, weeks])

  async function loadMeta() {
    const feat = await getFeatures()
    if (feat.dashboard) {
      const { data: w } = await db.from('dashboard_widgets').select('*').order('urutan')
      if (w && w.length) setWidgets(w) // kosong = pakai tampilan bawaan
    }
    const [{ data: p }, { data: upts }, { data: jds }, { data: fdefs }] = await Promise.all([
      db.from('periods').select('*').eq('level', 'minggu'),
      db.from('upt_list').select('*').eq('aktif', true).order('label'),
      db.from('jenis_data').select('*').eq('aktif', true).order('created_at'),
      db.from('field_definitions').select('*').eq('level', 'minggu'),
    ])
    setFieldDefs(fdefs || [])
    const list = sortPeriods(p || [])
    setWeeks(list)
    setUptList(upts || [])
    setJenisData((jds || []).filter(j => j.level_utama === 'minggu'))

    // Default: minggu yang sedang berjalan; jika tidak ada, minggu terakhir yang sudah lewat
    const def = pickCurrentPeriod(list)
    if (def) { setPeriodId(def.id); setTahun(Number(def.tahun)) }
    else setLoadingRekap(false)
  }

  async function loadRekap(id) {
    setLoadingRekap(true)
    // Angka kumulatif (pagu, realisasi, ...) memakai nilai terakhir sampai minggu terpilih, jadi ambil minggu-minggu sebelumnya di tahun yang sama
    const sel = weeks.find(w => w.id === id)
    const upTo = sel ? weeks.filter(w => Number(w.tahun) === Number(sel.tahun)) : []
    const ids = upTo.slice(0, upTo.findIndex(w => w.id === id) + 1).map(w => w.id)
    const feat = await getFeatures()
    let q = db
      .from('rekap_nilai')
      .select('period_id, jenis_data_id, upt_key, field_key, value' + (feat.terlambat ? ', terlambat' : ''))
      .in('period_id', ids.length ? ids : [id])
    // Baris yang masih menunggu persetujuan Admin belum dihitung di Dashboard (total resmi).
    if (feat.persetujuanBaris) q = q.eq('status', 'disetujui')
    const { data } = await q
    setRekap(data || [])
    setLoadingRekap(false)
  }

  const weekIdx = weeks.findIndex(w => w.id === periodId)
  const activeWeek = weeks[weekIdx] || null

  // Filter tahun: daftar minggu hanya menampilkan minggu pada tahun terpilih
  const years = useMemo(() => [...new Set(weeks.map(w => Number(w.tahun)))].sort((a, b) => a - b), [weeks])
  const weeksThisYear = useMemo(() => weeks.filter(w => Number(w.tahun) === Number(tahun)), [weeks, tahun])
  const goWeek = w => { if (w) { setPeriodId(w.id); setTahun(Number(w.tahun)) } }
  const pickYear = y => { const ws = weeks.filter(w => Number(w.tahun) === y); goWeek(pickCurrentPeriod(ws) || ws[0]) }

  // UPT yang tampil: Admin = semua UPT aktif; akun UPT = hanya UPT-nya
  const scopeUpts = useMemo(
    () => (isAdmin ? uptList : uptList.filter(u => u.key === uptKey)),
    [isAdmin, uptList, uptKey]
  )
  const scopeKeys = useMemo(() => new Set(scopeUpts.map(u => u.key)), [scopeUpts])

  const jdIdByKey = useMemo(() => {
    const m = {}
    jenisData.forEach(j => { m[j.key] = j.id })
    return m
  }, [jenisData])

  // Baris rekap milik UPT yang masih ada (UPT yang dihapus otomatis tidak ikut)
  const rowsAll = useMemo(() => rekap.filter(r => scopeKeys.has(r.upt_key)), [rekap, scopeKeys]) // minggu-minggu sampai yang dipilih
  const rows = useMemo(() => rowsAll.filter(r => r.period_id === periodId), [rowsAll, periodId]) // hanya minggu terpilih

  const weekOrder = useMemo(() => Object.fromEntries(weeks.map((w, i) => [w.id, i])), [weeks])
  const modeOf = (jdKey, field) => agregasiOf(fieldDefs.find(f => f.jenis_data_id === jdIdByKey[jdKey] && f.field_key === field) || { field_key: field })
  const cumulative = (jdKey, field) => modeOf(jdKey, field) === 'last'
  const matching = (jdKey, field, uptFilter, list) => list.filter(r => r.jenis_data_id === jdIdByKey[jdKey] && r.field_key === field && (!uptFilter || r.upt_key === uptFilter))

  // Nilai: kolom kumulatif = nilai terakhir tiap UPT sampai minggu terpilih; kolom lain = jumlah seluruh minggu dari minggu 1 tahun berjalan sampai minggu terpilih
  const sum = (jdKey, field, uptFilter) => {
    if (!cumulative(jdKey, field)) return matching(jdKey, field, uptFilter, rowsAll).reduce((a, r) => a + num(r.value), 0)
    const perUpt = {}
    matching(jdKey, field, uptFilter, rowsAll).filter(r => r.value !== null && r.value !== undefined).forEach(r => {
      const o = weekOrder[r.period_id] ?? -1
      const cur = perUpt[r.upt_key]
      if (!cur || o > cur.o) perUpt[r.upt_key] = { o, v: num(r.value) }
      else if (o === cur.o) cur.v += num(r.value)
    })
    return Object.values(perUpt).reduce((a, x) => a + x.v, 0)
  }

  // UPT mana saja yang sudah mengisi jenis data tertentu pada minggu terpilih
  const filledUpts = jdKey => new Set(rows.filter(r => r.jenis_data_id === jdIdByKey[jdKey]).map(r => r.upt_key))

  const waitingNote = isAdmin ? 'Menunggu input UPT' : 'Menunggu input UPT Anda'
  const filledNote = jdKey => {
    const n = filledUpts(jdKey).size
    return isAdmin ? `${n} dari ${scopeUpts.length} UPT sudah input` : 'Sudah diinput UPT Anda'
  }

  // Nilai widget = jumlah baris rekap (minggu terpilih) untuk semua sumber {jd, field}; per UPT bila uptFilter diisi
  const sumItems = (items = [], uptFilter) => items.reduce((a, it) => a + sum(it.jd, it.field, uptFilter), 0)
  const uptsOf = it => new Set(matching(it.jd, it.field, null, rowsAll).map(r => r.upt_key))
  const hasItems = (items = []) => items.some(it => uptsOf(it).size > 0)
  const fmt = (satuan, v) => (satuan === 'rupiah' ? formatRp(v) : num(v).toLocaleString('id-ID'))
  const groups = useMemo(() => groupWidgets(widgets), [widgets])
  const charts = groups.flatMap(g => g.widgets.filter(w => w.tipe === 'grafik'))
  const chartData = w => scopeUpts.map(u => {
    const row = { name: u.label }
    ;(w.konfigurasi?.series || []).forEach(sr => { row[sr.label] = sumItems(sr.items, u.key) })
    return row
  })
  const noteFor = items => {
    const n = new Set((items || []).flatMap(it => [...uptsOf(it)])).size
    return isAdmin ? `${n} dari ${scopeUpts.length} UPT sudah input` : 'Sudah diinput UPT Anda'
  }
  const anyData = rowsAll.length > 0

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard"
        description={`${profile?.nama_lengkap || 'Pengguna'} · ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${isAdmin ? ' · Admin' : uptKey ? ` · ${uptKey}` : ''}`}
      />

      {/* Filter mingguan — di bagian atas, berlaku untuk seluruh angka & grafik di bawahnya */}
      <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Periode Mingguan</h3>
          {activeWeek && (
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(activeWeek.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              {' – '}
              {new Date(activeWeek.tanggal_selesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' · batas pengisian '}
              {new Date(activeWeek.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary text-xs px-2 py-2"
            disabled={weekIdx <= 0}
            onClick={() => goWeek(weeks[weekIdx - 1])}
            title="Minggu sebelumnya"
          >
            <ChevronLeft size={14} />
          </button>
          {years.length > 1 && (
            <select
              className="form-select text-sm"
              value={tahun ?? ''}
              onChange={e => pickYear(Number(e.target.value))}
              title="Tahun"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          <select
            className="form-select text-sm"
            value={periodId}
            onChange={e => setPeriodId(e.target.value)}
          >
            {weeksThisYear.map(w => (
              <option key={w.id} value={w.id}>{formatPeriodLabel(w)}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary text-xs px-2 py-2"
            disabled={weekIdx < 0 || weekIdx >= weeks.length - 1}
            onClick={() => goWeek(weeks[weekIdx + 1])}
            title="Minggu berikutnya"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Kartu & grafik — isi diatur Admin di menu Kelola Dashboard */}
      {groups.filter(g => g.widgets.some(w => w.tipe === 'kartu')).map(g => (
        <div key={g.nama}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-3">
            {g.nama}{g.widgets.some(w => w.gaya === 'berwarna') && ` — ${activeWeek ? formatPeriodLabel(activeWeek) : '-'}`}
          </h3>
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${g.widgets.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            {g.widgets.filter(w => w.tipe === 'kartu').map(w => {
              const c = w.konfigurasi || {}
              const has = hasItems(c.items)
              const value = sumItems(c.items)
              if (w.gaya === 'putih') {
                return (
                  <div key={w.id} className="card p-4">
                    <p className="text-xs text-gray-500">{w.judul}</p>
                    <p className={`text-2xl font-bold font-display tabular-nums ${c.sorot ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>
                      {loadingRekap ? '…' : has ? fmt(w.satuan, value) : '–'}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {loadingRekap ? '' : has ? (c.pembanding?.length ? `${c.pembandingLabel || 'Pembanding'} ${fmt(w.satuan, sumItems(c.pembanding))}` : noteFor(c.items)) : waitingNote}
                    </p>
                  </div>
                )
              }
              return (
                <StatCard
                  key={w.id}
                  icon={ICONS[w.ikon] || BarChart3}
                  color={w.warna || 'bg-blue-600'}
                  label={w.judul}
                  value={loadingRekap ? '…' : has ? fmt(w.satuan, value) : '–'}
                  note={loadingRekap ? '' : has ? noteFor(c.items) : waitingNote}
                />
              )
            })}
          </div>
        </div>
      ))}

      {/* Grafik */}
      {charts.length > 0 && (loadingRekap ? (
        <div className="card flex justify-center py-10">
          <Loader2 className="animate-spin text-gray-400" />
        </div>
      ) : !anyData ? (
        <div className="card p-6 text-center text-sm text-gray-400">
          <Hourglass size={28} className="mx-auto mb-2 opacity-40" />
          {isAdmin
            ? 'Menunggu UPT memasukkan data untuk minggu ini. Grafik akan tampil otomatis setelah ada isian.'
            : 'Menunggu Anda memasukkan data untuk minggu ini di menu Input Mingguan.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {charts.map(w => {
            const view = chartView[w.id] || 'grafik'
            const series = w.konfigurasi?.series || []
            const data = chartData(w)
            return (
              <div key={w.id} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold">{w.judul} {isAdmin ? 'per UPT/Balai' : ''}</h4>
                  <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0">
                    <button
                      type="button"
                      className={`p-1.5 ${view === 'grafik' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-700'}`}
                      onClick={() => setChartView(v => ({ ...v, [w.id]: 'grafik' }))}
                      title="Tampilkan sebagai grafik"
                    >
                      <BarChart3 size={14} />
                    </button>
                    <button
                      type="button"
                      className={`p-1.5 ${view === 'tabel' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-700'}`}
                      onClick={() => setChartView(v => ({ ...v, [w.id]: 'tabel' }))}
                      title="Tampilkan sebagai tabel angka"
                    >
                      <Table2 size={14} />
                    </button>
                  </div>
                </div>
                {view === 'tabel' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200 dark:border-gray-700">
                          <th className="py-2 px-2">UPT/Balai</th>
                          {series.map((sr, i) => <th key={i} className="py-2 px-2 text-right">{sr.label}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {data.map((row, i) => (
                          <tr key={i}>
                            <td className="py-2 px-2">{row.name}</td>
                            {series.map((sr, j) => <td key={j} className="py-2 px-2 text-right tabular-nums">{fmt(w.satuan, row[sr.label])}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  // Batang horizontal: nama UPT di sumbu kiri (terbaca utuh, tidak miring/bertumpuk); tinggi
                  // mengikuti jumlah UPT supaya 18 UPT tidak berdesakan.
                  <div style={{ height: Math.max(160, data.length * (14 + series.length * 12) + 70) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }} barCategoryGap="22%">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E3E8EF" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => compactNumber(w.satuan, v)} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" width={132} tick={{ fontSize: 11, fill: '#334155' }} interval={0} axisLine={false} tickLine={false} />
                        <Tooltip formatter={v => fmt(w.satuan, v)} cursor={{ fill: 'rgba(15, 82, 166, 0.06)' }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {series.map((sr, i) => <Bar key={i} dataKey={sr.label} name={sr.label} fill={sr.warna || '#1B5FA8'} radius={[0, 4, 4, 0]} maxBarSize={14} />)}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
