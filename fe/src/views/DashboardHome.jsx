/**
 * views/DashboardHome.jsx
 * Dashboard utama: ringkasan mingguan (dari isian data UPT) dan status pengisian. Isi kartu/grafik diatur Admin (Kelola Dashboard).
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
  Users, Landmark, GraduationCap, Calendar, BarChart3, Activity, ChevronLeft, ChevronRight,
  Clock, ClipboardList, Database, FileText, CheckCircle2, Hourglass, Loader2
} from 'lucide-react'

// Kunci Jenis Data bawaan yang menjadi sumber angka dashboard
const JD_MASYARAKAT = 'masyarakat'
const JD_APARATUR = 'aparatur'
const JD_INSTRUKTUR = 'data_instruktur_dan_wi'
const JD_SUMBER_DANA = 'data_capaian_anggaran_per_sumber_dana'

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0)
const formatRp = n => `Rp ${num(n).toLocaleString('id-ID')}`


import PageHeader from '../components/PageHeader'

export default function DashboardHome({ onNavigate }) {
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
    const { data } = await db
      .from('rekap_nilai')
      .select('period_id, jenis_data_id, upt_key, field_key, value' + ((await getFeatures()).terlambat ? ', terlambat' : ''))
      .in('period_id', ids.length ? ids : [id])
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

  // Nilai: kolom kumulatif = nilai terakhir tiap UPT sampai minggu terpilih; kolom lain = jumlah minggu terpilih
  const sum = (jdKey, field, uptFilter) => {
    if (!cumulative(jdKey, field)) return matching(jdKey, field, uptFilter, rows).reduce((a, r) => a + num(r.value), 0)
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
  const uptsOf = it => new Set(matching(it.jd, it.field, null, cumulative(it.jd, it.field) ? rowsAll : rows).map(r => r.upt_key))
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
                    <p className={`text-2xl font-bold tabular-nums ${c.sorot ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>
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
          {charts.map(w => (
            <div key={w.id} className="card p-4">
              <h4 className="text-sm font-semibold mb-3">{w.judul} {isAdmin ? 'per UPT/Balai' : ''}</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData(w)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip formatter={v => fmt(w.satuan, v)} />
                    <Legend />
                    {(w.konfigurasi?.series || []).map((sr, i) => <Bar key={i} dataKey={sr.label} name={sr.label} fill={sr.warna || '#1B5FA8'} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Status pengisian data UPT untuk minggu terpilih */}
      <InfoCard title={`Status Pengisian Data — ${activeWeek ? formatPeriodLabel(activeWeek) : '-'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 uppercase tracking-wide">
                <th className="py-2 pr-3 font-semibold">UPT/Balai</th>
                {jenisData.map(j => (
                  <th key={j.id} className="py-2 px-2 font-semibold text-center">{j.judul}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {scopeUpts.length === 0 ? (
                <tr><td colSpan={jenisData.length + 1} className="py-4 text-center text-gray-400">Belum ada UPT.</td></tr>
              ) : scopeUpts.map(u => (
                <tr key={u.key}>
                  <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{u.label}</td>
                  {jenisData.map(j => {
                    const done = rows.some(r => r.upt_key === u.key && r.jenis_data_id === j.id)
                    return (
                      <td key={j.id} className="py-2 px-2 text-center">
                        {loadingRekap ? '…' : done ? (
                          rows.some(r => r.upt_key === u.key && r.jenis_data_id === j.id && r.terlambat) ? (
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium" title="Diisi setelah deadline">
                              <CheckCircle2 size={13} /> Terlambat
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 size={13} /> Sudah
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400">
                            <Hourglass size={12} /> Menunggu
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </InfoCard>

      {/* Akses cepat */}
      <InfoCard title="Akses Cepat">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Database, label: 'Input Mingguan', page: 'input-mingguan', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
            { icon: Calendar, label: 'Input Bulanan', page: 'input-bulanan', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' },
            { icon: BarChart3, label: 'Rekap Triwulan & Tahun', page: 'rekap-triwulan-tahun', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
            { icon: FileText, label: 'Dokumen & Arsip', page: 'dokumen-arsip', color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/30' },
          ].map(item => (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all duration-200 group"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform`}>
                <item.icon size={20} />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-400 text-center">{item.label}</span>
            </button>
          ))}
        </div>
      </InfoCard>
    </div>
  )
}
