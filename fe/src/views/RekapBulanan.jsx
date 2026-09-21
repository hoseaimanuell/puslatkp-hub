/**
 * views/RekapBulanan.jsx
 * Halaman Rekapitulasi Data Bulanan PUSLATKP
 * Menampilkan akumulasi 4 minggu per bulan, verifikasi kelengkapan pelaporan,
 * rincian data per jenis data & UPT, serta fitur ekspor Excel bulanan terpadu.
 */
import { Fragment, useState, useEffect, useMemo } from 'react'
import { db } from '../lib/db'
import { useAuth } from '../AuthContext'
import Badge from '../components/Badge'
import {
  formatPeriodLabel,
  labelBulan,
  namaBulan,
  sortPeriods,
  weeksOfMonth,
} from '../lib/periods'
import * as XLSX from 'xlsx'
import { sanitizeRows } from '../lib/excelExport'
import { weekValues, applyAgregasi, agregasiOf, aggregateRows, combineUpt } from '../lib/agregasi'
import {
  Calendar, Building2, Database, Download, Filter,
  CheckCircle2, AlertTriangle, FileSpreadsheet,
  Users, Target, TrendingUp, Layers, ChevronDown,
  ChevronRight, Calculator, FileText, Loader2, Eye, Sparkles, Search
} from 'lucide-react'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function formatRp(n) {
  return `Rp ${Number(n || 0).toLocaleString('id-ID')}`
}

