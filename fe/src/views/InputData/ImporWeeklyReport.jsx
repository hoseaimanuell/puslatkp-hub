/**
 * views/InputData/ImporWeeklyReport.jsx
 * Popup "Impor Weekly Report": UPT/Admin mengunggah Form Weekly Report (Excel formulir yang rutin dikirim UPT),
 * aplikasi membacanya (lib/weeklyReport.js), menampilkan pratinjau, lalu menyimpan ke jenis data mingguan yang
 * sesuai (be/scripts/seed-weekly-report.js) untuk UPT & minggu yang dipilih.
 *
 * Penyimpanan memakai aturan yang sama dengan input biasa: tulisan UPT jadi "Menunggu Persetujuan"; baris yang
 * sudah disetujui Admin tidak ditimpa, perubahannya diajukan sebagai permintaan edit. Tulisan Admin langsung
 * disetujui. Bagian yang kosong di formulir tidak mengubah data jenis data itu yang sudah tersimpan.
 */
import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { db } from '../../lib/db'
import { notify } from '../../lib/dialog'
import { useAuth } from '../../AuthContext'
import { bacaWeeklyReport } from '../../lib/weeklyReport'
import { formatPeriodLabel, sortPeriods } from '../../lib/periods'
import { FileSpreadsheet, Loader2, AlertTriangle, Upload, CheckCircle2 } from 'lucide-react'

const KUNCI = [
  'data_capaian_anggaran_per_jenis_belanja', 'pnbp_dan_mp_pnbp', 'data_capaian_anggaran_per_sumber_dana',
  'capaian_masyarakat_per_program', 'capaian_masyarakat_per_bidang', 'capaian_masyarakat_per_pembiayaan',
  'capaian_masyarakat_per_metode', 'capaian_aparatur_per_metode', 'lulusan_dudika', 'pelatihan_non_apbn',
]
const ON_CONFLICT = 'jenis_data_id,upt_key,period_id,baris_ke,field_key'
const normNama = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()

function formatNilai(v, def) {
  if (typeof v !== 'number') return String(v)
  return /\(Rp\)/i.test(def?.label || '') ? `Rp ${v.toLocaleString('id-ID')}` : v.toLocaleString('id-ID')
}

