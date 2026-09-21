import { pool } from '../db.js'
import { TABLES } from '../schema.js'

/**
 * Kolom opsional dari migrasi_03 (baris per minggu & cara rekap). Jika belum ada di database, kolom itu
 * dibuang dari whitelist (aplikasi tetap berjalan seperti sebelumnya) dan fiturnya dilaporkan nonaktif
 * lewat GET /api/health -> features.
 */
const OPTIONAL = [
  { table: 'rekap_nilai', col: 'baris_ke', feature: 'multiBaris' },
  { table: 'jenis_data', col: 'multi_baris', feature: 'multiBaris' },
  { table: 'field_definitions', col: 'agregasi', feature: 'agregasi' },
  { table: 'rekap_nilai', col: 'terlambat', feature: 'terlambat' },
  { table: 'data_entries', col: 'terlambat', feature: 'terlambat' },
  { table: 'dokumen_upload', col: 'terlambat', feature: 'terlambat' },
]

export const features = { multiBaris: true, agregasi: true, terlambat: true, dashboard: true }

/** Tabel opsional (migrasi_05). Bila belum ada, tabel dibuang dari whitelist dan fiturnya nonaktif. */
export async function detectOptionalTables() {
  const [t] = await pool.query("SHOW TABLES LIKE 'dashboard_widgets'")
  if (t.length) return
  features.dashboard = false
  delete TABLES.dashboard_widgets
  console.warn('PERINGATAN: tabel dashboard_widgets belum ada. Jalankan database/migrasi_05_pengaturan_dashboard.sql agar Kelola Dashboard aktif.')
}

export async function detectOptionalColumns() {
  const missing = []
  for (const { table, col, feature } of OPTIONAL) {
    const [found] = await pool.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [col])
    if (found.length) continue
    missing.push(`${table}.${col}`)
    features[feature] = false
    const def = TABLES[table]
    for (const key of ['cols', 'writable', 'bool', 'json']) def[key] = def[key].filter(c => c !== col)
    if (def.unique) def.unique = def.unique.filter(c => c !== col)
  }
  if (missing.length) {
    console.warn(`PERINGATAN: kolom migrasi belum ada: ${missing.join(', ')}.`)
    console.warn('  Jalankan database/migrasi_03_baris_dan_agregasi.sql dan database/migrasi_04_terlambat_dan_arsip.sql di phpMyAdmin.')
  }
  return features
}
