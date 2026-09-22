/**
 * views/admin/BuatJenisDataExcel.jsx
 * Admin: buat Jenis Data BARU (bulanan, per-nama) langsung dari sebuah berkas Excel.
 * Alur: unggah -> sistem menebak kolom identitas (UPT/Tahun/Bulan) & tipe tiap kolom isian (teks/angka/
 * tanggal/pilihan) -> Admin meninjau & mengoreksi -> konfirmasi -> Jenis Data + kolom dibuat, lalu seluruh
 * baris berkas langsung diimpor sebagai data pertamanya.
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { db } from '../../lib/db'
import { readExcelFile } from '../../lib/excelExport'
import { META, validateRows, parseTanggal } from '../../lib/historisImport'
import Modal from '../../components/Modal'
import { Upload, Loader2, CheckCircle2, AlertTriangle, XCircle, Sparkles } from 'lucide-react'

const TIPE_OPTIONS = [
  { value: 'teks', label: 'Teks Singkat' },
  { value: 'teks_panjang', label: 'Teks Panjang / Narasi' },
  { value: 'angka', label: 'Angka' },
  { value: 'tanggal', label: 'Tanggal' },
  { value: 'pilihan', label: 'Pilihan (Dropdown)' },
]

const normalize = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const slugify = s => String(s ?? '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

/** Cari header yang cocok dengan kolom identitas UPT/Tahun/Bulan lewat alias yang sama dengan Impor Historis. */
function detectMeta(headers) {
  const out = {}
  for (const h of headers) {
    const n = normalize(h)
    const m = META.find(x => ['upt', 'tahun', 'bulan'].includes(x.id) && !out[x.id] && x.alias.includes(n))
    if (m) out[m.id] = h
  }
  return out
}

/** Tebak tipe kolom dari isi selnya. Cuma tebakan awal — Admin selalu bisa mengoreksi di layar tinjauan. */
function inferField(header, values) {
  const filled = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '')
  const idLike = /\b(nik|nip|no\.?|nomor|telepon|hp|kode|kusuka|npwp)\b/i.test(header)

  let tipe = 'teks'
  if (filled.length) {
    const dateCount = filled.filter(v => typeof parseTanggal(v) === 'string').length
    const numCount = filled.filter(v => typeof v === 'number' || (typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v.trim()))).length
    const uniq = new Set(filled.map(v => String(v).trim().toLowerCase()))
    if (dateCount / filled.length > 0.7) tipe = 'tanggal'
    else if (!idLike && numCount / filled.length > 0.8) tipe = 'angka'
    else if (uniq.size > 1 && uniq.size <= 8 && uniq.size < filled.length) tipe = 'pilihan'
  }
  const opsi = tipe === 'pilihan' ? [...new Set(filled.map(v => String(v).trim()))].filter(Boolean).slice(0, 30) : []
  return {
    header,
    label: header,
    field_key: slugify(header),
    tipe,
    opsi_text: opsi.join(', '),
    wajib: false,
    is_identitas: idLike,
    skip: false,
  }
}

