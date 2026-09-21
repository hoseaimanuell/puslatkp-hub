import { pool, todayJakarta } from '../db.js'
import { generatePeriods } from './periods.js'
import { periodId } from './ids.js'
import { logAudit } from './audit.js'

const COLS = '(id, `level`, tahun, triwulan_ke, bulan, minggu_ke, tanggal_mulai, tanggal_selesai, deadline, label)'

/**
 * Membuat periode 1 tahun (1 tahun + 4 triwulan + 12 bulan + 48 minggu).
 * Periode yang sudah ada TIDAK ditimpa (deadline yang pernah diubah Admin tetap aman),
 * kecuali overwrite = true (mengembalikan tanggal & deadline ke aturan bawaan).
 * @returns jumlah baris periode yang baru dibuat
 */
export async function ensureYear(tahun, { overwrite = false } = {}) {
  let created = 0
  for (const p of generatePeriods(tahun, { idFor: periodId })) {
    const sql = overwrite
      ? `INSERT INTO periods ${COLS} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE tanggal_mulai = VALUES(tanggal_mulai), tanggal_selesai = VALUES(tanggal_selesai), deadline = VALUES(deadline), label = VALUES(label)`
      : `INSERT IGNORE INTO periods ${COLS} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    const [res] = await pool.query(sql, [p.id, p.level, p.tahun, p.triwulan_ke, p.bulan, p.minggu_ke, p.tanggal_mulai, p.tanggal_selesai, p.deadline, p.label])
    if (res.affectedRows === 1) created++
  }
  return created
}

/** Membuat periode untuk rentang tahun. @returns { [tahun]: jumlah periode baru } */
export async function ensureYears(dari, sampai, opts) {
  const dibuat = {}
  for (let y = dari; y <= sampai; y++) dibuat[y] = await ensureYear(y, opts)
  return dibuat
}

/** Menjaga periode tahun berjalan dan tahun depan selalu ada (dipanggil saat server start & berkala). */
export async function ensureCurrentYears() {
  const tahun = Number(todayJakarta().slice(0, 4))
  const dibuat = await ensureYears(tahun, tahun + 1)
  const total = Object.values(dibuat).reduce((a, b) => a + b, 0)
  if (total) {
    console.log(`Periode otomatis dibuat: ${JSON.stringify(dibuat)}`)
    await logAudit(null, 'buat_periode', { tahun: dibuat, jumlah: total, alasan: 'otomatis (tahun berjalan & tahun depan)' })
  }
  return dibuat
}
