/**
 * views/Documents.jsx
 * Repositori pedoman, template Excel, SOP pelaporan, dan arsip dokumen resmi.
 * Mendukung download berkas nyata dan pengaturan dokumen oleh Admin.
 */
import { useState, useEffect } from 'react'
import InfoCard from '../components/InfoCard'
import Modal from '../components/Modal'
import { useAuth } from '../AuthContext'
import { db } from '../lib/db'
import { generateTemplateExcel } from '../lib/excelExport'
import {
  FileText, Download, FileSpreadsheet,
  BookOpen, ShieldCheck, ExternalLink, Search, Plus, Trash2, CheckCircle2, ChevronDown
} from 'lucide-react'

const STORAGE_DOCS_KEY = 'puslatkp_official_docs_v1'

const DEFAULT_REPO_DOCS = [
  {
    id: 'doc-2',
    title: 'Petunjuk Teknis Pelaporan Kinerja & Aktivitas Harian UPT',
    desc: 'Buku panduan pengisian daily activity, batas waktu pelaporan, dan rekonsiliasi data mingguan.',
    category: 'Pedoman',
    format: 'TXT',
    size: '12 KB',
    content: 'PETUNJUK TEKNIS PELAPORAN KINERJA & AKTIVITAS HARIAN UPT\nPUSLATKP - KEMENTERIAN KELAUTAN DAN PERIKANAN\n\n1. Ketentuan Umum:\n- Seluruh UPT wajib melaporkan aktivitas harian dan rekap mingguan.\n- Batas waktu input data mingguan adalah setiap akhir periode berjalan.\n- Rekonsiliasi bulanan mencocokkan total peserta 4 minggu dengan rincian data peserta by name.\n\n2. Format & Prosedur:\n- Gunakan template excel resmi untuk unggah massal.\n- Laporkan kendala dan output nyata kegiatan pada modul Daily Activity.',
    fileName: 'Juknis_Pelaporan_Kinerja_UPT_PUSLATKP.txt',
    mime: 'text/plain;charset=utf-8;'
  },
  {
    id: 'doc-3',
    title: 'Kepmen KKP tentang Standar Pelatihan Kelautan dan Perikanan',
    desc: 'Dasar regulasi dan acuan standar kompetensi pelatihan aparatur dan masyarakat kelautan perikanan.',
    category: 'Regulasi',
    format: 'TXT',
    size: '18 KB',
    content: 'SALINAN KEPUTUSAN MENTERI KELAUTAN DAN PERIKANAN REPUBLIK INDONESIA\nTENTANG STANDAR PELATIHAN KELAUTAN DAN PERIKANAN\n\nMenimbang: Perlunya standardisasi mutu kompetensi sumber daya manusia kelautan dan perikanan...\nMengingat: Undang-Undang Kelautan dan Perikanan Republik Indonesia...\n\nMenetapkan:\nStandar Kurikulum, Silabus, Sarana Prasarana, dan Tenaga Pendidik / Instruktur / Widyaiswara pada Balai Pelatihan Kelautan dan Perikanan.',
    fileName: 'Kepmen_Standar_Pelatihan_Kelautan_Perikanan.txt',
    mime: 'text/plain;charset=utf-8;'
  },
  {
    id: 'doc-4',
    title: 'Standar Operasional Prosedur (SOP) Validasi Selisih Data',
    desc: 'Protokol penyesuaian saat terdeteksi selisih angka antara level Bulanan dan Mingguan.',
    category: 'SOP',
    format: 'TXT',
    size: '10 KB',
    content: 'STANDAR OPERASIONAL PROSEDUR (SOP) VALIDASI DATA & REKONSILIASI SELISIH\n\nLangkah-langkah Penanganan:\n1. Buka modul Input Data pada jenis data yang bersangkutan.\n2. Cek banner status validasi pada tab Bulan.\n3. Periksa selisih jumlah baris nama peserta dengan angka total mingguan.\n4. Lakukan penyesuaian data baris atau perbarui nilai form mingguan sebelum periode dikunci oleh admin.',
    fileName: 'SOP_Validasi_Selisih_Data_PUSLATKP.txt',
    mime: 'text/plain;charset=utf-8;'
  },
]

import PageHeader from '../components/PageHeader'

