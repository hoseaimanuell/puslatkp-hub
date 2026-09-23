/**
 * components/DynamicForm.jsx
 * Merender form dari daftar field_definitions — KOMPONEN INTI SISTEM
 * Tidak ada field yang ditulis manual — semua dari konfigurasi database
 */

import { useEffect, useState } from 'react'
import { agregasiOf } from '../lib/agregasi'
import { db, fieldFiles } from '../lib/db'

const FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx'
const FILE_MAX_MB = 10

function formatFileSize(n) {
  const num = Number(n) || 0
  return num >= 1048576 ? `${(num / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(num / 1024))} KB`
}

/**
 * Ambil metadata berkas (nama, ukuran) untuk sebuah id field_files. Dipakai baik oleh kontrol unggah (FieldInput
 * tipe 'file') maupun tampilan baca-saja di tabel rekap (FileValueDisplay).
 */
function useFieldFileMeta(id) {
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(!!id)
  useEffect(() => {
    let alive = true
    if (!id) { setMeta(null); setLoading(false); return }
    setLoading(true)
    db.from('field_files').select('id,file_name,file_ext,file_size').eq('id', id).single()
      .then(({ data }) => { if (alive) { setMeta(data || null); setLoading(false) } })
      .catch(() => { if (alive) { setMeta(null); setLoading(false) } })
    return () => { alive = false }
  }, [id])
  return { meta, loading }
}

/** Tampilan baca-saja (tabel rekap): tombol unduh + nama berkas. `value` = id field_files, atau teks lama (link). */
export function FileValueDisplay({ id, className = '' }) {
  const { meta, loading } = useFieldFileMeta(id)
  const [busy, setBusy] = useState(false)
  if (!id) return <span className="text-gray-300 dark:text-gray-600">—</span>
  if (loading) return <span className="text-gray-400 text-xs">Memuat…</span>
  if (!meta) {
    // Bukan id berkas yang dikenal (mis. isian lama berupa teks/link sebelum kolom ini diganti tipe Berkas)
    return <span className="text-gray-500 dark:text-gray-400 text-xs break-all">{String(id)}</span>
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => { setBusy(true); try { await fieldFiles.download(id) } catch (e) { alert(e.message) } finally { setBusy(false) } }}
      className={`inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 ${className}`}
      title={`${meta.file_name} (${formatFileSize(meta.file_size)})`}
    >
      📎 {busy ? 'Mengunduh…' : meta.file_name}
    </button>
  )
}

/** Kontrol unggah untuk form input (FieldInput tipe 'file'). */
function FileFieldInput({ field, value, onChange, disabled, idPrefix, jenisDataId, uptKey }) {
  const { meta, loading } = useFieldFileMeta(value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // supaya memilih berkas yang sama lagi tetap memicu onChange
    if (!file) return
    setError('')
    if (file.size > FILE_MAX_MB * 1024 * 1024) { setError(`Ukuran berkas melebihi ${FILE_MAX_MB} MB.`); return }
    if (!jenisDataId || !uptKey) { setError('Pilih UPT terlebih dahulu sebelum mengunggah berkas.'); return }
    setBusy(true)
    const prevId = value
    const { data, error: err } = await fieldFiles.upload(file, { jenis_data_id: jenisDataId, field_key: field.field_key, upt_key: uptKey })
    setBusy(false)
    if (err) { setError(err.message); return }
    onChange(field.field_key, data.id)
    if (prevId && prevId !== data.id) fieldFiles.remove(prevId).catch(() => {}) // ganti berkas: buang yang lama
  }

  return (
    <div className="space-y-1.5">
      {value && (
        <div className="flex items-center gap-2 text-xs">
          {loading ? (
            <span className="text-gray-400">Memuat…</span>
          ) : meta ? (
            <>
              <FileValueDisplay id={value} />
              <span className="text-gray-400">({formatFileSize(meta.file_size)})</span>
            </>
          ) : (
            <span className="text-gray-500 dark:text-gray-400 break-all">{String(value)}</span>
          )}
          {!disabled && (
            <button type="button" onClick={() => onChange(field.field_key, null)} className="text-rose-500 hover:underline">Hapus</button>
          )}
        </div>
      )}
      {!disabled && (
        <input
          id={`${idPrefix}field-${field.field_key}`}
          type="file"
          accept={FILE_ACCEPT}
          onChange={handleFile}
          disabled={busy}
          className="block w-full text-xs text-gray-600 dark:text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-950/40 dark:file:text-blue-300 hover:file:bg-blue-100"
        />
      )}
      {busy && <p className="text-xs text-blue-500">Mengunggah…</p>}
      {error && <p className="text-xs text-rose-500">{error}</p>}
      <p className="text-[10px] text-gray-400">PDF, Word, atau Excel — maks. {FILE_MAX_MB} MB.</p>
    </div>
  )
}

