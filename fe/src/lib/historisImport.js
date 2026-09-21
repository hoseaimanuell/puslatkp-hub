/**
 * lib/historisImport.js
 * Impor DATA HISTORIS (Admin): template Excel, pemetaan kolom, validasi baris, dan penyusunan data siap simpan.
 * Modul ini murni (tanpa React/DOM) agar mudah diuji. Penulisan ke database dilakukan oleh halaman pemanggil.
 *
 *  - Mingguan  -> rekap_nilai  (kolom: UPT, Tahun, Bulan, Minggu, [Pelatihan Ke], + isian)
 *  - Bulanan rincian per nama -> data_entries (kolom: UPT, Tahun, Bulan, + isian)
 */
import * as XLSX from 'xlsx'
import { matchColumns } from './columnMatcher.js'

const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Kolom identitas baris pada berkas impor. */
export const META = [
  { id: 'upt', label: 'UPT', alias: ['upt', 'unit', 'balai', 'bppp', 'upt balai', 'unit pelaksana teknis', 'nama upt'] },
  { id: 'tahun', label: 'Tahun', alias: ['tahun', 'year', 'thn'] },
  { id: 'bulan', label: 'Bulan', alias: ['bulan', 'month', 'bln'] },
  { id: 'minggu', label: 'Minggu', alias: ['minggu', 'minggu ke', 'week', 'mg'] },
  { id: 'baris', label: 'Pelatihan Ke', alias: ['pelatihan ke', 'pelatihan', 'baris', 'baris ke', 'urutan', 'no pelatihan'] },
]

export const metaIds = (weekly, multi) => (weekly ? (multi ? ['upt', 'tahun', 'bulan', 'minggu', 'baris'] : ['upt', 'tahun', 'bulan', 'minggu']) : ['upt', 'tahun', 'bulan'])

// ─────────────── Template ───────────────
function sampleValue(f) {
  if (f.tipe === 'angka') return 1000
  if (f.tipe === 'tanggal') return '2024-03-15'
  if (f.tipe === 'pilihan') return (f.opsi_pilihan || [])[0] || ''
  return 'contoh'
}

/** Membuat workbook template (sheet Data, Petunjuk, Daftar UPT). */
export function buildTemplateWorkbook({ jenisData, fields, uptList, weekly, multi }) {
  const metaHeaders = metaIds(weekly, multi).map(id => META.find(m => m.id === id).label)
  const headers = [...metaHeaders, ...fields.map(f => f.label)]
  const meta = metaIds(weekly, multi)
  const example = [
    uptList[0]?.label || 'BPPP Contoh',
    2024, 3,
    ...(meta.includes('minggu') ? [2] : []),
    ...(meta.includes('baris') ? [1] : []),
    ...fields.map(sampleValue),
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, example]), 'Data')
  const petunjuk = [
    [`Template impor data historis — ${jenisData.judul}`],
    [''],
    ['1. Isi sheet "Data": satu baris = satu ' + (weekly ? 'UPT pada satu minggu' + (multi ? ' (satu pelatihan; ulangi baris dengan "Pelatihan Ke" 2, 3, … bila ada lebih dari satu)' : '') : 'orang (peserta) pada satu bulan') + '.'],
    ['2. Kolom UPT: isi nama UPT persis seperti sheet "Daftar UPT" (nama atau key).'],
    ['3. Tahun: 4 digit. Bulan: 1–12.' + (weekly ? ' Minggu: 1–4 (1 = tgl 1–7, 2 = 8–14, 3 = 15–21, 4 = 22–akhir bulan).' : '')],
    ['4. Periode (tahun) harus sudah dibuat di menu Kelola Periode.'],
    ['5. Kolom angka: isi angka saja (boleh 1.250.000 atau 1250000). Kolom tanggal: YYYY-MM-DD atau DD/MM/YYYY.'],
    weekly ? ['6. Pagu, realisasi, dan jumlah SDM adalah angka KUMULATIF: isi total sampai minggu tersebut.'] : [''],
    ['7. Mengimpor ulang baris yang sama memperbarui data yang sudah ada (tidak menggandakan).'],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(petunjuk), 'Petunjuk')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Key', 'Nama UPT'], ...uptList.map(u => [u.key, u.label])]), 'Daftar UPT')
  return wb
}

// ─────────────── Pemetaan kolom ───────────────
/** Tebak pemetaan header berkas -> { kind:'meta', id } | { kind:'field', field } | null */
export function autoMap(headers, fields, weekly, multi) {
  const allowed = metaIds(weekly, multi)
  const mapping = {}
  const used = new Set()
  for (const h of headers) {
    const n = norm(h)
    const m = META.find(x => allowed.includes(x.id) && !used.has(x.id) && x.alias.includes(n))
    if (m) { mapping[h] = { kind: 'meta', id: m.id }; used.add(m.id) }
  }
  const rest = headers.filter(h => !mapping[h])
  const fm = matchColumns(rest, fields)
  for (const h of rest) mapping[h] = fm[h] ? { kind: 'field', field: fm[h] } : null
  return mapping
}

