import { Router } from 'express'
import express from 'express'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pool } from '../db.js'
import { config } from '../config.js'
import { requireAuth } from '../auth.js'
import { HttpError } from '../lib/query.js'
import { logAudit } from '../lib/audit.js'

const router = Router()
router.use(requireAuth)

const MAX_BYTES = 30 * 1024 * 1024
export const ARSIP_DIR = path.join(config.storageDir, 'arsip')
const MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv; charset=utf-8',
}

let enabled = false
export const arsipEnabled = () => enabled

/** Arsip aktif hanya bila tabel arsip_historis sudah ada (migrasi_04). */
export async function detectArsip() {
  const [t] = await pool.query("SHOW TABLES LIKE 'arsip_historis'")
  enabled = t.length > 0
  if (enabled) await fs.mkdir(ARSIP_DIR, { recursive: true })
  else console.warn('PERINGATAN: tabel arsip_historis belum ada. Jalankan database/migrasi_04_terlambat_dan_arsip.sql agar Arsip Historis aktif.')
  return enabled
}

router.use((_req, _res, next) =>
  next(enabled ? undefined : new HttpError(409, 'Arsip Historis belum aktif. Jalankan database/migrasi_04_terlambat_dan_arsip.sql terlebih dahulu.')))

/** Cek isi berkas (bukan hanya ekstensi). */
function sniff(ext, buf) {
  const head = (...bytes) => bytes.every((b, i) => buf[i] === b)
  if (ext === 'pdf') return head(0x25, 0x50, 0x44, 0x46)
  if (ext === 'xlsx') return head(0x50, 0x4b, 0x03, 0x04)
  if (ext === 'xls') return head(0xd0, 0xcf, 0x11, 0xe0)
  if (ext === 'csv') return !buf.subarray(0, 4096).includes(0)
  return false
}

const COLS = 'a.id, a.upt_key, a.tahun, a.jenis_data_id, a.judul, a.catatan, a.file_name, a.file_ext, a.file_size, a.uploaded_by_label, a.created_at'

async function findVisible(id, user) {
  const [[row]] = await pool.query('SELECT * FROM arsip_historis WHERE id = ?', [id])
  if (!row || (user.role !== 'admin' && row.upt_key !== user.upt_key)) throw new HttpError(404, 'Arsip tidak ditemukan.')
  return row
}

// GET /api/arsip?tahun=&upt_key=&jenis_data_id=
router.get('/', async (req, res) => {
  const where = []
  const params = []
  if (req.user.role !== 'admin') { where.push('a.upt_key = ?'); params.push(req.user.upt_key) }
  else if (req.query.upt_key === '_pusat') where.push('a.upt_key IS NULL')
  else if (req.query.upt_key) { where.push('a.upt_key = ?'); params.push(String(req.query.upt_key)) }
  if (req.query.tahun) { where.push('a.tahun = ?'); params.push(Number(req.query.tahun)) }
  if (req.query.jenis_data_id) { where.push('a.jenis_data_id = ?'); params.push(String(req.query.jenis_data_id)) }
  const [rows] = await pool.query(
    `SELECT ${COLS}, u.label AS upt_label, j.judul AS jenis_data_judul
       FROM arsip_historis a LEFT JOIN upt_list u ON u.\`key\` = a.upt_key LEFT JOIN jenis_data j ON j.id = a.jenis_data_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.tahun DESC, a.created_at DESC LIMIT 1000`,
    params,
  )
  res.json({ data: rows.map(r => ({ ...r, file_size: Number(r.file_size) })) })
})

