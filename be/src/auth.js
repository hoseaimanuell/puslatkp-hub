import jwt from 'jsonwebtoken'
import { config } from './config.js'
import { pool } from './db.js'
import { HttpError } from './lib/query.js'

export function signToken(profile) {
  return jwt.sign({ sub: profile.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn })
}

/** Baca header Authorization; req.user diisi jika token valid & akun masih ada di database. */
export async function attachUser(req, _res, next) {
  try {
    const header = req.headers.authorization || ''
    if (header.startsWith('Bearer ')) {
      let payload
      try { payload = jwt.verify(header.slice(7), config.jwtSecret) } catch { /* token tidak valid -> anonim */ }
      if (payload?.sub) {
        const [[row]] = await pool.query('SELECT id, email, role, upt_key, nama_lengkap, created_at FROM profiles WHERE id = ?', [payload.sub])
        if (row) req.user = row
      }
    }
    next()
  } catch (e) {
    next(e)
  }
}

export function requireAuth(req, _res, next) {
  next(req.user ? undefined : new HttpError(401, 'Silakan login terlebih dahulu.'))
}

export function requireAdmin(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Silakan login terlebih dahulu.'))
  next(req.user.role === 'admin' ? undefined : new HttpError(403, 'Hanya Admin yang boleh melakukan aksi ini.'))
}
