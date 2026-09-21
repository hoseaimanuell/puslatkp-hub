/**
 * views/InputData/PeriodeTabs.jsx
 * Menangani form dinamis berdasarkan level_utama Jenis Data:
 * - level_utama === 'bulan': Hanya tab Bulan (rincian per-orang) + Banner 4 Minggu Pasangan + Validasi non-blocking
 * - level_utama === 'minggu': Tab Minggu (input form) + Tab Triwulan & Tahun (Auto-agregasi SUM otomatis)
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { db, getFeatures } from '../../lib/db'
import { weekValues, applyAgregasi, agregasiOf, AGREGASI_SHORT } from '../../lib/agregasi'
import { useAuth } from '../../AuthContext'
import PeriodSelector from '../../components/PeriodSelector'
import DynamicForm from '../../components/DynamicForm'
import Modal from '../../components/Modal'
import HapusMassalDialog from '../../components/HapusMassalDialog'
import ColumnMappingScreen from '../../components/ColumnMappingScreen'
import { Building2 } from 'lucide-react'
import { isPeriodLocked, formatTanggal } from '../../lib/deadline'
import { formatPeriodLabel, sortPeriods, weeksOfMonth, weeksOfQuarter, weeksOfYear, pickCurrentPeriod } from '../../lib/periods'
import { matchColumns, convertRows } from '../../lib/columnMatcher'
import { readExcelFile, exportDataEntries, exportRekapNilai, generateTemplateExcel, exportAgregasiBreakdown } from '../../lib/excelExport'
import {
  Upload, Plus, Download, CheckCircle2, AlertTriangle, AlertCircle,
  Trash2, Eye, Edit, Search, X, FileSpreadsheet, Loader2,
  TrendingUp, Calendar, Calculator, Check, ArrowRight, Layers
} from 'lucide-react'
import BulanAgregatView from './BulanAgregatView'
import BulanUploadView from './BulanUploadView'

export function isBulananJenisData(jd) {
  if (!jd) return false
  // level_utama (NOT NULL di database) adalah penentu utama: 'bulan' = Input Bulanan, 'minggu' = Input Mingguan
  return jd.level_utama === 'bulan' || jd.mode_bulanan === 'agregasi' || jd.mode_bulanan === 'upload_file'
}

export default function PeriodeTabs({ jenisData, allJenisData = [], onSaved }) {
  const { isAdmin, uptKey } = useAuth()
  const isMonthOnly = isBulananJenisData(jenisData)
  // Mingguan: input di level minggu; triwulan & tahun hanya rekap otomatis (tanpa upload). Bulanan: level bulan saja.
  const allowedLevels = isMonthOnly ? ['bulan'] : ['minggu']

  const [activeLevel, setActiveLevel] = useState(isMonthOnly ? 'bulan' : 'minggu')
  const [periods, setPeriods] = useState([])
  const [activePeriod, setActivePeriod] = useState(null)
  const [fieldDefs, setFieldDefs] = useState([])
  const [partnerFieldDefs, setPartnerFieldDefs] = useState([])

  // Data states
  // Mingguan: daftar baris/pelatihan (bawaan 1 baris). savedSnap = isi tersimpan terakhir { baris_ke: { field_key: nilai } }
  // untuk mendeteksi kolom yang dikosongkan / baris yang dihapus saat menyimpan.
  const [barisList, setBarisList] = useState([{ baris_ke: 1, values: {} }])
  const [savedSnap, setSavedSnap] = useState({})
  const [lateRekap, setLateRekap] = useState(false)
  const [features, setFeatures] = useState({ multiBaris: false, agregasi: false })
  useEffect(() => { getFeatures().then(setFeatures) }, [])
  const multiBaris = features.multiBaris && !!jenisData.multi_baris
  const [entries, setEntries] = useState([])
  const [validation, setValidation] = useState(null)
  const [aggregatedData, setAggregatedData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingPeriods, setLoadingPeriods] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modal states
  const [addEntryModal, setAddEntryModal] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [viewEntry, setViewEntry] = useState(null)
  const [uploadModal, setUploadModal] = useState(false)
  const [mappingData, setMappingData] = useState(null)
  const [formValues, setFormValues] = useState({})
  const [searchEntries, setSearchEntries] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const fileRef = useRef()
  // Hapus massal: { kind: 'rekap' | 'entries', count } — data masuk Tempat Sampah
  const [clearDialog, setClearDialog] = useState(null)

  const filteredEntries = useMemo(() => {
    if (!searchEntries.trim()) return entries
    const q = searchEntries.toLowerCase()
    return entries.filter(e => {
      const nama = (e.nama || e.data_json?.nama || '').toLowerCase()
      const nik = (e.nik || e.data_json?.nik || '').toLowerCase()
      const jsonStr = JSON.stringify(e.data_json || {}).toLowerCase()
      return nama.includes(q) || nik.includes(q) || jsonStr.includes(q)
    })
  }, [entries, searchEntries])

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize))

  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredEntries.slice(start, start + pageSize)
  }, [filteredEntries, currentPage, pageSize])

  // Admin harus memilih UPT tujuan secara eksplisit sebelum bisa melihat/mengisi
  // data — supaya data tiap UPT tidak tercampur jadi satu tempat yang sama.
  // Akun UPT selalu terkunci ke upt_key miliknya sendiri (tidak bisa diganti).
  const [uptList, setUptList] = useState([])
  const [selectedUptKey, setSelectedUptKey] = useState('')

  useEffect(() => {
    db.from('upt_list').select('*').eq('aktif', true).order('label').then(({ data }) => {
      setUptList(data || [])
    })
  }, [])

  const currentUptKey = isAdmin ? selectedUptKey : (uptKey || '')
  const currentUptLabel = isAdmin
    ? (uptList.find(u => u.key === selectedUptKey)?.label || '')
    : (uptList.find(u => u.key === uptKey)?.label || uptKey || '')
  const needsUptSelection = isAdmin && !selectedUptKey

  useEffect(() => {
    setCurrentPage(1)
  }, [searchEntries, activePeriod?.id, currentUptKey])

  // Deadline TIDAK mengunci: UPT tetap boleh mengisi, tetapi datanya ditandai "Terlambat" (merah).
  const locked = false
  const pastDeadline = !!activePeriod && !isAdmin && isPeriodLocked(activePeriod.deadline)

  // Cari pasangan Jenis Data jika ada
  const partnerJd = isMonthOnly && jenisData.pasangan_mingguan_id
    ? allJenisData.find(j => j.id === jenisData.pasangan_mingguan_id)
    : null

  useEffect(() => {
    const isMonth = isBulananJenisData(jenisData)
    setActiveLevel(isMonth ? 'bulan' : 'minggu')
    loadPeriods()
  }, [jenisData.id, jenisData.key, jenisData.level_utama])

  useEffect(() => {
    loadFieldDefs()
  }, [jenisData.id, activeLevel])

  useEffect(() => {
    if (activePeriod && jenisData && !needsUptSelection) {
      loadData()
    }
  }, [activePeriod?.id, jenisData.id, activeLevel, currentUptKey, needsUptSelection])

  async function loadPeriods() {
    setLoadingPeriods(true)
    const { data } = await db
      .from('periods')
      .select('*')
      .order('tahun')
      .order('bulan')
      .order('minggu_ke')
      .order('triwulan_ke')

    const allP = sortPeriods(data || [])
    setPeriods(allP)

    const isMonth = isBulananJenisData(jenisData)
    const levelToSet = isMonth ? 'bulan' : 'minggu'
    setActiveLevel(levelToSet)

    const filtered = allP.filter(p => p.level === levelToSet)
    setActivePeriod(pickCurrentPeriod(filtered))
    setLoadingPeriods(false)
  }

  async function loadFieldDefs() {
    // Muat field definitions untuk jenis data saat ini
    const queryLevel = isMonthOnly ? 'bulan' : 'minggu'
    const { data } = await db
      .from('field_definitions')
      .select('*')
      .eq('jenis_data_id', jenisData.id)
      .eq('level', queryLevel)
      .eq('aktif', true)
      .order('urutan')
    setFieldDefs(data || [])

    // Jika memiliki pasangan mingguan, muat juga field pasangan untuk kalkulasi
    if (isMonthOnly && jenisData.pasangan_mingguan_id) {
      const { data: pDefs } = await db
        .from('field_definitions')
        .select('*')
        .eq('jenis_data_id', jenisData.pasangan_mingguan_id)
        .eq('level', 'minggu')
        .eq('aktif', true)
        .order('urutan')
      setPartnerFieldDefs(pDefs || [])
    }
  }

  async function loadData() {
    if (!activePeriod) return
    setLoading(true)

    if (activeLevel === 'bulan' && isMonthOnly) {
      if (jenisData.mode_bulanan === 'agregasi' || jenisData.mode_bulanan === 'upload_file') {
        setEntries([])
        setValidation(null)
        setLoading(false)
        return
      }
      // 1. Ambil data baris rincian (data_entries)
      let q = db.from('data_entries')
        .select('*')
        .eq('jenis_data_id', jenisData.id)
        .eq('period_id', activePeriod.id)
        .order('created_at')
      q = q.eq('upt_key', currentUptKey)
      const { data: entData } = await q
      const currentEntries = entData || []
      setEntries(currentEntries)

      // 2. Evaluasi validasi & kelengkapan 4 minggu pasangan
      await checkPartnerWeeklyProgress(currentEntries)
    } else if (activeLevel === 'minggu') {
      // Ambil nilai rekap minggual
      let q = db.from('rekap_nilai')
        .select('*')
        .eq('jenis_data_id', jenisData.id)
        .eq('period_id', activePeriod.id)
      q = q.eq('upt_key', currentUptKey)
      const { data } = await q
      const snap = {}
      ;(data || []).forEach(r => {
        const b = r.baris_ke ?? 1
        ;(snap[b] ||= {})[r.field_key] = r.value !== null && r.value !== undefined ? r.value : r.value_text
      })
      setSavedSnap(snap)
      setLateRekap((data || []).some(r => r.terlambat))
      const list = Object.keys(snap).map(Number).sort((a, b) => a - b).map(b => ({ baris_ke: b, values: { ...snap[b] } }))
      setBarisList(list.length ? list : [{ baris_ke: 1, values: {} }])
    } else if (activeLevel === 'bulan' || activeLevel === 'triwulan' || activeLevel === 'tahun') {
      await calculateAggregation()
    }

    setLoading(false)
  }

  // Hitung status 4 minggu pasangan mingguan & bandingkan dengan rincian bulan
  async function checkPartnerWeeklyProgress(currentEntries) {
    if (!jenisData.pasangan_mingguan_id) {
      setValidation(null)
      return
    }

    const partnerId = jenisData.pasangan_mingguan_id
    // Ambil 4 periode minggu dalam bulan aktif
    const weekPeriods = weeksOfMonth(periods, activePeriod.tahun, activePeriod.bulan)

    if (!weekPeriods.length) {
      setValidation(null)
      return
    }

    const weekIds = weekPeriods.map(p => p.id)
    const { data: partnerRekap } = await db
      .from('rekap_nilai')
      .select('*')
      .eq('jenis_data_id', partnerId)
      .eq('upt_key', currentUptKey)
      .in('period_id', weekIds)

    const rekapList = partnerRekap || []

    // Field angka utama di pasangan (mis. jumlah_peserta, jumlah_instruktur_wi)
    const targetField = partnerFieldDefs.find(f => f.tipe === 'angka') || {
      field_key: 'jumlah_peserta',
      label: 'Jumlah Peserta'
    }

    // Hitung minggu mana saja yang sudah ada entri
    const filledWeekIds = new Set()
    let totalMingguan = 0

    weekPeriods.forEach(wp => {
      const match = rekapList.find(r => r.period_id === wp.id && r.field_key === targetField.field_key)
      if (match && match.value !== null && match.value !== undefined) {
        filledWeekIds.add(wp.id)
        totalMingguan += Number(match.value) || 0
      }
    })

    const filledWeeksCount = filledWeekIds.size
    const entriCount = currentEntries.length

    setValidation({
      partnerJudul: partnerJd?.judul || 'Pasangan Mingguan',
      targetFieldLabel: targetField.label,
      filledWeeksCount,
      totalWeeks: weekPeriods.length,
      totalMingguan,
      entriCount,
      selisih: entriCount - totalMingguan,
      isMatch: entriCount === totalMingguan && filledWeeksCount >= weekPeriods.length,
    })
  }

  // Auto-agregasi dari level minggu ke triwulan / tahun
  async function calculateAggregation() {
    let weekPeriods = []
    if (activeLevel === 'bulan') {
      weekPeriods = weeksOfMonth(periods, activePeriod.tahun, activePeriod.bulan)
    } else if (activeLevel === 'triwulan') {
      weekPeriods = weeksOfQuarter(periods, activePeriod.tahun, activePeriod.triwulan_ke)
    } else if (activeLevel === 'tahun') {
      weekPeriods = weeksOfYear(periods, activePeriod.tahun)
    }

    if (!weekPeriods.length) {
      setAggregatedData({ totals: {}, weekRows: [] })
      return
    }

    const weekIds = weekPeriods.map(p => p.id)
    const { data } = await db
      .from('rekap_nilai')
      .select('*')
      .eq('jenis_data_id', jenisData.id)
      .eq('upt_key', currentUptKey)
      .in('period_id', weekIds)

    const rekapRows = data || []
    const totals = {}

    // Rekap tiap kolom angka sesuai cara rekapnya: jumlah / nilai terakhir (kumulatif) / rata-rata / maks.
    fieldDefs.filter(f => f.tipe === 'angka').forEach(f => {
      const perWeek = weekIds.map(id => {
        const rs = rekapRows.filter(r => r.period_id === id && r.field_key === f.field_key && r.value !== null && r.value !== undefined)
        return rs.length ? rs.reduce((acc, r) => acc + Number(r.value), 0) : null
      })
      totals[f.field_key] = applyAgregasi(perWeek, agregasiOf(f)) ?? 0
    })

    // Susun breakdown per minggu
    const weekRows = weekPeriods.map(wp => {
      const rowVals = weekValues(rekapRows.filter(r => r.period_id === wp.id))
      return {
        period: wp,
        values: rowVals,
        hasData: Object.keys(rowVals).length > 0,
      }
    })

    setAggregatedData({ totals, weekRows, totalWeeks: weekPeriods.length })
  }

  // ── Baris/pelatihan mingguan ──
  function updateBaris(i, key, val) {
    setBarisList(list => list.map((b, idx) => (idx === i ? { ...b, values: { ...b.values, [key]: val } } : b)))
  }
  function addBaris() {
    setBarisList(list => [...list, { baris_ke: Math.max(0, ...list.map(b => b.baris_ke)) + 1, values: {} }])
  }
  function removeBaris(i) {
    setBarisList(list => (list.length > 1 ? list.filter((_, idx) => idx !== i) : [{ baris_ke: list[0].baris_ke, values: {} }]))
  }

  // Simpan seluruh isian minggu ini dalam SATU permintaan. Kolom yang dikosongkan / baris yang dihapus
  // ikut dihapus (masuk Tempat Sampah), jadi mengosongkan kolom benar-benar menghapus nilainya.
  async function saveRekap() {
    setSaving(true)
    const base = { jenis_data_id: jenisData.id, upt_key: currentUptKey, period_id: activePeriod.id }
    const upserts = []
    const cleared = {} // baris_ke -> [field_key yang dikosongkan]
    const keep = new Set()

    for (const b of barisList) {
      keep.add(b.baris_ke)
      for (const f of fieldDefs) {
        const val = b.values[f.field_key]
        if (val === '' || val === null || val === undefined) {
          if (savedSnap[b.baris_ke]?.[f.field_key] !== undefined) (cleared[b.baris_ke] ||= []).push(f.field_key)
          continue
        }
        upserts.push({
          ...base,
          ...(features.multiBaris ? { baris_ke: b.baris_ke } : {}),
          field_key: f.field_key,
          value: f.tipe === 'angka' ? Number(val) : null,
          value_text: String(val),
        })
      }
    }
    const removed = Object.keys(savedSnap).map(Number).filter(n => !keep.has(n))

    const scoped = () => db.from('rekap_nilai').delete()
      .eq('jenis_data_id', jenisData.id).eq('upt_key', currentUptKey).eq('period_id', activePeriod.id)
    const onConflict = features.multiBaris ? 'jenis_data_id,upt_key,period_id,baris_ke,field_key' : 'jenis_data_id,upt_key,period_id,field_key'

    let error = null
    if (upserts.length) error = (await db.from('rekap_nilai').upsert(upserts, { onConflict })).error
    for (const [n, fields] of Object.entries(cleared)) {
      if (error) break
      let q = scoped().in('field_key', fields)
      if (features.multiBaris) q = q.eq('baris_ke', Number(n))
      error = (await q).error
    }
    if (features.multiBaris) {
      for (const n of removed) {
        if (error) break
        error = (await scoped().eq('baris_ke', n)).error
      }
    }

    setSaving(false)
    if (error) { alert('Gagal menyimpan: ' + error.message); return }
    await loadData()
    onSaved?.()
  }

  async function saveEntry(values) {
    setSaving(true)
    const payload = {
      jenis_data_id: jenisData.id,
      upt_key: currentUptKey,
      period_id: activePeriod.id,
      nama: values.nama || values.nama_pelatihan || null,
      nik: values.nik ? String(values.nik) : null,
      data_json: values,
    }

    if (editEntry) {
      await db.from('data_entries').update(payload).eq('id', editEntry.id)
    } else {
      await db.from('data_entries').insert(payload)
    }

    setSaving(false)
    setAddEntryModal(false)
    setEditEntry(null)
    setFormValues({})
    loadData()
    onSaved?.()
  }

  async function deleteEntry(id) {
    if (!confirm('Hapus baris data ini?\n\nData masuk Tempat Sampah 30 hari dan hanya Admin yang dapat memulihkannya.')) return
    const { error } = await db.from('data_entries').delete().eq('id', id)
    if (error) alert('Gagal menghapus: ' + error.message)
    loadData()
  }

  // ── Hapus massal per periode (mingguan: seluruh isian minggu ini; bulanan: seluruh baris bulan ini) ──
  const CLEAR_TABLE = { rekap: 'rekap_nilai', entries: 'data_entries' }

  function clearQuery(kind, builder) {
    return builder
      .eq('jenis_data_id', jenisData.id)
      .eq('upt_key', currentUptKey)
      .eq('period_id', activePeriod.id)
  }

  async function openClear(kind) {
    const { count } = await clearQuery(kind, db.from(CLEAR_TABLE[kind]).select('*', { count: 'exact', head: true }))
    setClearDialog({ kind, count: count || 0 })
  }

  async function confirmClear() {
    const { kind } = clearDialog
    const { error } = await clearQuery(kind, db.from(CLEAR_TABLE[kind]).delete())
    if (error) return { error }
    setClearDialog(null)
    await loadData()
    return {}
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { headers, rows } = await readExcelFile(file)
      const initialMapping = matchColumns(headers, fieldDefs)
      setMappingData({ headers, rows, initialMapping })
      setUploadModal(true)
    } catch (err) {
      alert('Gagal membaca file: ' + err.message)
    }
    e.target.value = ''
  }

  async function handleImportConfirm(mapping) {
    if (!mappingData) return
    setSaving(true)
    const { entries: converted, extraKeys } = convertRows(mappingData.rows, mapping, fieldDefs)

    // Kirim per batch 100 baris (bukan 1 permintaan per baris): jauh lebih cepat & tiap batch atomik
    const payloads = converted.map(entry => ({
      jenis_data_id: jenisData.id,
      upt_key: currentUptKey,
      period_id: activePeriod.id,
      nama: entry.nama,
      nik: entry.nik || null,
      data_json: entry.data_json,
      data_ekstra: entry.data_ekstra,
    }))
    let importError = null
    for (let i = 0; i < payloads.length && !importError; i += 100) {
      importError = (await db.from('data_entries').upsert(payloads.slice(i, i + 100), {
        onConflict: 'jenis_data_id,upt_key,period_id,nik',
      })).error
    }
    if (importError) {
      setSaving(false)
      alert('Impor berhenti: ' + importError.message + '\n\nBatch sebelumnya sudah tersimpan. Mengimpor ulang berkas yang sama aman: NIK yang sama diperbarui, bukan digandakan.')
      loadData()
      return
    }

    if (extraKeys.length > 0) {
      await db.from('audit_log').insert({
        actor_upt_key: currentUptKey,
        action: 'import_kolom_tidak_dikenal',
        detail: { jenis_data_id: jenisData.id, kolom: extraKeys }
      })
    }

    setSaving(false)
    setUploadModal(false)
    setMappingData(null)
    loadData()
    onSaved?.()
  }

  function handleLevelChange(level) {
    setActiveLevel(level)
    const levelPeriods = sortPeriods(periods.filter(p => p.level === level))
    setActivePeriod(pickCurrentPeriod(levelPeriods))
  }

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="card p-4 shadow-sm border border-gray-100 dark:border-gray-800">
        <PeriodSelector
          level={activeLevel}
          onLevelChange={handleLevelChange}
          period={activePeriod}
          onPeriodChange={setActivePeriod}
          availablePeriods={periods}
          allowedLevels={allowedLevels}
        />
      </div>

      {/* Pilih UPT — wajib untuk Admin, terkunci ke akun sendiri untuk UPT */ }
      <div className="card p-4 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex-shrink-0">
            <Building2 size={16} />
          </span>
          {isAdmin ? (
            <div className="flex-1 min-w-[220px]">
              <label className="form-label mb-1">Pilih UPT/Balai</label>
              <select
                value={selectedUptKey}
                onChange={e => setSelectedUptKey(e.target.value)}
                className="form-select max-w-xs"
              >
                <option value="">- Pilih UPT -</option>
                {uptList.map(u => (
                  <option key={u.key} value={u.key}>{u.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">UPT/Balai</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{currentUptLabel}</p>
            </div>
          )}
        </div>
      </div>

      {needsUptSelection ? (
        <div className="card p-8 text-center text-gray-400 dark:text-gray-500">
          <Building2 size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pilih UPT/Balai dulu di atas untuk melihat atau mengisi datanya.</p>
        </div>
      ) : (
      <>
      {/* Locked Banner */}
      {pastDeadline && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl p-4 flex items-center gap-3">
          <div>
            <p className="font-semibold text-rose-800 dark:text-rose-300 text-sm">Lewat Deadline — data tetap bisa diisi</p>
            <p className="text-xs text-rose-600 dark:text-rose-400">Deadline periode ini {formatTanggal(activePeriod.deadline)}. Data yang Anda simpan sekarang akan ditandai <strong>Terlambat</strong> (merah) dan terlihat oleh Admin.</p>
          </div>
        </div>
      )}

      {/* BANNER 4 MINGGU & VALIDASI PASANGAN (Sesuai Koreksi Bagian C) */}
      {isMonthOnly && validation && (
        <div className="space-y-2">
          {/* Banner Kelengkapan 4 Minggu */}
          {validation.filledWeeksCount >= validation.totalWeeks ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl p-3.5 flex items-center gap-3 text-emerald-800 dark:text-emerald-200">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                <CheckCircle2 size={20} />
              </span>
              <div className="flex-1 text-sm">
                <p className="font-semibold">
                  4 minggu sudah lengkap, total {validation.totalMingguan} {validation.targetFieldLabel.toLowerCase()}
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Lengkapi rincian nama ({validation.entriCount} terisi saat ini) untuk mencocokkan dengan data mingguan <strong>{validation.partnerJudul}</strong>.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl p-3.5 flex items-center gap-3 text-amber-800 dark:text-amber-200">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex-shrink-0">
                <AlertTriangle size={20} />
              </span>
              <div className="flex-1 text-sm">
                <p className="font-semibold">
                  Baru {validation.filledWeeksCount} dari {validation.totalWeeks} minggu terisi, total sementara {validation.totalMingguan} {validation.targetFieldLabel.toLowerCase()}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Data mingguan pasangan <strong>{validation.partnerJudul}</strong> belum lengkap di bulan ini. Anda tetap dapat mencicil input rincian nama kapan saja.
                </p>
              </div>
            </div>
          )}

          {/* Badge Validasi Kesesuaian (Non-Blocking) */}
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-medium border ${
            validation.entriCount === validation.totalMingguan
              ? 'bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
          }`}>
            <div className="flex items-center gap-2">
              {validation.entriCount === validation.totalMingguan ? (
                <>
                  <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                  <span>
                    <strong>Cocok:</strong> Total rincian bulan ({validation.entriCount} baris) sama persis dengan total mingguan ({validation.totalMingguan}).
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle size={15} className="text-rose-600 dark:text-rose-400" />
                  <span>
                    <strong>Ada Selisih ({Math.abs(validation.selisih)} baris):</strong> Rincian Bulan = {validation.entriCount} baris, Total Mingguan = {validation.totalMingguan}.
                    <span className="text-gray-500 dark:text-gray-400 ml-1">(Peringatan validasi, tidak menghalangi simpan)</span>
                  </span>
                </>
              )}
            </div>
            <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-white/70 dark:bg-gray-800/70">
              {validation.entriCount === validation.totalMingguan ? 'Valid' : 'Perlu Dicocokkan'}
            </span>
          </div>
        </div>
      )}

      {/* KONTEN BERDASARKAN LEVEL */}
      {loadingPeriods ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-gray-400" />
        </div>
      ) : !activePeriod ? (
        <div className="card p-10 text-center text-gray-400 dark:text-gray-500">
          <Calendar size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Tidak ada periode yang tersedia.</p>
          <p className="text-xs text-gray-400 mt-1">Hubungi Admin untuk membuat periode data.</p>
        </div>
      ) : activePeriod ? (
        activeLevel === 'bulan' && isMonthOnly ? (
          jenisData.mode_bulanan === 'agregasi' ? (
            <BulanAgregatView
              jenisData={jenisData}
              partnerJd={partnerJd}
              activePeriod={activePeriod}
              allPeriods={periods}
              currentUptKey={currentUptKey}
              currentUptLabel={currentUptLabel}
            />
          ) : jenisData.mode_bulanan === 'upload_file' ? (
            <BulanUploadView
              jenisData={jenisData}
              activePeriod={activePeriod}
              currentUptKey={currentUptKey}
              currentUptLabel={currentUptLabel}
              locked={locked}
              isAdmin={isAdmin}
            />
          ) : (
          /* ======================================================== */
          /* ===== LEVEL BULAN — DATA DETAIL PER BARIS RINCIAN ====== */
          /* ======================================================== */
          <div className="card shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-wrap gap-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>{jenisData.judul}</span>
                  <span className="badge-neutral text-[10px] uppercase">Rincian Per-Orang</span>
                  {currentUptLabel && <span className="badge-blue text-[10px]">{currentUptLabel}</span>}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {entries.length} baris data terdaftar pada {formatPeriodLabel(activePeriod)}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => generateTemplateExcel({
                    fieldDefs,
                    jenisDataJudul: jenisData.judul,
                    format: 'xlsx'
                  })}
                  className="btn-secondary text-xs text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  title="Unduh format file template Excel resmi untuk jenis data ini"
                >
                  <FileSpreadsheet size={14} />
                  Template Excel
                </button>
                {!locked && (
                  <>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                    <button onClick={() => fileRef.current?.click()} className="btn-secondary text-xs">
                      <Upload size={14} />
                      Upload Excel
                    </button>
                    { !jenisData.mode_upload_saja && (
                      <button
                        onClick={() => { setEditEntry(null); setFormValues({}); setAddEntryModal(true) }}
                        className="btn-primary text-xs"
                      >
                        <Plus size={14} />
                        Tambah Baris
                      </button>
                    )}
                  </>
                )}
                {!locked && entries.length > 0 && (
                  <button
                    onClick={() => openClear('entries')}
                    className="btn-secondary text-xs text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    title="Hapus seluruh baris data bulan ini (masuk Tempat Sampah)"
                  >
                    <Trash2 size={14} />
                    Hapus Semua Data Bulan Ini
                  </button>
                )}
                <button
                  onClick={() => exportDataEntries({
                    entries,
                    fieldDefs,
                    jenisDataJudul: jenisData.judul,
                    periodLabel: formatPeriodLabel(activePeriod),
                    uptKey: currentUptKey
                  })}
                  className="btn-secondary text-xs"
                >
                  <Download size={14} />
                  Download Excel
                </button>
              </div>
            </div>

            {/* Search */}
            {entries.length > 0 && (
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
                <div className="relative max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari nama, NIK, pelatihan..."
                    value={searchEntries}
                    onChange={e => setSearchEntries(e.target.value)}
                    className="form-input pl-8 text-xs py-1.5"
                  />
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={24} className="animate-spin text-gray-400" />
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-14 text-gray-400 dark:text-gray-500">
                <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {locked ? 'Tidak ada data pada periode ini.' : 'Belum ada rincian data per-orang.'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {!locked && 'Klik tombol "Tambah Baris" atau "Upload Excel" untuk melengkapi data.'}
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-100 dark:divide-gray-800 overflow-x-auto">
                  {paginatedEntries.map((entry, idx) => {
                    const globalIdx = (currentPage - 1) * pageSize + idx + 1
                    return (
                      <div key={entry.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <span className="text-xs text-gray-400 w-9 flex-shrink-0 font-mono text-right">{globalIdx}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {entry.nama || entry.data_json?.nama || `Baris #${globalIdx}`}{entry.terlambat ? <> {<span title="Disimpan setelah deadline" className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">Terlambat</span>}</> : null}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex-wrap">
                            {entry.nik && <span>NIK: <span className="font-mono">{entry.nik}</span></span>}
                            {entry.data_json?.jenis_kelamin && <span>JK: {entry.data_json.jenis_kelamin}</span>}
                            {entry.data_json?.nama_pelatihan && <span className="text-blue-600 dark:text-blue-400 font-medium truncate">Pelatihan: {entry.data_json.nama_pelatihan}</span>}
                            {entry.data_json?.asal_instansi && <span>Instansi: {entry.data_json.asal_instansi}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewEntry(entry)}
                            className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                            title="Lihat Rincian"
                          >
                            <Eye size={15} />
                          </button>
                          {!locked && (
                            <>
                              <button
                                onClick={() => { setEditEntry(entry); setFormValues(entry.data_json || {}); setAddEntryModal(true) }}
                                className="p-1.5 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                                title="Edit Baris"
                              >
                                <Edit size={15} />
                              </button>
                              <button
                                onClick={() => deleteEntry(entry.id)}
                                className="p-1.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                title="Hapus Baris"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Controls Paginasi */}
                {filteredEntries.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 text-xs text-gray-500 dark:text-gray-400 flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <span>Tampilkan</span>
                      <select
                        value={pageSize}
                        onChange={e => {
                          setPageSize(Number(e.target.value))
                          setCurrentPage(1)
                        }}
                        className="form-select text-xs py-1 px-2.5 w-auto"
                      >
                        <option value={25}>25 baris</option>
                        <option value={50}>50 baris</option>
                        <option value={100}>100 baris</option>
                        <option value={250}>250 baris</option>
                        <option value={500}>500 baris</option>
                      </select>
                      <span>dari <strong>{filteredEntries.length}</strong> total baris data</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors font-medium"
                      >
                        « Prev
                      </button>
                      <span className="px-2 font-semibold text-gray-700 dark:text-gray-300">
                        Halaman {currentPage} dari {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors font-medium"
                      >
                        Next »
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          )
        ) : activeLevel === 'minggu' ? (
          /* ======================================================== */
          /* ===== LEVEL MINGGU — FORM INPUT MINGGUAN ================ */
          /* ======================================================== */
          <div className="card p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2 border-b border-gray-100 dark:border-gray-800 pb-4">
              <div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <span>{jenisData.judul}</span>
                  <span className="badge-neutral text-xs">Form Mingguan</span>
                  {lateRekap && <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">Terlambat</span>}
                  {currentUptLabel && <span className="badge-blue text-xs">{currentUptLabel}</span>}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{formatPeriodLabel(activePeriod)}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!locked && Object.keys(savedSnap).length > 0 && (
                  <button
                    onClick={() => openClear('rekap')}
                    className="btn-secondary text-xs text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    title="Hapus seluruh isian minggu ini (masuk Tempat Sampah)"
                  >
                    <Trash2 size={14} />
                    Kosongkan Data Minggu Ini
                  </button>
                )}
                <button
                  onClick={() => exportRekapNilai({
                    rekapData: barisList.filter(b => Object.keys(b.values).length).map(b => ({ upt_key: currentUptKey, values: b.values })),
                    fieldDefs,
                    jenisDataJudul: jenisData.judul,
                    periodLabel: formatPeriodLabel(activePeriod)
                  })}
                  className="btn-secondary text-xs"
                >
                  <Download size={14} />
                  Download Excel Mingguan
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
            ) : fieldDefs.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Belum ada kolom konfigurasi untuk jenis data mingguan ini.</p>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); saveRekap() }} className="space-y-4">
                {barisList.map((b, i) => (
                  <div key={b.baris_ke} className={multiBaris ? 'rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3' : ''}>
                    {multiBaris && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Pelatihan ke-{i + 1}</span>
                        {!locked && (barisList.length > 1 || Object.keys(b.values).length > 0) && (
                          <button
                            type="button"
                            onClick={() => removeBaris(i)}
                            className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                          >
                            <Trash2 size={12} /> {barisList.length > 1 ? 'Hapus pelatihan ini' : 'Kosongkan'}
                          </button>
                        )}
                      </div>
                    )}
                    <DynamicForm
                      bare
                      idPrefix={multiBaris ? `r${i}-` : ''}
                      level="minggu"
                      fields={fieldDefs}
                      values={b.values}
                      onChange={(key, val) => updateBaris(i, key, val)}
                      disabled={locked}
                    />
                  </div>
                ))}
                {multiBaris && !locked && (
                  <button type="button" onClick={addBaris} className="btn-secondary text-xs">
                    <Plus size={14} /> Tambah pelatihan lain (opsional)
                  </button>
                )}
                {!locked && (
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                    <button type="submit" className="btn-primary w-full" disabled={saving}>
                      {saving ? 'Menyimpan...' : 'Simpan Data Mingguan'}
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        ) : (
          /* ======================================================== */
          /* ===== LEVEL TRIWULAN & TAHUN — AUTO AGREGASI (SUM) ===== */
          /* ======================================================== */
          <div className="card p-6 shadow-sm border border-gray-100 dark:border-gray-800 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 dark:border-gray-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                    <Calculator size={16} />
                  </span>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                    Auto-Agregasi {activeLevel === 'bulan' ? 'Bulanan' : activeLevel === 'triwulan' ? 'Triwulan' : 'Tahunan'}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Otomatis direkap dari data mingguan <strong>{jenisData.judul}</strong> untuk {formatPeriodLabel(activePeriod)}, sesuai cara rekap tiap kolom (jumlah / nilai terakhir untuk angka kumulatif).
                </p>
              </div>
              <button
                onClick={() => exportAgregasiBreakdown({
                  jenisDataJudul: jenisData.judul,
                  periodLabel: formatPeriodLabel(activePeriod),
                  uptKey: currentUptKey,
                  fieldDefs,
                  totals: aggregatedData?.totals || {},
                  weekRows: aggregatedData?.weekRows || []
                })}
                className="btn-primary text-xs py-2 px-3"
                title="Download tabel rincian mingguan dan total akumulasi ke Excel"
              >
                <Download size={14} />
                Download Excel ({activeLevel === 'bulan' ? 'Bulanan' : activeLevel === 'triwulan' ? 'Triwulan' : 'Tahunan'})
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
            ) : (
              <>
                {/* Summary Cards */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Total Akumulasi Periode</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {fieldDefs.filter(f => f.tipe === 'angka').map(field => {
                      const totalVal = aggregatedData?.totals?.[field.field_key] ?? 0
                      const isRupiah = field.field_key.includes('anggaran') || field.field_key.includes('belanja') || field.field_key.includes('rm') || field.field_key.includes('pnbp') || field.field_key.includes('sbsn')
                      return (
                        <div key={field.field_key} className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">{field.label}</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                            {isRupiah
                              ? `Rp ${Number(totalVal).toLocaleString('id-ID')}`
                              : Number(totalVal).toLocaleString('id-ID')
                            }
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{AGREGASI_SHORT[agregasiOf(field)]}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Weekly breakdown table */}
                {aggregatedData?.weekRows && aggregatedData.weekRows.length > 0 && (
                  <div className="pt-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                      Rincian Sumber Data Mingguan ({aggregatedData.weekRows.filter(w => w.hasData).length} dari {aggregatedData.weekRows.length} minggu terisi)
                    </h4>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                          <tr>
                            <th className="py-2.5 px-3 font-semibold">Periode Minggu</th>
                            {fieldDefs.filter(f => f.tipe === 'angka').slice(0, 4).map(f => (
                              <th key={f.field_key} className="py-2.5 px-3 font-semibold text-right">{f.label}</th>
                            ))}
                            <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {aggregatedData.weekRows.map(w => (
                            <tr key={w.period.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                              <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100">{formatPeriodLabel(w.period)}</td>
                              {fieldDefs.filter(f => f.tipe === 'angka').slice(0, 4).map(f => {
                                const val = w.values[f.field_key]
                                const isRupiah = f.field_key.includes('anggaran') || f.field_key.includes('belanja')
                                return (
                                  <td key={f.field_key} className="py-2.5 px-3 text-right font-mono">
                                    {val !== undefined && val !== null
                                      ? (isRupiah ? `Rp ${Number(val).toLocaleString('id-ID')}` : Number(val).toLocaleString('id-ID'))
                                    : '-'
                                  }
                                  </td>
                                )
                              })}
                              <td className="py-2.5 px-3 text-center">
                                {w.hasData ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-medium">
                                    <Check size={10} /> Terisi
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-gray-400">Kosong</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )
      ) : (
        <div className="card p-8 text-center text-gray-400 dark:text-gray-500">
          <p>Tidak ada periode tersedia untuk level ini.</p>
        </div>
      )}
      </>
      )}

      {/* Add/Edit Entry Modal */}
      <Modal
        open={addEntryModal}
        onClose={() => { setAddEntryModal(false); setEditEntry(null); setFormValues({}) }}
        title={editEntry ? 'Edit Baris Data' : 'Tambah Baris Rincian Data'}
        maxWidth="max-w-3xl"
      >
        <DynamicForm
          level="bulan"
          fields={fieldDefs}
          values={formValues}
          onChange={(key, val) => setFormValues(v => ({ ...v, [key]: val }))}
          disabled={false}
          onSubmit={(e) => { e.preventDefault(); saveEntry(formValues) }}
          loading={saving}
        />
      </Modal>

      {/* View Entry Modal */}
      <Modal
        open={!!viewEntry}
        onClose={() => setViewEntry(null)}
        title="Detail Rincian Data"
        maxWidth="max-w-2xl"
      >
        {viewEntry && (
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fieldDefs.map(fd => {
                const isFull = fd.field_key === 'alamat' || fd.field_key.includes('link') || fd.field_key === 'nama_pelatihan'
                const val = viewEntry.data_json?.[fd.field_key] ?? '-'
                const isLink = String(val).startsWith('http://') || String(val).startsWith('https://')

                return (
                  <div key={fd.field_key} className={`p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 ${isFull ? 'sm:col-span-2' : ''}`}>
                    <p className="text-xs text-gray-400 font-medium">{fd.label}</p>
                    {isLink ? (
                      <a href={val} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                        {val}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words mt-0.5">
                        {val}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* Upload Column Mapping Modal */}
      <Modal
        open={uploadModal}
        onClose={() => { setUploadModal(false); setMappingData(null) }}
        title="Cocokkan Kolom Excel"
        maxWidth="max-w-2xl"
      >
        {mappingData && (
          <ColumnMappingScreen
            excelHeaders={mappingData.headers}
            fieldDefs={fieldDefs}
            initialMapping={mappingData.initialMapping}
            onConfirm={handleImportConfirm}
            onCancel={() => { setUploadModal(false); setMappingData(null) }}
          />
        )}
      </Modal>
      <HapusMassalDialog
        open={!!clearDialog}
        onClose={() => setClearDialog(null)}
        onConfirm={confirmClear}
        isAdmin={isAdmin}
        count={clearDialog?.count || 0}
        title={clearDialog?.kind === 'entries' ? 'Hapus Semua Data Bulan Ini' : 'Kosongkan Data Minggu Ini'}
        details={[
          ['Jenis Data', jenisData.judul],
          ['UPT', currentUptLabel || currentUptKey],
          ['Periode', activePeriod ? formatPeriodLabel(activePeriod) : '-'],
        ]}
      />
    </div>
  )
}
