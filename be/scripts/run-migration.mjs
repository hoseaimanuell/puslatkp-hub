/**
 * Jalankan satu berkas migrasi database/*.sql memakai kredensial di be/.env (tanpa menampilkan password).
 *   node scripts/run-migration.mjs migrasi_06_kolom_berkas.sql
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import 'dotenv/config'

const file = process.argv[2]
if (!file) { console.error('Pemakaian: node scripts/run-migration.mjs <nama-berkas-migrasi.sql>'); process.exit(1) }
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../database')
const sql = readFileSync(path.join(dir, file), 'utf8')

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
  charset: 'utf8mb4',
})
console.log(`Menjalankan ${file} pada database ${process.env.DB_NAME || 'Puslatkp1a'} @ ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306} ...`)
await conn.query(sql)
console.log('Selesai.')
await conn.end()
