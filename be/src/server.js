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
import periodRoutes from './routes/periods.js'
import arsipRoutes, { detectArsip, arsipEnabled, sweepArsipFiles } from './routes/arsip.js'
import { ensureCurrentYears } from './lib/yearService.js'
import { detectSoftDelete, purgeExpired, trashEnabled } from './lib/trash.js'
import { detectOptionalColumns, detectOptionalTables, features } from './lib/compat.js'

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
  res.json({ status: 'ok', database: config.db.database, trash: trashEnabled(), features: { ...features, arsip: arsipEnabled() } })
})
app.use('/api/auth', authRoutes)
app.use('/api/db', dbRoutes)
app.use('/api/trash', trashRoutes)
app.use('/api/periods', periodRoutes)
app.use('/api/arsip', arsipRoutes)

app.use((_req, _res, next) => next(new HttpError(404, 'Endpoint tidak ditemukan.')))
app.use((err, _req, res, _next) => {
  const e = err.type === 'entity.too.large' ? new HttpError(413, 'Ukuran data terlalu besar.') : friendlyError(err)
  res.status(e.status).json({ error: { message: e.message } })
})

await detectSoftDelete()
await detectOptionalColumns()
await detectOptionalTables()
await detectArsip()
const purge = () => purgeExpired().catch(e => console.error('Gagal membuang tempat sampah kedaluwarsa:', e.message))
const sweep = () => sweepArsipFiles().catch(e => console.error('Gagal menyapu berkas arsip yatim:', e.message))
sweep()
setInterval(sweep, 6 * 60 * 60 * 1000).unref()
purge()
setInterval(purge, 6 * 60 * 60 * 1000).unref() // bersihkan tempat sampah kedaluwarsa tiap 6 jam

// Periode tahun berjalan & tahun depan selalu tersedia (tanpa perintah manual saat pergantian tahun)
const ensurePeriods = () => ensureCurrentYears().catch(e => console.error('Gagal membuat periode otomatis:', e.message))
await ensurePeriods()
setInterval(ensurePeriods, 12 * 60 * 60 * 1000).unref()

app.listen(config.port, () => {
  console.log(`PUSLATKP BE berjalan di http://localhost:${config.port} (database: ${config.db.database}, tempat sampah: ${trashEnabled() ? 'aktif' : 'NONAKTIF'})`)
})
