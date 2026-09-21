/**
 * lib/excelExport.js
 * Export data ke Excel menggunakan SheetJS (xlsx)
 * Dilengkapi proteksi terhadap Formula Injection (CWE-1236 / DDE Attack).
 */
import * as XLSX from 'xlsx'

/**
 * Sanitasi nilai sel dari potensi eksekusi formula jahat.
 * Mencegah karakter =, +, -, @, \t, \r dieksekusi sebagai formula saat dibuka di Excel.
 */
export function sanitizeCellValue(val) {
  if (val === null || val === undefined) return ''
  if (typeof val === 'number' || typeof val === 'boolean') return val
  const str = String(val)
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`
  }
  return str
}

/**
 * Sanitasi array of objects sebelum dimasukkan ke json_to_sheet
 */
export function sanitizeRows(rows) {
  return (rows || []).map(row => {
    const clean = {}
    for (const [k, v] of Object.entries(row)) {
      clean[k] = sanitizeCellValue(v)
    }
    return clean
  })
}

/**
 * Export data entries (level bulan) ke Excel
 * @param {Object} options
 */
export function exportDataEntries({ entries, fieldDefs, jenisDataJudul, periodLabel, uptKey }) {
  // Buat header sesuai urutan field_definitions
  const headers = fieldDefs
    .filter(fd => fd.aktif)
    .sort((a, b) => a.urutan - b.urutan)
    .map(fd => fd.label)

  const fieldKeys = fieldDefs
    .filter(fd => fd.aktif)
    .sort((a, b) => a.urutan - b.urutan)
    .map(fd => fd.field_key)

  // Baris data dengan sanitasi Formula Injection
  const rows = entries.map(entry => {
    const row = {}
    fieldKeys.forEach((key, i) => {
      const rawVal = entry.data_json?.[key] ?? entry[key] ?? ''
      row[headers[i]] = sanitizeCellValue(rawVal)
    })
    return row
  })

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers })
  const wb = XLSX.utils.book_new()
  const sheetName = (periodLabel && String(periodLabel).length <= 31)
    ? String(periodLabel)
    : 'Data Detail'
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // Sheet ringkasan
  const summaryData = [
    ['Jenis Data', sanitizeCellValue(jenisDataJudul)],
    ['Periode', sanitizeCellValue(periodLabel)],
    ['UPT', sanitizeCellValue(uptKey || 'Semua')],
    ['Total Data', entries.length],
    ['Diekspor pada', new Date().toLocaleString('id-ID')],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan')

  const filename = `${jenisDataJudul}_${periodLabel}_${uptKey || 'semua'}.xlsx`
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '')

  XLSX.writeFile(wb, filename)
}

/**
 * Export rekap nilai (level tahun/triwulan/minggu)
 */
export function exportRekapNilai({ rekapData, fieldDefs, jenisDataJudul, periodLabel }) {
  const headers = ['Periode', 'UPT', ...fieldDefs.map(fd => fd.label)]
  const rows = rekapData.map(item => {
    const row = {
      Periode: sanitizeCellValue(periodLabel),
      UPT: sanitizeCellValue(item.upt_key),
    }
    fieldDefs.forEach(fd => {
      row[fd.label] = sanitizeCellValue(item.values?.[fd.field_key] ?? '')
    })
    return row
  })

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers })
  const wb = XLSX.utils.book_new()
  const sheet = (periodLabel && String(periodLabel).length <= 31)
    ? String(periodLabel)
    : 'Rekap'
  XLSX.utils.book_append_sheet(wb, ws, sheet)

  const filename = `Rekap_${jenisDataJudul}_${periodLabel}.xlsx`
    .replace(/\s+/g, '_')

  XLSX.writeFile(wb, filename)
}

/**
 * Export hasil auto-agregasi persis sesuai tampilan tabel di layar (Total & Breakdown Mingguan)
 */
export function exportAgregasiBreakdown({
  jenisDataJudul,
  periodLabel,
  uptKey,
  fieldDefs,
  totals = {},
  weekRows = []
}) {
  const numFields = fieldDefs.filter(f => f.tipe === 'angka')
  const headers = ['Periode Minggu', ...numFields.map(f => f.label), 'Status']

  // Baris-baris rincian mingguan
  const rows = weekRows.map(w => {
    const row = {
      'Periode Minggu': sanitizeCellValue(w.period?.label || `Minggu ke-${w.period?.minggu_ke}`),
    }
    numFields.forEach(f => {
      row[f.label] = w.values[f.field_key] !== undefined && w.values[f.field_key] !== null
        ? sanitizeCellValue(w.values[f.field_key])
        : 0
    })
    row['Status'] = sanitizeCellValue(w.hasData ? 'Terisi' : 'Kosong')
    return row
  })

  // Baris Total Akumulasi
  const totalRow = {
    'Periode Minggu': 'TOTAL AKUMULASI',
  }
  numFields.forEach(f => {
    totalRow[f.label] = sanitizeCellValue(totals[f.field_key] ?? 0)
  })
  totalRow['Status'] = '-'
  rows.push(totalRow)

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers })
  const wb = XLSX.utils.book_new()
  const sheetName = (periodLabel && String(periodLabel).length <= 31)
    ? String(periodLabel)
    : 'Agregasi'
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // Sheet Ringkasan Informasi
  const summaryData = [
    ['Laporan Auto-Agregasi Data PUSLATKP'],
    ['Jenis Data', sanitizeCellValue(jenisDataJudul)],
    ['Periode Agregasi', sanitizeCellValue(periodLabel)],
    ['UPT / Balai', sanitizeCellValue(uptKey || 'Semua')],
    ['Jumlah Minggu Terisi', `${weekRows.filter(w => w.hasData).length} dari ${weekRows.length} minggu`],
    ['Tanggal Ekspor', new Date().toLocaleString('id-ID')],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan')

  const filename = `Agregasi_${jenisDataJudul}_${periodLabel}_${uptKey || 'semua'}.xlsx`
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '')

  XLSX.writeFile(wb, filename)
}

/**
 * Export tabel rekap ringkasan UPT/Balai persis sesuai filter dan tampilan tabel di layar
 */
export function exportTabelRekapRingkasan({
  periodLabel,
  filterInfo = {},
  tableRows = [],
  totals = {}
}) {
  const headers = [
    'Nama UPT/Balai',
    'Jenis Data',
    'Pelatihan',
    'Peserta',
    'Pagu (Rp)',
    'Realisasi (Rp)',
    'Status'
  ]

  const rows = tableRows.map(r => ({
    'Nama UPT/Balai': sanitizeCellValue(r.upt_label),
    'Jenis Data': sanitizeCellValue(r.jenis),
    'Pelatihan': Number(r.pelatihan) || 0,
    'Peserta': Number(r.peserta) || 0,
    'Pagu (Rp)': Number(r.pagu) || 0,
    'Realisasi (Rp)': Number(r.realisasi) || 0,
    'Status': sanitizeCellValue(r.status),
  }))

  // Baris Total
  rows.push({
    'Nama UPT/Balai': 'TOTAL',
    'Jenis Data': '-',
    'Pelatihan': Number(totals.pelatihan) || 0,
    'Peserta': Number(totals.peserta) || 0,
    'Pagu (Rp)': Number(totals.pagu) || 0,
    'Realisasi (Rp)': Number(totals.realisasi) || 0,
    'Status': '-',
  })

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers })
  const wb = XLSX.utils.book_new()
  const sheetName = (periodLabel && String(periodLabel).length <= 31)
    ? String(periodLabel)
    : 'Rekap UPT'
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // Sheet Ringkasan Metadata
  const summaryData = [
    ['Laporan Rekapitulasi Pelaporan UPT/Balai PUSLATKP'],
    ['Periode', sanitizeCellValue(periodLabel)],
    ['Tahun', sanitizeCellValue(filterInfo.tahun || '-')],
    ['Bulan', sanitizeCellValue(filterInfo.bulan || '-')],
    ['Triwulan', sanitizeCellValue(filterInfo.triwulan || '-')],
    ['Filter Jenis Data', sanitizeCellValue(filterInfo.jenisData || 'Semua')],
    ['Filter UPT', sanitizeCellValue(filterInfo.upt || 'Semua')],
    ['Total Baris Data', tableRows.length],
    ['Tanggal Ekspor', new Date().toLocaleString('id-ID')],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Info Laporan')

  const filename = `Rekap_Pelaporan_UPT_${periodLabel}_${filterInfo.tahun || ''}.xlsx`
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '')

  XLSX.writeFile(wb, filename)
}

/**
 * Export gabungan semua UPT (Admin) — multi-sheet
 */
export function exportGabunganSemuaUPT({ data, jenisDataJudul, tahun }) {
  const wb = XLSX.utils.book_new()

  // Sheet per level
  const levels = ['tahun', 'triwulan', 'bulan', 'minggu']
  for (const level of levels) {
    const levelData = sanitizeRows(data[level] || [])
    if (levelData.length === 0) continue

    const ws = XLSX.utils.json_to_sheet(levelData)
    XLSX.utils.book_append_sheet(wb, ws, level.charAt(0).toUpperCase() + level.slice(1))
  }

  // Sheet validasi
  if (data.validasi && data.validasi.length > 0) {
    const wsV = XLSX.utils.json_to_sheet(sanitizeRows(data.validasi))
    XLSX.utils.book_append_sheet(wb, wsV, 'Validasi')
  }

  // Sheet kolom belum dikenal
  if (data.kolomTidakDikenal && data.kolomTidakDikenal.length > 0) {
    const wsE = XLSX.utils.json_to_sheet(sanitizeRows(data.kolomTidakDikenal))
    XLSX.utils.book_append_sheet(wb, wsE, 'Kolom Tidak Dikenal')
  }

  const filename = `Gabungan_${jenisDataJudul}_${tahun}.xlsx`.replace(/\s+/g, '_')
  XLSX.writeFile(wb, filename)
}

/**
 * Buat dan unduh file template Excel/CSV yang kolom-kolomnya dinamis mengikuti Jenis Data
 * @param {Object} options
 */
export function generateTemplateExcel({ fieldDefs = [], jenisDataJudul = 'Template', format = 'xlsx' }) {
  const activeFields = fieldDefs
    .filter(fd => fd.aktif !== false)
    .sort((a, b) => (a.urutan || 0) - (b.urutan || 0))

  const headers = activeFields.map(f => f.label)
  const fieldKeys = activeFields.map(f => f.field_key)

  // Contoh baris sampel agar user mengerti format isian
  const sampleRow = {}
  activeFields.forEach(f => {
    if (f.tipe === 'angka') {
      sampleRow[f.label] = f.field_key.includes('pagu') || f.field_key.includes('realisasi') ? 25000000 : 30
    } else if (f.tipe === 'tanggal') {
      sampleRow[f.label] = '2026-09-01'
    } else if (f.tipe === 'pilihan') {
      sampleRow[f.label] = (f.opsi_pilihan && f.opsi_pilihan[0]) || 'Pilihan 1'
    } else if (f.field_key === 'nik') {
      sampleRow[f.label] = '3171010101900001'
    } else if (f.field_key === 'nama') {
      sampleRow[f.label] = 'Nama Lengkap Peserta'
    } else {
      sampleRow[f.label] = `Contoh ${f.label}`
    }
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers })
  XLSX.utils.book_append_sheet(wb, ws, 'Template Impor')

  // Sheet Petunjuk Pengisian
  const petunjukData = [
    ['Petunjuk Pengisian Template Impor Data PUSLATKP'],
    ['Jenis Data', sanitizeCellValue(jenisDataJudul)],
    ['Jumlah Kolom', headers.length],
    ['Format Tanggal', 'YYYY-MM-DD (Contoh: 2026-09-01) atau format rentang (2026-09-01 s/d 2026-09-05)'],
    ['PENTING', 'Jangan mengubah urutan maupun nama header baris pertama agar auto-matching akurat.'],
  ]
  const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjukData)
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk')

  const cleanTitle = jenisDataJudul.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '')
  const fileName = `Template_Impor_${cleanTitle}.${format.toLowerCase() === 'csv' ? 'csv' : 'xlsx'}`

  XLSX.writeFile(wb, fileName)
}

/**
 * Baca file Excel dan kembalikan { headers, rows }
 */
export async function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    // Validasi ukuran file (maksimal 25MB untuk mencegah DoS memory exhaustion)
    const MAX_SIZE = 25 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return reject(new Error('Ukuran file melebihi batas maksimum 25 MB'))
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target.result
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const sheetName = wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
        const headers = rows.length > 0 ? Object.keys(rows[0]) : []
        resolve({ headers, rows, sheetName })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

