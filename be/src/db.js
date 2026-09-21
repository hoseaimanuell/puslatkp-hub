import mysql from 'mysql2/promise'
import { config } from './config.js'

// DATE -> 'YYYY-MM-DD', DATETIME/TIMESTAMP -> ISO 8601 UTC (sesi MySQL dipaksa UTC).
function typeCast(field, next) {
  if (field.type === 'DATE') return field.string()
  if (field.type === 'DATETIME' || field.type === 'TIMESTAMP') {
    const s = field.string()
    return s ? new Date(s.replace(' ', 'T') + 'Z').toISOString() : null
  }
  return next()
}

export const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  decimalNumbers: true,
  timezone: 'Z',
  typeCast,
})

pool.pool.on('connection', conn => conn.query("SET time_zone = '+00:00'"))

/** Tanggal hari ini (zona Asia/Jakarta) format YYYY-MM-DD, dipakai untuk kunci deadline periode. */
export function todayJakarta() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}
