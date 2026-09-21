/**
 * views/InputData/BulanUploadView.jsx
 * Tampilan data bulanan model upload berkas langsung (PDF / Excel) dari UPT.
 * Mendukung upload file, preview PDF, download Excel/PDF, dan pencatatan riwayat upload.
 */
import { useState, useEffect, useRef } from 'react'
import { db, getFeatures } from '../../lib/db'
import { formatPeriodLabel } from '../../lib/periods'
import Modal from '../../components/Modal'
import {
  UploadCloud, FileText, FileSpreadsheet, Download, Eye,
  Trash2, Plus, AlertCircle, CheckCircle2, Clock, Calendar,
  Loader2, ExternalLink, HardDrive, File, X
} from 'lucide-react'

export default function BulanUploadView({
  jenisData,
  activePeriod,
  currentUptKey,
  currentUptLabel,
  locked = false,
  isAdmin = false
}) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState(null)

  // Form upload state
  const [selectedFile, setSelectedFile] = useState(null)
  const [judulDokumen, setJudulDokumen] = useState('')
  const [catatan, setCatatan] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (activePeriod && currentUptKey) {
      loadDocuments()
    }
  }, [activePeriod?.id, currentUptKey, jenisData.id])

  async function loadDocuments() {
    if (!activePeriod || !currentUptKey) return
    setLoading(true)
    try {
      const { data, error } = await db
        .from('dokumen_upload')
        .select('id, jenis_data_id, period_id, upt_key, judul, file_name, file_size, file_ext, file_type, catatan, uploaded_by, created_at' + ((await getFeatures()).terlambat ? ', terlambat' : ''))
        .eq('jenis_data_id', jenisData.id)
        .eq('period_id', activePeriod.id)
        .eq('upt_key', currentUptKey)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading documents:', error)
      } else {
        setDocuments(data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validasi ukuran max 15MB
    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('Ukuran berkas maksimal adalah 15 MB')
      return
    }

    setSelectedFile(file)
    setErrorMsg('')
    if (!judulDokumen) {
      // Set default judul dari nama file tanpa ekstensi
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
      setJudulDokumen(nameWithoutExt)
    }
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = (err) => reject(err)
      reader.readAsDataURL(file)
    })
  }

  function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  async function handleUploadSubmit(e) {
    e.preventDefault()
    if (!selectedFile) {
      setErrorMsg('Pilih berkas terlebih dahulu')
      return
    }

    setUploading(true)
    setErrorMsg('')

    try {
      const fileDataUrl = await readFileAsDataURL(selectedFile)
      const ext = selectedFile.name.split('.').pop()?.toLowerCase() || ''
      
      const newDoc = {
        id: `doc-up-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        jenis_data_id: jenisData.id,
        period_id: activePeriod.id,
        upt_key: currentUptKey,
        judul: judulDokumen.trim() || selectedFile.name,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        file_ext: ext,
        file_type: selectedFile.type || 'application/octet-stream',
        file_data: fileDataUrl,
        catatan: catatan.trim(),
        uploaded_by: isAdmin ? 'Admin' : (currentUptLabel || currentUptKey),
        created_at: new Date().toISOString()
      }

      const { error } = await db
        .from('dokumen_upload')
        .insert([newDoc])

      if (error) throw error

      setUploadModalOpen(false)
      setSelectedFile(null)
      setJudulDokumen('')
      setCatatan('')
      await loadDocuments()
    } catch (err) {
      console.error('Gagal upload:', err)
      setErrorMsg(err.message || 'Gagal mengunggah berkas. Silakan coba lagi.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteDoc(id, title) {
    if (!confirm(`Hapus berkas "${title}"?\n\nBerkas masuk Tempat Sampah 30 hari dan hanya Admin yang dapat memulihkannya.`)) return

    try {
      const { error } = await db
        .from('dokumen_upload')
        .delete()
        .eq('id', id)

      if (error) throw error
      await loadDocuments()
    } catch (err) {
      alert('Gagal menghapus berkas: ' + err.message)
    }
  }

  // Daftar berkas tidak memuat isi berkas (bisa belasan MB); isinya diambil hanya saat diunduh / dipratinjau
  async function loadFileData(doc) {
    if (doc.file_data) return doc.file_data
    const { data, error } = await db.from('dokumen_upload').select('file_data').eq('id', doc.id).single()
    if (error || !data?.file_data) {
      alert('Data berkas tidak tersedia.')
      return null
    }
    return data.file_data
  }

  async function openPreview(doc) {
    const fileData = await loadFileData(doc)
    if (fileData) setPreviewDoc({ ...doc, file_data: fileData })
  }

  async function downloadDoc(doc) {
    const fileData = await loadFileData(doc)
    if (!fileData) return
    const link = document.createElement('a')
    link.href = fileData
    link.download = doc.file_name || `dokumen-${doc.id}.${doc.file_ext || 'pdf'}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getFileIcon = (ext) => {
    const lower = (ext || '').toLowerCase()
    if (['xlsx', 'xls', 'csv'].includes(lower)) {
      return <FileSpreadsheet className="text-emerald-600 dark:text-emerald-400" size={28} />
    }
    if (lower === 'pdf') {
      return <FileText className="text-rose-600 dark:text-rose-400" size={28} />
    }
    return <File className="text-blue-600 dark:text-blue-400" size={28} />
  }

  return (
    <div className="space-y-4">
      {/* HEADER CARD */}
      <div className="card p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                {jenisData.judul}
              </h3>
              <span className="badge-purple text-xs flex items-center gap-1 font-medium">
                <UploadCloud size={12} />
                Laporan File UPT (PDF / Excel)
              </span>
              {currentUptLabel && (
                <span className="badge-blue text-xs font-medium">{currentUptLabel}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Calendar size={13} className="text-gray-400" />
              Periode: <strong className="text-gray-700 dark:text-gray-300">{formatPeriodLabel(activePeriod)}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!locked && (
              <button
                onClick={() => {
                  setSelectedFile(null)
                  setJudulDokumen('')
                  setCatatan('')
                  setErrorMsg('')
                  setUploadModalOpen(true)
                }}
                className="btn-primary text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Plus size={15} />
                Upload Laporan Baru
              </button>
            )}
          </div>
        </div>

        {/* Info Petunjuk */}
        <div className="mt-4 p-3 rounded-lg bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 text-xs text-purple-900 dark:text-purple-300 flex items-start gap-2.5">
          <UploadCloud size={16} className="text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold">Format Pelaporan Berkas Resmi:</span> Jenis data ini menggunakan pengunggahan berkas laporan langsung (PDF / Excel resmi) yang diterbitkan oleh masing-masing UPT setiap bulan. Anda dapat langsung membuka, melihat pratinjau (PDF), atau mengunduh dokumen di bawah.
          </div>
        </div>
      </div>

      {/* LIST DOKUMEN YANG DIUNGGAH */}
      <div className="card shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">
              Daftar Berkas Terunggah
            </h4>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              {documents.length} berkas
            </span>
          </div>
          {documents.length > 0 && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={13} />
              Laporan tersedia
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 size={24} className="animate-spin text-purple-600" />
            <span className="ml-2 text-xs text-gray-500">Memuat berkas...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="py-14 text-center px-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 flex items-center justify-center mb-3">
              <UploadCloud size={28} className="text-purple-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Belum ada berkas laporan untuk bulan ini
            </p>
            <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
              {locked
                ? 'Periode telah dikunci dan tidak ada berkas yang diunggah.'
                : 'Silakan unggah dokumen laporan bulanan berupa file PDF atau Excel resmi dari UPT.'}
            </p>
            {!locked && (
              <button
                onClick={() => setUploadModalOpen(true)}
                className="mt-4 btn-secondary text-xs inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                Pilih Berkas Sekarang
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {documents.map((doc) => {
              const isPdf = doc.file_ext?.toLowerCase() === 'pdf'

              return (
                <div
                  key={doc.id}
                  className="p-4 sm:p-5 hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700 flex-shrink-0">
                      {getFileIcon(doc.file_ext)}
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate flex items-center gap-2">
                        <span>{doc.judul}</span>{doc.terlambat ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">Terlambat</span> : null}
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          {doc.file_ext || 'FILE'}
                        </span>
                      </h5>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono truncate">
                        {doc.file_name} • {formatBytes(doc.file_size)}
                      </p>
                      {doc.catatan && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 italic bg-gray-50 dark:bg-gray-800/60 px-2 py-1 rounded border-l-2 border-purple-400">
                          "{doc.catatan}"
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {new Date(doc.created_at).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </span>
                        <span>•</span>
                        <span>Oleh: <strong className="text-gray-600 dark:text-gray-300">{doc.uploaded_by}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                    {isPdf && (
                      <button
                        onClick={() => openPreview(doc)}
                        className="btn-secondary text-xs flex items-center gap-1 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/60 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                        title="Lihat Pratinjau PDF"
                      >
                        <Eye size={14} />
                        Lihat PDF
                      </button>
                    )}
                    <button
                      onClick={() => downloadDoc(doc)}
                      className="btn-secondary text-xs flex items-center gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      title="Download Dokumen Asli"
                    >
                      <Download size={14} />
                      Download
                    </button>
                    {(!locked || isAdmin) && (
                      <button
                        onClick={() => handleDeleteDoc(doc.id, doc.judul)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition-colors"
                        title="Hapus Dokumen"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL UPLOAD DOKUMEN */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => !uploading && setUploadModalOpen(false)}
        title="Upload Laporan Bulanan UPT"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Unggah berkas laporan bulanan resmi untuk <strong className="text-gray-800 dark:text-gray-200">{jenisData.judul}</strong> ({currentUptLabel}) pada periode <strong className="text-gray-800 dark:text-gray-200">{formatPeriodLabel(activePeriod)}</strong>.
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle size={15} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Area File Drop / Select */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Pilih Berkas (PDF / Excel) <span className="text-rose-500">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                selectedFile
                  ? 'border-purple-400 bg-purple-50/30 dark:bg-purple-950/20'
                  : 'border-gray-300 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500'
              }`}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  {getFileIcon(selectedFile.name.split('.').pop())}
                  <div className="text-left">
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{selectedFile.name}</p>
                    <p className="text-[11px] text-gray-500">{formatBytes(selectedFile.size)}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <UploadCloud size={32} className="mx-auto text-gray-400 dark:text-gray-500 mb-1" />
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Klik untuk memilih berkas dari komputer
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Mendukung PDF, Excel (.xlsx, .xls), atau CSV (Maks. 15MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Input Judul */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Judul / Keterangan Dokumen <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={judulDokumen}
              onChange={(e) => setJudulDokumen(e.target.value)}
              placeholder="Contoh: Laporan Rekap Instruktur & WI Bulan September 2026"
              className="form-input text-xs w-full"
            />
          </div>

          {/* Input Catatan Opsional */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Catatan Tambahan (Opsional)
            </label>
            <textarea
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Tambahkan keterangan atau nomor surat jika diperlukan..."
              className="form-input text-xs w-full"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              disabled={uploading}
              onClick={() => setUploadModalOpen(false)}
              className="btn-secondary text-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              {uploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Mengunggah...
                </>
              ) : (
                <>
                  <UploadCloud size={14} />
                  Unggah Berkas
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL PREVIEW PDF */}
      {previewDoc && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewDoc(null)}
          title={`Pratinjau PDF: ${previewDoc.judul}`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b border-gray-200 dark:border-gray-700">
              <span>Berkas: <strong>{previewDoc.file_name}</strong> ({formatBytes(previewDoc.file_size)})</span>
              <button
                onClick={() => downloadDoc(previewDoc)}
                className="btn-secondary text-xs flex items-center gap-1"
              >
                <Download size={13} />
                Download PDF
              </button>
            </div>
            <div className="w-full h-[70vh] bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <iframe
                src={previewDoc.file_data}
                title={previewDoc.judul}
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
