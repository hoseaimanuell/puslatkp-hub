import { readFileSync } from 'node:fs'

/**
 * Opsi SSL koneksi MySQL dari variabel lingkungan (dipakai server dan skrip be/scripts/*).
 *   DB_SSL=true                -> koneksi terenkripsi
 *   DB_SSL_CA=/path/ca.pem     -> sertifikat server DIVERIFIKASI dengan CA ini (disarankan; unduh dari penyedia database)
 * Tanpa DB_SSL_CA koneksi tetap terenkripsi tetapi sertifikat server tidak diperiksa (perilaku lama, agar
 * instalasi yang sudah jalan tidak putus).
 */
export function sslDari(env = process.env) {
  if (env.DB_SSL !== 'true') return {}
  if (env.DB_SSL_CA) return { ssl: { ca: readFileSync(env.DB_SSL_CA, 'utf8'), rejectUnauthorized: true } }
  return { ssl: { rejectUnauthorized: false } }
}
