/**
 * views/admin/ImporHistoris.jsx
 * Admin: impor data historis (mis. 5 tahun ke belakang) dari Excel — HANYA data bulanan/tahunan rincian per nama (data mingguan tidak diimpor).
 * Sumber berkas: unggah langsung atau dari Arsip Data Historis. UPT/tahun/bulan dapat berasal dari kolom berkas, nilai tetap, atau kolom tanggal.
 * Alur: pilih jenis data → unduh template → pilih berkas → periksa pemetaan → validasi → impor per batch.
 * Admin tidak terkena kunci deadline; mengimpor ulang baris yang sama memperbarui (tidak menggandakan).
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { db, arsip, getFeatures } from '../../lib/db'
import InfoCard from '../../components/InfoCard'
import { readExcelFile } from '../../lib/excelExport'
import { META, metaIds, buildTemplateWorkbook, autoMap, validateRows } from '../../lib/historisImport'
import { Loader2, Upload, Download, CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet, ListChecks } from 'lucide-react'

import PageHeader from '../../components/PageHeader'

export default function ImporHistoris() {
  const [loading, setLoading] = useState(true)
  const [jenisData, setJenisData] = useState([])
  const [fieldDefs, setFieldDefs] = useState([])
  const [uptList, setUptList] = useState([])
  const [periods, setPeriods] = useState([])
  const [features, setFeatures] = useState({ multiBaris: false })
  const [source, setSource] = useState('upload') // 'upload' | 'arsip'
  const [arsipList, setArsipList] = useState([])
  const [arsipId, setArsipId] = useState('')
  const [fixed, setFixed] = useState({ upt: '', tahun: '', bulan: '' })
  const [dateKey, setDateKey] = useState('')

  const [jdId, setJdId] = useState('')
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null) // { headers, rows }
  const [mapping, setMapping] = useState({})
  const [result, setResult] = useState(null) // hasil validateRows
  const [skipBad, setSkipBad] = useState(false)
  const [progress, setProgress] = useState(null) // { done, total }
  const [done, setDone] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    (async () => {
      const [{ data: jds }, { data: fields }, { data: upts }, { data: p }, feat] = await Promise.all([
        db.from('jenis_data').select('*').eq('aktif', true).order('created_at'),
        db.from('field_definitions').select('*').eq('aktif', true).order('urutan'),
        db.from('upt_list').select('*').eq('aktif', true).order('label'),
        db.from('periods').select('*'),
        getFeatures(),
      ])
      // Yang dapat diimpor: hanya bulanan/tahunan rincian per nama (mingguan tidak ikut diimpor massal)
      const list = (jds || []).filter(j => j.level_utama === 'bulan' && (j.mode_bulanan === 'rincian' || !j.mode_bulanan))
      if (feat.arsip) arsip.list({}).then(({ data }) => setArsipList((data?.data || []).filter(a => ['xlsx', 'xls', 'csv'].includes(a.file_ext))))
      setJenisData(list)
      setJdId(list[0]?.id || '')
      setFieldDefs(fields || [])
      setUptList(upts || [])
      setPeriods(p || [])
      setFeatures(feat)
      setLoading(false)
    })()
  }, [])

  const jd = jenisData.find(j => j.id === jdId) || null
  const weekly = false // impor massal hanya data bulanan/tahunan by name
  const level = weekly ? 'minggu' : 'bulan'
  const fields = useMemo(() => (jd ? fieldDefs.filter(f => f.jenis_data_id === jd.id && f.level === level).sort((a, b) => (a.urutan || 0) - (b.urutan || 0)) : []), [jd, fieldDefs, level])
  const multi = !!(weekly && jd?.multi_baris && features.multiBaris)

  function reset(keepJd = true) {
    setFile(null); setParsed(null); setMapping({}); setResult(null); setSkipBad(false); setProgress(null); setDone(null); setError('')
    setFixed({ upt: '', tahun: '', bulan: '' }); setDateKey(''); setArsipId('')
    if (fileRef.current) fileRef.current.value = ''
    if (!keepJd) setJdId(jenisData[0]?.id || '')
  }

  function downloadTemplate() {
    const wb = buildTemplateWorkbook({ jenisData: jd, fields, uptList, weekly, multi })
    XLSX.writeFile(wb, `TemplateHistoris_${jd.judul}.xlsx`.replace(/\s+/g, '_'))
  }

  async function loadArsip(id) {
    setArsipId(id); setResult(null); setDone(null); setError('')
    if (!id) return
    try {
      const item = arsipList.find(a => a.id === id)
      const buf = await arsip.fetchFile(id)
      await onFile({ target: { files: [new File([buf], item.file_name)] } })
    } catch (err) { setError(err.message || 'Gagal membuka arsip') }
  }

  async function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setResult(null); setDone(null); setError('')
    try {
      const p = await readExcelFile(f)
      if (!p.rows.length) throw new Error('Berkas kosong atau baris pertama bukan header.')
      setFile(f)
      setParsed(p)
      const mp = autoMap(p.headers, fields, weekly, multi)
      setMapping(mp)
      const dateField = Object.values(mp).find(m => m?.kind === 'field' && m.field.tipe === 'tanggal')
      setDateKey(dateField ? dateField.field.field_key : '')
    } catch (err) {
      setError(err.message || 'Gagal membaca berkas')
    }
  }

  const targets = useMemo(() => [
    ...metaIds(weekly, multi).map(id => ({ value: `meta:${id}`, label: `[Identitas] ${META.find(m => m.id === id).label}` })),
    ...fields.map(f => ({ value: `field:${f.field_key}`, label: f.label })),
  ], [weekly, multi, fields])

  const valueOf = m => (m ? (m.kind === 'meta' ? `meta:${m.id}` : `field:${m.field.field_key}`) : '')
  function setTarget(header, val) {
    setResult(null)
    setMapping(prev => {
      const next = { ...prev }
      if (!val) next[header] = null
      else if (val.startsWith('meta:')) {
        Object.keys(next).forEach(h => { if (next[h]?.kind === 'meta' && next[h].id === val.slice(5)) next[h] = null })
        next[header] = { kind: 'meta', id: val.slice(5) }
      } else {
        next[header] = { kind: 'field', field: fields.find(f => f.field_key === val.slice(6)) }
      }
      return next
    })
  }

  function validate() {
    setDone(null)
    const fixedObj = {
      upt: fixed.upt ? uptList.find(u => u.key === fixed.upt) : null,
      tahun: fixed.tahun ? Number(fixed.tahun) : null,
      bulan: fixed.bulan ? Number(fixed.bulan) : null,
    }
    setResult(validateRows({ rows: parsed.rows, mapping, jenisData: jd, fields, uptList, periods, weekly, multi, multiSupported: features.multiBaris, fixed: fixedObj, deriveDateKey: dateKey || null }))
  }

  async function doImport() {
    setError(''); setDone(null)
    const table = weekly ? 'rekap_nilai' : 'data_entries'
    const onConflict = weekly
      ? (features.multiBaris ? 'jenis_data_id,upt_key,period_id,baris_ke,field_key' : 'jenis_data_id,upt_key,period_id,field_key')
      : 'jenis_data_id,upt_key,period_id,nik'
    const chunk = weekly ? 500 : 100
    const items = result.payloads
    setProgress({ done: 0, total: items.length })
    for (let i = 0; i < items.length; i += chunk) {
      const { error: err } = await db.from(table).upsert(items.slice(i, i + chunk), { onConflict })
      if (err) {
        setProgress(null)
        setError(`Impor berhenti pada data ke-${i + 1}: ${err.message}. Data sebelumnya sudah tersimpan; mengimpor ulang berkas yang sama aman.`)
        return
      }
      setProgress({ done: Math.min(i + chunk, items.length), total: items.length })
    }
    await db.from('audit_log').insert({
      action: 'impor_historis',
      detail: { jenis_data: jd.judul, berkas: file?.name, baris_valid: result.ringkas.valid, data_ditulis: items.length, dilewati: result.errors.length, per_tahun: result.ringkas.perTahun },
    })
    setProgress(null)
    setDone({ ditulis: items.length, baris: result.ringkas.valid })
  }

  if (loading) return <div className="card flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>

  const canImport = result && !result.fatal && result.payloads.length > 0 && (result.errors.length === 0 || skipBad) && !progress && !done
  const sample = parsed ? parsed.rows[0] : null

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Impor Data Historis" description="Impor data bulanan/tahunan per nama dari Excel. Data mingguan tidak diimpor. Tahun periodenya harus sudah ada di Kelola Periode." />

      {/* 1. Jenis data + template */}
      <InfoCard title="1. Pilih Jenis Data & Unduh Template">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="min-w-[280px]">
            <label className="form-label text-xs">Jenis Data</label>
            <select value={jdId} onChange={e => { setJdId(e.target.value); reset() }} className="form-select w-full">
              {jenisData.map(j => (
                <option key={j.id} value={j.id}>{j.judul}</option>
              ))}
            </select>
          </div>
          <button onClick={downloadTemplate} disabled={!jd} className="btn-secondary text-sm">
            <FileSpreadsheet size={15} /> Unduh Template Excel
          </button>
        </div>
        {jd && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Satu baris = {weekly ? `satu UPT pada satu minggu${multi ? ' (ulangi dengan "Pelatihan Ke" 2, 3, … untuk pelatihan tambahan)' : ''}` : 'satu peserta pada satu bulan'}.
            Kolom identitas: {metaIds(weekly, multi).map(id => META.find(m => m.id === id).label).join(', ')}, lalu {fields.length} kolom isian.
            {weekly && ' Pagu/realisasi/jumlah SDM diisi kumulatif (total sampai minggu tersebut).'}
          </p>
        )}
      </InfoCard>

      {/* 2. Unggah */}
      <InfoCard title="2. Pilih Berkas">
        <div className="flex gap-4 mb-3 text-sm">
          <label className="flex items-center gap-1.5"><input type="radio" checked={source === 'upload'} onChange={() => { setSource('upload'); reset() }} /> Unggah dari komputer</label>
          <label className="flex items-center gap-1.5"><input type="radio" checked={source === 'arsip'} onChange={() => { setSource('arsip'); reset() }} disabled={!features.arsip} /> Dari Arsip Data Historis{!features.arsip && ' (belum aktif)'}</label>
        </div>
        {source === 'upload' ? (
          <div className="flex items-center gap-3 flex-wrap">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="text-sm" />
            {file && <span className="text-xs text-gray-500">{file.name} — {parsed?.rows.length} baris</span>}
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <select value={arsipId} onChange={e => loadArsip(e.target.value)} className="form-select min-w-[320px] text-sm">
              <option value="">— pilih arsip Excel/CSV —</option>
              {arsipList.map(a => <option key={a.id} value={a.id}>{a.tahun} · {a.judul} ({a.upt_label || 'Pusat'})</option>)}
            </select>
            {file && <span className="text-xs text-gray-500">{file.name} — {parsed?.rows.length} baris</span>}
          </div>
        )}
        {error && <p className="text-sm text-rose-600 dark:text-rose-400 mt-3 flex items-start gap-1.5"><XCircle size={16} className="mt-0.5 flex-shrink-0" /> {error}</p>}
      </InfoCard>

      {/* 3. Pemetaan */}
      {parsed && (
        <InfoCard title="3. Periksa Pemetaan Kolom">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Kolom dipetakan otomatis berdasarkan namanya. Ubah bila ada yang keliru atau pilih kosong untuk mengabaikan.</p>
          <div className="grid gap-3 md:grid-cols-4 mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <p className="md:col-span-4 text-xs text-gray-500">Bila berkas tidak punya kolom UPT / Tahun / Bulan, tentukan di sini (dipakai hanya jika kolomnya tidak dipetakan):</p>
            <label className="text-xs font-medium">UPT untuk seluruh berkas
              <select className="form-select w-full mt-1 text-xs" value={fixed.upt} onChange={e => { setResult(null); setFixed(f => ({ ...f, upt: e.target.value })) }}>
                <option value="">— dari kolom UPT —</option>
                {uptList.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium">Tahun untuk seluruh berkas
              <input className="form-input w-full mt-1 text-xs" inputMode="numeric" placeholder="mis. 2022" value={fixed.tahun} onChange={e => { setResult(null); setFixed(f => ({ ...f, tahun: e.target.value.replace(/\D/g, '').slice(0, 4) })) }} />
            </label>
            <label className="text-xs font-medium">Bulan untuk seluruh berkas
              <select className="form-select w-full mt-1 text-xs" value={fixed.bulan} onChange={e => { setResult(null); setFixed(f => ({ ...f, bulan: e.target.value })) }}>
                <option value="">— dari kolom Bulan / tanggal —</option>
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium">Turunkan bulan & tahun dari kolom tanggal
              <select className="form-select w-full mt-1 text-xs" value={dateKey} onChange={e => { setResult(null); setDateKey(e.target.value) }}>
                <option value="">— tidak —</option>
                {fields.filter(f => f.tipe === 'tanggal').map(f => <option key={f.field_key} value={f.field_key}>{f.label}</option>)}
              </select>
            </label>
          </div>
          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-900">
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 px-2">Kolom di berkas</th><th className="py-2 px-2">Contoh isi</th><th className="py-2 px-2">Diisikan ke</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {parsed.headers.map(h => (
                  <tr key={h}>
                    <td className="py-2 px-2 font-medium">{h}</td>
                    <td className="py-2 px-2 text-xs text-gray-500 max-w-[220px] truncate">{String(sample?.[h] ?? '')}</td>
                    <td className="py-2 px-2">
                      <select value={valueOf(mapping[h])} onChange={e => setTarget(h, e.target.value)} className={`form-select text-xs py-1 ${mapping[h] ? '' : 'text-gray-400'}`}>
                        <option value="">— abaikan —</option>
                        {targets.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={validate} className="btn-primary text-sm mt-4"><ListChecks size={15} /> Periksa Data</button>
        </InfoCard>
      )}

      {/* 4. Hasil validasi + impor */}
      {result && (
        <InfoCard title="4. Hasil Pemeriksaan">
          {result.fatal ? (
            <p className="text-sm text-rose-600 dark:text-rose-400 flex items-start gap-1.5"><XCircle size={16} className="mt-0.5" /> {result.fatal}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ['Baris di berkas', result.ringkas.totalBaris, ''],
                  ['Baris valid', result.ringkas.valid, 'text-emerald-600 dark:text-emerald-400'],
                  ['Bermasalah (dilewati)', result.errors.length, result.errors.length ? 'text-rose-600 dark:text-rose-400' : ''],
                  ['Data yang ditulis', result.payloads.length, ''],
                ].map(([label, val, cls]) => (
                  <div key={label} className="card p-3">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className={`text-2xl font-bold tabular-nums ${cls}`}>{val.toLocaleString('id-ID')}</p>
                  </div>
                ))}
              </div>

              {Object.keys(result.ringkas.perTahun).length > 0 && (
                <p className="text-xs text-gray-500">
                  Per tahun: {Object.entries(result.ringkas.perTahun).map(([y, n]) => `${y} (${n} baris)`).join(' · ')}
                </p>
              )}

              {result.warnings.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  {result.warnings.map((w, i) => <p key={i} className="flex gap-1.5"><AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /> {w.pesan}</p>)}
                </div>
              )}

              {result.errors.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 mb-1">{result.errors.length} baris bermasalah (baris Excel):</p>
                  <div className="max-h-56 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                    {result.errors.slice(0, 200).map((e, i) => (
                      <p key={i} className="px-3 py-1.5"><span className="font-mono text-gray-400 mr-2">baris {e.baris}</span>{e.pesan}</p>
                    ))}
                    {result.errors.length > 200 && <p className="px-3 py-1.5 text-gray-400">… dan {result.errors.length - 200} lainnya</p>}
                  </div>
                  <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
                    <input type="checkbox" checked={skipBad} onChange={e => setSkipBad(e.target.checked)} className="w-4 h-4 rounded" />
                    Lewati {result.errors.length} baris bermasalah dan impor {result.ringkas.valid} baris yang valid
                  </label>
                </div>
              )}

              {progress && (
                <div>
                  <div className="h-2 rounded bg-gray-200 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full bg-blue-600 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Menyimpan {progress.done.toLocaleString('id-ID')} / {progress.total.toLocaleString('id-ID')} …</p>
                </div>
              )}

              {done && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-sm text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-3 flex-wrap">
                  <span className="flex items-center gap-2"><CheckCircle2 size={18} /> {done.ditulis.toLocaleString('id-ID')} data dari {done.baris.toLocaleString('id-ID')} baris berhasil diimpor dan dicatat di log.</span>
                  <button onClick={() => reset()} className="btn-secondary text-xs">Impor berkas lain</button>
                </div>
              )}

              {!done && (
                <button onClick={doImport} disabled={!canImport} className="btn-primary text-sm disabled:opacity-40">
                  {progress ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  Impor {result.payloads.length.toLocaleString('id-ID')} Data
                </button>
              )}
              {!canImport && !done && result.errors.length > 0 && !skipBad && (
                <p className="text-xs text-gray-400">Perbaiki berkas dan unggah ulang, atau centang "lewati baris bermasalah" untuk melanjutkan.</p>
              )}
            </div>
          )}
        </InfoCard>
      )}
    </div>
  )
}
