import { pool } from '../db.js'
import { TABLES } from '../schema.js'

/**
 * Kolom opsional dari migrasi_03 (baris per minggu & cara rekap). Jika belum ada di database, kolom itu
 * dibuang dari whitelist (aplikasi tetap berjalan seperti sebelumnya) dan fiturnya dilaporkan nonaktif
 * lewat GET /api/health -> features.
 */
const OPTIONAL = [
  { table: 'rekap_nilai', col: 'baris_ke', feature: 'multiBaris', migrasi: 'migrasi_03_baris_dan_agregasi.sql' },
  { table: 'jenis_data', col: 'multi_baris', feature: 'multiBaris', migrasi: 'migrasi_03_baris_dan_agregasi.sql' },
  { table: 'field_definitions', col: 'agregasi', feature: 'agregasi', migrasi: 'migrasi_03_baris_dan_agregasi.sql' },
  { table: 'rekap_nilai', col: 'terlambat', feature: 'terlambat', migrasi: 'migrasi_04_terlambat_dan_arsip.sql' },
  { table: 'data_entries', col: 'terlambat', feature: 'terlambat', migrasi: 'migrasi_04_terlambat_dan_arsip.sql' },
  { table: 'dokumen_upload', col: 'terlambat', feature: 'terlambat', migrasi: 'migrasi_04_terlambat_dan_arsip.sql' },
  { table: 'jenis_data', col: 'kumulatif_bulanan', feature: 'kumulatifBulanan', migrasi: 'migrasi_07_kumulatif_bulanan.sql' },
  { table: 'field_definitions', col: 'opsi_bersyarat', feature: 'opsiBersyarat', migrasi: 'migrasi_09_opsi_bersyarat.sql' },
  // Tanpa kolom ini, rekap kembali menebak peran dari nama kolom (lihat fe/src/lib/peranRekap.js: peranLama).
  { table: 'field_definitions', col: 'peran_rekap', feature: 'peranRekap', migrasi: 'migrasi_16_peran_rekap.sql' },
]

export const features = { multiBaris: true, agregasi: true, terlambat: true, dashboard: true, kumulatifBulanan: true, dokumenResmi: true, opsiBersyarat: true, permintaanHapus: true, persetujuanBaris: true, tolakBaris: true, permintaanEdit: true, peranRekap: true }

/** Tabel opsional (migrasi_05/06/08). Bila belum ada, tabel dibuang dari whitelist dan fiturnya nonaktif. */
export async function detectOptionalTables() {
  const [t] = await pool.query("SHOW TABLES LIKE 'dashboard_widgets'")
  if (!t.length) {
    features.dashboard = false
    delete TABLES.dashboard_widgets
    console.warn('PERINGATAN: tabel dashboard_widgets belum ada. Jalankan database/migrasi_05_pengaturan_dashboard.sql agar Kelola Dashboard aktif.')
  }
  const [ff] = await pool.query("SHOW TABLES LIKE 'field_files'")
  if (!ff.length) {
    delete TABLES.field_files
    // fitur fieldFiles dilaporkan lewat fieldFilesEnabled() di routes/fieldFiles.js, bukan objek features ini
  }
  const [dr] = await pool.query("SHOW TABLES LIKE 'dokumen_resmi'")
  if (!dr.length) {
    features.dokumenResmi = false
    delete TABLES.dokumen_resmi
    console.warn('PERINGATAN: tabel dokumen_resmi belum ada. Jalankan database/migrasi_08_dokumen_resmi.sql agar menu Dokumen & Panduan tersimpan di database.')
  }
  const [ph] = await pool.query("SHOW TABLES LIKE 'permintaan_hapus'")
  if (!ph.length) {
    features.permintaanHapus = false
    delete TABLES.permintaan_hapus
    // Tanpa tabel ini, hapus/kosongkan akun UPT kembali langsung mengeksekusi (perilaku lama) — tidak diblokir diam-diam.
    for (const t of ['rekap_nilai', 'data_entries', 'dokumen_upload']) delete TABLES[t].deleteRequiresApproval
    console.warn('PERINGATAN: tabel permintaan_hapus belum ada. Jalankan database/migrasi_10_permintaan_hapus.sql agar hapus data UPT perlu persetujuan Admin.')
  } else {
    // period_id/jenis_data_id (migrasi 11) dipakai generik untuk konteks tiap permintaan hapus (bukan cuma
    // periode_kirim yang sudah dilepas) — tetap dicek di sini supaya database lama yang belum migrasi_11 aman.
    const [pidCol] = await pool.query("SHOW COLUMNS FROM permintaan_hapus LIKE 'period_id'")
    if (!pidCol.length) {
      for (const c of ['period_id', 'jenis_data_id']) {
        TABLES.permintaan_hapus.cols = TABLES.permintaan_hapus.cols.filter(x => x !== c)
        TABLES.permintaan_hapus.writable = TABLES.permintaan_hapus.writable.filter(x => x !== c)
      }
      console.warn('PERINGATAN: kolom permintaan_hapus.period_id belum ada. Jalankan database/migrasi_11_periode_kirim.sql agar konteks periode/jenis data tampil di menu Permintaan.')
    }
  }
}

