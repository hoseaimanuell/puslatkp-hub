/**
 * views/admin/KelolaJenisData.jsx
 * Admin: CRUD 9 Jenis Data + Relasi Pasangan + Form Builder Fleksibel
 * Admin bisa bebas membuat kolom teks, angka, tanggal, narasi, dan pilihan (custom/E-Laut)
 */
import { useState, useEffect } from 'react'
import { db, getFeatures } from '../../lib/db'
import { confirmDialog } from '../../lib/dialog'
import { AGREGASI_LABEL, defaultAgregasi } from '../../lib/agregasi'
import { PERAN_REKAP, peranUntukTipe, tebakPeran } from '../../lib/peranRekap'
import { useAuth } from '../../AuthContext'
import InfoCard from '../../components/InfoCard'
import Modal from '../../components/Modal'
import Badge from '../../components/Badge'
import BuatJenisDataExcelModal from './BuatJenisDataExcel'
import { TIPE_OPTIONS, FormSection, QUICK_PRESETS, SortableField } from './KolomJenisData'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy
} from '@dnd-kit/sortable'
import {
  Plus, Settings, Trash2, GripVertical,
  ChevronRight, Globe, GlobeLock, Loader2, ArrowLeft,
  ToggleLeft, ToggleRight, Edit, Link2, Check, Sparkles,
  AlertTriangle, CheckCircle2, FileSpreadsheet,
  Sigma, Lock
} from 'lucide-react'

const MODE_LABEL = { rincian: 'Per nama', agregasi: 'Rekap angka saja', upload_file: 'Unggah berkas (lama)' }
const modeLabel = jd => MODE_LABEL[jd?.mode_bulanan] || 'Per nama'