export default function BuatJenisDataExcelModal({ open, onClose, onCreated, uptList = [], periods = [] }) {
  const [step, setStep] = useState('upload') // 'upload' | 'review' | 'importing' | 'done'
  const [parsed, setParsed] = useState(null) // { headers, rows }
  const [error, setError] = useState('')
  const [judul, setJudul] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [kumulatif, setKumulatif] = useState(false)
  const [publik, setPublik] = useState(false)
  const [metaMap, setMetaMap] = useState({ upt: '', tahun: '', bulan: '' })
  const [fixedUpt, setFixedUpt] = useState('')
  const [fixedTahun, setFixedTahun] = useState('')
  const [fixedBulan, setFixedBulan] = useState('')
  const [dataFields, setDataFields] = useState([])
  const [result, setResult] = useState(null)
  const [progress, setProgress] = useState(null)

  const bulanPeriods = periods.filter(p => p.level === 'bulan')
  const tahunOptions = [...new Set(bulanPeriods.map(p => Number(p.tahun)))].sort((a, b) => a - b)

  function reset() {
    setStep('upload'); setParsed(null); setError(''); setJudul(''); setDeskripsi('')
    setKumulatif(false); setPublik(false); setMetaMap({ upt: '', tahun: '', bulan: '' })
    setFixedUpt(''); setFixedTahun(''); setFixedBulan(''); setDataFields([]); setResult(null); setProgress(null)
  }

  function handleClose() {
    reset()
    onClose?.()
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const p = await readExcelFile(file)
      if (!p.rows.length) throw new Error('Berkas kosong atau baris pertama bukan header.')
      const meta = detectMeta(p.headers)
      const dataHeaders = p.headers.filter(h => !Object.values(meta).includes(h))
      setDataFields(dataHeaders.map(h => inferField(h, p.rows.map(r => r[h]))))
      setMetaMap({ upt: meta.upt || '', tahun: meta.tahun || '', bulan: meta.bulan || '' })
      setParsed(p)
      if (!judul) setJudul(file.name.replace(/\.(xlsx|xls|csv)$/i, '').replace(/[_-]+/g, ' ').trim())
      setStep('review')
    } catch (err) {
      setError(err.message || 'Gagal membaca berkas')
    }
    e.target.value = ''
  }

  function updateField(idx, patch) {
    setDataFields(list => list.map((f, i) => (i === idx ? { ...f, ...patch } : f)))
  }

  const activeFields = dataFields.filter(f => !f.skip)
  const missingMetaUpt = !metaMap.upt && !fixedUpt
  const missingMetaTahun = !metaMap.tahun && !fixedTahun
  const missingMetaBulan = !metaMap.bulan && !fixedBulan
  const dupKeys = (() => {
    const seen = new Map()
    activeFields.forEach(f => seen.set(f.field_key, (seen.get(f.field_key) || 0) + 1))
    return [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k)
  })()
  const canSubmit = judul.trim() && activeFields.length > 0 && activeFields.every(f => f.label.trim() && f.field_key.trim())
    && !missingMetaUpt && !missingMetaTahun && !missingMetaBulan && !dupKeys.length

  async function handleSubmit() {
    setStep('importing')
    setError('')
    try {
      // 1) Buat Jenis Data
      const { data: jd, error: jdErr } = await db.from('jenis_data').insert({
        key: slugify(judul) || `jenis_data_${Date.now()}`,
        judul: judul.trim(),
        deskripsi: deskripsi.trim() || null,
        level_utama: 'bulan',
        mode_bulanan: 'rincian',
        butuh_input_bulanan: false,
        pasangan_mingguan_id: null,
        publik_boleh_lihat: publik,
        multi_baris: false,
        kumulatif_bulanan: kumulatif,
        aktif: true,
      }).select().single()
      if (jdErr) throw jdErr

      // 2) Buat kolom-kolomnya
      const createdFields = []
      let urutan = 1
      for (const f of activeFields) {
        const { data: fd, error: fdErr } = await db.from('field_definitions').insert({
          jenis_data_id: jd.id,
          level: 'bulan',
          field_key: f.field_key,
          label: f.label.trim(),
          tipe: f.tipe,
          wajib: f.wajib,
          is_identitas: f.is_identitas,
          opsi_pilihan: f.tipe === 'pilihan' ? f.opsi_text.split(',').map(s => s.trim()).filter(Boolean) : null,
          agregasi: 'sum',
          urutan: urutan++,
        }).select().single()
        if (fdErr) throw fdErr
        createdFields.push(fd)
      }

      // 3) Petakan baris berkas ke kolom yang baru dibuat, lalu validasi (sama seperti Impor Data Historis)
      const mapping = {}
      if (metaMap.upt) mapping[metaMap.upt] = { kind: 'meta', id: 'upt' }
      if (metaMap.tahun) mapping[metaMap.tahun] = { kind: 'meta', id: 'tahun' }
      if (metaMap.bulan) mapping[metaMap.bulan] = { kind: 'meta', id: 'bulan' }
      activeFields.forEach(f => { mapping[f.header] = { kind: 'field', field: createdFields.find(cf => cf.field_key === f.field_key) } })

      const fixedObj = {
        upt: fixedUpt ? uptList.find(u => u.key === fixedUpt) : null,
        tahun: fixedTahun ? Number(fixedTahun) : null,
        bulan: fixedBulan ? Number(fixedBulan) : null,
      }
      const validated = validateRows({
        rows: parsed.rows, mapping, jenisData: jd, fields: createdFields, uptList, periods,
        weekly: false, multi: false, multiSupported: false, fixed: fixedObj,
      })
      if (validated.fatal) throw new Error(validated.fatal)

      // 4) Impor per-batch 100 baris
      const items = validated.payloads
      setProgress({ done: 0, total: items.length })
      for (let i = 0; i < items.length; i += 100) {
        const { error: impErr } = await db.from('data_entries').upsert(items.slice(i, i + 100), { onConflict: 'jenis_data_id,upt_key,period_id,nik' })
        if (impErr) throw impErr
        setProgress({ done: Math.min(i + 100, items.length), total: items.length })
      }

      setResult({ jd, fieldCount: createdFields.length, ...validated })
      setStep('done')
      onCreated?.(jd)
    } catch (err) {
      setError(err.message || 'Gagal membuat Jenis Data')
      setStep('review')
    }
  }

  return createPortal(
    <Modal open={open} onClose={step === 'importing' ? () => {} : handleClose} title="Buat Jenis Data dari Excel" maxWidth="max-w-3xl">
      {step === 'upload' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Unggah contoh berkas Excel (baris pertama = judul kolom). Sistem akan menebak mana kolom UPT/Tahun/Bulan
            dan tipe tiap kolom isian (teks/angka/tanggal/pilihan) — Anda bisa mengoreksi semuanya sebelum dibuat.
          </p>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-10 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
            <Upload size={28} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Klik untuk pilih berkas Excel</span>
            <span className="text-xs text-gray-400">.xlsx, .xls, atau .csv</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
          </label>
          {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        </div>
      )}

      {step === 'review' && parsed && (
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label text-xs">Judul Jenis Data *</label>
              <input type="text" value={judul} onChange={e => setJudul(e.target.value)} className="form-input w-full" placeholder="mis. Data Peserta Sertifikasi" />
            </div>
            <div>
              <label className="form-label text-xs">Deskripsi</label>
              <input type="text" value={deskripsi} onChange={e => setDeskripsi(e.target.value)} className="form-input w-full" placeholder="Opsional" />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={publik} onChange={e => setPublik(e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
              Tampilkan rekap ke Publik
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={kumulatif} onChange={e => setKumulatif(e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
              Data kumulatif (bulan terbaru menggantikan sebelumnya)
            </label>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Kolom Identitas Baris (UPT · Tahun · Bulan)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'upt', label: 'Kolom UPT', fixed: fixedUpt, setFixed: setFixedUpt, fixedOptions: uptList.map(u => [u.key, u.label]) },
                { id: 'tahun', label: 'Kolom Tahun', fixed: fixedTahun, setFixed: setFixedTahun, fixedOptions: tahunOptions.map(y => [String(y), String(y)]) },
                { id: 'bulan', label: 'Kolom Bulan', fixed: fixedBulan, setFixed: setFixedBulan, fixedOptions: Array.from({ length: 12 }, (_, i) => [String(i + 1), String(i + 1)]) },
              ].map(m => (
                <div key={m.id}>
                  <label className="form-label text-xs">{m.label}</label>
                  <select
                    value={metaMap[m.id]}
                    onChange={e => setMetaMap(prev => ({ ...prev, [m.id]: e.target.value }))}
                    className="form-select w-full text-sm"
                  >
                    <option value="">- Tidak ada di berkas -</option>
                    {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  {!metaMap[m.id] && (
                    <select value={m.fixed} onChange={e => m.setFixed(e.target.value)} className="form-select w-full text-sm mt-1">
                      <option value="">- Pilih nilai tetap -</option>
                      {m.fixedOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              Kalau berkas tidak punya kolom UPT/Tahun/Bulan tersendiri, isi "nilai tetap" (berarti seluruh baris berkas ini milik satu UPT/bulan yang sama).
            </p>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
              Kolom Data ({activeFields.length} dari {dataFields.length} kolom dipakai)
            </h4>
            <div className="space-y-2">
              {dataFields.map((f, idx) => (
                <div key={f.header} className={`border rounded-lg p-3 ${f.skip ? 'opacity-40 border-gray-200 dark:border-gray-800' : 'border-gray-200 dark:border-gray-700'}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono text-gray-400 truncate">Kolom berkas: "{f.header}"</span>
                    <label className="flex items-center gap-1.5 text-[11px] cursor-pointer flex-shrink-0">
                      <input type="checkbox" checked={f.skip} onChange={e => updateField(idx, { skip: e.target.checked })} className="w-3.5 h-3.5 rounded" />
                      Lewati kolom ini
                    </label>
                  </div>
                  {!f.skip && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-start">
                      <div>
                        <label className="text-[10px] text-gray-400">Label</label>
                        <input type="text" value={f.label} onChange={e => updateField(idx, { label: e.target.value })} className="form-input text-xs w-full py-1" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400">Field Key</label>
                        <input type="text" value={f.field_key} onChange={e => updateField(idx, { field_key: slugify(e.target.value) })} className="form-input text-xs w-full py-1 font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400">Tipe</label>
                        <select value={f.tipe} onChange={e => updateField(idx, { tipe: e.target.value })} className="form-select text-xs w-full py-1">
                          {TIPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div className="flex items-end gap-2 pb-1">
                        <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                          <input type="checkbox" checked={f.wajib} onChange={e => updateField(idx, { wajib: e.target.checked })} className="w-3.5 h-3.5 rounded" />
                          Wajib
                        </label>
                        <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                          <input type="checkbox" checked={f.is_identitas} onChange={e => updateField(idx, { is_identitas: e.target.checked })} className="w-3.5 h-3.5 rounded" />
                          Identitas
                        </label>
                      </div>
                      {f.tipe === 'pilihan' && (
                        <div className="col-span-2 sm:col-span-4">
                          <label className="text-[10px] text-gray-400">Opsi (dipisah koma)</label>
                          <input type="text" value={f.opsi_text} onChange={e => updateField(idx, { opsi_text: e.target.value })} className="form-input text-xs w-full py-1" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {dupKeys.length > 0 && (
            <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5"><AlertTriangle size={13} /> Field Key ganda: {dupKeys.join(', ')} — ubah supaya unik.</p>
          )}
          {(missingMetaUpt || missingMetaTahun || missingMetaBulan) && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5"><AlertTriangle size={13} /> Lengkapi kolom/nilai tetap untuk: {[missingMetaUpt && 'UPT', missingMetaTahun && 'Tahun', missingMetaBulan && 'Bulan'].filter(Boolean).join(', ')}.</p>
          )}
          {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <button type="button" onClick={() => setStep('upload')} className="btn-secondary text-sm">Ganti Berkas</button>
            <button type="button" onClick={handleSubmit} disabled={!canSubmit} className="btn-primary text-sm disabled:opacity-40">
              <Sparkles size={15} /> Buat Jenis Data & Impor {parsed.rows.length} Baris
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 size={28} className="animate-spin text-blue-500" />
          <p>Membuat Jenis Data & kolom...</p>
          {progress && <p className="text-xs">Mengimpor {progress.done} dari {progress.total} baris...</p>}
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={22} className="flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold">"{result.jd.judul}" berhasil dibuat dengan {result.fieldCount} kolom.</p>
              <p className="text-xs mt-0.5">{result.payloads.length} baris berhasil diimpor sebagai data pertamanya.</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-400 max-h-40 overflow-y-auto">
              <p className="font-semibold mb-1 flex items-center gap-1.5"><XCircle size={13} /> {result.errors.length} baris dilewati karena bermasalah:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {result.errors.slice(0, 20).map((e, i) => <li key={i}>Baris {e.baris}: {e.pesan}</li>)}
              </ul>
              {result.errors.length > 20 && <p className="mt-1">...dan {result.errors.length - 20} lainnya.</p>}
            </div>
          )}
          <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
            <button type="button" onClick={handleClose} className="btn-primary text-sm">Selesai</button>
          </div>
        </div>
      )}
    </Modal>,
    document.body,
  )
}
