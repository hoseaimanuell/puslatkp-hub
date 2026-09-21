import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import rateLimit from 'express-rate-limit'
import { pool } from '../db.js'
import { signToken, requireAuth, requireAdmin } from '../auth.js'
import { HttpError } from '../lib/query.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.' } },
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const publicProfile = ({ id, email, role, upt_key, nama_lengkap, created_at }) => ({ id, email, role, upt_key, nama_lengkap, created_at })

// POST /api/auth/login  { email, password }
router.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const [[row]] = await pool.query('SELECT * FROM profiles WHERE email = ?', [email])
  // Selalu jalankan compare agar waktu respons tidak membocorkan keberadaan email.
  const ok = await bcrypt.compare(password, row?.password_hash || '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi')
  if (!row || !ok) throw new HttpError(401, 'Invalid login credentials')
  res.json({ token: signToken(row), user: { id: row.id, email: row.email }, profile: publicProfile(row) })
})

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email }, profile: publicProfile(req.user) })
})

// POST /api/auth/users  (Admin) — membuat akun UPT baru
router.post('/users', requireAdmin, async (req, res) => {
  const { email, password, nama_lengkap, upt_key } = req.body || {}
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(cleanEmail)) throw new HttpError(400, 'Format email tidak valid')
  if (!password || String(password).length < 8) throw new HttpError(400, 'Password minimal 8 karakter')
  if (!nama_lengkap || !String(nama_lengkap).trim()) throw new HttpError(400, 'Nama lengkap wajib diisi')

  const [[upt]] = await pool.query('SELECT `key` FROM upt_list WHERE `key` = ? AND aktif = 1', [upt_key])
  if (!upt) throw new HttpError(400, `UPT '${upt_key}' tidak valid atau tidak aktif`)
  const [[dup]] = await pool.query('SELECT id FROM profiles WHERE email = ?', [cleanEmail])
  if (dup) throw new HttpError(409, 'Email sudah digunakan oleh akun lain')

  const id = randomUUID()
  const hash = await bcrypt.hash(String(password), 10)
  await pool.query(
    "INSERT INTO profiles (id, email, password_hash, role, upt_key, nama_lengkap) VALUES (?, ?, ?, 'upt', ?, ?)",
    [id, cleanEmail, hash, upt_key, String(nama_lengkap).trim()],
  )
  res.status(201).json({ success: true, user: { id, email: cleanEmail, role: 'upt', upt_key, nama_lengkap: String(nama_lengkap).trim() } })
})

export default router