export default function ImporWeeklyReport({ onSaved }) {
  const { isAdmin, uptKey, uptLabel } = useAuth()
  const [meta, setMeta] = useState(null) // { upts, weeks, jdByKey, defs }
  const [hasil, setHasil] = useState(null)
  const [namaBerkas, setNamaBerkas] = useState('')
  const [galat, setGalat] = useState('')
  const [upt, setUpt] = useState(isAdmin ? '' : uptKey)
  const [periodId, setPeriodId] = useState('')
  const [lama, setLama] = useState([]) // rekap_nilai yang sudah ada untuk UPT & minggu terpilih
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      const [{ data: upts }, { data: weeks }, { data: jds }] = await Promise.all([
        db.from('upt_list').select('*').eq('aktif', true).order('label'),
        db.from('periods').select('*').eq('level', 'minggu'),
        db.from('jenis_data').select('*').in('key', KUNCI),
      ])
      const ids = (jds || []).map(j => j.id)
      const { data: defs } = ids.length ? await db.from('field_definitions').select('*').in('jenis_data_id', ids).eq('level', 'minggu') : { data: [] }
      setMeta({
        upts: upts || [],
        weeks: sortPeriods(weeks || []),
        jdByKey: Object.fromEntries((jds || []).map(j => [j.key, j])),
        defs: Object.fromEntries((defs || []).map(d => [`${d.jenis_data_id}|${d.field_key}`, d])),
      })
    })()
  }, [])

  const jenisBelumAda = meta ? KUNCI.filter(k => !meta.jdByKey[k]) : []

  async function pilihBerkas(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setGalat('')
    setHasil(null)
    setNamaBerkas(file.name)
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const ws = wb.Sheets.form || wb.Sheets[wb.SheetNames[0]]
      const h = bacaWeeklyReport(XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true }))
      if (!h.kelompok.length) throw new Error('Tidak ada angka yang terisi di formulir ini.')
      setHasil(h)
      // Tebak UPT (Admin) & minggu dari isi formulir
      if (isAdmin) setUpt(meta?.upts.find(u => normNama(u.label) === normNama(h.upt))?.key || '')
      const w = h.tanggal && meta?.weeks.find(p => p.tanggal_mulai <= h.tanggal && h.tanggal <= p.tanggal_selesai)
      setPeriodId(w?.id || '')
    } catch (err) {
      setGalat(err.message || 'Berkas tidak bisa dibaca.')
    }
  }

  // Data yang sudah tersimpan untuk UPT & minggu terpilih (untuk memberi tahu & menentukan jalur simpan)
  useEffect(() => {
    if (!meta || !upt || !periodId) { setLama([]); return }
    const ids = Object.values(meta.jdByKey).map(j => j.id)
    db.from('rekap_nilai').select('jenis_data_id, baris_ke, field_key, status')
      .in('jenis_data_id', ids).eq('upt_key', upt).eq('period_id', periodId)
      .then(({ data }) => setLama(data || []))
  }, [meta, upt, periodId])

  const tahunLaporan = hasil?.tanggal?.slice(0, 4)
  const pilihanMinggu = useMemo(
    () => (meta?.weeks || []).filter(w => !tahunLaporan || String(w.tahun) === tahunLaporan),
    [meta, tahunLaporan],
  )
  const labelUptTerpilih = meta?.upts.find(u => u.key === upt)?.label || uptLabel
  const beda = hasil?.upt && labelUptTerpilih && normNama(hasil.upt) !== normNama(labelUptTerpilih)
  const jdAdaData = new Set(lama.map(r => r.jenis_data_id))

  async function simpan() {
    setSaving(true)
    let disimpan = 0, diajukan = 0
    try {
      for (const k of hasil.kelompok) {
        const jd = meta.jdByKey[k.key]
        if (!jd) continue
        const barisLama = new Map()
        lama.filter(r => r.jenis_data_id === jd.id).forEach(r => {
          const b = barisLama.get(r.baris_ke) || { status: r.status, fields: new Set() }
          b.fields.add(r.field_key)
          if (r.status === 'disetujui') b.status = 'disetujui'
          barisLama.set(r.baris_ke, b)
        })
        const upserts = []
        for (let i = 0; i < k.baris.length; i++) {
          const barisKe = i + 1
          const row = k.baris[i]
          const nilai = Object.entries(row)
            .filter(([fk]) => meta.defs[`${jd.id}|${fk}`]) // kolom yang dihapus Admin dilewati
            .map(([fk, v]) => {
              const numerik = meta.defs[`${jd.id}|${fk}`].tipe === 'angka'
              return { field_key: fk, value: numerik ? v : null, value_text: numerik ? null : String(v) }
            })
          const b = barisLama.get(barisKe)
          const dikosongkan = b ? [...b.fields].filter(f => !(f in row)) : []
          if (b?.status === 'disetujui' && !isAdmin) {
            const { error } = await db.permintaanEdit.ajukanRekap(jd.id, periodId, barisKe, nilai, dikosongkan, 'Impor Weekly Report')
            if (error) throw error
            diajukan++
            continue
          }
          upserts.push(...nilai.map(n => ({ jenis_data_id: jd.id, upt_key: upt, period_id: periodId, baris_ke: barisKe, ...n })))
          if (dikosongkan.length) {
            const { error } = await db.from('rekap_nilai').delete().eq('jenis_data_id', jd.id).eq('upt_key', upt)
              .eq('period_id', periodId).eq('baris_ke', barisKe).in('field_key', dikosongkan).liveEdit()
            if (error) throw error
          }
        }
        if (upserts.length) {
          const { error } = await db.from('rekap_nilai').upsert(upserts, { onConflict: ON_CONFLICT })
          if (error) throw error
          disimpan++
        }
        // Baris lama yang tidak ada lagi di laporan ini (mis. minggu lalu 4 program, sekarang 3)
        for (const [barisKe, b] of barisLama) {
          if (barisKe <= k.baris.length) continue
          const q = db.from('rekap_nilai').delete().eq('jenis_data_id', jd.id).eq('upt_key', upt).eq('period_id', periodId).eq('baris_ke', barisKe)
          const { error } = await (b.status === 'disetujui' && !isAdmin ? q.alasan('Tidak ada lagi di Weekly Report') : q.liveEdit())
          if (error) throw error
        }
      }
      const bagian = [
        disimpan && `${disimpan} jenis data tersimpan${isAdmin ? '' : ' (menunggu persetujuan Admin)'}`,
        diajukan && `${diajukan} baris yang sudah disetujui diajukan sebagai permintaan edit`,
      ].filter(Boolean)
      notify(`Weekly Report diimpor: ${bagian.join(', ') || 'tidak ada perubahan'}.`, 'success')
      onSaved?.()
    } catch (err) {
      notify('Impor berhenti: ' + (err.message || err) + '\n\nBagian sebelumnya sudah tersimpan; mengimpor ulang berkas yang sama aman (menimpa nilai yang sama).')
    } finally {
      setSaving(false)
    }
  }

  if (!meta) return <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>

  if (jenisBelumAda.length) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Jenis data Weekly Report belum lengkap di database ({jenisBelumAda.join(', ')}). Jalankan <code>npm run migrate</code> di
        folder <code>be</code> (migrasi_17), lalu muat ulang halaman.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm text-[#0B1830]">
        Unggah <strong>Form Weekly Report</strong> (Excel) apa adanya. Angkanya dibaca per bagian dan dimasukkan ke jenis data
        mingguan yang sesuai. Periksa pratinjau sebelum menyimpan; semua data tetap bisa diubah lagi lewat Input Mingguan.
      </div>

      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors text-sm text-gray-600">
        <Upload size={18} />
        {namaBerkas ? <span>Ganti berkas <strong className="text-gray-800">{namaBerkas}</strong></span> : 'Pilih berkas Weekly Report (.xlsx)'}
        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={pilihBerkas} />
      </label>

      {galat && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{galat}</div>}

      {hasil && (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">UPT</label>
              {isAdmin ? (
                <select className="form-input" value={upt} onChange={e => setUpt(e.target.value)}>
                  <option value="">— Pilih UPT —</option>
                  {meta.upts.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
                </select>
              ) : <div className="form-input bg-gray-50">{uptLabel}</div>}
              <p className="text-[11px] text-gray-500 mt-1">Di formulir: <strong>{hasil.upt || '—'}</strong></p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Minggu laporan</label>
              <select className="form-input" value={periodId} onChange={e => setPeriodId(e.target.value)}>
                <option value="">— Pilih minggu —</option>
                {pilihanMinggu.map(w => <option key={w.id} value={w.id}>{formatPeriodLabel(w)}</option>)}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">Tanggal di formulir: <strong>{hasil.tanggal ? new Date(hasil.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</strong></p>
            </div>
          </div>

          {beda && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              UPT di formulir ({hasil.upt}) berbeda dengan UPT tujuan ({labelUptTerpilih}). Pastikan berkasnya benar.
            </div>
          )}
          {hasil.peringatan.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold flex items-center gap-1.5 mb-1"><AlertTriangle size={15} /> Perlu dicek ({hasil.peringatan.length})</p>
              <ul className="list-disc pl-5 space-y-0.5">{hasil.peringatan.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}

          <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
            {hasil.kelompok.map(k => {
              const jd = meta.jdByKey[k.key]
              const kolom = [...new Set(k.baris.flatMap(b => Object.keys(b)))]
                .map(fk => meta.defs[`${jd.id}|${fk}`] || { field_key: fk, label: fk, urutan: 999 })
                .sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
              return (
                <div key={k.key} className="rounded-xl border border-gray-200 bg-white">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                    <p className="text-sm font-semibold text-[#0B1830] flex items-center gap-1.5"><FileSpreadsheet size={14} className="text-blue-600" /> {jd.judul}</p>
                    <span className="text-[11px] text-gray-500">
                      {k.baris.length} baris{jdAdaData.has(jd.id) && <span className="ml-1.5 text-amber-700">· data minggu ini sudah ada, akan diperbarui</span>}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>{kolom.map(c => <th key={c.field_key} className="px-3 py-1.5 text-left font-medium whitespace-nowrap">{c.label}</th>)}</tr>
                      </thead>
                      <tbody>
                        {k.baris.map((b, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            {kolom.map(c => <td key={c.field_key} className={`px-3 py-1.5 whitespace-nowrap ${typeof b[c.field_key] === 'number' ? 'text-right tabular-nums' : ''}`}>{b[c.field_key] === undefined ? <span className="text-gray-300">—</span> : formatNilai(b[c.field_key], c)}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-gray-500">
              {isAdmin ? 'Tersimpan sebagai data yang sudah disetujui.' : 'Tersimpan sebagai "Menunggu Persetujuan" Admin.'} Bagian yang kosong di formulir tidak mengubah data yang sudah ada.
            </p>
            <button type="button" className="btn-primary text-sm" disabled={saving || !upt || !periodId} onClick={simpan}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Simpan {hasil.kelompok.length} jenis data
            </button>
          </div>
        </>
      )}
    </div>
  )
}