// POST /api/arsip?tahun=&upt_key=&jenis_data_id=&judul=&catatan=&nama=   (body = isi berkas mentah)
router.post('/', express.raw({ type: () => true, limit: MAX_BYTES }), async (req, res) => {
  const q = req.query
  const buf = req.body
  if (!Buffer.isBuffer(buf) || !buf.length) throw new HttpError(400, 'Berkas kosong.')
  const nama = String(q.nama || '').replace(/[\\/]/g, '_').slice(0, 250)
  const ext = path.extname(nama).slice(1).toLowerCase()
  if (!MIME[ext]) throw new HttpError(400, 'Format berkas tidak didukung. Gunakan PDF, XLSX, XLS, atau CSV.')
  if (!sniff(ext, buf)) throw new HttpError(400, `Isi berkas tidak sesuai dengan ekstensi .${ext}.`)
  const tahun = Number(q.tahun)
  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) throw new HttpError(400, 'Tahun tidak valid.')

  let uptKey = null
  if (req.user.role === 'admin') {
    uptKey = q.upt_key && q.upt_key !== '_pusat' ? String(q.upt_key) : null
    if (uptKey) {
      const [[u]] = await pool.query('SELECT 1 AS ok FROM upt_list WHERE `key` = ?', [uptKey])
      if (!u) throw new HttpError(400, 'UPT tidak ditemukan.')
    }
  } else uptKey = req.user.upt_key

  let jd = q.jenis_data_id ? String(q.jenis_data_id) : null
  if (jd) {
    const [[j]] = await pool.query('SELECT 1 AS ok FROM jenis_data WHERE id = ?', [jd])
    if (!j) jd = null
  }
  const id = randomUUID()
  const storageKey = `${id}.${ext}`
  const judul = String(q.judul || '').trim().slice(0, 255) || nama
  await fs.mkdir(ARSIP_DIR, { recursive: true })
  await fs.writeFile(path.join(ARSIP_DIR, storageKey), buf)
  try {
    await pool.query(
      `INSERT INTO arsip_historis (id, upt_key, tahun, jenis_data_id, judul, catatan, file_name, file_ext, file_size, storage_key, uploaded_by, uploaded_by_label)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, uptKey, tahun, jd, judul, String(q.catatan || '').slice(0, 2000) || null, nama, ext, buf.length, storageKey, req.user.id, req.user.email],
    )
  } catch (e) {
    await fs.rm(path.join(ARSIP_DIR, storageKey), { force: true })
    throw e
  }
  await logAudit(req.user, 'arsip_unggah', { judul, tahun, upt: uptKey || 'pusat', berkas: nama, ukuran: buf.length })
  res.status(201).json({ data: { id } })
})

// GET /api/arsip/:id/file
router.get('/:id/file', async (req, res) => {
  const row = await findVisible(req.params.id, req.user)
  const file = path.join(ARSIP_DIR, row.storage_key)
  try { await fs.access(file) } catch { throw new HttpError(404, 'Berkas fisik tidak ditemukan di server (storage).') }
  res.setHeader('Content-Type', MIME[row.file_ext] || 'application/octet-stream')
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(row.file_name)}`)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.sendFile(file)
})

// DELETE /api/arsip/:id  — Admin: semua; UPT: milik sendiri
router.delete('/:id', async (req, res) => {
  const row = await findVisible(req.params.id, req.user)
  await pool.query('DELETE FROM arsip_historis WHERE id = ?', [row.id])
  await fs.rm(path.join(ARSIP_DIR, row.storage_key), { force: true })
  await logAudit(req.user, 'arsip_hapus', { judul: row.judul, tahun: row.tahun, upt: row.upt_key || 'pusat', berkas: row.file_name })
  res.json({ success: true })
})

/** Hapus berkas yatim (mis. arsip ikut terhapus saat UPT dihapus). Berkas < 1 jam dilewati (sedang diunggah). */
export async function sweepArsipFiles() {
  if (!enabled) return 0
  let names
  try { names = await fs.readdir(ARSIP_DIR) } catch { return 0 }
  const [rows] = await pool.query('SELECT storage_key FROM arsip_historis')
  const known = new Set(rows.map(r => r.storage_key))
  let n = 0
  for (const f of names) {
    if (known.has(f)) continue
    const p = path.join(ARSIP_DIR, f)
    const st = await fs.stat(p).catch(() => null)
    if (st && Date.now() - st.mtimeMs > 3600_000) { await fs.rm(p, { force: true }); n++ }
  }
  return n
}

export default router
