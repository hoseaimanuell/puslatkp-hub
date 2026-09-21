/**
 * views/ArsipHistoris.jsx
 * Arsip data tahun-tahun lalu: unggah Excel/PDF apa adanya, lalu tampilkan langsung di web.
 * - PDF: ditampilkan lewat penampil bawaan browser.
 * - Excel/CSV: ditampilkan sebagai tabel (per sheet). Jika kolomnya sesuai template jenis data yang dipilih,
 *   muncul penanda "format sesuai template"; jika berbeda tetap ditampilkan apa adanya.
 * Admin melihat semua arsip; akun UPT hanya arsip miliknya.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { db, arsip, getFeatures } from '../lib/db'
import { useAuth } from '../AuthContext'
import InfoCard from '../components/InfoCard'
import { Loader2, Upload, Trash2, FileText, FileSpreadsheet, CheckCircle2, Info, X, Download, Search } from 'lucide-react'

const MAX_ROWS = 500
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const fmtSize = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB')
const fmtDate = d => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

/** Baris header = baris pertama (dari 10 baris teratas) yang memiliki paling banyak sel terisi. */
function detectHeader(rows) {
  let best = 0, bestN = -1
  rows.slice(0, 10).forEach((r, i) => { const n = (r || []).filter(c => c !== null && c !== '').length; if (n > bestN) { best = i; bestN = n } })
  return best
}

