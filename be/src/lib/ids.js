import { createHash } from 'node:crypto'

/** UUID deterministik dari sebuah string (dipakai agar data seed & periode punya ID yang stabil). */
export function uid(str) {
  const h = createHash('md5').update(String(str)).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** ID periode deterministik -> aman dijalankan ulang (INSERT ... ON DUPLICATE KEY UPDATE). */
export function periodId(p) {
  return uid(`period:${p.level}:${p.tahun}:${p.triwulan_ke ?? ''}:${p.bulan ?? ''}:${p.minggu_ke ?? ''}`)
}