// ─────────────── Parsing nilai ───────────────
/** '1.250.000' | '1,250,000' | 'Rp 12,5' | 12 -> angka; kosong -> null; tidak valid -> NaN */
export function parseNumber(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN
  let s = String(v).trim().replace(/^rp\.?\s*/i, '').replace(/\s+/g, '')
  if (!s) return null
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '')
  else s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

/** Date | 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'a s/d b' -> string; kosong -> null; tidak valid -> NaN */
export function parseTanggal(v) {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return NaN
    const d = new Date(v.getTime() + 12 * 3600 * 1000) // tahan terhadap selisih zona waktu pembacaan Excel
    return d.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) || /\ss\/d\s/i.test(s)) return s
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return NaN
}

const cellText = v => (v instanceof Date ? parseTanggal(v) : String(v).trim())

// ─────────────── Validasi ───────────────
/**
 * @returns {{ fatal?: string, errors: {baris:number,pesan:string}[], warnings: {baris:number,pesan:string}[],
 *            payloads: object[], ringkas: object }}
 * Baris yang bermasalah TIDAK masuk payloads (dilewati).
 */
export function validateRows({ rows, mapping, jenisData, fields, uptList, periods, weekly, multi, multiSupported, fixed = {}, deriveDateKey = null }) {
  const metaCol = {}
  const fieldCols = []
  Object.entries(mapping).forEach(([h, m]) => {
    if (m?.kind === 'meta') metaCol[m.id] = h
    else if (m?.kind === 'field') fieldCols.push({ header: h, field: m.field })
  })
  // Nilai tetap (mis. seluruh berkas milik satu UPT / satu tahun) & bulan/tahun yang diturunkan dari kolom tanggal
  const dateCol = deriveDateKey ? fieldCols.find(c => c.field.field_key === deriveDateKey) : null
  const need = weekly ? ['upt', 'tahun', 'bulan', 'minggu'] : ['upt', 'tahun', 'bulan']
  const missing = need.filter(id => {
    if (metaCol[id]) return false
    if (id === 'upt') return !fixed.upt
    if (id === 'tahun') return !fixed.tahun && !dateCol
    if (id === 'bulan') return !fixed.bulan && !dateCol
    return true
  })
  const base = { errors: [], warnings: [], payloads: [], ringkas: { totalBaris: rows.length, valid: 0, perTahun: {}, perUpt: {} } }
  if (missing.length) return { ...base, fatal: `Kolom wajib belum dipetakan: ${missing.map(id => META.find(m => m.id === id).label).join(', ')}.` }
  if (!fieldCols.length) return { ...base, fatal: 'Belum ada kolom isian yang dipetakan.' }

  const uptIndex = new Map()
  uptList.forEach(u => { uptIndex.set(norm(u.key), u); uptIndex.set(norm(u.label), u) })
  const findUpt = raw => uptIndex.get(norm(raw)) || uptIndex.get(norm('BPPP ' + raw)) || null

  const periodIndex = new Map()
  periods.forEach(p => {
    if (weekly && p.level === 'minggu') periodIndex.set(`${p.tahun}-${p.bulan}-${p.minggu_ke}`, p)
    if (!weekly && p.level === 'bulan') periodIndex.set(`${p.tahun}-${p.bulan}`, p)
  })

  const errors = base.errors
  const warnCount = {}
  const seen = new Map()
  const { ringkas } = base

  rows.forEach((r, idx) => {
    const line = idx + 2 // baris Excel (baris 1 = header)
    const err = pesan => errors.push({ baris: line, pesan })

    const upt = metaCol.upt ? findUpt(r[metaCol.upt]) : fixed.upt
    if (!upt) return err(`UPT "${r[metaCol.upt] ?? ''}" tidak dikenal (cocokkan dengan sheet "Daftar UPT")`)

    let dTahun = null, dBulan = null
    if ((!metaCol.tahun && !fixed.tahun) || (!metaCol.bulan && !fixed.bulan)) {
      const dv = dateCol ? parseTanggal(r[dateCol.header]) : null
      if (typeof dv !== 'string') return err(`Tanggal pada kolom "${dateCol?.field.label ?? ''}" kosong/tidak dikenali, sehingga bulan tidak dapat ditentukan`)
      dTahun = Number(dv.slice(0, 4)); dBulan = Number(dv.slice(5, 7))
    }
    const tahun = metaCol.tahun ? Number(r[metaCol.tahun]) : (fixed.tahun ?? dTahun)
    const bulan = metaCol.bulan ? Number(r[metaCol.bulan]) : (fixed.bulan ?? dBulan)
    const minggu = weekly ? Number(r[metaCol.minggu]) : null
    if (!Number.isInteger(tahun) || !Number.isInteger(bulan) || bulan < 1 || bulan > 12) return err(`Tahun/Bulan tidak valid ("${r[metaCol.tahun]}" / "${r[metaCol.bulan]}")`)
    if (weekly && (!Number.isInteger(minggu) || minggu < 1 || minggu > 4)) return err(`Minggu harus 1–4 (diisi "${r[metaCol.minggu]}")`)

    const period = periodIndex.get(weekly ? `${tahun}-${bulan}-${minggu}` : `${tahun}-${bulan}`)
    if (!period) return err(`Periode ${weekly ? `Minggu ke-${minggu} ` : ''}${bulan}/${tahun} belum ada — buat tahun ${tahun} di menu Kelola Periode`)

    let baris = 1
    if (weekly && metaCol.baris) {
      const b = r[metaCol.baris]
      baris = b === null || b === undefined || b === '' ? 1 : Number(b)
      if (!Number.isInteger(baris) || baris < 1) return err(`"Pelatihan Ke" tidak valid ("${b}")`)
    }
    if (weekly && baris > 1 && !multiSupported) return err('Beberapa pelatihan per minggu belum aktif di database (jalankan migrasi_03) — baris ini dilewati')
    if (weekly && baris > 1 && !jenisData.multi_baris) return err(`Jenis data ini tidak mengizinkan lebih dari 1 pelatihan per minggu ("Pelatihan Ke" = ${baris})`)

    // Nilai isian
    const values = {}
    let rowBad = false
    for (const { header, field } of fieldCols) {
      const raw = r[header]
      if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) continue
      let val
      if (field.tipe === 'angka') val = parseNumber(raw)
      else if (field.tipe === 'tanggal') val = parseTanggal(raw)
      else val = cellText(raw)
      if (typeof val === 'number' && Number.isNaN(val)) { err(`Kolom "${field.label}": "${raw}" bukan angka`); rowBad = true; continue }
      if (field.tipe === 'tanggal' && Number.isNaN(val)) { err(`Kolom "${field.label}": tanggal "${raw}" tidak dikenali (pakai YYYY-MM-DD atau DD/MM/YYYY)`); rowBad = true; continue }
      if (val !== null) values[field.field_key] = val
    }
    if (rowBad) return

    fields.filter(f => f.wajib && values[f.field_key] === undefined).forEach(f => {
      warnCount[`Kolom wajib "${f.label}" kosong`] = (warnCount[`Kolom wajib "${f.label}" kosong`] || 0) + 1
    })
    if (!Object.keys(values).length) return err('Semua kolom isian kosong')

    // Duplikat dalam berkas yang sama
    const dupKey = weekly ? `${upt.key}|${period.id}|${baris}` : (values.nik ? `${upt.key}|${period.id}|${values.nik}` : null)
    if (dupKey) {
      if (seen.has(dupKey)) return err(`Duplikat dengan baris ${seen.get(dupKey)} (${weekly ? 'UPT + minggu + pelatihan yang sama' : 'NIK yang sama pada UPT & bulan yang sama'})`)
      seen.set(dupKey, line)
    } else if (!weekly) {
      warnCount['Baris tanpa NIK akan terduplikasi jika berkas yang sama diimpor ulang'] = (warnCount['Baris tanpa NIK akan terduplikasi jika berkas yang sama diimpor ulang'] || 0) + 1
    }

    // Siap simpan
    if (weekly) {
      for (const f of fields) {
        const v = values[f.field_key]
        if (v === undefined) continue
        base.payloads.push({
          jenis_data_id: jenisData.id,
          upt_key: upt.key,
          period_id: period.id,
          ...(multiSupported ? { baris_ke: baris } : {}),
          field_key: f.field_key,
          value: f.tipe === 'angka' ? v : null,
          value_text: String(v),
        })
      }
    } else {
      base.payloads.push({
        jenis_data_id: jenisData.id,
        upt_key: upt.key,
        period_id: period.id,
        nama: values.nama || values.nama_pelatihan || null,
        nik: values.nik ? String(values.nik) : null,
        data_json: values,
        data_ekstra: {},
      })
    }
    ringkas.valid++
    ringkas.perTahun[tahun] = (ringkas.perTahun[tahun] || 0) + 1
    ringkas.perUpt[upt.label] = (ringkas.perUpt[upt.label] || 0) + 1
  })

  base.warnings = Object.entries(warnCount).map(([pesan, n]) => ({ baris: 0, pesan: `${pesan} (${n} baris)` }))
  return base
}
