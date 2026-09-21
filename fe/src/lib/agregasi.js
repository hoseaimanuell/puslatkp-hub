/**
 * lib/agregasi.js
 * Cara merekap nilai mingguan menjadi bulan / triwulan / tahun.
 *
 *   sum  = dijumlahkan                       (mis. jumlah peserta per minggu)
 *   last = NILAI TERAKHIR yang sudah diisi   (angka KUMULATIF: pagu, realisasi, jumlah SDM)
 *   avg  = rata-rata minggu yang terisi
 *   max  = nilai tertinggi
 *
 * Satu minggu dapat berisi beberapa baris (beberapa pelatihan): nilai angka pada minggu itu = jumlah semua baris.
 */

export const AGREGASI_LABEL = {
  sum: 'Jumlahkan (Σ)',
  last: 'Nilai terakhir (kumulatif)',
  avg: 'Rata-rata',
  max: 'Maksimum',
}

export const AGREGASI_SHORT = { sum: 'Σ jumlah', last: 'nilai terakhir', avg: 'rata-rata', max: 'maks.' }

/** Tebakan bila kolom `agregasi` belum ada di database (sebelum migrasi_03): sama dengan aturan di migrasi. */
export function defaultAgregasi(fieldKey = '') {
  if (/^(pagu|realisasi)/.test(fieldKey)) return 'last'
  if (['jumlah_instruktur_wi', 'instruktur_berdasarkan_keahlian', 'widyaiswara_berdasarkan_keahlian', 'volume'].includes(fieldKey)) return 'last'
  return 'sum'
}

export const agregasiOf = field => field?.agregasi || defaultAgregasi(field?.field_key)

const isNum = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))

/**
 * Terapkan cara rekap pada nilai per minggu (URUT dari minggu terawal ke terakhir).
 * Nilai kosong (null/undefined) dilewati. Mengembalikan null bila tidak ada satu pun nilai.
 */
export function applyAgregasi(valuesInWeekOrder, mode = 'sum') {
  const v = valuesInWeekOrder.filter(isNum).map(Number)
  if (!v.length) return mode === 'sum' ? 0 : null
  switch (mode) {
    case 'last': return v[v.length - 1]
    case 'avg': return v.reduce((a, b) => a + b, 0) / v.length
    case 'max': return Math.max(...v)
    default: return v.reduce((a, b) => a + b, 0)
  }
}

/** Menggabungkan hasil beberapa UPT: sum & last dijumlahkan antar UPT; avg dirata-rata; max diambil tertinggi. */
export function combineUpt(valuesPerUpt, mode = 'sum') {
  const v = valuesPerUpt.filter(isNum).map(Number)
  if (!v.length) return 0
  if (mode === 'avg') return v.reduce((a, b) => a + b, 0) / v.length
  if (mode === 'max') return Math.max(...v)
  return v.reduce((a, b) => a + b, 0)
}

/**
 * Nilai satu minggu dari baris-baris rekap_nilai minggu itu (boleh banyak baris/pelatihan):
 * angka dijumlahkan antar baris, teks digabung dengan " · ".
 * @returns {{[field_key: string]: number|string}}
 */
export function weekValues(rows = []) {
  const out = {}
  for (const r of rows) {
    if (isNum(r.value)) {
      out[r.field_key] = (typeof out[r.field_key] === 'number' ? out[r.field_key] : 0) + Number(r.value)
    } else if (r.value_text !== null && r.value_text !== undefined && r.value_text !== '') {
      const t = String(r.value_text)
      if (typeof out[r.field_key] === 'number') continue
      out[r.field_key] = out[r.field_key] ? (out[r.field_key].split(' · ').includes(t) ? out[r.field_key] : `${out[r.field_key]} · ${t}`) : t
    }
  }
  return out
}

/**
 * Rekap banyak baris rekap_nilai (campuran jenis data/UPT) menjadi satu baris per (jenis_data, UPT, kolom) sesuai
 * cara rekap tiap kolom. Baris teks (value null) diteruskan apa adanya.
 * @param rows      baris rekap_nilai
 * @param weekIds   id periode minggu berurutan kronologis
 * @param fieldDefs field_definitions (untuk `agregasi`)
 */
export function aggregateRows(rows, weekIds, fieldDefs) {
  const modeOf = {}
  fieldDefs.forEach(f => { modeOf[`${f.jenis_data_id}|${f.field_key}`] = agregasiOf(f) })
  const order = new Map(weekIds.map((id, i) => [id, i]))
  const groups = new Map()
  const passthrough = []

  for (const r of rows) {
    if (!isNum(r.value)) { passthrough.push(r); continue }
    const key = `${r.jenis_data_id}|${r.upt_key}|${r.field_key}`
    if (!groups.has(key)) groups.set(key, { jenis_data_id: r.jenis_data_id, upt_key: r.upt_key, field_key: r.field_key, weeks: new Map() })
    const g = groups.get(key)
    g.weeks.set(r.period_id, (g.weeks.get(r.period_id) || 0) + Number(r.value))
  }

  const out = [...passthrough]
  for (const g of groups.values()) {
    const ordered = [...g.weeks.entries()].sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0)).map(([, v]) => v)
    const mode = modeOf[`${g.jenis_data_id}|${g.field_key}`] || defaultAgregasi(g.field_key)
    out.push({ jenis_data_id: g.jenis_data_id, upt_key: g.upt_key, field_key: g.field_key, value: applyAgregasi(ordered, mode), value_text: null, period_id: null })
  }
  return out
}