export function FieldInput({ field, value, onChange, disabled, idPrefix = '', jenisDataId, uptKey, allValues, allFields }) {
  const base = `form-input ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800' : ''}`

  switch (field.tipe) {
    case 'angka':
      return (
        <input
          id={`${idPrefix}field-${field.field_key}`}
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(field.field_key, e.target.value === '' ? null : Number(e.target.value))}
          className={base}
          disabled={disabled}
          required={field.wajib}
          placeholder="0"
        />
      )

    case 'file':
      return (
        <FileFieldInput
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
          idPrefix={idPrefix}
          jenisDataId={jenisDataId}
          uptKey={uptKey}
        />
      )

    case 'tanggal': {
      const isRange = typeof value === 'string' && value.includes(' s/d ')
      const parts = isRange ? value.split(' s/d ') : [value || '', '']
      const [startDate, endDate] = parts

      return (
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-400 font-medium block mb-0.5">Dari Tanggal</label>
              <input
                id={`${idPrefix}field-${field.field_key}-start`}
                type="date"
                value={startDate ? String(startDate).split('T')[0] : ''}
                onChange={(e) => {
                  const newStart = e.target.value
                  if (!newStart && !endDate) {
                    onChange(field.field_key, null)
                  } else if (endDate) {
                    onChange(field.field_key, newStart ? `${newStart} s/d ${endDate}` : endDate)
                  } else {
                    onChange(field.field_key, newStart || null)
                  }
                }}
                className={base}
                disabled={disabled}
                required={field.wajib && !endDate}
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-medium block mb-0.5">Sampai (Opsional)</label>
              <input
                id={`${idPrefix}field-${field.field_key}-end`}
                type="date"
                value={endDate ? String(endDate).split('T')[0] : ''}
                onChange={(e) => {
                  const newEnd = e.target.value
                  if (!newEnd) {
                    onChange(field.field_key, startDate || null)
                  } else {
                    onChange(field.field_key, startDate ? `${startDate} s/d ${newEnd}` : newEnd)
                  }
                }}
                className={base}
                disabled={disabled}
                min={startDate ? String(startDate).split('T')[0] : undefined}
              />
            </div>
          </div>
          {isRange && (
            <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
              Rentang aktif: {value}
            </p>
          )}
        </div>
      )
    }

    case 'pilihan': {
      // Opsi bersyarat: kolom pilihan lain yang opsinya berbeda tergantung nilai kolom "depends_on" di baris yang sama
      // (mis. "Jenjang Jabatan" opsinya beda untuk Instruktur vs Widyaiswara). Dikonfigurasi lewat field.opsi_bersyarat.
      let opsi = field.opsi_pilihan || []
      let waitingOn = null
      if (field.opsi_bersyarat?.depends_on) {
        const driverKey = field.opsi_bersyarat.depends_on
        const driverVal = allValues?.[driverKey]
        if (!driverVal) {
          opsi = []
          waitingOn = allFields?.find(f => f.field_key === driverKey)?.label || 'kolom sebelumnya'
        } else {
          opsi = field.opsi_bersyarat.options?.[driverVal] || []
        }
      }
      return (
        <select
          id={`${idPrefix}field-${field.field_key}`}
          value={value ?? ''}
          onChange={(e) => onChange(field.field_key, e.target.value || null)}
          className={`${base} form-select`}
          disabled={disabled || !!waitingOn}
          required={field.wajib}
        >
          <option value="">{waitingOn ? `- Pilih ${waitingOn} dulu -` : '- Pilih -'}</option>
          {opsi.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }

    case 'teks_panjang':
      return (
        <textarea
          id={`${idPrefix}field-${field.field_key}`}
          value={value ?? ''}
          onChange={(e) => onChange(field.field_key, e.target.value || null)}
          className={`${base} resize-y`}
          rows={3}
          disabled={disabled}
          required={field.wajib}
          placeholder={field.label}
        />
      )

    case 'teks':
    default:
      if (field.field_key === 'alamat' || field.field_key === 'progress_pelaksanaan' || field.field_key === 'permasalahan') {
        return (
          <textarea
            id={`${idPrefix}field-${field.field_key}`}
            value={value ?? ''}
            onChange={(e) => onChange(field.field_key, e.target.value || null)}
            className={`${base} resize-y`}
            rows={2}
            disabled={disabled}
            required={field.wajib}
            placeholder={field.label}
          />
        )
      }
      return (
        <input
          id={`${idPrefix}field-${field.field_key}`}
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(field.field_key, e.target.value || null)}
          className={base}
          disabled={disabled}
          required={field.wajib}
          placeholder={field.label}
        />
      )
  }
}