export default function Documents() {
  const { isAdmin } = useAuth()
  const [search, setSearch] = useState('')
  const [jenisDataList, setJenisDataList] = useState([])
  const [selectedJdId, setSelectedJdId] = useState('')
  const [fieldDefsMap, setFieldDefsMap] = useState({})
  const [docsList, setDocsList] = useState(() => {
    const saved = localStorage.getItem(STORAGE_DOCS_KEY)
    if (saved) {
      try { return JSON.parse(saved) } catch (e) {}
    }
    return DEFAULT_REPO_DOCS
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [newDoc, setNewDoc] = useState({
    title: '',
    desc: '',
    category: 'Pedoman',
    format: 'TXT',
    content: '',
  })

  useEffect(() => {
    loadJenisDataAndFields()
  }, [])

  async function loadJenisDataAndFields() {
    const [{ data: jds }, { data: fds }] = await Promise.all([
      db.from('jenis_data').select('*').eq('aktif', true).order('created_at'),
      db.from('field_definitions').select('*').eq('aktif', true).order('urutan'),
    ])
    setJenisDataList(jds || [])
    if (jds && jds.length > 0) {
      setSelectedJdId(jds[0].id)
    }

    const map = {}
    ;(fds || []).forEach(f => {
      if (!map[f.jenis_data_id]) map[f.jenis_data_id] = []
      map[f.jenis_data_id].push(f)
    })
    setFieldDefsMap(map)
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_DOCS_KEY, JSON.stringify(docsList))
  }, [docsList])

  const filtered = docsList.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.desc.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase())
  )

  function handleDownload(doc) {
    const blob = new Blob([doc.content || `${doc.title}\n\n${doc.desc}`], { type: doc.mime || 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.fileName || `${doc.title.replace(/\s+/g, '_')}.${doc.format.toLowerCase()}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleDownloadTemplateForJd(jd) {
    const fds = fieldDefsMap[jd.id] || []
    generateTemplateExcel({
      fieldDefs: fds,
      jenisDataJudul: jd.judul,
      format: 'xlsx'
    })
  }

  function handleAddDoc(e) {
    e.preventDefault()
    if (!newDoc.title.trim()) return

    const ext = newDoc.format.toLowerCase() === 'xlsx' || newDoc.format.toLowerCase() === 'csv' ? 'csv' : 'txt'
    const added = {
      id: `doc-${Date.now()}`,
      title: newDoc.title,
      desc: newDoc.desc,
      category: newDoc.category,
      format: newDoc.format.toUpperCase(),
      size: `${Math.max(1, Math.round((newDoc.content.length || 500) / 1024))} KB`,
      content: newDoc.content || `${newDoc.title}\n\n${newDoc.desc}`,
      fileName: `${newDoc.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`,
      mime: ext === 'csv' ? 'text/csv;charset=utf-8;' : 'text/plain;charset=utf-8;'
    }

    setDocsList(prev => [added, ...prev])
    setNewDoc({ title: '', desc: '', category: 'Pedoman', format: 'TXT', content: '' })
    setModalOpen(false)
  }

  function handleDeleteDoc(id, title) {
    if (!confirm(`Hapus dokumen "${title}" dari repositori?`)) return
    setDocsList(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <PageHeader title="Dokumen & Panduan" description="Pedoman, SOP, dan template Excel." />

      {/* Template Generator Per Jenis Data */}
      <InfoCard
        title="Template Standar Impor Excel (Sesuai 9 Jenis Data)"
        subtitle="Unduh berkas format Excel resmi yang kolom-kolomnya telah disesuaikan dengan konfigurasi database jenis data."
      >
        <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-[260px]">
            <label className="form-label mb-1">Pilih Jenis Data Target</label>
            <div className="relative">
              <select
                value={selectedJdId}
                onChange={e => setSelectedJdId(e.target.value)}
                className="form-select text-sm font-medium w-full"
              >
                {jenisDataList.map((jd, idx) => (
                  <option key={jd.id} value={jd.id}>
                    {idx + 1}. {jd.judul} ({jd.level_utama === 'bulan' ? 'Level Bulan: Rincian' : 'Level Minggu'})
                  </option>
                ))}
              </select>
            </div>
            {selectedJdId && fieldDefsMap[selectedJdId] && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                Memuat {fieldDefsMap[selectedJdId].length} kolom resmi: {fieldDefsMap[selectedJdId].map(f => f.label).slice(0, 4).join(', ')}...
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
            {selectedJdId && (
              <>
                <button
                  onClick={() => {
                    const jd = jenisDataList.find(j => j.id === selectedJdId)
                    if (jd) handleDownloadTemplateForJd(jd)
                  }}
                  className="btn-primary text-xs py-2 px-3.5"
                >
                  <FileSpreadsheet size={15} />
                  <span>Unduh Template (.xlsx)</span>
                </button>
                <button
                  onClick={() => {
                    const jd = jenisDataList.find(j => j.id === selectedJdId)
                    if (jd) {
                      const fds = fieldDefsMap[jd.id] || []
                      generateTemplateExcel({ fieldDefs: fds, jenisDataJudul: jd.judul, format: 'csv' })
                    }
                  }}
                  className="btn-secondary text-xs py-2 px-3"
                >
                  <Download size={14} />
                  <span>Format CSV</span>
                </button>
              </>
            )}
          </div>
        </div>
      </InfoCard>

      {/* Document Grid */}
      <InfoCard
        title="Daftar Dokumen Resmi"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama dokumen / SOP..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="form-input pl-8 text-xs py-1.5"
              />
            </div>
            {isAdmin && (
              <button
                onClick={() => setModalOpen(true)}
                className="btn-primary text-xs py-1.5"
              >
                <Plus size={14} />
                <span>Tambah Dokumen</span>
              </button>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-900/40 hover:border-blue-300 dark:hover:border-blue-600 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    {doc.category}
                  </span>
                  <span className="text-xs font-mono text-gray-400 font-semibold">
                    {doc.format} • {doc.size}
                  </span>
                </div>
                <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-1.5">
                  {doc.title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                  {doc.desc}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                {isAdmin ? (
                  <button
                    onClick={() => handleDeleteDoc(doc.id, doc.title)}
                    className="p-1.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    title="Hapus dokumen"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : <div />}

                <button
                  onClick={() => handleDownload(doc)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  <Download size={13} />
                  Unduh Berkas
                </button>
              </div>
            </div>
          ))}
        </div>
      </InfoCard>

      {/* Modal Admin Tambah Dokumen */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Tambah Dokumen / Panduan Resmi"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Batal</button>
            <button form="add-doc-form" type="submit" className="btn-primary">Simpan & Publikasikan</button>
          </>
        }
      >
        <form id="add-doc-form" onSubmit={handleAddDoc} className="space-y-4">
          <div>
            <label className="form-label">Judul Dokumen <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={newDoc.title}
              onChange={e => setNewDoc(d => ({ ...d, title: e.target.value }))}
              className="form-input"
              required
              placeholder="mis. Juknis Pelaporan Anggaran 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Kategori</label>
              <select
                value={newDoc.category}
                onChange={e => setNewDoc(d => ({ ...d, category: e.target.value }))}
                className="form-select"
              >
                <option value="Pedoman">Pedoman</option>
                <option value="Template">Template</option>
                <option value="Regulasi">Regulasi</option>
                <option value="SOP">SOP</option>
              </select>
            </div>
            <div>
              <label className="form-label">Format Berkas</label>
              <select
                value={newDoc.format}
                onChange={e => setNewDoc(d => ({ ...d, format: e.target.value }))}
                className="form-select"
              >
                <option value="XLSX">Excel (XLSX/CSV)</option>
                <option value="PDF">Dokumen (PDF/TXT)</option>
                <option value="TXT">Teks Petunjuk (TXT)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Deskripsi Ringkas</label>
            <textarea
              rows={2}
              value={newDoc.desc}
              onChange={e => setNewDoc(d => ({ ...d, desc: e.target.value }))}
              className="form-input resize-none"
              placeholder="Penjelasan ringkas peruntukan dokumen ini"
            />
          </div>

          <div>
            <label className="form-label">Isi / Naskah Dokumen (Tersedia saat diunduh)</label>
            <textarea
              rows={4}
              value={newDoc.content}
              onChange={e => setNewDoc(d => ({ ...d, content: e.target.value }))}
              className="form-input font-mono text-xs"
              placeholder="Tuliskan format teks, header kolom CSV, atau instruksi resmi di sini..."
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}

