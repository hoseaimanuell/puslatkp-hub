/**
 * lib/periods.js
 * Periode pelaporan: 4 minggu per bulan (bukan minggu kalender ISO).
 * 1 tahun = 1 tahun + 4 triwulan + 12 bulan + 48 minggu.
 */

export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export const NAMA_BULAN_SINGKAT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

export const ROMAN_TRIWULAN = ['I', 'II', 'III', 'IV']

export function namaBulan(bulan) {
  return NAMA_BULAN[(Number(bulan) || 1) - 1] || ''
}

export function triwulanDariBulan(bulan) {
  return Math.ceil((Number(bulan) || 1) / 3)
}

export function labelTriwulan(triwulanKe, tahun) {
  return `Triwulan ${ROMAN_TRIWULAN[(Number(triwulanKe) || 1) - 1] || triwulanKe} ${tahun}`
}

/** Format wajib UI: "Minggu ke-{N} {Nama Bulan} {Tahun}" */
export function labelMinggu(mingguKe, bulan, tahun) {
  return `Minggu ke-${mingguKe} ${namaBulan(bulan)} ${tahun}`
}

export function labelBulan(bulan, tahun) {
  return `${namaBulan(bulan)} ${tahun}`
}

/** Nama sheet Excel (maks. 31 karakter): "Mg ke-1 Jan 2026" */
export function excelSheetNameMinggu(mingguKe, bulan, tahun) {
  return `Mg ke-${mingguKe} ${NAMA_BULAN_SINGKAT[(Number(bulan) || 1) - 1]} ${tahun}`
}

export function excelSheetName(period) {
  if (!period) return 'Periode'
  if (period.level === 'minggu') {
    const full = formatPeriodLabel(period)
    return full.length <= 31 ? full : excelSheetNameMinggu(period.minggu_ke, period.bulan, period.tahun)
  }
  const label = formatPeriodLabel(period)
  return label.length <= 31 ? label : label.slice(0, 31)
}

/**
 * Label tampilan selalu dihitung dari tahun/bulan/minggu_ke
 * agar tidak bergantung pada teks lama ("Minggu 1", "M1", dll).
 */
export function formatPeriodLabel(period) {
  if (!period) return ''
  const tahun = period.tahun
  if (period.level === 'minggu') {
    return labelMinggu(period.minggu_ke, period.bulan, tahun)
  }
  if (period.level === 'bulan') {
    return labelBulan(period.bulan, tahun)
  }
  if (period.level === 'triwulan') {
    return labelTriwulan(period.triwulan_ke, tahun)
  }
  if (period.level === 'tahun') {
    return `Tahun ${tahun}`
  }
  if (period.minggu_ke && period.bulan) {
    return labelMinggu(period.minggu_ke, period.bulan, tahun)
  }
  return period.label || ''
}

export function periodHierarchy(period) {
  if (!period) return null
  const tahun = period.tahun
  const bulan = period.bulan
  const tw = period.triwulan_ke || (bulan ? triwulanDariBulan(bulan) : null)
  return {
    minggu: period.level === 'minggu' ? formatPeriodLabel(period) : null,
    bulan: bulan ? labelBulan(bulan, tahun) : null,
    triwulan: tw ? labelTriwulan(tw, tahun) : null,
    tahun: tahun ? `Tahun ${tahun}` : null,
  }
}

export function comparePeriods(a, b) {
  const y = (Number(a?.tahun) || 0) - (Number(b?.tahun) || 0)
  if (y) return y
  const levelRank = { tahun: 0, triwulan: 1, bulan: 2, minggu: 3 }
  const lr = (levelRank[a?.level] ?? 9) - (levelRank[b?.level] ?? 9)
  if (lr) return lr
  const tw = (Number(a?.triwulan_ke) || 0) - (Number(b?.triwulan_ke) || 0)
  if (a?.level === 'triwulan' || b?.level === 'triwulan') return tw
  const m = (Number(a?.bulan) || 0) - (Number(b?.bulan) || 0)
  if (m) return m
  return (Number(a?.minggu_ke) || 0) - (Number(b?.minggu_ke) || 0)
}

export function sortPeriods(periods = []) {
  return [...periods].sort(comparePeriods)
}

