/**
 * Jalankan semua migrasi database/migrasi_*.sql yang BELUM diterapkan, berurutan, sekali perintah.
 *   npm run migrate              -> terapkan yang belum
 *   npm run migrate -- --cek     -> hanya tampilkan status, tidak mengubah apa pun
 *
 * Cara menentukan "sudah diterapkan": setiap migrasi punya pemeriksaan ke information_schema (kolom/tabel/FK yang
 * ditambahkannya sudah ada atau belum). Jadi aman untuk:
 *   - database baru dari puslatkp1a.sql (semua terdeteksi sudah ada -> tidak ada yang dijalankan),
 *   - database lama yang sebagian migrasinya dijalankan manual lewat phpMyAdmin,
 *   - menjalankan perintah ini berulang kali.
 * Riwayat dicatat di tabel schema_migrations (hanya catatan, bukan penentu).
 *
 * MENAMBAH MIGRASI BARU: buat database/migrasi_17_xxx.sql lalu tambahkan satu baris di DAFTAR di bawah beserta
 * pemeriksaannya. Berkas migrasi yang tidak terdaftar akan membuat perintah ini berhenti dengan pesan jelas.
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import 'dotenv/config'
import { sslDari } from '../src/lib/dbSsl.js'

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../database')
const DB = process.env.DB_NAME || 'Puslatkp1a'
const hanyaCek = process.argv.includes('--cek')

const kolom = (table, col) => async q =>
  (await q('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?', [DB, table, col])).length > 0
const tabel = table => async q =>
  (await q('SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [DB, table])).length > 0
// Migrasi berisi data (bukan struktur): sudah diterapkan bila jenis data yang ditambahkannya ada
const jenisData = key => async q =>
  (await q('SELECT 1 FROM `' + DB + '`.jenis_data WHERE `key` = ?', [key])).length > 0
const fkCascade = name => async q =>
  (await q("SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? AND CONSTRAINT_NAME = ? AND DELETE_RULE = 'CASCADE'", [DB, name])).length > 0

/** Urutan = urutan penerapan. `sudah` mengembalikan true bila perubahan migrasi itu sudah ada di database. */
const DAFTAR = [
  { file: 'migrasi_01_hapus_upt_cascade.sql', sudah: fkCascade('fk_rn_upt') },
  { file: 'migrasi_02_tempat_sampah.sql', sudah: kolom('rekap_nilai', 'deleted_at') },
  { file: 'migrasi_03_baris_dan_agregasi.sql', sudah: kolom('rekap_nilai', 'baris_ke') },
  { file: 'migrasi_04_terlambat_dan_arsip.sql', sudah: kolom('rekap_nilai', 'terlambat') },
  { file: 'migrasi_05_pengaturan_dashboard.sql', sudah: tabel('dashboard_widgets') },
  { file: 'migrasi_06_kolom_berkas.sql', sudah: tabel('field_files') },
  { file: 'migrasi_07_kumulatif_bulanan.sql', sudah: kolom('jenis_data', 'kumulatif_bulanan') },
  { file: 'migrasi_08_dokumen_resmi.sql', sudah: tabel('dokumen_resmi') },
  { file: 'migrasi_09_opsi_bersyarat.sql', sudah: kolom('field_definitions', 'opsi_bersyarat') },
  { file: 'migrasi_10_permintaan_hapus.sql', sudah: tabel('permintaan_hapus') },
  { file: 'migrasi_13_status_baris.sql', sudah: kolom('rekap_nilai', 'status') },
  { file: 'migrasi_14_tolak_baris.sql', sudah: kolom('rekap_nilai', 'catatan_admin') },
  { file: 'migrasi_15_permintaan_edit.sql', sudah: kolom('permintaan_hapus', 'aksi') },
  { file: 'migrasi_16_peran_rekap.sql', sudah: kolom('field_definitions', 'peran_rekap') },
  { file: 'migrasi_17_weekly_report.sql', sudah: jenisData('pnbp_dan_mp_pnbp') },
]
// Fitur yang sudah dihapus dari aplikasi — jangan pernah dijalankan otomatis (lihat docs/07-pemeliharaan.md).
const USANG = new Set(['migrasi_11_periode_kirim.sql', 'migrasi_12_status_kirim.sql'])

