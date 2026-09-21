/**
 * lib/deadline.js
 * Utilitas untuk perhitungan deadline periode
 */

/**
 * Hitung tanggal deadline = tanggal selesai periode BERIKUTNYA level yang sama
 * Logika: setiap periode punya tenggang 1 periode setelahnya untuk pengisian data
 */
export function hitungDeadline(level, tahun, triwulanKe, bulan, mingguKe) {
  switch (level) {
    case 'tahun': {
      // Deadline tahun = 30 Juni tahun berikutnya
      return new Date(tahun + 1, 5, 30) // June 30 next year
    }
    case 'triwulan': {
      // Deadline = akhir triwulan berikutnya
      const nextQ = triwulanKe === 4 ? 1 : triwulanKe + 1
      const nextYear = triwulanKe === 4 ? tahun + 1 : tahun
      const endMonths = { 1: [3, 31], 2: [6, 30], 3: [9, 30], 4: [12, 31] }
      const [m, d] = endMonths[nextQ]
      return new Date(nextYear, m - 1, d)
    }
    case 'bulan': {
      // Deadline = akhir bulan berikutnya
      const nextMonth = bulan === 12 ? 1 : bulan + 1
      const nextYear = bulan === 12 ? tahun + 1 : tahun
      const lastDay = new Date(nextYear, nextMonth, 0).getDate()
      return new Date(nextYear, nextMonth - 1, lastDay)
    }
    case 'minggu': {
      // Deadline = akhir minggu berikutnya (7 hari kemudian)
      // Asumsi setiap minggu = 7 hari flat
      const weekEnds = { 1: 7, 2: 14, 3: 21, 4: 31 } // rough day-of-month ends
      const nextWeek = mingguKe === 4 ? 1 : mingguKe + 1
      const nextMonth = mingguKe === 4 ? (bulan === 12 ? 1 : bulan + 1) : bulan
      const nextYear = mingguKe === 4 && bulan === 12 ? tahun + 1 : tahun
      return new Date(nextYear, nextMonth - 1, weekEnds[nextWeek])
    }
    default:
      return new Date()
  }
}

/**
 * Cek apakah sebuah periode sudah terkunci (lewat deadline)
 * @param {string|Date} deadline - tanggal deadline
 */
export function isPeriodLocked(deadline) {
  if (!deadline) return false
  const dl = new Date(deadline)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return dl < now
}

/**
 * Format tanggal ke string Indonesia
 * @param {string|Date} date
 */
export function formatTanggal(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Hitung sisa hari menuju deadline
 */
export function sisaHari(deadline) {
  if (!deadline) return null
  const dl = new Date(deadline)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.ceil((dl - now) / (1000 * 60 * 60 * 24))
  return diff
}