export default function KelolaJenisData() {
  const { profile } = useAuth()
  const [jenisDataList, setJenisDataList] = useState([])
  const [selected, setSelected] = useState(null)
  const [activeLevel, setActiveLevel] = useState('bulan')
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [fieldLoading, setFieldLoading] = useState(false)
  const [uptList, setUptList] = useState([])
  const [periods, setPeriods] = useState([])
  const [excelWizardOpen, setExcelWizardOpen] = useState(false)

  // Modals
  const [createModal, setCreateModal] = useState(false)
  const [editJdModal, setEditJdModal] = useState(false)
  const [addFieldModal, setAddFieldModal] = useState(false)
  const [editingField, setEditingField] = useState(null)

  // Form states
  const [jdForm, setJdForm] = useState({
    judul: '',
    deskripsi: '',
    level_utama: 'minggu',
    mode_bulanan: 'rincian',
    butuh_input_bulanan: false,
    pasangan_mingguan_id: '',
    publik_boleh_lihat: false,
    multi_baris: false,
    kumulatif_bulanan: false,
  })

  const [fieldForm, setFieldForm] = useState({
    label: '',
    field_key: '',
    tipe: 'teks',
    wajib: false,
    is_identitas: false,
    opsi_text: '',
    agregasi: 'sum',
    opsi_bersyarat_enabled: false,
    depends_on: '',
    bersyarat_map: {},
    peran_rekap: null,
    peranDisentuh: false, // selama belum dipilih manual, peran ditebak otomatis dari nama & tipe kolom
  })

  const [peranRekapAktif, setPeranRekapAktif] = useState(false) // kolom peran_rekap sudah ada (migrasi_16)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null) // { type: 'success' | 'error', message }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  function showToast(message, type = 'success') {
    setToast({ type, message })
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    loadJenisData()
    getFeatures().then(f => setPeranRekapAktif(!!f.peranRekap))
    db.from('upt_list').select('*').eq('aktif', true).order('label').then(({ data }) => setUptList(data || []))
    db.from('periods').select('*').then(({ data }) => setPeriods(data || []))
  }, [])

  useEffect(() => {
    if (selected) {
      loadFields()
    }
  }, [selected?.id, activeLevel])

  async function loadJenisData() {
    setLoading(true)
    const { data } = await db.from('jenis_data').select('*').order('created_at')
    setJenisDataList(data || [])
    setLoading(false)
  }

  async function loadFields() {
    setFieldLoading(true)
    const { data } = await db.from('field_definitions')
      .select('*')
      .eq('jenis_data_id', selected.id)
      .eq('level', activeLevel)
      .order('urutan')
    setFields(data || [])
    setFieldLoading(false)
  }

  function handleSelectJd(jd) {
    setSelected(jd)
    setActiveLevel(jd.level_utama || 'minggu')
  }

  async function saveJenisData(e) {
    e.preventDefault()
    if (jdForm.level_utama === 'bulan' && jdForm.mode_bulanan === 'agregasi' && !jdForm.pasangan_mingguan_id) {
      showToast('Rekap angka saja wajib memilih Pasangan Jenis Data Mingguan.', 'error')
      return
    }
    setSaving(true)

    try {
      const payload = {
        judul: jdForm.judul,
        deskripsi: jdForm.deskripsi,
        level_utama: jdForm.level_utama,
        mode_bulanan: jdForm.level_utama === 'bulan' ? (jdForm.mode_bulanan || 'rincian') : null,
        butuh_input_bulanan: jdForm.level_utama === 'bulan' ? true : jdForm.butuh_input_bulanan,
        pasangan_mingguan_id: jdForm.pasangan_mingguan_id || null,
        publik_boleh_lihat: jdForm.publik_boleh_lihat,
        multi_baris: jdForm.level_utama === 'minggu' && !!jdForm.multi_baris,
        kumulatif_bulanan: jdForm.level_utama === 'bulan' && jdForm.mode_bulanan === 'rincian' && !!jdForm.kumulatif_bulanan,
        aktif: true,
        dibuat_oleh: profile?.id,
      }

      if (editJdModal && selected) {
        const { error } = await db.from('jenis_data').update(payload).eq('id', selected.id)
        if (error) throw error
        setSelected({ ...selected, ...payload })
        setEditJdModal(false)
        showToast(`Pengaturan "${jdForm.judul}" berhasil diperbarui!`)
      } else {
        // key hanya ditentukan saat membuat baru — mengedit judul TIDAK mengubah key (identitas internal stabil).
        const key = jdForm.judul.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        const { data, error } = await db.from('jenis_data').insert({ ...payload, key }).select().single()
        if (error) throw error
        if (data) {
          setSelected(data)
          setActiveLevel(data.level_utama)
        }
        setCreateModal(false)
        showToast(`Jenis Data baru "${jdForm.judul}" berhasil ditambahkan!`)
      }

      await loadJenisData()
    } catch (err) {
      console.error('Error saveJenisData:', err)
      showToast(err.message || 'Gagal menyimpan Jenis Data', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function saveField(e) {
    e.preventDefault()
    setSaving(true)

    try {
      const useBersyarat = fieldForm.tipe === 'pilihan' && fieldForm.opsi_bersyarat_enabled
      if (useBersyarat && !fieldForm.depends_on) {
        showToast('Pilih kolom yang menentukan opsi bersyarat.', 'error')
        setSaving(false)
        return
      }

      const opsi = !useBersyarat && fieldForm.opsi_text
        ? fieldForm.opsi_text.split(',').map(s => s.trim()).filter(Boolean)
        : null

      const opsiBersyarat = useBersyarat
        ? {
            depends_on: fieldForm.depends_on,
            options: Object.fromEntries(
              Object.entries(fieldForm.bersyarat_map || {}).map(([k, v]) => [k, String(v || '').split(',').map(s => s.trim()).filter(Boolean)]),
            ),
          }
        : null

      const payload = {
        jenis_data_id: selected.id,
        level: activeLevel,
        field_key: fieldForm.field_key || fieldForm.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        label: fieldForm.label,
        tipe: fieldForm.tipe,
        wajib: fieldForm.wajib,
        is_identitas: fieldForm.is_identitas,
        opsi_pilihan: opsi,
        opsi_bersyarat: opsiBersyarat,
        agregasi: fieldForm.tipe === 'angka' ? fieldForm.agregasi : 'sum',
        // Peran di rekap hanya dipakai kolom level minggu (rekap_nilai); level bulan dibiarkan apa adanya.
        ...(peranRekapAktif && activeLevel === 'minggu'
          ? { peran_rekap: peranUntukTipe(fieldForm.tipe).includes(fieldForm.peran_rekap) ? fieldForm.peran_rekap : null }
          : {}),
      }

      if (editingField) {
        const { error } = await db.from('field_definitions').update(payload).eq('id', editingField.id)
        if (error) throw error
        showToast(`Kolom "${fieldForm.label}" berhasil diperbarui!`)
      } else {
        const maxUrutan = Math.max(0, ...fields.map(f => f.urutan)) + 1
        const { error } = await db.from('field_definitions').insert({
          ...payload,
          urutan: maxUrutan,
          dibuat_oleh: profile?.id,
        })
        if (error) throw error
        showToast(`Kolom baru "${fieldForm.label}" berhasil ditambahkan!`)
      }

      setEditingField(null)
      setAddFieldModal(false)
      loadFields()
    } catch (err) {
      console.error('Error saveField:', err)
      showToast(err.message || 'Gagal menyimpan kolom', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleField(field) {
    try {
      const { error } = await db.from('field_definitions').update({ aktif: !field.aktif }).eq('id', field.id)
      if (error) throw error
      showToast(`Kolom "${field.label}" ${!field.aktif ? 'diaktifkan' : 'dinonaktifkan'}`)
      loadFields()
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui status kolom', 'error')
    }
  }

  async function deleteField(field) {
    if (!await confirmDialog(`Hapus kolom "${field.label}"? Kolom ini tidak akan ditampilkan lagi.`)) return
    try {
      const { error } = await db.from('field_definitions').delete().eq('id', field.id)
      if (error) throw error
      showToast(`Kolom "${field.label}" berhasil dihapus`)
      loadFields()
    } catch (err) {
      showToast(err.message || 'Gagal menghapus kolom', 'error')
    }
  }

  async function togglePublik(jd) {
    try {
      const { error } = await db.from('jenis_data').update({ publik_boleh_lihat: !jd.publik_boleh_lihat }).eq('id', jd.id)
      if (error) throw error
      const updated = { ...jd, publik_boleh_lihat: !jd.publik_boleh_lihat }
      setJenisDataList(prev => prev.map(j => j.id === jd.id ? updated : j))
      if (selected?.id === jd.id) setSelected(updated)
      showToast(`Akses publik untuk "${jd.judul}" ${!jd.publik_boleh_lihat ? 'diizinkan' : 'ditutup'}`)
    } catch (err) {
      showToast(err.message || 'Gagal mengubah akses publik', 'error')
    }
  }

  async function toggleAktif(jd) {
    try {
      const { error } = await db.from('jenis_data').update({ aktif: !jd.aktif }).eq('id', jd.id)
      if (error) throw error
      showToast(`Jenis Data "${jd.judul}" ${!jd.aktif ? 'diaktifkan' : 'dinonaktifkan'}`)
      loadJenisData()
    } catch (err) {
      showToast(err.message || 'Gagal mengubah status', 'error')
    }
  }

  async function deleteJenisData(jd) {
    if (!jd) return
    const confirmMessage = `Apakah Anda yakin ingin menghapus Jenis Data "${jd.judul}" secara permanen?\n\nSemua definisi kolom dan data terkait jenis data ini akan dihapus dari sistem.`
    if (!await confirmDialog(confirmMessage)) return

    try {
      setLoading(true)
      // Hapus data anak terlebih dahulu untuk mencegah error foreign key
      await Promise.all([
        db.from('field_definitions').delete().eq('jenis_data_id', jd.id),
        db.from('rekap_nilai').delete().eq('jenis_data_id', jd.id),
        db.from('data_entries').delete().eq('jenis_data_id', jd.id),
        db.from('dokumen_upload').delete().eq('jenis_data_id', jd.id),
      ])

      // Hapus record utama jenis_data
      const { error } = await db.from('jenis_data').delete().eq('id', jd.id)
      if (error) throw error

      if (selected?.id === jd.id) {
        setSelected(null)
      }

      showToast(`Jenis Data "${jd.judul}" berhasil dihapus permanen!`)
      await loadJenisData()
    } catch (err) {
      console.error('Error deleteJenisData:', err)
      showToast(err.message || 'Gagal menghapus Jenis Data', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = fields.findIndex(f => f.id === active.id)
    const newIndex = fields.findIndex(f => f.id === over.id)
    const reordered = arrayMove(fields, oldIndex, newIndex)
    setFields(reordered)

    for (let i = 0; i < reordered.length; i++) {
      await db.from('field_definitions').update({ urutan: i + 1 }).eq('id', reordered[i].id)
    }
  }

  function openEditField(field) {
    setEditingField(field)
    setFieldForm({
      label: field.label,
      field_key: field.field_key,
      tipe: field.tipe,
      wajib: !!field.wajib,
      is_identitas: !!field.is_identitas,
      opsi_text: (field.opsi_pilihan || []).join(', '),
      agregasi: field.agregasi || defaultAgregasi(field.field_key),
      opsi_bersyarat_enabled: !!field.opsi_bersyarat,
      depends_on: field.opsi_bersyarat?.depends_on || '',
      bersyarat_map: field.opsi_bersyarat
        ? Object.fromEntries(Object.entries(field.opsi_bersyarat.options || {}).map(([k, v]) => [k, (v || []).join(', ')]))
        : {},
      peran_rekap: field.peran_rekap ?? null,
      peranDisentuh: true,
    })
    setAddFieldModal(true)
  }

  function openCreateField() {
    setEditingField(null)
    setFieldForm({
      label: '',
      field_key: '',
      tipe: 'teks',
      wajib: false,
      is_identitas: false,
      opsi_text: '',
      // Bawaan kumulatif (nilai terakhir) hanya berlaku untuk kolom angka level minggu (satu-satunya level yang
      // punya kontrol Cara Rekap); level bulan tetap 'sum' seperti bawaan lama, mengikuti be/scripts/build-sql.js.
      agregasi: activeLevel === 'minggu' ? 'last' : 'sum',
      opsi_bersyarat_enabled: false,
      depends_on: '',
      bersyarat_map: {},
      peran_rekap: null,
      peranDisentuh: false,
    })
    setAddFieldModal(true)
  }

  // Nama/tipe kolom berubah: tebak ulang peran (selama Admin belum memilih sendiri), dan buang peran yang tidak
  // berlaku lagi untuk tipe barunya (mis. "Peserta" hanya untuk kolom Angka).
  function ubahNamaAtauTipe(patch) {
    setFieldForm(f => {
      const next = { ...f, ...patch }
      if (!next.peranDisentuh) next.peran_rekap = tebakPeran(next.label, next.tipe)
      else if (!peranUntukTipe(next.tipe).includes(next.peran_rekap)) next.peran_rekap = null
      return next
    })
  }

  function openEditJd(jd) {
    setSelected(jd)
    setJdForm({
      judul: jd.judul,
      deskripsi: jd.deskripsi || '',
      level_utama: jd.level_utama || 'minggu',
      mode_bulanan: jd.mode_bulanan || 'rincian',
      butuh_input_bulanan: !!jd.butuh_input_bulanan,
      pasangan_mingguan_id: jd.pasangan_mingguan_id || '',
      publik_boleh_lihat: !!jd.publik_boleh_lihat,
      multi_baris: !!jd.multi_baris,
      kumulatif_bulanan: !!jd.kumulatif_bulanan,
    })
    setEditJdModal(true)
  }

  // Cari pasangan
  function findPartner(jd) {
    if (!jd) return null
    if (jd.level_utama === 'bulan' && jd.pasangan_mingguan_id) {
      return jenisDataList.find(j => j.id === jd.pasangan_mingguan_id) || null
    }
    if (jd.level_utama === 'minggu') {
      return jenisDataList.find(j => j.pasangan_mingguan_id === jd.id) || null
    }
    return null
  }

  // Pilihan pasangan mingguan untuk modal
  const weeklyOptions = jenisDataList.filter(j => j.level_utama === 'minggu')

  // TAMPILAN 1: ATUR KOLOM JENIS DATA TERPILIH
  if (selected && !editJdModal) {
    const partner = findPartner(selected)
    // Peran di rekap hanya berlaku untuk kolom mingguan (angka rekap dihitung dari data mingguan).
    const tampilkanPeran = peranRekapAktif && activeLevel === 'minggu'

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header Selected */}
        <div
          className="card p-5"
        >
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-2 text-blue-600 dark:text-blue-300 hover:text-gray-900 dark:hover:text-white text-sm mb-3 transition-colors"
          >
            <ArrowLeft size={16} />
            Kembali ke Daftar Jenis Data ({jenisDataList.length} Data)
          </button>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="font-bold text-2xl tracking-tight text-[#0B1830]">{selected.judul}</h1>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                  selected.level_utama === 'bulan'
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {selected.level_utama === 'bulan' ? `Diisi bulanan · ${modeLabel(selected)}` : 'Diisi mingguan'}
                </span>
              </div>
              <p className="text-sm text-gray-600 max-w-2xl">
                {selected.level_utama === 'bulan'
                  ? 'UPT mengisi data ini setiap bulan di menu Input Bulanan.'
                  : `UPT mengisi data ini setiap minggu di menu Input Mingguan${selected.multi_baris ? ', boleh lebih dari satu baris per minggu' : ''}.`}
              </p>
              {selected.deskripsi && <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xl mt-1">{selected.deskripsi}</p>}

              {partner && (
                <div className="flex items-center gap-2 mt-2 text-xs text-blue-600 dark:text-blue-300 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg w-fit">
                  <Link2 size={13} />
                  <span>Terkait dengan pasangan: <strong>{partner.judul}</strong> ({partner.level_utama})</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => openEditJd(selected)}
                className="btn-secondary text-xs bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700"
              >
                <Edit size={14} />
                Edit Pengaturan
              </button>
              <button
                onClick={() => deleteJenisData(selected)}
                className="btn-secondary text-xs bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/50 border-rose-400/30"
                title="Hapus Jenis Data ini secara permanen"
              >
                <Trash2 size={14} />
                Hapus
              </button>
              <button
                onClick={() => togglePublik(selected)}
                className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-colors ${
                  selected.publik_boleh_lihat
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {selected.publik_boleh_lihat ? <Globe size={14} /> : <GlobeLock size={14} />}
                {selected.publik_boleh_lihat ? 'Publik: Ya' : 'Publik: Tidak'}
              </button>
            </div>
          </div>
        </div>

        {/* Ringkasan: kolom mana yang mengisi 4 angka rekap (Pelatihan/Peserta/Pagu/Realisasi) */}
        {tampilkanPeran && !fieldLoading && (
          <div className="card p-5">
            <div className="flex items-start gap-3 mb-4">
              <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Sigma size={18} />
              </span>
              <div>
                <h2 className="font-semibold text-[#0B1830]">Cara data ini dihitung di rekap</h2>
                <p className="text-sm text-gray-500 max-w-3xl">
                  Tabel Rekap UPT/Balai dan Rekap Bulanan menampilkan empat angka ringkasan. Tentukan kolom mana yang
                  mengisinya lewat tombol <Edit size={12} className="inline -mt-0.5" /> pada kolom, bagian <em>"Dihitung di rekap sebagai"</em>.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(PERAN_REKAP).map(([key, p]) => {
                const cols = fields.filter(f => f.aktif && f.peran_rekap === key)
                return (
                  <div key={key} className={`rounded-xl border p-3 ${cols.length ? 'border-blue-200 bg-blue-50/40' : 'border-dashed border-gray-300 bg-gray-50/60'}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{p.kolomRekap}</p>
                    {cols.length ? (
                      <p className="text-sm font-semibold text-[#0B1830] mt-1 leading-snug">{cols.map(c => c.label).join(' + ')}</p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1 leading-snug">
                        {key === 'judul' ? 'Belum diatur — dihitung 1 per UPT bila ada isian' : 'Belum diatur — selalu 0 di rekap'}
                      </p>
                    )}
                    {key === 'judul' && cols.length > 1 && (
                      <p className="text-[11px] text-amber-700 mt-1.5 flex items-start gap-1">
                        <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" /> Pilih satu kolom saja agar pelatihan tidak terhitung dua kali.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Daftar kolom isian */}
        <div className="card p-5">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div>
              <h2 className="font-semibold text-[#0B1830]">Kolom isian ({fields.length})</h2>
              <p className="text-sm text-gray-500 max-w-2xl">
                Kolom-kolom ini tampil sebagai form yang diisi UPT, dengan urutan yang sama seperti di sini. Seret ikon
                <GripVertical size={13} className="inline -mt-0.5 mx-0.5" /> untuk mengubah urutan.
              </p>
            </div>
            <button onClick={openCreateField} className="btn-primary text-sm">
              <Plus size={15} />
              Tambah Kolom
            </button>
          </div>

          {fieldLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : fields.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-300 rounded-xl">
              <p className="text-sm font-medium text-gray-600">Belum ada kolom.</p>
              <p className="text-xs text-gray-400 mt-1">Klik "Tambah Kolom" untuk membuat kolom pertama form ini.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map(field => (
                    <SortableField
                      key={field.id}
                      field={field}
                      onToggle={toggleField}
                      onEdit={openEditField}
                      onDelete={deleteField}
                      tampilkanPeran={tampilkanPeran}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Modal Add / Edit Field */}
        <Modal
          open={addFieldModal}
          onClose={() => setAddFieldModal(false)}
          title={editingField ? `Edit Kolom: ${editingField.label}` : 'Tambah Kolom Baru'}
          maxWidth="max-w-2xl"
          footer={
            <>
              <button onClick={() => setAddFieldModal(false)} className="btn-secondary">Batal</button>
              <button form="field-form" type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
                {saving && <Loader2 size={15} className="animate-spin" />}
                <span>{saving ? 'Menyimpan...' : (editingField ? 'Simpan Perubahan' : 'Tambah Kolom')}</span>
              </button>
            </>
          }
        >
          <form id="field-form" onSubmit={saveField} className="space-y-6">
            <FormSection title="Nama kolom" hint="Tampil sebagai judul kolom di form UPT dan di tabel rekap.">
              <input
                type="text"
                value={fieldForm.label}
                onChange={e => ubahNamaAtauTipe({ label: e.target.value })}
                className="form-input"
                required
                autoFocus
                placeholder="mis. Nama Pelatihan, Jumlah Peserta, Pagu Anggaran"
              />
            </FormSection>

            <FormSection title="Jenis isian" hint="Menentukan bentuk isian di form UPT.">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Jenis isian">
                {TIPE_OPTIONS.map(opt => {
                  const active = fieldForm.tipe === opt.value
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => ubahNamaAtauTipe({ tipe: opt.value })}
                      className={`text-left rounded-xl border p-3 transition-colors ${
                        active ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <span className={`flex items-center gap-1.5 text-sm font-semibold ${active ? 'text-blue-700' : 'text-[#0B1830]'}`}>
                        <Icon size={15} /> {opt.label}
                      </span>
                      <span className="block text-[11px] text-gray-500 mt-0.5">{opt.desc}</span>
                    </button>
                  )
                })}
              </div>
            </FormSection>

            {/* Jika tipe pilihan: sediakan input opsi & quick preset, atau opsi bersyarat tergantung kolom lain */}
            {fieldForm.tipe === 'pilihan' && (() => {
              const driverCandidates = fields.filter(f => f.tipe === 'pilihan' && f.opsi_pilihan?.length && f.id !== editingField?.id)
              const driverField = driverCandidates.find(f => f.field_key === fieldForm.depends_on)
              return (
                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldForm.opsi_bersyarat_enabled}
                      onChange={e => setFieldForm(f => ({ ...f, opsi_bersyarat_enabled: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span className="text-xs font-medium text-blue-900 dark:text-blue-200">
                      Opsi tergantung kolom lain (bersyarat)
                    </span>
                  </label>
                  {!driverCandidates.length && (
                    <p className="text-[11px] text-gray-500">
                      Belum ada kolom bertipe Pilihan (dengan opsi tetap) lain di level ini untuk dijadikan acuan.
                    </p>
                  )}

                  {fieldForm.opsi_bersyarat_enabled ? (
                    <div className="space-y-3">
                      <div>
                        <label className="form-label text-blue-900 dark:text-blue-200">Tergantung kolom</label>
                        <select
                          value={fieldForm.depends_on}
                          onChange={e => setFieldForm(f => ({ ...f, depends_on: e.target.value, bersyarat_map: {} }))}
                          className="form-select text-xs"
                        >
                          <option value="">— pilih kolom —</option>
                          {driverCandidates.map(f => <option key={f.id} value={f.field_key}>{f.label}</option>)}
                        </select>
                      </div>
                      {driverField && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                            Opsi kolom ini untuk tiap nilai "{driverField.label}" (pisahkan dengan koma):
                          </p>
                          {driverField.opsi_pilihan.map(val => (
                            <div key={val}>
                              <label className="text-[11px] text-gray-600 dark:text-gray-300">{val}</label>
                              <input
                                type="text"
                                value={fieldForm.bersyarat_map[val] || ''}
                                onChange={e => setFieldForm(f => ({ ...f, bersyarat_map: { ...f.bersyarat_map, [val]: e.target.value } }))}
                                className="form-input text-xs"
                                placeholder={`Opsi bila "${driverField.label}" = ${val}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="form-label text-blue-900 dark:text-blue-200">
                          Daftar Opsi Pilihan (Ketik bebas, pisahkan dengan koma)
                        </label>
                        <textarea
                          rows={2}
                          value={fieldForm.opsi_text}
                          onChange={e => setFieldForm(f => ({ ...f, opsi_text: e.target.value }))}
                          className="form-input text-xs"
                          placeholder="mis. Opsi 1, Opsi 2, Opsi 3"
                          required
                        />
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                          <Sparkles size={12} className="text-amber-500" />
                          Atau klik preset pilihan siap pakai:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {QUICK_PRESETS.map(p => (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => setFieldForm(f => ({ ...f, opsi_text: p.opsi }))}
                              className="text-[11px] px-2.5 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 rounded-lg transition-colors text-gray-700 dark:text-gray-200"
                            >
                              + {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })()}

            {tampilkanPeran && peranUntukTipe(fieldForm.tipe).length > 0 && (
              <FormSection
                title="Dihitung di rekap sebagai"
                hint="Menentukan angka ringkasan mana di Rekap UPT/Balai dan Rekap Bulanan yang diisi kolom ini."
              >
                <div className="space-y-2" role="radiogroup" aria-label="Dihitung di rekap sebagai">
                  {[null, ...peranUntukTipe(fieldForm.tipe)].map(key => {
                    const p = key ? PERAN_REKAP[key] : null
                    const active = (fieldForm.peran_rekap ?? null) === key
                    const dipakai = key && fields.find(f => f.aktif && f.peran_rekap === key && f.id !== editingField?.id)
                    return (
                      <button
                        key={key || 'none'}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setFieldForm(f => ({ ...f, peran_rekap: key, peranDisentuh: true }))}
                        className={`w-full text-left flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                          active ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 ${active ? 'border-blue-600 bg-blue-600 shadow-[inset_0_0_0_2px_white]' : 'border-gray-300'}`} />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-[#0B1830]">
                            {p ? `${p.label} → kolom ${p.kolomRekap}` : 'Tidak dihitung'}
                          </span>
                          <span className="block text-xs text-gray-500 mt-0.5">
                            {p ? `${p.penjelasan} Contoh: ${p.contoh}.` : 'Kolom ini hanya tampil di form dan tabel rincian.'}
                          </span>
                          {key === 'judul' && dipakai && (
                            <span className="block text-[11px] text-amber-700 mt-1">
                              Kolom "{dipakai.label}" sudah menjadi judul baris — sebaiknya pilih satu saja.
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {!fieldForm.peranDisentuh && fieldForm.peran_rekap && (
                  <p className="text-[11px] text-blue-700 mt-2 flex items-center gap-1">
                    <Sparkles size={12} /> Dipilih otomatis dari nama kolom — silakan ganti bila kurang tepat.
                  </p>
                )}
              </FormSection>
            )}

            {fieldForm.tipe === 'angka' && activeLevel === 'minggu' && (
              <FormSection
                title="Cara menggabungkan angka mingguan"
                hint="Dipakai saat angka mingguan direkap menjadi bulanan, triwulan, dan tahunan."
              >
                <select
                  value={fieldForm.agregasi}
                  onChange={e => setFieldForm(f => ({ ...f, agregasi: e.target.value }))}
                  className="form-select"
                >
                  {Object.entries(AGREGASI_LABEL).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  <strong>Nilai terakhir</strong> untuk angka berjalan yang terus bertambah (minggu 1 = 10, minggu 2 = 30 →
                  bulan ini = 30). <strong>Jumlahkan</strong> bila tiap minggu mencatat tambahan baru yang terpisah
                  (minggu 1 = 10, minggu 2 = 20 → bulan ini = 30).
                </p>
              </FormSection>
            )}

            <FormSection title="Pengaturan lain" hint="">
              <div className="grid sm:grid-cols-2 gap-2">
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 hover:border-gray-300">
                  <input
                    type="checkbox"
                    checked={fieldForm.wajib}
                    onChange={e => setFieldForm(f => ({ ...f, wajib: e.target.checked }))}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#0B1830]">Wajib diisi</span>
                    <span className="block text-xs text-gray-500">UPT harus mengisi kolom ini sebelum menyimpan.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 hover:border-gray-300">
                  <input
                    type="checkbox"
                    checked={fieldForm.is_identitas}
                    onChange={e => setFieldForm(f => ({ ...f, is_identitas: e.target.checked }))}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#0B1830]">Data pribadi <Lock size={12} className="inline -mt-0.5" /></span>
                    <span className="block text-xs text-gray-500">Mis. NIK, telepon, alamat. Diberi tanda gembok di form sebagai pengingat.</span>
                  </span>
                </label>
              </div>
            </FormSection>

            <details className="rounded-xl border border-gray-200 px-3 py-2 text-sm group">
              <summary className="cursor-pointer text-gray-600 font-medium select-none">Lanjutan: kode kolom</summary>
              <div className="pt-3 pb-1">
                {editingField ? (
                  <>
                    <p className="font-mono text-xs px-3 py-2 rounded-lg bg-gray-100 text-gray-700">{fieldForm.field_key}</p>
                    <p className="text-xs text-gray-500 mt-1.5">
                      Kode tidak dapat diubah karena sudah dipakai untuk menyimpan data yang ada. Nama kolom di atas tetap bisa diganti bebas.
                    </p>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={fieldForm.field_key}
                      onChange={e => setFieldForm(f => ({ ...f, field_key: e.target.value }))}
                      className="form-input font-mono text-xs"
                      placeholder={fieldForm.label ? fieldForm.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : 'dibuat otomatis dari nama kolom'}
                    />
                    <p className="text-xs text-gray-500 mt-1.5">Kosongkan saja — kode dibuat otomatis dari nama kolom.</p>
                  </>
                )}
              </div>
            </details>
          </form>
        </Modal>
      </div>
    )
  }

  // TAMPILAN 2: DAFTAR 9 JENIS DATA DENGAN PENANDA VISUAL PASANGAN
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-semibold text-2xl text-gray-900 dark:text-white">Kelola Jenis Data ({jenisDataList.length})</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Daftar jenis data dan kolom isiannya. Tiap jenis data punya satu level utama: minggu atau bulan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExcelWizardOpen(true)}
              className="btn-secondary"
              title="Buat Jenis Data baru sekaligus impor datanya dari berkas Excel"
            >
              <FileSpreadsheet size={16} />
              Buat dari Excel
            </button>
            <button
              onClick={() => {
                setJdForm({
                  judul: '',
                  deskripsi: '',
                  level_utama: 'minggu',
                  mode_bulanan: 'rincian',
                  butuh_input_bulanan: false,
                  pasangan_mingguan_id: '',
                  publik_boleh_lihat: false,
                  multi_baris: false,
                  kumulatif_bulanan: false,
                })
                setCreateModal(true)
              }}
              className="btn-primary"
            >
              <Plus size={16} />
              Buat Jenis Data Baru
            </button>
          </div>
        </div>
      </div>

      <BuatJenisDataExcelModal
        open={excelWizardOpen}
        onClose={() => setExcelWizardOpen(false)}
        onCreated={() => loadJenisData()}
        uptList={uptList}
        periods={periods}
      />

      <InfoCard title={`Daftar ${jenisDataList.length} Jenis Data & Relasi Pasangan`}>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : jenisDataList.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Belum ada Jenis Data.</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {jenisDataList.map((jd, idx) => {
              const partner = findPartner(jd)

              return (
                <div key={jd.id} className="py-4 flex items-center justify-between gap-4 flex-wrap hover:bg-gray-50/50 dark:hover:bg-gray-800/30 px-3 rounded-xl transition-colors">
                  <div className="flex-1 min-w-[280px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-400 font-bold">{idx + 1}.</span>
                      <h3 className="font-bold text-gray-900 dark:text-white text-base">{jd.judul}</h3>

                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        jd.level_utama === 'bulan'
                          ? 'bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                          : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}>
                        Level: {jd.level_utama === 'bulan' ? `Bulan (${modeLabel(jd)})` : 'Minggu (Rekap)'}
                      </span>


                      <Badge variant={jd.aktif ? 'success' : 'neutral'}>
                        {jd.aktif ? 'Aktif' : 'Nonaktif'}
                      </Badge>

                      {jd.publik_boleh_lihat && (
                        <Badge variant="blue"><Globe size={10} /> Publik</Badge>
                      )}
                    </div>

                    {jd.deskripsi && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl">{jd.deskripsi}</p>
                    )}

                    {/* Penanda Visual Pasangan */}
                    {partner ? (
                      <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg text-xs bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300">
                        <Link2 size={12} />
                        <span>Terkait dengan: <strong>{partner.judul}</strong> ({partner.level_utama})</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-400 mt-1 block">Tanpa pasangan (Mandiri)</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAktif(jd)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        jd.aktif ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'
                      }`}
                      title={jd.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                    >
                      {jd.aktif ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>

                    <button
                      onClick={() => openEditJd(jd)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title="Edit Pengaturan"
                    >
                      <Edit size={15} />
                    </button>

                    <button
                      onClick={() => deleteJenisData(jd)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="Hapus Jenis Data ini"
                    >
                      <Trash2 size={15} />
                    </button>

                    <button
                      onClick={() => handleSelectJd(jd)}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
                    >
                      <Settings size={14} />
                      Atur Kolom
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </InfoCard>

      {/* Modal Create / Edit Jenis Data */}
      <Modal
        open={createModal || editJdModal}
        onClose={() => { setCreateModal(false); setEditJdModal(false) }}
        title={editJdModal ? 'Edit Pengaturan Jenis Data' : 'Buat Jenis Data Baru'}
        footer={
          <>
            <button onClick={() => { setCreateModal(false); setEditJdModal(false) }} className="btn-secondary">
              Batal
            </button>
            <button form="jd-form" type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
              {saving && <Loader2 size={15} className="animate-spin" />}
              <span>{saving ? 'Menyimpan...' : (editJdModal ? 'Simpan Perubahan' : 'Buat & Atur Kolom')}</span>
            </button>
          </>
        }
      >
        <form id="jd-form" onSubmit={saveJenisData} className="space-y-4">
          <div>
            <label className="form-label">Judul Jenis Data <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={jdForm.judul}
              onChange={e => setJdForm(f => ({ ...f, judul: e.target.value }))}
              className="form-input"
              required
              placeholder="mis. Masyarakat, Aparatur, Belanja Modal, ..."
            />
          </div>

          <div>
            <label className="form-label">Deskripsi</label>
            <textarea
              rows={2}
              value={jdForm.deskripsi}
              onChange={e => setJdForm(f => ({ ...f, deskripsi: e.target.value }))}
              className="form-input resize-none"
              placeholder="Penjelasan data yang dikumpulkan"
            />
          </div>

          <div>
            <label className="form-label">Level & Tipe Pengisian <span className="text-rose-500">*</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                jdForm.level_utama === 'minggu'
                  ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 ring-1 ring-blue-500/30'
                  : 'border-gray-200 dark:border-gray-700'
              }`}>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="level_utama"
                    value="minggu"
                    checked={jdForm.level_utama === 'minggu'}
                    onChange={() => setJdForm(f => ({ ...f, level_utama: 'minggu', mode_bulanan: 'rincian', butuh_input_bulanan: false }))}
                    className="text-blue-600"
                  />
                  <span className="font-semibold text-xs text-gray-900 dark:text-white">Level MINGGU (Rekap)</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                  Form isian mingguan, otomatis direkap ke Bulanan, Triwulan, dan Tahunan.
                </p>
              </label>

              <label className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                jdForm.level_utama === 'bulan'
                  ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 ring-1 ring-blue-500/30'
                  : 'border-gray-200 dark:border-gray-700'
              }`}>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="level_utama"
                    value="bulan"
                    checked={jdForm.level_utama === 'bulan'}
                    onChange={() => setJdForm(f => ({ ...f, level_utama: 'bulan', butuh_input_bulanan: true }))}
                    className="text-blue-600"
                  />
                  <span className="font-semibold text-xs text-gray-900 dark:text-white">Level BULAN (Terpisah)</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                  Pelaporan bulanan terpisah (bisa berupa rincian identitas atau langsung upload file saja).
                </p>
              </label>
            </div>

            {/* Level Bulan: dua pilihan saja */}
            {jdForm.level_utama === 'bulan' && (
              <div className="mt-3 p-3.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200/80 dark:border-blue-800/60 space-y-2">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">Jenis data bulanan ini berisi:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className={`p-2.5 rounded-lg border cursor-pointer text-xs transition-all ${jdForm.mode_bulanan === 'rincian' ? 'border-blue-500 bg-white dark:bg-gray-900 text-blue-900 dark:text-blue-200 font-medium' : 'border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40 text-gray-600 dark:text-gray-300'}`}>
                    <div className="flex items-center gap-2">
                      <input type="radio" name="mode_pengisian_bulan" checked={jdForm.mode_bulanan === 'rincian'} onChange={() => setJdForm(f => ({ ...f, mode_bulanan: 'rincian' }))} className="text-blue-600" />
                      <span>Per nama (rincian)</span>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 pl-5">Satu baris per orang/peserta. Diisi lewat form atau impor Excel dengan kolom identitas.</p>
                  </label>
                  <label className={`p-2.5 rounded-lg border cursor-pointer text-xs transition-all ${jdForm.mode_bulanan === 'agregasi' ? 'border-blue-500 bg-white dark:bg-gray-900 text-blue-900 dark:text-blue-200 font-medium' : 'border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40 text-gray-600 dark:text-gray-300'}`}>
                    <div className="flex items-center gap-2">
                      <input type="radio" name="mode_pengisian_bulan" checked={jdForm.mode_bulanan === 'agregasi'} onChange={() => setJdForm(f => ({ ...f, mode_bulanan: 'agregasi' }))} className="text-blue-600" />
                      <span>Rekap angka saja</span>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 pl-5">Hanya angka total per bulan, dijumlahkan otomatis dari isian mingguan. Wajib memilih pasangan mingguan di bawah.</p>
                  </label>
                </div>
                {jdForm.mode_bulanan === 'upload_file' && <p className="text-[11px] text-amber-700 dark:text-amber-300">Jenis data ini masih memakai mode lama "unggah berkas". Pilih salah satu di atas untuk mengganti; berkas lama tetap tersimpan.</p>}
              </div>
            )}
          </div>

          {/* Pasangan Mingguan ID */}
          <div>
            <label className="form-label">Pasangan Jenis Data Mingguan</label>
            <select
              value={jdForm.pasangan_mingguan_id}
              onChange={e => setJdForm(f => ({ ...f, pasangan_mingguan_id: e.target.value }))}
              className="form-select text-xs"
            >
              <option value="">- Tidak Ada Pasangan (Mandiri) -</option>
              {weeklyOptions.map(w => (
                <option key={w.id} value={w.id}>{w.judul} (Level Minggu)</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              Untuk "Rekap angka saja" wajib diisi (angka bulan dijumlahkan dari minggu). Untuk "Per nama" bersifat opsional (validasi kelengkapan 4 minggu).
            </p>
          </div>

          {jdForm.level_utama === 'minggu' && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <input
                  type="checkbox"
                  checked={!!jdForm.multi_baris}
                  onChange={e => setJdForm(f => ({ ...f, multi_baris: e.target.checked }))}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">Boleh lebih dari 1 pelatihan per minggu</p>
                  <p className="text-[11px] text-gray-400">Menampilkan tombol "Tambah pelatihan lain" di form mingguan. Bawaan tetap 1 pelatihan.</p>
                </div>
              </label>
            </div>
          )}

          {jdForm.level_utama === 'bulan' && jdForm.mode_bulanan === 'rincian' && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <input
                  type="checkbox"
                  checked={!!jdForm.kumulatif_bulanan}
                  onChange={e => setJdForm(f => ({ ...f, kumulatif_bulanan: e.target.checked }))}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">Data kumulatif (bulan terbaru menggantikan sebelumnya)</p>
                  <p className="text-[11px] text-gray-400">UPT diharapkan mengunggah roster LENGKAP tiap bulan (bukan hanya yang berubah). Data by Name akan otomatis menampilkan bulan terakhir yang sudah ada datanya sebagai "data saat ini", bukan selalu bulan kalender berjalan.</p>
                </div>
              </label>
            </div>
          )}

          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <input
                type="checkbox"
                checked={jdForm.publik_boleh_lihat}
                onChange={e => setJdForm(f => ({ ...f, publik_boleh_lihat: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-600"
              />
              <div>
                <p className="text-xs font-semibold text-gray-900 dark:text-white">Tampilkan rekap ke Publik</p>
                <p className="text-[11px] text-gray-400">Kolom identitas pribadi (NIK/No HP/Alamat) otomatis terlindungi</p>
              </div>
            </label>
          </div>
        </form>
      </Modal>

      {/* Toast Notification Floating Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium text-white animate-fade-in ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
