import { pool } from '../db.js'
import { config } from '../config.js'
import { TABLES } from '../schema.js'
import { logAudit } from './audit.js'

/** Tabel yang memakai tempat sampah (soft delete). */
export const SOFT_TABLES = Object.keys(TABLES).filter(t => TABLES[t].soft)

let enabled = true
export const trashEnabled = () => enabled

/**
 * Tempat sampah aktif hanya jika kolom deleted_at sudah ada di SEMUA tabelnya
 * (database sudah menjalankan database/migrasi_02_tempat_sampah.sql). Jika belum, soft delete
 * dimatikan supaya aplikasi tetap berjalan (penghapusan menjadi permanen) dan peringatan dicetak.
 *
 * Bila suatu saat ada tabel ber-`soft:true` yang ditambahkan lewat migrasi opsional dan mungkin belum ada
 * sama sekali di database ini, itu BUKAN masalah tempat sampah (jangan sampai
 * membuat trash nonaktif untuk tabel lain yang sudah lengkap), jadi tabel yang belum ada dikeluarkan dari
 * SOFT_TABLES di sini (sebelum detectOptionalTables() menghapusnya dari whitelist TABLES juga).
 */
export async function detectSoftDelete() {
  const missingCol = []
  for (let i = SOFT_TABLES.length - 1; i >= 0; i--) {
    const t = SOFT_TABLES[i]
    const [exists] = await pool.query('SHOW TABLES LIKE ?', [t])
    if (!exists.length) { SOFT_TABLES.splice(i, 1); continue }
    const [cols] = await pool.query(`SHOW COLUMNS FROM \`${t}\` LIKE 'deleted_at'`)
    if (!cols.length) missingCol.push(t)
  }
  enabled = missingCol.length === 0
  if (!enabled) {
    for (const t of missingCol) TABLES[t].soft = false
    console.warn(`PERINGATAN: kolom tempat sampah belum ada di tabel: ${missingCol.join(', ')}.`)
    console.warn('  Jalankan database/migrasi_02_tempat_sampah.sql di phpMyAdmin. Sampai itu, penghapusan bersifat PERMANEN.')
  }
  return enabled
}

/** Buang permanen data yang sudah lebih dari TRASH_RETENTION_DAYS hari di tempat sampah. */
export async function purgeExpired() {
  if (!enabled) return 0
  const removed = {}
  let total = 0
  for (const t of SOFT_TABLES) {
    const [res] = await pool.query(
      `DELETE FROM \`${t}\` WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [config.trashRetentionDays],
    )
    if (res.affectedRows) { removed[t] = res.affectedRows; total += res.affectedRows }
  }
  if (total) await logAudit(null, 'hapus_permanen_otomatis', { jumlah: total, tabel: removed, alasan: `> ${config.trashRetentionDays} hari di tempat sampah` })
  return total
}
