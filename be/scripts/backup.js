/**
 * Backup lengkap: database (mysqldump, dikompres .gz) + folder berkas (be/storage / STORAGE_DIR).
 *   npm run backup
 * Hasil: <BACKUP_DIR>/<tanggal_jam>/database.sql.gz dan <BACKUP_DIR>/<tanggal_jam>/storage/
 * Backup yang lebih lama dari BACKUP_KEEP_DAYS hari (bawaan 14) dihapus otomatis.
 * Jadwalkan harian: Windows Task Scheduler / cron (lihat docs/07-pemeliharaan.md#backup-otomatis).
 *
 * Variabel be/.env (opsional):
 *   BACKUP_DIR       folder tujuan (bawaan: <repo>/backup — sebaiknya disalin juga ke luar server)
 *   BACKUP_KEEP_DAYS lama backup disimpan (hari)
 *   MYSQLDUMP_PATH   lokasi mysqldump bila tidak ada di PATH (di Laragon terdeteksi otomatis)
 */
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, cpSync, statSync } from 'node:fs'
import { createGzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'

const here = path.dirname(fileURLToPath(import.meta.url))
const env = process.env
const DB = env.DB_NAME || 'Puslatkp1a'
const backupDir = path.resolve(env.BACKUP_DIR || path.join(here, '../../backup'))
const keepDays = Number(env.BACKUP_KEEP_DAYS) || 14
const storageDir = env.STORAGE_DIR || path.join(here, '../storage')

function cariMysqldump() {
  if (env.MYSQLDUMP_PATH) return env.MYSQLDUMP_PATH
  const laragon = 'C:\\laragon\\bin\\mysql'
  if (process.platform === 'win32' && existsSync(laragon)) {
    for (const v of readdirSync(laragon).sort().reverse()) {
      const exe = path.join(laragon, v, 'bin', 'mysqldump.exe')
      if (existsSync(exe)) return exe
    }
  }
  return 'mysqldump'
}

const pad = n => String(n).padStart(2, '0')
const now = new Date()
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
const target = path.join(backupDir, stamp)
mkdirSync(target, { recursive: true })

// 1. Database
const dumpPath = path.join(target, 'database.sql.gz')
process.stdout.write(`Backup database ${DB} ... `)
const dump = spawn(cariMysqldump(), [
  '-h', env.DB_HOST || '127.0.0.1',
  '-P', String(Number(env.DB_PORT) || 3306),
  '-u', env.DB_USER || 'root',
  '--single-transaction', '--no-tablespaces', '--default-character-set=utf8mb4', // tanpa hak PROCESS, cocok untuk user MySQL khusus aplikasi
  '--databases', DB,
], { env: { ...env, MYSQL_PWD: env.DB_PASSWORD || '' } }) // password lewat env, tidak terlihat di daftar proses
let stderr = ''
dump.stderr.on('data', d => { stderr += d })
const selesai = new Promise((resolve, reject) => {
  dump.on('error', reject)
  dump.on('close', code => (code === 0 ? resolve() : reject(new Error(stderr.trim() || `mysqldump keluar dengan kode ${code}`))))
})
try {
  await Promise.all([pipeline(dump.stdout, createGzip(), createWriteStream(dumpPath)), selesai])
} catch (e) {
  console.log('GAGAL')
  console.error(e.code === 'ENOENT' ? 'mysqldump tidak ditemukan. Isi MYSQLDUMP_PATH di be/.env.' : e.message)
  rmSync(target, { recursive: true, force: true })
  process.exit(1)
}
console.log(`selesai (${(statSync(dumpPath).size / 1024).toFixed(0)} KB)`)

// 2. Berkas (Arsip Historis & kolom Berkas) — tanpa ini, data di database menunjuk ke berkas yang hilang
if (existsSync(storageDir)) {
  process.stdout.write('Backup folder berkas ... ')
  cpSync(storageDir, path.join(target, 'storage'), { recursive: true })
  console.log('selesai')
} else {
  console.log(`Folder berkas ${storageDir} belum ada — dilewati.`)
}

// 3. Buang backup lama
const batas = Date.now() - keepDays * 24 * 60 * 60 * 1000
for (const nama of readdirSync(backupDir)) {
  const p = path.join(backupDir, nama)
  if (/^\d{4}-\d{2}-\d{2}_\d{6}$/.test(nama) && nama !== stamp && statSync(p).mtimeMs < batas) {
    rmSync(p, { recursive: true, force: true })
    console.log(`Backup lama dihapus: ${nama}`)
  }
}
console.log(`\nBackup tersimpan di ${target}`)
