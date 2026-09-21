import 'dotenv/config'
import { fileURLToPath } from 'node:url'

const env = process.env

export const config = {
  port: Number(env.PORT) || 4000,
  corsOrigins: (env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean),
  jwtSecret: env.JWT_SECRET || '',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '12h',
  trashRetentionDays: Number(env.TRASH_RETENTION_DAYS) || 30, // lama data dihapus tersimpan di tempat sampah
  // Folder berkas Arsip Historis (ikut di-backup!). Default: be/storage
  storageDir: env.STORAGE_DIR || fileURLToPath(new URL('../storage', import.meta.url)),
  db: {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'Puslatkp1a',
    // Database di cloud (mis. Aiven) mewajibkan koneksi terenkripsi: set DB_SSL=true
    ...(env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  },
}

if (!config.jwtSecret || config.jwtSecret.length < 16) {
  console.error('JWT_SECRET belum diisi (minimal 16 karakter). Salin be/.env.example ke be/.env lalu isi nilainya.')
  process.exit(1)
}