/**
 * Kolom migrasi_13 (status draft/disetujui per baris) pada rekap_nilai/data_entries/dokumen_upload. Beda dari
 * `OPTIONAL` di atas (yang men-strip SATU kolom saja): di sini 4 kolom + forceOnWrite/rowApprovalGate dilepas
 * bersamaan bila belum ada, supaya tidak ada kondisi setengah-jalan (mis. rowApprovalGate menunjuk kolom
 * `status` yang sudah di-strip tapi forceOnWrite masih mencoba menulisnya).
 */
const ROW_STATUS_TABLES = ['rekap_nilai', 'data_entries', 'dokumen_upload']
const ROW_STATUS_COLS = ['status', 'disetujui_at', 'disetujui_by', 'disetujui_by_label']

export async function detectRowApproval() {
  const [found] = await pool.query("SHOW COLUMNS FROM rekap_nilai LIKE 'status'")
  if (found.length) return
  features.persetujuanBaris = false
  for (const t of ROW_STATUS_TABLES) {
    const def = TABLES[t]
    if (!def) continue
    for (const key of ['cols', 'writable']) def[key] = def[key].filter(c => !ROW_STATUS_COLS.includes(c))
    delete def.forceOnWrite
    delete def.rowApprovalGate
  }
  console.warn('PERINGATAN: kolom rekap_nilai.status belum ada. Jalankan database/migrasi_13_status_baris.sql agar setiap baris data yang disimpan UPT perlu disetujui Admin.')
}

/** Kolom migrasi_14 (`catatan_admin`, tombol Tolak pada Persetujuan Baris Data). Independen dari detectRowApproval
 *  di atas — database bisa punya migrasi_13 tanpa migrasi_14 (Setujui tetap jalan, Tolak saja yang nonaktif). */
export async function detectRejectBaris() {
  if (!features.persetujuanBaris) { features.tolakBaris = false; return }
  const [found] = await pool.query("SHOW COLUMNS FROM rekap_nilai LIKE 'catatan_admin'")
  if (found.length) return
  features.tolakBaris = false
  for (const t of ROW_STATUS_TABLES) {
    const def = TABLES[t]
    if (!def) continue
    for (const key of ['cols', 'writable']) def[key] = def[key].filter(c => c !== 'catatan_admin')
  }
  console.warn('PERINGATAN: kolom rekap_nilai.catatan_admin belum ada. Jalankan database/migrasi_14_tolak_baris.sql agar Admin bisa menolak baris data dengan catatan.')
}

/** Kolom migrasi_15 (`aksi`, `data_baru_json` pada permintaan_hapus) — mengedit baris yang sudah disetujui
 *  lewat "Permintaan Edit" alih-alih harus menghapus dulu. Butuh tabel permintaan_hapus (migrasi_10) sendiri. */
export async function detectEditRequest() {
  if (!features.permintaanHapus || !TABLES.permintaan_hapus) { features.permintaanEdit = false; return }
  const [found] = await pool.query("SHOW COLUMNS FROM permintaan_hapus LIKE 'aksi'")
  if (found.length) return
  features.permintaanEdit = false
  for (const c of ['aksi', 'data_baru_json']) {
    TABLES.permintaan_hapus.cols = TABLES.permintaan_hapus.cols.filter(x => x !== c)
    TABLES.permintaan_hapus.json = TABLES.permintaan_hapus.json.filter(x => x !== c)
  }
  for (const t of ['rekap_nilai', 'data_entries']) delete TABLES[t].editRequiresApproval
  console.warn('PERINGATAN: kolom permintaan_hapus.aksi belum ada. Jalankan database/migrasi_15_permintaan_edit.sql agar UPT bisa mengajukan edit baris yang sudah disetujui, bukan hanya menghapusnya.')
}

export async function detectOptionalColumns() {
  const missing = []
  const migrasiPerlu = new Set()
  for (const { table, col, feature, migrasi } of OPTIONAL) {
    const [found] = await pool.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [col])
    if (found.length) continue
    missing.push(`${table}.${col}`)
    migrasiPerlu.add(migrasi)
    features[feature] = false
    const def = TABLES[table]
    for (const key of ['cols', 'writable', 'bool', 'json']) def[key] = def[key].filter(c => c !== col)
    if (def.unique) def.unique = def.unique.filter(c => c !== col)
  }
  if (missing.length) {
    console.warn(`PERINGATAN: kolom migrasi belum ada: ${missing.join(', ')}.`)
    console.warn(`  Jalankan \`npm run migrate\` di folder be (atau di phpMyAdmin: ${[...migrasiPerlu].map(m => `database/${m}`).join(', ')}).`)
  }
  return features
}