export default function RekapBulanan({ onNavigate }) {
  const { isAdmin, uptKey, profile } = useAuth()

  // Filter states
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [bulan, setBulan] = useState(() => new Date().getMonth() + 1)
  const [selectedUpt, setSelectedUpt] = useState(isAdmin ? 'all' : (uptKey || 'all'))
  const [selectedJdId, setSelectedJdId] = useState('all')

  // Data states
  const [periods, setPeriods] = useState([])
  const [uptList, setUptList] = useState([])
  const [jenisDataList, setJenisDataList] = useState([])
  const [fieldDefs, setFieldDefs] = useState([])
  const [rekapRows, setRekapRows] = useState([])
  const [dataEntries, setDataEntries] = useState([])
  const [uploadedDocs, setUploadedDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedJd, setExpandedJd] = useState({})
  // 'rekap' = akumulasi 4 minggu semua UPT; 'nama' = data by name hasil unggahan satu UPT
  const [tampilan, setTampilan] = useState('rekap')

  // Load Metadata
  useEffect(() => {
    loadMetadata()
  }, [])

  // When filters change, load data
  useEffect(() => {
    if (periods.length > 0) {
      loadBulananData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahun, bulan, periods.length])

  async function loadMetadata() {
    setLoading(true)
    const [{ data: p }, { data: upts }, { data: jds }, { data: fields }] = await Promise.all([
      db.from('periods').select('*'),
      db.from('upt_list').select('*').eq('aktif', true).order('label'),
      db.from('jenis_data').select('*').eq('aktif', true).order('created_at'),
      db.from('field_definitions').select('*').eq('aktif', true).order('urutan'),
    ])

    const allPeriods = sortPeriods(p || [])
    setPeriods(allPeriods)
    // tahun bawaan: tahun berjalan bila periodenya ada, jika tidak tahun terakhir yang tersedia
    const ys = [...new Set(allPeriods.map(p => Number(p.tahun)))]
    if (ys.length && !ys.includes(new Date().getFullYear())) setTahun(Math.max(...ys))
    setUptList(upts || [])
    setJenisDataList(jds || [])
    setFieldDefs(fields || [])

    // Default expanded state: first 3 jenis data open
    const initExpanded = {}
    ;(jds || []).slice(0, 3).forEach(j => { initExpanded[j.id] = true })
    setExpandedJd(initExpanded)

    setLoading(false)
  }

  // Pilihan tahun mengikuti periode yang ada di database
  const years = useMemo(() => {
    const y = [...new Set(periods.map(p => Number(p.tahun)))].sort((a, b) => a - b)
    return y.length ? y : [tahun]
  }, [periods, tahun])

  // 4 Minggu dalam bulan terpilih
  const currentWeeks = useMemo(() => {
    return weeksOfMonth(periods, tahun, bulan)
  }, [periods, tahun, bulan])

  const currentMonthPeriod = useMemo(() => {
    return periods.find(p => p.level === 'bulan' && Number(p.tahun) === Number(tahun) && Number(p.bulan) === Number(bulan))
  }, [periods, tahun, bulan])

  async function loadBulananData() {
    setLoading(true)
    const weekIds = currentWeeks.map(w => w.id)
    const monthPeriodId = currentMonthPeriod?.id

    const targetPeriodIds = [...weekIds]
    if (monthPeriodId) targetPeriodIds.push(monthPeriodId)

    const [{ data: rek }, { data: ent }, { data: docs }] = await Promise.all([
      db.from('rekap_nilai').select('*').in('period_id', targetPeriodIds),
      db.from('data_entries').select('*').in('period_id', targetPeriodIds),
      db.from('dokumen_upload').select('id, jenis_data_id, period_id, upt_key, judul, file_name, file_size, uploaded_by, created_at').in('period_id', targetPeriodIds),
    ])

    setRekapRows(rek || [])
    setDataEntries(ent || [])
    setUploadedDocs(docs || [])
    setLoading(false)
  }

  // ── Tampilan "Data by Name" (hasil unggahan Excel per UPT) ──
  // Hanya jenis data bulanan berbasis rincian per-orang; hanya SATU UPT sekaligus.
  const namaJdList = useMemo(
    () => jenisDataList.filter(j => j.level_utama === 'bulan' && j.mode_bulanan === 'rincian'),
    [jenisDataList]
  )
  const namaJd = namaJdList.find(j => j.id === selectedJdId) || null
  const namaUptKey = isAdmin ? (selectedUpt !== 'all' ? selectedUpt : '') : (uptKey || '')

  // Saat masuk mode "nama": paksa pilihan valid (satu jenis data rincian, satu UPT)
  useEffect(() => {
    if (tampilan !== 'nama') return
    if (!namaJdList.some(j => j.id === selectedJdId) && namaJdList.length) setSelectedJdId(namaJdList[0].id)
    if (isAdmin && selectedUpt === 'all' && uptList.length) setSelectedUpt(uptList[0].key)
  }, [tampilan, namaJdList, uptList, selectedJdId, selectedUpt, isAdmin])

  const namaFields = useMemo(
    () => (namaJd ? fieldDefs.filter(f => f.jenis_data_id === namaJd.id && f.level === 'bulan').sort((a, b) => (a.urutan || 0) - (b.urutan || 0)) : []),
    [fieldDefs, namaJd]
  )

  const namaEntries = useMemo(() => {
    if (!namaJd || !namaUptKey) return []
    const ids = new Set([currentMonthPeriod?.id, ...currentWeeks.map(w => w.id)])
    return dataEntries.filter(e => e.jenis_data_id === namaJd.id && e.upt_key === namaUptKey && ids.has(e.period_id))
  }, [dataEntries, namaJd, namaUptKey, currentMonthPeriod, currentWeeks])

  // Filter UPT yang relevan
  const effectiveUptList = useMemo(() => {
    if (!isAdmin && uptKey) {
      return uptList.filter(u => u.key === uptKey)
    }
    if (selectedUpt !== 'all') {
      return uptList.filter(u => u.key === selectedUpt)
    }
    return uptList
  }, [isAdmin, uptKey, selectedUpt, uptList])

  // Filter Jenis Data yang relevan
  const effectiveJdList = useMemo(() => {
    if (selectedJdId !== 'all') {
      return jenisDataList.filter(j => j.id === selectedJdId)
    }
    return jenisDataList
  }, [selectedJdId, jenisDataList])

  // Hitung metrik agregat total bulan ini
  const monthlyMetrics = useMemo(() => {
    let totalPeserta = 0
    let totalPelatihan = 0
    let totalPagu = 0
    let totalRealisasi = 0
    let totalDokumen = 0

    const uptKeys = new Set(effectiveUptList.map(u => u.key))

    // Rekap tiap kolom sesuai cara rekapnya (pagu/realisasi kumulatif = nilai terakhir; peserta = dijumlahkan)
    aggregateRows(rekapRows, currentWeeks.map(w => w.id), fieldDefs).forEach(r => {
      if (!uptKeys.has(r.upt_key)) return
      if (r.field_key === 'jumlah_peserta') totalPeserta += num(r.value)
      if (r.field_key.includes('pagu')) totalPagu += num(r.value)
      if (r.field_key.includes('realisasi_anggaran') || r.field_key === 'realisasi_anggaran') {
        totalRealisasi += num(r.value)
      }
      if (r.field_key === 'nama_pelatihan' && (r.value_text || r.value)) {
        totalPelatihan++
      }
    })

    uploadedDocs.forEach(d => {
      if (uptKeys.has(d.upt_key)) totalDokumen++
    })

    const entCount = dataEntries.filter(e => uptKeys.has(e.upt_key)).length
    if (totalPeserta === 0 && entCount > 0) {
      totalPeserta = entCount
    }

    const persentaseSerapan = totalPagu > 0 ? ((totalRealisasi / totalPagu) * 100).toFixed(1) : 0

    return {
      totalPeserta,
      totalPelatihan,
      totalPagu,
      totalRealisasi,
      persentaseSerapan,
      totalDokumen,
    }
  }, [rekapRows, uploadedDocs, effectiveUptList, currentWeeks, fieldDefs])

  // Bangun tabel rekap per jenis data
  const recapPerJenisData = useMemo(() => {
    return effectiveJdList.map(jd => {
      const isBulanUpload = jd.mode_bulanan === 'upload_file'
      const isBulanAgregasi = jd.mode_bulanan === 'agregasi' || (jd.level_utama === 'bulan' && jd.pasangan_mingguan_id != null)
      const partnerId = jd.pasangan_mingguan_id

      // Target field definitions
      const jdTargetId = isBulanAgregasi && partnerId ? partnerId : jd.id
      const jFields = fieldDefs.filter(f => f.jenis_data_id === jdTargetId && f.aktif).sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
      const angkaFields = jFields.filter(f => f.tipe === 'angka')
      const otherFields = jFields.filter(f => f.tipe !== 'angka')

      // Hitung data per UPT untuk jenis data ini
      const uptBreakdown = effectiveUptList.map(upt => {
        // Ambil nilai 4 minggu (semua field)
        const weekData = currentWeeks.map(w => {
          const rows = rekapRows.filter(r =>
            r.upt_key === upt.key &&
            r.period_id === w.id &&
            r.jenis_data_id === jdTargetId
          )
          const vals = weekValues(rows) // beberapa pelatihan dalam 1 minggu: angka dijumlahkan, teks digabung
          return {
            period: w,
            values: vals,
            hasData: rows.length > 0,
          }
        })

        // Total akumulasi angka 4 minggu
        const totals = {}
        angkaFields.forEach(f => {
          totals[f.field_key] = applyAgregasi(weekData.map(wd => wd.values[f.field_key]), agregasiOf(f)) ?? 0
        })

        // Hitung baris entries jika ada
        const entCount = dataEntries.filter(e =>
          e.upt_key === upt.key &&
          e.jenis_data_id === jd.id &&
          (e.period_id === currentMonthPeriod?.id || currentWeeks.some(w => w.id === e.period_id))
        ).length

        // Hitung dokumen terunggah
        const docs = uploadedDocs.filter(d =>
          d.upt_key === upt.key &&
          d.jenis_data_id === jd.id &&
          (d.period_id === currentMonthPeriod?.id || currentWeeks.some(w => w.id === d.period_id))
        )

        const filledWeeksCount = weekData.filter(w => w.hasData).length
        const isComplete = isBulanUpload ? docs.length > 0 : filledWeeksCount >= 4

        return {
          upt_key: upt.key,
          upt_label: upt.label,
          weekData,
          totals,
          entCount,
          docs,
          filledWeeksCount,
          isComplete,
        }
      })

      // Total kumulatif seluruh UPT untuk jenis data ini
      const summaryTotals = {}
      angkaFields.forEach(f => {
        summaryTotals[f.field_key] = combineUpt(uptBreakdown.map(u => u.totals[f.field_key]), agregasiOf(f))
      })

      const totalDocsUploaded = uptBreakdown.reduce((acc, u) => acc + u.docs.length, 0)
      const totalUptComplete = uptBreakdown.filter(u => u.isComplete).length

      const matchingEntries = dataEntries.filter(e =>
        (e.jenis_data_id === jd.id || (partnerId && e.jenis_data_id === partnerId)) &&
        (selectedUpt === 'all' || e.upt_key === selectedUpt)
      )

      return {
        jenisData: jd,
        isBulanUpload,
        isBulanAgregasi,
        jFields,
        angkaFields,
        otherFields,
        uptBreakdown,
        summaryTotals,
        matchingEntries,
        totalDocsUploaded,
        totalUptComplete,
      }
    })
  }, [effectiveJdList, fieldDefs, effectiveUptList, currentWeeks, rekapRows, dataEntries, uploadedDocs, currentMonthPeriod])

  // Handle Export Excel Rekap Bulanan — semua kolom per minggu
  function handleExportExcel() {
    const periodName = `${namaBulan(bulan)} ${tahun}`
    const wb = XLSX.utils.book_new()

    recapPerJenisData.forEach(item => {
      const rows = []
      const headers = ['UPT', 'Minggu', ...item.jFields.map(f => f.label), 'Status']

      item.uptBreakdown.forEach(ub => {
        // Baris per minggu
        ub.weekData.forEach((wd, wIdx) => {
          const row = { UPT: ub.upt_label, Minggu: `M${wd.period?.minggu_ke || (wIdx + 1)}` }
          item.jFields.forEach(f => {
            const val = wd.values[f.field_key]
            row[f.label] = val !== undefined && val !== null ? val : ''
          })
          row['Status'] = wd.hasData ? 'Terisi' : 'Kosong'
          rows.push(row)
        })
        // Baris Total
        const totalRow = { UPT: ub.upt_label, Minggu: 'TOTAL' }
        item.jFields.forEach(f => {
          totalRow[f.label] = f.tipe === 'angka' ? (ub.totals[f.field_key] || 0) : ''
        })
        totalRow['Status'] = ub.isComplete ? 'Lengkap' : (ub.filledWeeksCount > 0 ? 'Sebagian' : 'Belum Ada')
        rows.push(totalRow)
      })

      if (rows.length > 0) {
        const ws = XLSX.utils.json_to_sheet(rows, { header: headers })
        const sheetName = item.jenisData.judul.slice(0, 31)
        XLSX.utils.book_append_sheet(wb, ws, sheetName)
      }
    })

    // Sheet ringkasan metadata
    const metaRows = [
      ['Laporan Rekapitulasi Data Bulanan PUSLATKP'],
      ['Periode', labelBulan(bulan, tahun)],
      ['Tahun', tahun],
      ['Filter UPT', selectedUpt === 'all' ? 'Semua UPT' : (uptList.find(u => u.key === selectedUpt)?.label || selectedUpt)],
      ['Filter Jenis Data', selectedJdId === 'all' ? 'Semua Jenis Data' : (jenisDataList.find(j => j.id === selectedJdId)?.judul || '')],
      ['Diekspor pada', new Date().toLocaleString('id-ID')],
    ]
    const wsMeta = XLSX.utils.aoa_to_sheet(metaRows)
    XLSX.utils.book_append_sheet(wb, wsMeta, 'Info')

    const filename = `RekapBulanan_${periodName}_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`
      .replace(/\s+/g, '_')
    XLSX.writeFile(wb, filename)
  }



  const toggleExpand = (id) => {
    setExpandedJd(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-semibold text-2xl text-gray-900 dark:text-white">
              Rekap Data Bulanan
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
              {isAdmin
                ? 'Akumulasi 4 minggu per bulan untuk seluruh UPT.'
                : 'Akumulasi 4 minggu per bulan untuk UPT Anda.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">

            {tampilan === 'rekap' && (
              <button
                onClick={handleExportExcel}
                className="btn-primary whitespace-nowrap self-start md:self-auto"
                title="Download kompilasi rekap bulanan dalam format Excel"
              >
                <Download size={15} />
                <span>Download Excel Bulanan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-4 shadow-sm border border-gray-100 dark:border-gray-800 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          <Filter size={14} className="text-blue-500" />
          <span>Filter Periode & Parameter Rekap</span>
        </div>

        {/* Pilihan tampilan */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            ['rekap', Layers, 'Rekap 4 Minggu'],
            ['nama', Users, 'Data by Name (Unggahan UPT)'],
          ].map(([mode, Icon, text]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTampilan(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                tampilan === mode
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Icon size={13} />
              <span>{text}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Tahun */}
          <div>
            <label className="form-label text-xs">Tahun</label>
            <select
              value={tahun}
              onChange={e => setTahun(Number(e.target.value))}
              className="form-select text-sm w-full"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Bulan */}
          <div>
            <label className="form-label text-xs">Bulan Rekap</label>
            <select
              value={bulan}
              onChange={e => setBulan(Number(e.target.value))}
              className="form-select text-sm w-full font-semibold text-blue-600 dark:text-blue-400"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>
                  {m}. {namaBulan(m)} {tahun}
                </option>
              ))}
            </select>
          </div>

          {/* UPT Selector */}
          <div>
            <label className="form-label text-xs">Unit Pelaksana Teknis (UPT)</label>
            {isAdmin ? (
              <select
                value={selectedUpt}
                onChange={e => setSelectedUpt(e.target.value)}
                className="form-select text-sm w-full"
              >
                {tampilan === 'rekap' && <option value="all">Semua UPT (10 Balai)</option>}
                {uptList.map(u => (
                  <option key={u.key} value={u.key}>{u.label}</option>
                ))}
              </select>
            ) : (
              <div className="h-[38px] px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold flex items-center gap-1.5 truncate">
                <Building2 size={14} className="text-blue-500 flex-shrink-0" />
                <span className="truncate">{uptList.find(u => u.key === uptKey)?.label || uptKey || 'UPT'}</span>
              </div>
            )}
          </div>

          {/* Jenis Data Selector */}
          <div>
            <label className="form-label text-xs">Jenis Data</label>
            <select
              value={selectedJdId}
              onChange={e => setSelectedJdId(e.target.value)}
              className="form-select text-sm w-full"
            >
              {tampilan === 'rekap' && <option value="all">Semua Jenis Data ({jenisDataList.length} Data)</option>}
              {(tampilan === 'rekap' ? jenisDataList : namaJdList).map(j => (
                <option key={j.id} value={j.id}>
                  {j.judul} ({j.level_utama === 'bulan' ? 'Bulanan' : 'Mingguan'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4 Minggu chips preview */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Periode Sumber Data 4 Minggu:</span>
            {currentWeeks.map(w => (
              <span
                key={w.id}
                className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 font-mono text-[11px]"
              >
                Mg {w.minggu_ke} ({new Date(w.tanggal_mulai).getDate()}–{new Date(w.tanggal_selesai).getDate()} {namaBulan(bulan).slice(0,3)})
              </span>
            ))}
          </div>
          <span className="text-gray-400">
            {effectiveUptList.length} UPT · {effectiveJdList.length} Jenis Data
          </span>
        </div>
      </div>

      {tampilan === 'rekap' && (
      <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="card p-4 border border-gray-100 dark:border-gray-800 shadow-sm bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-xs font-medium">Total Pelatihan</span>
            <Target size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold font-display text-gray-900 dark:text-white tabular-nums">
            {loading ? '…' : monthlyMetrics.totalPelatihan.toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Bulan {namaBulan(bulan)}</p>
        </div>

        <div className="card p-4 border border-gray-100 dark:border-gray-800 shadow-sm bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-xs font-medium">Total Peserta</span>
            <Users size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-display text-gray-900 dark:text-white tabular-nums">
            {loading ? '…' : monthlyMetrics.totalPeserta.toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Orang / Aparatur / Masyarakat</p>
        </div>

        <div className="card p-4 border border-gray-100 dark:border-gray-800 shadow-sm bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-xs font-medium">Pagu Anggaran</span>
            <Calculator size={16} className="text-amber-500" />
          </div>
          <p className="text-xl font-bold font-display text-gray-900 dark:text-white tabular-nums truncate">
            {loading ? '…' : formatRp(monthlyMetrics.totalPagu)}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Alokasi pagu berjalan</p>
        </div>

        <div className="card p-4 border border-gray-100 dark:border-gray-800 shadow-sm bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-xs font-medium">Realisasi Anggaran</span>
            <TrendingUp size={16} className="text-indigo-500" />
          </div>
          <p className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
            {loading ? '…' : formatRp(monthlyMetrics.totalRealisasi)}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Serapan: {monthlyMetrics.persentaseSerapan}%</p>
        </div>

        <div className="card p-4 border border-gray-100 dark:border-gray-800 shadow-sm bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-xs font-medium">Laporan / Berkas</span>
            <FileText size={16} className="text-purple-500" />
          </div>
          <p className="text-2xl font-bold font-display text-gray-900 dark:text-white tabular-nums">
            {loading ? '…' : monthlyMetrics.totalDokumen}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Dokumen PDF/Excel UPT</p>
        </div>
      </div>

      {/* Main Content: Accordion per Jenis Data */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 px-1">
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Layers size={18} className="text-blue-500" />
            <span>Rincian Rekapitulasi per Jenis Data ({namaBulan(bulan)} {tahun})</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const allOpen = {}
                recapPerJenisData.forEach(r => { allOpen[r.jenisData.id] = true })
                setExpandedJd(allOpen)
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Buka Semua
            </button>
            <span className="text-gray-300 dark:text-gray-700">•</span>
            <button
              onClick={() => setExpandedJd({})}
              className="text-xs text-gray-500 dark:text-gray-400 hover:underline font-medium"
            >
              Tutup Semua
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card p-12 text-center">
            <Loader2 size={32} className="animate-spin text-blue-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Memuat rekapitulasi data bulanan...</p>
          </div>
        ) : recapPerJenisData.length === 0 ? (
          <div className="card p-12 text-center text-gray-400">
            <Database size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Tidak ada data untuk filter ini.</p>
          </div>
        ) : (
          recapPerJenisData.map(item => {
            const isExpanded = expandedJd[item.jenisData.id]
            const jd = item.jenisData

            return (
              <div
                key={jd.id}
                className="card shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden"
              >
                {/* Header item */}
                <button
                  type="button"
                  onClick={() => toggleExpand(jd.id)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors border-b border-gray-100 dark:border-gray-800"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                      jd.level_utama === 'bulan'
                        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300'
                        : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'
                    }`}>
                      {jd.level_utama === 'bulan' ? 'B' : 'M'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                          {jd.judul}
                        </h3>
                        <Badge variant={jd.level_utama === 'bulan' ? 'primary' : 'neutral'}>
                          {jd.level_utama === 'bulan'
                            ? jd.mode_bulanan === 'upload_file'
                              ? 'Bulanan (Upload Berkas)'
                              : 'Bulanan (Agregasi M1–4)'
                            : 'Mingguan'
                          }
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                        {jd.deskripsi || 'Rekapitulasi data kinerja bulanan'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="hidden sm:flex flex-col text-right">
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {item.totalUptComplete} dari {item.uptBreakdown.length} UPT Lengkap
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {item.isBulanUpload
                          ? `${item.totalDocsUploaded} berkas terunggah`
                          : 'Akumulasi 4 Minggu'
                        }
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown size={18} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={18} className="text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Body when expanded */}
                {isExpanded && (
                  <div className="p-5 space-y-4">
                      <>
                        {/* Ringkasan Akumulasi Angka */}
                        {item.angkaFields.length > 0 && (
                          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-700/60">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                              ∑ Total Akumulasi Seluruh UPT — {namaBulan(bulan)} {tahun}
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                              {item.angkaFields.map(field => {
                                const totalVal = item.summaryTotals[field.field_key] || 0
                                const isRupiah = field.field_key.includes('pagu') || field.field_key.includes('anggaran') || field.field_key.includes('belanja')
                                return (
                                  <div key={field.field_key} className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{field.label}</p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5 tabular-nums">
                                      {isRupiah ? formatRp(totalVal) : totalVal.toLocaleString('id-ID')}
                                    </p>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                    {/* Tabel lengkap: semua field, per minggu */}
                    {!item.isBulanUpload && item.jFields.length > 0 && (
                      <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-xl">
                        <table className="text-xs border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              <th className="text-left px-3 py-2.5 whitespace-nowrap font-semibold border-b border-r border-gray-200 dark:border-gray-700 sticky left-0 z-10 bg-gray-50 dark:bg-gray-800/60" style={{ minWidth: 140 }}>
                                UPT
                              </th>
                              <th className="text-center px-3 py-2.5 whitespace-nowrap font-semibold border-b border-r border-gray-200 dark:border-gray-700">
                                Minggu
                              </th>
                              {item.jFields.map(f => (
                                <th
                                  key={f.field_key}
                                  className={`px-3 py-2.5 whitespace-nowrap font-semibold border-b border-gray-200 dark:border-gray-700 ${
                                    f.tipe === 'angka' ? 'text-right' : 'text-left'
                                  }`}
                                  style={{ minWidth: f.tipe === 'angka' ? 120 : 140 }}
                                >
                                  {f.label}
                                </th>
                              ))}
                              <th className="text-center px-3 py-2.5 whitespace-nowrap font-semibold border-b border-l border-gray-200 dark:border-gray-700">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.uptBreakdown.map(ub => (
                              <Fragment key={ub.upt_key}>
                                {ub.weekData.map((wd, wIdx) => (
                                  <tr
                                    key={`${ub.upt_key}-w${wIdx}`}
                                    className={`${
                                      !wd.hasData ? 'opacity-40' : ''
                                    } border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-colors`}
                                  >
                                    {wIdx === 0 && (
                                      <td
                                        rowSpan={ub.weekData.length + 1}
                                        className="px-3 py-2 font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700 align-top sticky left-0 bg-white dark:bg-gray-900 z-10"
                                      >
                                        <div className="flex items-center gap-1.5 pt-1">
                                          <Building2 size={12} className="text-blue-400 flex-shrink-0" />
                                          <span className="text-[11px] leading-tight">{ub.upt_label}</span>
                                        </div>
                                        <div className="mt-1">
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                                            ub.filledWeeksCount >= 4
                                              ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                              : ub.filledWeeksCount > 0
                                              ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                                              : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                                          }`}>
                                            {ub.filledWeeksCount}/4 Mg
                                          </span>
                                        </div>
                                      </td>
                                    )}
                                    <td className="px-3 py-2 text-center font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap border-r border-gray-100 dark:border-gray-800">
                                      M{wd.period?.minggu_ke || (wIdx + 1)}
                                    </td>
                                    {item.jFields.map(f => {
                                      const val = wd.values[f.field_key]
                                      const isRupiah = f.tipe === 'angka' && (f.field_key.includes('pagu') || f.field_key.includes('anggaran') || f.field_key.includes('belanja'))
                                      const display = val !== undefined && val !== null && val !== ''
                                        ? isRupiah
                                          ? formatRp(Number(val))
                                          : f.tipe === 'angka'
                                            ? Number(val).toLocaleString('id-ID')
                                            : String(val)
                                        : null
                                      return (
                                        <td
                                          key={f.field_key}
                                          className={`px-3 py-2 whitespace-nowrap ${
                                            f.tipe === 'angka'
                                              ? 'text-right font-mono text-gray-800 dark:text-gray-200'
                                              : 'text-left text-gray-700 dark:text-gray-300'
                                          }`}
                                          style={{ maxWidth: 220 }}
                                          title={display || ''}
                                        >
                                          {display
                                            ? <span className="block truncate">{display}</span>
                                            : <span className="text-gray-300 dark:text-gray-600">—</span>
                                          }
                                        </td>
                                      )
                                    })}
                                    {wIdx === 0 && (
                                      <td
                                        rowSpan={ub.weekData.length + 1}
                                        className="px-3 py-2 text-center align-top border-l border-gray-100 dark:border-gray-800"
                                      >
                                        <Badge variant={ub.isComplete ? 'success' : ub.filledWeeksCount > 0 ? 'warning' : 'draft'}>
                                          {ub.isComplete ? 'Lengkap' : ub.filledWeeksCount > 0 ? 'Sebagian' : 'Belum Ada'}
                                        </Badge>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                                {/* Baris Total per UPT */}
                                <tr
                                  key={`${ub.upt_key}-total`}
                                  className="bg-blue-50/60 dark:bg-blue-950/20 border-b-2 border-blue-200 dark:border-blue-800"
                                >
                                  <td className="px-3 py-2 text-center text-blue-700 dark:text-blue-300 font-bold text-[11px] border-r border-blue-200 dark:border-blue-800">
                                    ∑ Total
                                  </td>
                                  {item.jFields.map(f => {
                                    const isRupiah = f.tipe === 'angka' && (f.field_key.includes('pagu') || f.field_key.includes('anggaran') || f.field_key.includes('belanja'))
                                    const totalVal = ub.totals[f.field_key]
                                    return (
                                      <td
                                        key={f.field_key}
                                        className={`px-3 py-2 whitespace-nowrap font-semibold ${
                                          f.tipe === 'angka'
                                            ? 'text-right font-mono text-blue-700 dark:text-blue-300'
                                            : 'text-center text-gray-300 dark:text-gray-600'
                                        }`}
                                      >
                                        {f.tipe === 'angka'
                                          ? (isRupiah ? formatRp(totalVal || 0) : (totalVal || 0).toLocaleString('id-ID'))
                                          : '—'
                                        }
                                      </td>
                                    )
                                  })}
                                </tr>
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Mode upload_file: tabel dokumen */}
                    {item.isBulanUpload && (
                      <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-xl">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              <th className="text-left px-4 py-3 font-semibold">Nama UPT</th>
                              <th className="text-left px-3 py-3 font-semibold">Berkas Laporan Terunggah</th>
                              <th className="text-center px-3 py-3 font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {item.uptBreakdown.map(ub => (
                              <tr key={ub.upt_key} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <Building2 size={13} className="text-gray-400" />
                                    <span>{ub.upt_label}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                                  {ub.docs.length > 0 ? (
                                    <div className="flex flex-col gap-1">
                                      {ub.docs.map((d, i) => (
                                        <div key={i} className="flex items-center gap-1.5">
                                          <FileText size={12} className="text-purple-500 flex-shrink-0" />
                                          <span className="text-xs">{d.file_name || d.judul}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 italic">Belum upload berkas</span>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <Badge variant={ub.isComplete ? 'success' : 'draft'}>
                                    {ub.isComplete ? 'Lengkap' : 'Belum Ada'}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                      </>

                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      </>
      )}

      {tampilan === 'nama' && (
        <RekapByNama
          jenisData={namaJd}
          fields={namaFields}
          entries={namaEntries}
          uptLabel={uptList.find(u => u.key === namaUptKey)?.label || namaUptKey || ''}
          periodLabel={labelBulan(bulan, tahun)}
          loading={loading}
        />
      )}
    </div>
  )
}


/**
 * Data by Name: baris-baris hasil unggahan (Excel/form) SATU UPT.
 * Kolom mengikuti definisi kolom Jenis Data (sama dengan template Excel), tanpa kolom UPT.
 */
function RekapByNama({ jenisData, fields = [], entries = [], uptLabel = '', periodLabel = '', loading }) {
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const cell = (e, f) => {
    const v = e.data_json?.[f.field_key]
    if (v !== undefined && v !== null && v !== '') return String(v)
    if (f.field_key === 'nama' && e.nama) return e.nama
    if (f.field_key === 'nik' && e.nik) return e.nik
    return ''
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(e => fields.some(f => cell(e, f).toLowerCase().includes(q)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, fields, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  function handleExport() {
    const rows = sanitizeRows(filtered.map(e => Object.fromEntries(fields.map(f => [f.label, cell(e, f)]))))
    const ws = XLSX.utils.json_to_sheet(rows, { header: fields.map(f => f.label) })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, (jenisData?.judul || 'Data').slice(0, 31))
    XLSX.writeFile(wb, `DataByName_${jenisData?.judul}_${uptLabel}_${periodLabel}.xlsx`.replace(/\s+/g, '_'))
  }

  if (!jenisData) {
    return (
      <div className="card p-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Belum ada Jenis Data bulanan berbasis rincian nama.
      </div>
    )
  }

  return (
    <div className="card p-5 space-y-3 border border-gray-100 dark:border-gray-800 shadow-sm animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users size={18} className="text-blue-500" />
            <span>{jenisData.judul}</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {uptLabel} · {periodLabel} · <strong>{entries.length}</strong> baris data hasil unggahan
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="btn-primary text-xs whitespace-nowrap self-start disabled:opacity-40"
        >
          <Download size={14} />
          <span>Download Excel</span>
        </button>
      </div>

      <div className="relative max-w-sm w-full">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Cari di semua kolom..."
          value={search}
          onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
          className="form-input pl-8 text-xs py-1.5 w-full"
        />
      </div>

      <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-xl">
        <table className="text-xs text-left" style={{ minWidth: 'max-content', width: '100%' }}>
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
              <th className="px-3 py-2.5 text-center w-10">#</th>
              {fields.map(f => (
                <th key={f.id || f.field_key} className="px-3 py-2.5 whitespace-nowrap">{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={fields.length + 1} className="px-4 py-8 text-center text-gray-400">Memuat data…</td></tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={fields.length + 1} className="px-4 py-8 text-center text-gray-400">
                  {entries.length === 0
                    ? `${uptLabel} belum mengunggah data untuk ${periodLabel}.`
                    : 'Tidak ada data yang cocok dengan pencarian.'}
                </td>
              </tr>
            ) : (
              paginated.map((e, i) => (
                <tr key={e.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors">
                  <td className="px-3 py-2.5 text-center font-mono text-gray-400">{(page - 1) * pageSize + i + 1}</td>
                  {fields.map(f => (
                    <td key={f.id || f.field_key} className="px-3 py-2.5 whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {cell(e, f) || <span className="text-gray-300 dark:text-gray-600">-</span>}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl text-xs text-gray-500 dark:text-gray-400 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span>Tampilkan</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
              className="form-select text-xs py-1 px-2 w-auto"
            >
              {[25, 50, 100, 250].map(n => <option key={n} value={n}>{n} baris</option>)}
            </select>
            <span>dari <strong>{filtered.length}</strong> baris</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-40"
            >
              « Prev
            </button>
            <span className="px-2 font-semibold">Halaman {page} dari {totalPages}</span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-40"
            >
              Next »
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
