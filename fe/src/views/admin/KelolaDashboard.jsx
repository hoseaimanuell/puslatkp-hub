/**
 * views/admin/KelolaDashboard.jsx
 * Admin: atur kartu & grafik Dashboard tanpa coding. Sumber angka dipilih dari jenis data + kolom (angka, level minggu).
 * Selama belum ada pengaturan tersimpan, Dashboard memakai tampilan bawaan (lib/dashboardWidgets.js).
 */
import { useState, useEffect, useMemo } from 'react'
import { db, getFeatures } from '../../lib/db'
import InfoCard from '../../components/InfoCard'
import { DEFAULT_WIDGETS, ICON_NAMES, COLORS, CHART_COLORS, toRow } from '../../lib/dashboardWidgets'
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Pencil, Copy, Eye, EyeOff, X } from 'lucide-react'

const blankKartu = grup => ({ tipe: 'kartu', judul: '', grup, gaya: 'berwarna', ikon: 'BarChart3', warna: 'bg-blue-600', satuan: 'angka', aktif: true, konfigurasi: { items: [{ jd: '', field: '' }] } })
const blankGrafik = () => ({ tipe: 'grafik', judul: '', grup: 'Grafik', gaya: 'berwarna', satuan: 'angka', aktif: true, konfigurasi: { series: [{ label: '', warna: CHART_COLORS[0], items: [{ jd: '', field: '' }] }] } })

/** Editor daftar sumber {jd, field}. */
function ItemsEditor({ items, onChange, jenisData, fieldsOf, label }) {
  const set = (i, patch) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</p>}
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select className="form-select text-xs flex-1" value={it.jd} onChange={e => set(i, { jd: e.target.value, field: '' })}>
            <option value="">— jenis data —</option>
            {jenisData.map(j => <option key={j.key} value={j.key}>{j.judul}</option>)}
          </select>
          <select className="form-select text-xs flex-1" value={it.field} onChange={e => set(i, { field: e.target.value })} disabled={!it.jd}>
            <option value="">— kolom angka —</option>
            {fieldsOf(it.jd).map(f => <option key={f.field_key} value={f.field_key}>{f.label}</option>)}
          </select>
          <button type="button" className="p-1 text-gray-400 hover:text-rose-600" onClick={() => onChange(items.filter((_, idx) => idx !== i))} title="Hapus sumber"><X size={14} /></button>
        </div>
      ))}
      <button type="button" className="text-xs text-sky-600 hover:underline" onClick={() => onChange([...items, { jd: '', field: '' }])}>+ tambah sumber (dijumlahkan)</button>
    </div>
  )
}

import PageHeader from '../../components/PageHeader'

