import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from './config.js'
import { pool } from './db.js'
import { attachUser } from './auth.js'
import { friendlyError, HttpError } from './lib/query.js'
import authRoutes from './routes/auth.js'
import dbRoutes from './routes/db.js'
import trashRoutes from './routes/trash.js'
import permintaanHapusRoutes from './routes/permintaan-hapus.js'
import permintaanEditRoutes from './routes/permintaan-edit.js'
import persetujuanBarisRoutes from './routes/persetujuan-baris.js'
import periodRoutes from './routes/periods.js'
import arsipRoutes, { detectArsip, arsipEnabled, sweepArsipFiles } from './routes/arsip.js'
import fieldFilesRoutes, { detectFieldFiles, fieldFilesEnabled, sweepFieldFiles } from './routes/fieldFiles.js'
import { ensureCurrentYears } from './lib/yearService.js'
import { detectSoftDelete, purgeExpired, trashEnabled } from './lib/trash.js'
import { detectOptionalColumns, detectOptionalTables, detectRowApproval, detectRejectBaris, detectEditRequest, features } from './lib/compat.js'

const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 'loopback') // di belakang proxy fe/tunnel: IP asli pengunjung dibaca dari X-Forwarded-For (untuk batas percobaan login)
app.use(helmet())
app.use(cors({ origin: config.corsOrigins, allowedHeaders: ['Content-Type', 'Authorization'] }))
app.use(attachUser)
// Batas body: akun login boleh besar (unggah berkas base64 hingga 15 MB); pengunjung anonim hanya 100 KB
const jsonLoggedIn = express.json({ limit: '25mb' })
const jsonAnonymous = express.json({ limit: '100kb' })
app.use((req, res, next) => (req.user ? jsonLoggedIn : jsonAnonymous)(req, res, next))

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1')
  res.json({ status: 'ok', database: config.db.database, trash: trashEnabled(), features: { ...features, arsip: arsipEnabled(), fieldFiles: fieldFilesEnabled() } })
})
app.use('/api/auth', authRoutes)
app.use('/api/db', dbRoutes)
app.use('/api/trash', trashRoutes)
app.use('/api/permintaan-hapus', permintaanHapusRoutes)
app.use('/api/permintaan-edit', permintaanEditRoutes)
app.use('/api/persetujuan-baris', persetujuanBarisRoutes)
app.use('/api/periods', periodRoutes)
app.use('/api/arsip', arsipRoutes)
app.use('/api/field-files', fieldFilesRoutes)

app.use((_req, _res, next) => next(new HttpError(404, 'Endpoint tidak ditemukan.')))
app.use((err, req, res, _next) => {
  const e = err.type === 'entity.too.large' ? new HttpError(413, 'Ukuran data terlalu besar.') : friendlyError(err)
  // Kesalahan tak terduga: catat kapan, endpoint apa, dan akun siapa agar bisa dilacak dari log server
  if (e.status >= 500) console.error(`[${new Date().toISOString()}] ${e.status} ${req.method} ${req.originalUrl} user=${req.user?.id || '-'}`)
  res.status(e.status).json({ error: { message: e.message } })
})

await detectSoftDelete()
await detectOptionalColumns()
await detectOptionalTables()
await detectRowApproval()
await detectRejectBaris()
await detectEditRequest()
await detectArsip()
await detectFieldFiles()
const purge = () => purgeExpired().catch(e => console.error('Gagal membuang tempat sampah kedaluwarsa:', e.message))
const sweep = () => sweepArsipFiles().catch(e => console.error('Gagal menyapu berkas arsip yatim:', e.message))
const sweepFF = () => sweepFieldFiles().catch(e => console.error('Gagal menyapu berkas kolom yatim:', e.message))
sweep()
sweepFF()
setInterval(sweep, 6 * 60 * 60 * 1000).unref()
setInterval(sweepFF, 6 * 60 * 60 * 1000).unref()
purge()
setInterval(purge, 6 * 60 * 60 * 1000).unref() // bersihkan tempat sampah kedaluwarsa tiap 6 jam

// Periode tahun berjalan & tahun depan selalu tersedia (tanpa perintah manual saat pergantian tahun)
const ensurePeriods = () => ensureCurrentYears().catch(e => console.error('Gagal membuat periode otomatis:', e.message))
await ensurePeriods()
setInterval(ensurePeriods, 12 * 60 * 60 * 1000).unref()

const server = app.listen(config.port, () => {
  console.log(`PUSLATKP BE berjalan di http://localhost:${config.port} (database: ${config.db.database}, tempat sampah: ${trashEnabled() ? 'aktif' : 'NONAKTIF'})`)
})

// Berhenti dengan rapi (docker stop / PM2 / Ctrl+C): selesaikan permintaan yang sedang berjalan, tutup koneksi DB.
let berhenti = false
for (const sinyal of ['SIGTERM', 'SIGINT']) {
  process.on(sinyal, () => {
    if (berhenti) return
    berhenti = true
    console.log(`${sinyal} diterima, menghentikan server ...`)
    setTimeout(() => process.exit(1), 10_000).unref() // jangan menggantung bila ada koneksi yang tidak mau selesai
    server.close(() => pool.end().finally(() => process.exit(0)))
  })
}