/**
 * DynamicFormRekap — untuk level Minggu (pengisian form mingguan)
 */
export function DynamicFormRekap({ fields, values, onChange, disabled, onSubmit, loading, bare = false, idPrefix = '', jenisDataId, uptKey }) {
  const activeFields = fields.filter(f => f.aktif).sort((a, b) => a.urutan - b.urutan)
  // bare: hanya kolom-kolomnya (dipakai saat satu <form> memuat beberapa baris/pelatihan)
  const Wrapper = bare ? 'div' : 'form'
  // Saat kolom "penentu" (depends_on) berubah, kosongkan kolom yang opsinya bergantung padanya (opsi lama bisa tidak
  // relevan lagi untuk nilai baru — mis. ganti dari Instruktur ke Widyaiswara, Jenjang Jabatan harus dipilih ulang).
  const handleChange = (key, val) => {
    onChange(key, val)
    activeFields.filter(f => f.opsi_bersyarat?.depends_on === key).forEach(f => onChange(f.field_key, null))
  }

  return (
    <Wrapper onSubmit={bare ? undefined : onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {activeFields.map(field => {
          const isFullWidth = field.tipe === 'teks_panjang' || field.tipe === 'file' || field.field_key.includes('laporan') || field.field_key === 'progress_pelaksanaan' || field.field_key === 'permasalahan' || field.field_key === 'nama_pelatihan'
          return (
            <div key={field.id || field.field_key} className={isFullWidth ? 'sm:col-span-2' : ''}>
              <label className="form-label" htmlFor={`${idPrefix}field-${field.field_key}`}>
                {field.label}
                {field.wajib && <span className="text-rose-500 ml-1">*</span>}
                {field.tipe === 'angka' && agregasiOf(field) === 'last' && (
                  <span className="ml-1.5 text-[10px] font-normal text-sky-500" title="Angka kumulatif: isi TOTAL sampai minggu ini. Rekap bulan/triwulan/tahun memakai nilai terakhir, bukan dijumlahkan.">kumulatif</span>
                )}
              </label>
              <FieldInput
                field={field}
                value={values[field.field_key]}
                onChange={handleChange}
                disabled={disabled}
                idPrefix={idPrefix}
                jenisDataId={jenisDataId}
                uptKey={uptKey}
                allValues={values}
                allFields={activeFields}
              />
            </div>
          )
        })}
      </div>

      {!disabled && !bare && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Menyimpan...' : 'Simpan Data Mingguan'}
          </button>
        </div>
      )}
    </Wrapper>
  )
}

/**
 * DynamicFormEntry — untuk level Bulan (satu baris data per-orang)
 */
export function DynamicFormEntry({ fields, values, onChange, disabled, onSubmit, loading, idPrefix = '', jenisDataId, uptKey }) {
  const activeFields = fields.filter(f => f.aktif).sort((a, b) => a.urutan - b.urutan)
  const handleChange = (key, val) => {
    onChange(key, val)
    activeFields.filter(f => f.opsi_bersyarat?.depends_on === key).forEach(f => onChange(f.field_key, null))
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
        {activeFields.map(field => {
          const isFullWidth = field.tipe === 'file' || field.field_key === 'alamat' || field.field_key === 'link_sertifikat_pelatihan_by_name' || field.field_key === 'nama_pelatihan'
          return (
            <div key={field.id || field.field_key} className={isFullWidth ? 'sm:col-span-2' : ''}>
              <label className="form-label" htmlFor={`${idPrefix}field-${field.field_key}`}>
                {field.label}
                {field.wajib && <span className="text-rose-500 ml-1">*</span>}
                {field.is_identitas && (
                  <span className="ml-1 text-amber-500 text-xs font-normal" title="Kolom Identitas Pribadi">🔒 Identitas</span>
                )}
              </label>
              <FieldInput
                field={field}
                value={values[field.field_key]}
                onChange={handleChange}
                disabled={disabled}
                jenisDataId={jenisDataId}
                uptKey={uptKey}
                allValues={values}
                allFields={activeFields}
              />
            </div>
          )
        })}
      </div>

      {!disabled && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Menyimpan...' : 'Simpan Data Baris'}
          </button>
        </div>
      )}
    </form>
  )
}

// Default export — auto-pilih berdasarkan level
export default function DynamicForm({ level, ...props }) {
  if (level === 'bulan') return <DynamicFormEntry {...props} />
  return <DynamicFormRekap {...props} />
}