const tidakTerdaftar = readdirSync(dir)
  .filter(f => /^migrasi_.*\.sql$/.test(f) && !USANG.has(f) && !DAFTAR.some(m => m.file === f))
if (tidakTerdaftar.length) {
  console.error(`Berkas migrasi belum terdaftar di be/scripts/migrate.js: ${tidakTerdaftar.join(', ')}`)
  console.error('Tambahkan ke DAFTAR beserta pemeriksaan "sudah" agar urutan dan deteksinya jelas.')
  process.exit(1)
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
  charset: 'utf8mb4',
  ...sslDari(),
})
const q = async (sql, params) => (await conn.query(sql, params))[0]

if (!(await q('SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [DB])).length) {
  console.error(`Database "${DB}" belum ada. Impor database/puslatkp1a.sql dulu (npm run db:init).`)
  await conn.end()
  process.exit(1)
}

console.log(`Database ${DB} @ ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}${hanyaCek ? ' (hanya cek)' : ''}`)
if (!hanyaCek) {
  await q(`CREATE TABLE IF NOT EXISTS \`${DB}\`.schema_migrations (
    nama          VARCHAR(190) NOT NULL,
    cara          ENUM('dijalankan','terdeteksi') NOT NULL COMMENT 'dijalankan = oleh npm run migrate; terdeteksi = sudah ada sebelumnya',
    diterapkan_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (nama)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Riwayat migrasi (be/scripts/migrate.js)'`)
}
const catat = (nama, cara) => q(`INSERT IGNORE INTO \`${DB}\`.schema_migrations (nama, cara) VALUES (?, ?)`, [nama, cara])

let dijalankan = 0
let belum = 0
for (const m of DAFTAR) {
  if (await m.sudah(q)) {
    console.log(`  ✓ ${m.file}`)
    if (!hanyaCek) await catat(m.file, 'terdeteksi')
    continue
  }
  belum++
  if (hanyaCek) { console.log(`  • ${m.file}  (belum diterapkan)`); continue }
  process.stdout.write(`  → ${m.file} ... `)
  // Berkas migrasi menulis USE `Puslatkp1a`; arahkan ke DB_NAME yang dipakai (mis. database cloud bernama lain).
  const sql = readFileSync(path.join(dir, m.file), 'utf8').replace(/USE\s+`Puslatkp1a`\s*;/g, `USE \`${DB}\`;`)
  try {
    await conn.query(sql)
  } catch (e) {
    console.log('GAGAL')
    console.error(`\n${e.message}\n`)
    console.error('Migrasi berikutnya tidak dijalankan. Perbaiki penyebabnya (atau backup lalu jalankan berkas itu manual), lalu ulangi npm run migrate.')
    await conn.end()
    process.exit(1)
  }
  if (!(await m.sudah(q))) {
    console.log('GAGAL')
    console.error('\nBerkas selesai dijalankan tetapi perubahannya tidak terdeteksi. Periksa isi berkas dan DB_NAME di be/.env.')
    await conn.end()
    process.exit(1)
  }
  await catat(m.file, 'dijalankan')
  dijalankan++
  console.log('selesai')
}

await conn.end()
if (hanyaCek) console.log(belum ? `\n${belum} migrasi belum diterapkan. Jalankan: npm run migrate` : '\nSemua migrasi sudah diterapkan.')
else console.log(dijalankan ? `\n${dijalankan} migrasi diterapkan. Restart backend agar fitur baru terdeteksi.` : '\nTidak ada migrasi baru. Database sudah terbaru.')