export default function ArsipHistoris() {
  const { isAdmin, uptKey } = useAuth()
  const thisYear = new Date().getFullYear()
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [jenisData, setJenisData] = useState([])
  const [fieldDefs, setFieldDefs] = useState([])
  const [uptList, setUptList] = useState([])
  const [filter, setFilter] = useState({ tahun: '', upt_key: '', q: '' })
  const [form, setForm] = useState({ tahun: String(thisYear - 1), upt_key: '', jenis_data_id: '', judul: '', catatan: '' })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [viewer, setViewer] = useState(null) // { item, kind, url?, sheets?, error? , loading }
  const [sheetIdx, setSheetIdx] = useState(0)
  const fileRef = useRef(null)

  async function load() {
    const { data, error } = await arsip.list({ tahun: filter.tahun, upt_key: filter.upt_key })
    if (error) { if (error.status === 409) setEnabled(false); else setMsg({ type: 'error', text: error.message }) }
    else setItems(data.data || [])
    setLoading(false)
  }
  useEffect(() => {
    (async () => {
      const feat = await getFeatures()
      if (!feat.arsip) { setEnabled(false); setLoading(false); return }
      const [{ data: jds }, { data: fields }, { data: upts }] = await Promise.all([
        db.from('jenis_data').select('*').eq('aktif', true).order('created_at'),
        db.from('field_definitions').select('*').eq('aktif', true),
        db.from('upt_list').select('*').order('label'),
      ])
      setJenisData(jds || []); setFieldDefs(fields || []); setUptList(upts || [])
    })()
  }, [])
  useEffect(() => { if (enabled) load() }, [filter.tahun, filter.upt_key, enabled]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (viewer?.url) URL.revokeObjectURL(viewer.url) }, [viewer?.url])

  const years = useMemo(() => Array.from({ length: 12 }, (_, i) => thisYear - i), [thisYear])
  const shown = useMemo(() => {
    const q = norm(filter.q)
    return items.filter(i => !q || norm(`${i.judul} ${i.file_name} ${i.upt_label || ''} ${i.jenis_data_judul || ''}`).includes(q))
  }, [items, filter.q])

  async function upload(e) {
    e.preventDefault()
    if (!file) return setMsg({ type: 'error', text: 'Pilih berkas terlebih dahulu.' })
    setBusy(true); setMsg(null)
    const { error } = await arsip.upload(file, {
      tahun: form.tahun, upt_key: isAdmin ? form.upt_key || '_pusat' : '', jenis_data_id: form.jenis_data_id,
      judul: form.judul.trim(), catatan: form.catatan.trim(),
    })
    setBusy(false)
    if (error) return setMsg({ type: 'error', text: error.message })
    setMsg({ type: 'success', text: 'Arsip berhasil diunggah.' })
    setFile(null); setForm(f => ({ ...f, judul: '', catatan: '' }))
    if (fileRef.current) fileRef.current.value = ''
    load()
  }

  async function remove(item) {
    if (!window.confirm(`Hapus arsip "${item.judul}"? Berkas akan dihapus permanen dari server.`)) return
    const { error } = await arsip.remove(item.id)
    if (error) return setMsg({ type: 'error', text: error.message })
    if (viewer?.item.id === item.id) setViewer(null)
    load()
  }

  async function open(item) {
    setSheetIdx(0)
    setViewer({ item, loading: true })
    try {
      const buf = await arsip.fetchFile(item.id)
      if (item.file_ext === 'pdf') {
        setViewer({ item, kind: 'pdf', url: URL.createObjectURL(new Blob([buf], { type: 'application/pdf' })) })
        return
      }
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const sheets = wb.SheetNames.map(name => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false })
        return { name, rows }
      }).filter(s => s.rows.length)
      setViewer({ item, kind: 'sheet', sheets, buf })
    } catch (err) {
      setViewer({ item, error: err.message })
    }
  }

  function download() {
    if (!viewer) return
    if (viewer.url) { const a = document.createElement('a'); a.href = viewer.url; a.download = viewer.item.file_name; a.click(); return }
    if (viewer.buf) { const url = URL.createObjectURL(new Blob([viewer.buf])); const a = document.createElement('a'); a.href = url; a.download = viewer.item.file_name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000) }
  }

  /** Bandingkan kolom sheet dengan template jenis data (kolom rincian bulanan). */
  function formatCheck(sheet, item) {
    if (!item.jenis_data_id) return null
    const fields = fieldDefs.filter(f => f.jenis_data_id === item.jenis_data_id && f.level === 'bulan')
    if (!fields.length) return null
    const hi = detectHeader(sheet.rows)
    const heads = new Set((sheet.rows[hi] || []).map(norm).filter(Boolean))
    const hit = fields.filter(f => heads.has(norm(f.label)))
    const ratio = hit.length / fields.length
    return { ratio, hit: hit.length, total: fields.length, ok: ratio >= 0.8 }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>
  if (!enabled) {
    return (
      <div className="card p-6 text-sm text-amber-700 dark:text-amber-300">
        Arsip Historis belum aktif di database. Jalankan <code>database/migrasi_04_terlambat_dan_arsip.sql</code> di phpMyAdmin, lalu muat ulang halaman.
      </div>
    )
  }

  const sheet = viewer?.kind === 'sheet' ? viewer.sheets[sheetIdx] : null
  const check = sheet ? formatCheck(sheet, viewer.item) : null
  const hi = sheet ? detectHeader(sheet.rows) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl font-display">Arsip Data Historis</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Simpan berkas Excel/PDF data tahun-tahun lalu apa adanya, lalu lihat langsung di sini. {isAdmin ? 'Anda melihat arsip semua UPT.' : 'Anda hanya melihat arsip UPT Anda sendiri.'}
        </p>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${msg.type === 'error' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>{msg.text}</div>
      )}

      <InfoCard title="Unggah Arsip">
        <form onSubmit={upload} className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Tahun data
            <select className="form-input mt-1" value={form.tahun} onChange={e => setForm(f => ({ ...f, tahun: e.target.value }))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          {isAdmin ? (
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">UPT
              <select className="form-input mt-1" value={form.upt_key} onChange={e => setForm(f => ({ ...f, upt_key: e.target.value }))}>
                <option value="">Pusat / seluruh UPT</option>
                {uptList.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
              </select>
            </label>
          ) : <div className="text-xs text-gray-500 self-end pb-2">Diunggah untuk UPT Anda ({uptKey}).</div>}
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Jenis data (opsional — untuk mengecek kesesuaian format)
            <select className="form-input mt-1" value={form.jenis_data_id} onChange={e => setForm(f => ({ ...f, jenis_data_id: e.target.value }))}>
              <option value="">— tidak dipilih —</option>
              {jenisData.map(j => <option key={j.id} value={j.id}>{j.judul}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Judul
            <input className="form-input mt-1" placeholder="mis. Data Peserta Pelatihan 2022" value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} />
          </label>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 md:col-span-2">Catatan (opsional)
            <input className="form-input mt-1" value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))} />
          </label>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={e => setFile(e.target.files?.[0] || null)} className="text-sm" />
            <button className="btn-primary text-sm" disabled={busy || !file}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Unggah
            </button>
            <span className="text-[11px] text-gray-400">PDF, XLSX, XLS, atau CSV — maks. 30 MB.</span>
          </div>
        </form>
      </InfoCard>

      <InfoCard title={`Daftar Arsip (${shown.length})`}>
        <div className="flex flex-wrap gap-2 mb-4">
          <select className="form-input w-auto text-sm" value={filter.tahun} onChange={e => setFilter(f => ({ ...f, tahun: e.target.value }))}>
            <option value="">Semua tahun</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {isAdmin && (
            <select className="form-input w-auto text-sm" value={filter.upt_key} onChange={e => setFilter(f => ({ ...f, upt_key: e.target.value }))}>
              <option value="">Semua UPT</option>
              <option value="_pusat">Pusat / seluruh UPT</option>
              {uptList.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
          )}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="form-input pl-8 text-sm w-full" placeholder="Cari judul / berkas…" value={filter.q} onChange={e => setFilter(f => ({ ...f, q: e.target.value }))} />
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">Belum ada arsip.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 px-2">Tahun</th><th className="py-2 px-2">Judul</th><th className="py-2 px-2">UPT</th><th className="py-2 px-2">Jenis Data</th><th className="py-2 px-2">Berkas</th><th className="py-2 px-2">Diunggah</th><th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {shown.map(i => (
                  <tr key={i.id} className={viewer?.item.id === i.id ? 'bg-sky-50/60 dark:bg-sky-950/20' : ''}>
                    <td className="py-2 px-2 font-medium">{i.tahun}</td>
                    <td className="py-2 px-2">{i.judul}{i.catatan && <div className="text-[11px] text-gray-400">{i.catatan}</div>}</td>
                    <td className="py-2 px-2 text-xs">{i.upt_label || 'Pusat'}</td>
                    <td className="py-2 px-2 text-xs">{i.jenis_data_judul || '—'}</td>
                    <td className="py-2 px-2 text-xs whitespace-nowrap">
                      {i.file_ext === 'pdf' ? <FileText size={12} className="inline mr-1 text-rose-500" /> : <FileSpreadsheet size={12} className="inline mr-1 text-emerald-600" />}
                      {i.file_name} <span className="text-gray-400">({fmtSize(i.file_size)})</span>
                    </td>
                    <td className="py-2 px-2 text-xs whitespace-nowrap">{fmtDate(i.created_at)}<div className="text-gray-400">{i.uploaded_by_label}</div></td>
                    <td className="py-2 px-2 whitespace-nowrap text-right">
                      <button onClick={() => open(i)} className="btn-secondary text-xs">Lihat</button>
                      <button onClick={() => remove(i)} className="p-1.5 ml-1 text-gray-400 hover:text-rose-600" title="Hapus arsip"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </InfoCard>

      {viewer && (
        <InfoCard
          title={viewer.item.judul}
          action={<div className="flex gap-2"><button onClick={download} className="btn-secondary text-xs" disabled={viewer.loading || viewer.error}><Download size={13} /> Unduh</button><button onClick={() => setViewer(null)} className="p-1.5 text-gray-400 hover:text-gray-700"><X size={16} /></button></div>}
        >
          {viewer.loading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>}
          {viewer.error && <p className="text-sm text-rose-600">{viewer.error}</p>}
          {viewer.kind === 'pdf' && <iframe title={viewer.item.file_name} src={viewer.url} className="w-full h-[75vh] rounded-lg border border-gray-200 dark:border-gray-700 bg-white" />}
          {viewer.kind === 'sheet' && (
            viewer.sheets.length === 0 ? <p className="text-sm text-gray-400">Berkas tidak berisi data.</p> : (
              <div className="space-y-3">
                {check && (check.ok ? (
                  <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <CheckCircle2 size={14} /> Format sesuai template ({check.hit} dari {check.total} kolom dikenali). Data ini dapat diimpor lewat Impor Data Historis.
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                    <Info size={14} /> Format berbeda dari template ({check.hit} dari {check.total} kolom dikenali) — ditampilkan apa adanya.
                  </div>
                ))}
                {viewer.sheets.length > 1 && (
                  <div className="flex gap-1 flex-wrap">
                    {viewer.sheets.map((s, i) => (
                      <button key={s.name} onClick={() => setSheetIdx(i)} className={`text-xs px-3 py-1 rounded-full border ${i === sheetIdx ? 'bg-sky-600 text-white border-sky-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>{s.name}</button>
                    ))}
                  </div>
                )}
                <div className="overflow-auto max-h-[70vh] rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="text-xs min-w-full">
                    <tbody>
                      {sheet.rows.slice(0, MAX_ROWS + 1).map((r, ri) => (
                        <tr key={ri} className={ri === hi ? 'bg-gray-100 dark:bg-gray-800 font-semibold sticky top-0' : 'border-t border-gray-100 dark:border-gray-800'}>
                          {r.map((c, ci) => <td key={ci} className="px-2 py-1 whitespace-nowrap">{String(c)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sheet.rows.length > MAX_ROWS + 1 && <p className="text-[11px] text-gray-400">Menampilkan {MAX_ROWS} baris pertama dari {sheet.rows.length - 1}. Unduh berkas untuk melihat semuanya.</p>}
              </div>
            )
          )}
        </InfoCard>
      )}
    </div>
  )
}
