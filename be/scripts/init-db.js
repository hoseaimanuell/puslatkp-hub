/**
 * Impor skema + data master ke MySQL tanpa phpMyAdmin.
 *   npm run db:init            -> skema + master + akun awal
 *   npm run db:init:sample     -> ditambah data contoh
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import 'dotenv/config'

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../database')
const files = ['puslatkp1a.sql', ...(process.argv.includes('--sample') ? ['puslatkp1a_contoh_data.sql'] : [])]

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
  charset: 'utf8mb4',
  ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
})

for (const f of files) {
  process.stdout.write(`Mengimpor ${f} ... `)
  await conn.query(readFileSync(path.join(dir, f), 'utf8'))
  console.log('selesai')
}
await conn.end()