export default function KelolaDashboard() {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [saved, setSaved] = useState([])
  const [jenisData, setJenisData] = useState([])
  const [fieldDefs, setFieldDefs] = useState([])
  const [edit, setEdit] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function load() {
    const feat = await getFeatures()
    if (!feat.dashboard) { setEnabled(false); setLoading(false); return }
    const [{ data: w }, { data: jds }, { data: f }] = await Promise.all([
      db.from('dashboard_widgets').select('*').order('urutan'),
      db.from('jenis_data').select('*').eq('aktif', true).order('created_at'),
      db.from('field_definitions').select('*').eq('aktif', true).eq('level', 'minggu').order('urutan'),
    ])
    setSaved(w || []); setJenisData((jds || []).filter(j => j.level_utama === 'minggu')); setFieldDefs(f || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const jdById = useMemo(() => Object.fromEntries(jenisData.map(j => [j.id, j])), [jenisData])
  const fieldsOf = key => {
    const j = jenisData.find(x => x.key === key)
    return j ? fieldDefs.filter(f => f.jenis_data_id === j.id && f.tipe === 'angka') : []
  }
  const usingDefault = saved.length === 0
  const list = usingDefault ? DEFAULT_WIDGETS : [...saved].sort((a, b) => a.urutan - b.urutan)
  const fail = error => setMsg({ type: 'error', text: error.message })

  async function copyDefaults() {
    setBusy(true)
    const { error } = await db.from('dashboard_widgets').insert(DEFAULT_WIDGETS.map(toRow))
    setBusy(false)
    if (error) return fail(error)
    setMsg({ type: 'success', text: 'Tampilan bawaan disalin. Sekarang setiap kartu/grafik dapat diubah.' })
    load()
  }

  async function save() {
    const w = edit
    const validItems = its => its.filter(i => i.jd && i.field)
    if (!w.judul.trim()) return setMsg({ type: 'error', text: 'Judul wajib diisi.' })
    if (!w.grup.trim()) return setMsg({ type: 'error', text: 'Nama bagian wajib diisi.' })
    let konfigurasi
    if (w.tipe === 'kartu') {
      const items = validItems(w.konfigurasi.items)
      if (!items.length) return setMsg({ type: 'error', text: 'Pilih minimal satu sumber (jenis data + kolom).' })
      konfigurasi = { ...w.konfigurasi, items, pembanding: validItems(w.konfigurasi.pembanding || []) }
      if (!konfigurasi.pembanding.length) { delete konfigurasi.pembanding; delete konfigurasi.pembandingLabel }
    } else {
      const series = w.konfigurasi.series.map(s => ({ ...s, items: validItems(s.items) })).filter(s => s.label.trim() && s.items.length)
      if (!series.length) return setMsg({ type: 'error', text: 'Grafik butuh minimal satu seri dengan nama dan sumber.' })
      konfigurasi = { series }
    }
    setBusy(true)
    const row = { ...toRow(w), konfigurasi }
    const q = w.id ? db.from('dashboard_widgets').update(row).eq('id', w.id) : db.from('dashboard_widgets').insert({ ...row, urutan: (Math.max(0, ...saved.map(s => s.urutan)) || 0) + 10 })
    const { error } = await q
    setBusy(false)
    if (error) return fail(error)
    setEdit(null); setMsg({ type: 'success', text: 'Tersimpan. Dashboard langsung memakai pengaturan ini.' }); load()
  }

  async function move(w, dir) {
    const i = list.findIndex(x => x.id === w.id), o = list[i + dir]
    if (!o) return
    const [a, b] = [w.urutan, o.urutan]
    await Promise.all([
      db.from('dashboard_widgets').update({ urutan: b }).eq('id', w.id),
      db.from('dashboard_widgets').update({ urutan: a === b ? b + dir : a }).eq('id', o.id),
    ])
    load()
  }
  async function toggle(w) { const { error } = await db.from('dashboard_widgets').update({ aktif: !w.aktif }).eq('id', w.id); if (error) fail(error); else load() }
  async function remove(w) {
    if (!window.confirm(`Hapus "${w.judul}" dari Dashboard?`)) return
    const { error } = await db.from('dashboard_widgets').delete().eq('id', w.id)
    if (error) fail(error); else load()
  }
  async function resetAll() {
    if (!window.confirm('Hapus SEMUA pengaturan dan kembali ke tampilan bawaan?')) return
    for (const w of saved) await db.from('dashboard_widgets').delete().eq('id', w.id)
    setMsg({ type: 'success', text: 'Kembali ke tampilan bawaan.' }); load()
  }

  if (loading) return <div className="card flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
  if (!enabled) {
    return <div className="card p-6 text-sm text-amber-700 dark:text-amber-300">Kelola Dashboard belum aktif. Jalankan <code>database/migrasi_05_pengaturan_dashboard.sql</code> di phpMyAdmin, restart backend, lalu muat ulang halaman.</div>
  }

  const setW = patch => setEdit(e => ({ ...e, ...patch }))
  const setK = patch => setEdit(e => ({ ...e, konfigurasi: { ...e.konfigurasi, ...patch } }))
  const src = w => (w.tipe === 'kartu' ? (w.konfigurasi?.items || []) : (w.konfigurasi?.series || []).flatMap(s => s.items || []))
    .map(i => `${jenisData.find(j => j.key === i.jd)?.judul || i.jd} · ${i.field}`).join(' + ')

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Kelola Dashboard" description="Atur kartu dan grafik di Dashboard. Sumber angka dipilih dari jenis data dan kolom." />

      {msg && <div className={`rounded-lg px-4 py-3 text-sm ${msg.type === 'error' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>{msg.text}</div>}

      {usingDefault && (
        <div className="card p-4 flex items-center justify-between gap-3 flex-wrap text-sm">
          <span>Saat ini Dashboard memakai <strong>tampilan bawaan</strong> (belum disimpan). Salin dulu agar bisa diubah.</span>
          <button className="btn-primary text-sm" onClick={copyDefaults} disabled={busy}><Copy size={14} /> Salin tampilan bawaan</button>
        </div>
      )}

      <InfoCard
        title={`Daftar Kartu & Grafik (${list.length})`}
        action={!usingDefault && (
          <div className="flex gap-2">
            <button className="btn-secondary text-xs" onClick={() => setEdit(blankKartu(list[0]?.grup || 'Ringkasan'))}><Plus size={13} /> Kartu</button>
            <button className="btn-secondary text-xs" onClick={() => setEdit(blankGrafik())}><Plus size={13} /> Grafik</button>
            <button className="btn-secondary text-xs text-rose-600" onClick={resetAll}>Kembali ke bawaan</button>
          </div>
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 px-2">Judul</th><th className="py-2 px-2">Bagian</th><th className="py-2 px-2">Tipe</th><th className="py-2 px-2">Sumber angka</th><th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {list.map((w, i) => (
                <tr key={w.id} className={w.aktif === false ? 'opacity-50' : ''}>
                  <td className="py-2 px-2 font-medium">{w.judul}</td>
                  <td className="py-2 px-2 text-xs">{w.grup}</td>
                  <td className="py-2 px-2 text-xs">{w.tipe === 'grafik' ? 'Grafik batang' : w.gaya === 'putih' ? 'Kartu putih' : 'Kartu berwarna'} · {w.satuan === 'rupiah' ? 'Rp' : 'angka'}</td>
                  <td className="py-2 px-2 text-[11px] text-gray-500 max-w-[320px] truncate" title={src(w)}>{src(w)}</td>
                  <td className="py-2 px-2 whitespace-nowrap text-right">
                    {!usingDefault && (
                      <>
                        <button className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" disabled={i === 0} onClick={() => move(w, -1)} title="Naik"><ArrowUp size={14} /></button>
                        <button className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" disabled={i === list.length - 1} onClick={() => move(w, 1)} title="Turun"><ArrowDown size={14} /></button>
                        <button className="p-1 text-gray-400 hover:text-gray-700" onClick={() => toggle(w)} title={w.aktif === false ? 'Tampilkan' : 'Sembunyikan'}>{w.aktif === false ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                        <button className="p-1 text-gray-400 hover:text-amber-600" onClick={() => setEdit(JSON.parse(JSON.stringify(w)))} title="Ubah"><Pencil size={14} /></button>
                        <button className="p-1 text-gray-400 hover:text-rose-600" onClick={() => remove(w)} title="Hapus"><Trash2 size={14} /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-400 mt-3">Nilai kartu/grafik = jumlah isian minggu yang dipilih di Dashboard. Untuk kolom kumulatif (pagu, realisasi) dipakai nilai terakhir tiap UPT pada minggu itu.</p>
      </InfoCard>

      {edit && (
        <InfoCard title={edit.id ? `Ubah ${edit.tipe === 'grafik' ? 'Grafik' : 'Kartu'}` : `${edit.tipe === 'grafik' ? 'Grafik' : 'Kartu'} Baru`} action={<button onClick={() => setEdit(null)} className="p-1 text-gray-400"><X size={16} /></button>}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium">Judul
              <input className="form-input w-full mt-1" value={edit.judul} onChange={e => setW({ judul: e.target.value })} />
            </label>
            <label className="text-xs font-medium">Bagian (kartu/grafik dengan nama sama dikelompokkan)
              <input className="form-input w-full mt-1" value={edit.grup} onChange={e => setW({ grup: e.target.value })} />
            </label>
            <label className="text-xs font-medium">Satuan
              <select className="form-select w-full mt-1" value={edit.satuan} onChange={e => setW({ satuan: e.target.value })}>
                <option value="angka">Angka</option><option value="rupiah">Rupiah</option>
              </select>
            </label>
            {edit.tipe === 'kartu' && (
              <label className="text-xs font-medium">Gaya kartu
                <select className="form-select w-full mt-1" value={edit.gaya} onChange={e => setW({ gaya: e.target.value })}>
                  <option value="berwarna">Berwarna (dengan ikon)</option><option value="putih">Putih (dengan pembanding)</option>
                </select>
              </label>
            )}
            {edit.tipe === 'kartu' && edit.gaya === 'berwarna' && (
              <>
                <label className="text-xs font-medium">Ikon
                  <select className="form-select w-full mt-1" value={edit.ikon || ''} onChange={e => setW({ ikon: e.target.value })}>
                    {ICON_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium">Warna
                  <select className="form-select w-full mt-1" value={edit.warna || ''} onChange={e => setW({ warna: e.target.value })}>
                    {COLORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
              </>
            )}
          </div>

          <div className="mt-4 space-y-4">
            {edit.tipe === 'kartu' ? (
              <>
                <ItemsEditor label="Sumber angka (dijumlahkan)" items={edit.konfigurasi.items} onChange={items => setK({ items })} jenisData={jenisData} fieldsOf={fieldsOf} />
                {edit.gaya === 'putih' && (
                  <div className="space-y-2">
                    <ItemsEditor label="Pembanding (opsional, mis. Pagu)" items={edit.konfigurasi.pembanding || []} onChange={pembanding => setK({ pembanding })} jenisData={jenisData} fieldsOf={fieldsOf} />
                    <label className="text-xs font-medium block">Nama pembanding
                      <input className="form-input w-full mt-1 md:w-64" value={edit.konfigurasi.pembandingLabel || ''} placeholder="Pagu" onChange={e => setK({ pembandingLabel: e.target.value })} />
                    </label>
                    <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={!!edit.konfigurasi.sorot} onChange={e => setK({ sorot: e.target.checked })} /> Sorot (angka hijau tebal)</label>
                  </div>
                )}
              </>
            ) : (
              <>
                {edit.konfigurasi.series.map((sr, i) => (
                  <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 space-y-2">
                    <div className="flex gap-2 items-center">
                      <input className="form-input text-xs flex-1" placeholder="Nama seri (mis. Masyarakat)" value={sr.label} onChange={e => setK({ series: edit.konfigurasi.series.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                      <input type="color" value={sr.warna || '#1B5FA8'} onChange={e => setK({ series: edit.konfigurasi.series.map((x, j) => (j === i ? { ...x, warna: e.target.value } : x)) })} className="h-8 w-10 rounded" title="Warna batang" />
                      <button type="button" className="p-1 text-gray-400 hover:text-rose-600" onClick={() => setK({ series: edit.konfigurasi.series.filter((_, j) => j !== i) })} title="Hapus seri"><X size={14} /></button>
                    </div>
                    <ItemsEditor items={sr.items} onChange={items => setK({ series: edit.konfigurasi.series.map((x, j) => (j === i ? { ...x, items } : x)) })} jenisData={jenisData} fieldsOf={fieldsOf} />
                  </div>
                ))}
                <button type="button" className="text-xs text-sky-600 hover:underline" onClick={() => setK({ series: [...edit.konfigurasi.series, { label: '', warna: CHART_COLORS[edit.konfigurasi.series.length % CHART_COLORS.length], items: [{ jd: '', field: '' }] }] })}>+ tambah seri</button>
              </>
            )}
          </div>
          <div className="flex gap-2 mt-5">
            <button className="btn-primary text-sm" onClick={save} disabled={busy}>{busy && <Loader2 size={14} className="animate-spin" />} Simpan</button>
            <button className="btn-secondary text-sm" onClick={() => setEdit(null)}>Batal</button>
          </div>
        </InfoCard>
      )}
    </div>
  )
}