export function daysInMonth(tahun, bulan) {
  return new Date(tahun, bulan, 0).getDate()
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function isoDate(tahun, bulan, hari) {
  return `${tahun}-${pad2(bulan)}-${pad2(hari)}`
}

/** Rentang pelaporan: Minggu ke-1..4 per bulan (hari 1–7, 8–14, 15–21, 22–akhir). */
export function weekDateRange(tahun, bulan, mingguKe) {
  const last = daysInMonth(tahun, bulan)
  const start = (mingguKe - 1) * 7 + 1
  const end = mingguKe === 4 ? last : Math.min(mingguKe * 7, last)
  return { start, end, tanggal_mulai: isoDate(tahun, bulan, start), tanggal_selesai: isoDate(tahun, bulan, end) }
}

export function weekDeadline(tahun, bulan, mingguKe) {
  if (mingguKe < 4) {
    const { tanggal_selesai } = weekDateRange(tahun, bulan, mingguKe + 1)
    return tanggal_selesai
  }
  const nextMonth = bulan === 12 ? 1 : bulan + 1
  const nextYear = bulan === 12 ? tahun + 1 : tahun
  return weekDateRange(nextYear, nextMonth, 1).tanggal_selesai
}

export function monthDeadline(tahun, bulan) {
  const nextMonth = bulan === 12 ? 1 : bulan + 1
  const nextYear = bulan === 12 ? tahun + 1 : tahun
  return isoDate(nextYear, nextMonth, daysInMonth(nextYear, nextMonth))
}

export function generatePeriods(tahun = 2026, options = {}) {
  const idFor = options.idFor || ((p) => {
    if (p.level === 'tahun') return `p-yr-${tahun}`
    if (p.level === 'triwulan') return `p-q-${p.triwulan_ke}`
    if (p.level === 'bulan') return `p-m-${p.bulan}`
    return `p-w-${p.bulan}-${p.minggu_ke}`
  })

  const periods = []

  periods.push({
    id: idFor({ level: 'tahun', tahun }),
    level: 'tahun',
    tahun,
    triwulan_ke: null,
    bulan: null,
    minggu_ke: null,
    tanggal_mulai: isoDate(tahun, 1, 1),
    tanggal_selesai: isoDate(tahun, 12, 31),
    deadline: isoDate(tahun + 1, 6, 30),
    label: `Tahun ${tahun}`,
  })

  const qEnds = [
    [3, 31], [6, 30], [9, 30], [12, 31],
  ]
  for (let q = 1; q <= 4; q++) {
    const startM = (q - 1) * 3 + 1
    const [endM, endD] = qEnds[q - 1]
    const nextQ = q === 4 ? 1 : q + 1
    const nextYear = q === 4 ? tahun + 1 : tahun
    const [dlM, dlD] = qEnds[nextQ - 1]
    const row = {
      level: 'triwulan',
      tahun,
      triwulan_ke: q,
      bulan: null,
      minggu_ke: null,
      tanggal_mulai: isoDate(tahun, startM, 1),
      tanggal_selesai: isoDate(tahun, endM, endD),
      deadline: isoDate(nextYear, dlM, dlD),
      label: labelTriwulan(q, tahun),
    }
    periods.push({ ...row, id: idFor(row) })
  }

  for (let m = 1; m <= 12; m++) {
    const last = daysInMonth(tahun, m)
    const tw = triwulanDariBulan(m)
    const monthRow = {
      level: 'bulan',
      tahun,
      triwulan_ke: tw,
      bulan: m,
      minggu_ke: null,
      tanggal_mulai: isoDate(tahun, m, 1),
      tanggal_selesai: isoDate(tahun, m, last),
      deadline: monthDeadline(tahun, m),
      label: labelBulan(m, tahun),
    }
    periods.push({ ...monthRow, id: idFor(monthRow) })

    for (let w = 1; w <= 4; w++) {
      const range = weekDateRange(tahun, m, w)
      const weekRow = {
        level: 'minggu',
        tahun,
        triwulan_ke: tw,
        bulan: m,
        minggu_ke: w,
        tanggal_mulai: range.tanggal_mulai,
        tanggal_selesai: range.tanggal_selesai,
        deadline: weekDeadline(tahun, m, w),
        label: labelMinggu(w, m, tahun),
      }
      periods.push({ ...weekRow, id: idFor(weekRow) })
    }
  }

  return periods
}

export function weeksOfMonth(periods, tahun, bulan) {
  return sortPeriods(
    (periods || []).filter(p =>
      p.level === 'minggu' && Number(p.tahun) === Number(tahun) && Number(p.bulan) === Number(bulan)
    )
  )
}

export function weeksOfQuarter(periods, tahun, triwulanKe) {
  const startM = (triwulanKe - 1) * 3 + 1
  const endM = triwulanKe * 3
  return sortPeriods(
    (periods || []).filter(p =>
      p.level === 'minggu' &&
      Number(p.tahun) === Number(tahun) &&
      Number(p.bulan) >= startM &&
      Number(p.bulan) <= endM
    )
  )
}

export function weeksOfYear(periods, tahun) {
  return sortPeriods(
    (periods || []).filter(p => p.level === 'minggu' && Number(p.tahun) === Number(tahun))
  )
}

export function reportingWeekFromDay(day) {
  const d = Number(day) || 1
  if (d <= 7) return 1
  if (d <= 14) return 2
  if (d <= 21) return 3
  return 4
}

/** Tanggal lokal hari ini format YYYY-MM-DD (perbandingan string aman, tanpa masalah jam/zona waktu). */
export function todayIso(now = new Date()) {
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/**
 * Periode default dari daftar (sudah satu level): yang sedang berjalan hari ini;
 * jika tidak ada, yang terakhir sudah lewat; jika belum ada yang lewat, yang pertama.
 */
export function pickCurrentPeriod(list = []) {
  const t = todayIso()
  const sorted = sortPeriods(list)
  return (
    sorted.find(p => p.tanggal_mulai <= t && t <= p.tanggal_selesai) ||
    [...sorted].reverse().find(p => p.tanggal_selesai < t) ||
    sorted[0] ||
    null
  )
}
