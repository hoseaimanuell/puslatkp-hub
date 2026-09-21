/**
 * lib/columnMatcher.js
 * Pencocokan otomatis nama kolom Excel ke field_definitions
 * Menggunakan normalisasi + Levenshtein distance sederhana
 */

/**
 * Normalisasi string: lowercase, hapus spasi, tanda baca
 */
function normalize(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Levenshtein distance antara dua string
 */
function levenshtein(a, b) {
  const an = a.length
  const bn = b.length
  if (an === 0) return bn
  if (bn === 0) return an
  const dp = Array.from({ length: an + 1 }, (_, i) =>
    Array.from({ length: bn + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[an][bn]
}

/**
 * Similarity score 0–1 berdasarkan Levenshtein
 */
function similarity(a, b) {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(na, nb) / maxLen
}

/**
 * Cocokkan array header Excel ke daftar field_definitions
 * @param {string[]} excelHeaders - kolom dari file Excel
 * @param {Array} fieldDefs - field_definitions dari database
 * @returns {Object} mapping: { excelHeader: fieldDef | null }
 */
export function matchColumns(excelHeaders, fieldDefs) {
  const THRESHOLD = 0.55 // minimum similarity untuk dianggap cocok

  const result = {}

  for (const header of excelHeaders) {
    let bestMatch = null
    let bestScore = 0

    for (const fd of fieldDefs) {
      // Cek similarity dengan label DAN field_key
      const scoreLabel = similarity(header, fd.label)
      const scoreKey = similarity(header, fd.field_key)
      const score = Math.max(scoreLabel, scoreKey)

      if (score > bestScore) {
        bestScore = score
        bestMatch = fd
      }
    }

    result[header] = bestScore >= THRESHOLD ? bestMatch : null
  }

  return result
}

/**
 * Konversi baris Excel ke format data_json sesuai mapping
 * @param {Object[]} rows - baris dari SheetJS
 * @param {Object} mapping - hasil matchColumns
 * @param {Array} fieldDefs - semua field definitions aktif
 * @returns {{ entries: Object[], extraKeys: string[] }}
 */
export function convertRows(rows, mapping, fieldDefs) {
  const fieldKeys = fieldDefs.map(fd => fd.field_key)
  const extraKeys = Object.keys(mapping).filter(h => mapping[h] === null)

  const entries = rows.map(row => {
    const data_json = {}
    const data_ekstra = {}
    let nama = null
    let nik = null

    for (const [header, fd] of Object.entries(mapping)) {
      const val = row[header]
      if (fd) {
        data_json[fd.field_key] = val ?? null
        if (fd.field_key === 'nama') nama = val
        if (fd.field_key === 'nik') nik = String(val ?? '')
      } else {
        // Kolom tidak dikenal → data_ekstra
        if (val !== undefined && val !== null) {
          data_ekstra[header] = val
        }
      }
    }

    return { nama, nik, data_json, data_ekstra }
  })

  return { entries, extraKeys }
}
