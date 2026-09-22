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

/**
 * Berkas yang dilampirkan pada SATU sel/kolom bertipe `file` (field_definitions.tipe = 'file'), mis. "Link
 * Laporan Pelatihan" yang diganti jadi unggah berkas. Nilai kolom itu di rekap_nilai/data_entries hanyalah
 * id baris ini (mis. `value_text` mingguan, atau `data_json[field_key]` bulanan) — isi berkas ada di disk.
 */
const router = Router()
router.use(requireAuth)

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB — cukup untuk laporan PDF/Word/Excel satu berkas
export const FIELD_FILES_DIR = path.join(config.storageDir, 'field-files')
const MIME = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

let enabled = false
export const fieldFilesEnabled = () => enabled

/** Aktif hanya bila tabel field_files sudah ada (migrasi_06). */
export async function detectFieldFiles() {
  const [t] = await pool.query("SHOW TABLES LIKE 'field_files'")
  enabled = t.length > 0
  if (enabled) await fs.mkdir(FIELD_FILES_DIR, { recursive: true })
  else console.warn('PERINGATAN: tabel field_files belum ada. Jalankan database/migrasi_06_kolom_berkas.sql agar kolom bertipe Berkas aktif.')
  return enabled
}

router.use((_req, _res, next) =>
  next(enabled ? undefined : new HttpError(409, 'Kolom bertipe Berkas belum aktif. Jalankan database/migrasi_06_kolom_berkas.sql terlebih dahulu.')))

/** Cek isi berkas (bukan hanya ekstensi) — pdf/doc/docx/xls/xlsx. */
function sniff(ext, buf) {
  const head = (...bytes) => bytes.every((b, i) => buf[i] === b)
  if (ext === 'pdf') return head(0x25, 0x50, 0x44, 0x46)
  if (ext === 'xlsx' || ext === 'docx') return head(0x50, 0x4b, 0x03, 0x04) // format zip (Office Open XML)
  if (ext === 'xls' || ext === 'doc') return head(0xd0, 0xcf, 0x11, 0xe0) // format OLE lama
  return false
}

async function findVisible(id, user) {
  const [[row]] = await pool.query('SELECT * FROM field_files WHERE id = ?', [id])
  if (!row || (user.role !== 'admin' && row.upt_key !== user.upt_key)) throw new HttpError(404, 'Berkas tidak ditemukan.')
  return row
}

// POST /api/field-files?jenis_data_id=&field_key=&upt_key=&nama=   (body = isi berkas mentah)
router.post('/', express.raw({ type: () => true, limit: MAX_BYTES }), async (req, res) => {
  const q = req.query
  const buf = req.body
  if (!Buffer.isBuffer(buf) || !buf.length) throw new HttpError(400, 'Berkas kosong.')
  const nama = String(q.nama || '').replace(/[\\/]/g, '_').slice(0, 250)
  const ext = path.extname(nama).slice(1).toLowerCase()
  if (!MIME[ext]) throw new HttpError(400, 'Format berkas tidak didukung. Gunakan PDF, Word (doc/docx), atau Excel (xls/xlsx).')
  if (!sniff(ext, buf)) throw new HttpError(400, `Isi berkas tidak sesuai dengan ekstensi .${ext}.`)

  const jenisDataId = String(q.jenis_data_id || '')
  const fieldKey = String(q.field_key || '')
  const [[field]] = await pool.query(
    "SELECT id FROM field_definitions WHERE jenis_data_id = ? AND field_key = ? AND tipe = 'file'",
    [jenisDataId, fieldKey],
  )
  if (!field) throw new HttpError(400, 'Kolom ini bukan bertipe Berkas (atau sudah diubah). Muat ulang halaman.')

  let uptKey = null
  if (req.user.role === 'admin') {
    uptKey = q.upt_key ? String(q.upt_key) : null
    if (uptKey) {
      const [[u]] = await pool.query('SELECT 1 AS ok FROM upt_list WHERE `key` = ?', [uptKey])
      if (!u) throw new HttpError(400, 'UPT tidak ditemukan.')
    }
  } else uptKey = req.user.upt_key
  if (!uptKey) throw new HttpError(400, 'upt_key wajib diisi.')

  const id = randomUUID()
  const storageKey = `${id}.${ext}`
  await fs.mkdir(FIELD_FILES_DIR, { recursive: true })
  await fs.writeFile(path.join(FIELD_FILES_DIR, storageKey), buf)
  try {
    await pool.query(
      `INSERT INTO field_files (id, upt_key, jenis_data_id, field_key, file_name, file_ext, file_size, storage_key, uploaded_by, uploaded_by_label)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, uptKey, jenisDataId, fieldKey, nama, ext, buf.length, storageKey, req.user.id, req.user.email],
    )
  } catch (e) {
    await fs.rm(path.join(FIELD_FILES_DIR, storageKey), { force: true })
    throw e
  }
  await logAudit(req.user, 'berkas_kolom_unggah', { kolom: fieldKey, upt: uptKey, berkas: nama, ukuran: buf.length })
  res.status(201).json({ data: { id, file_name: nama, file_ext: ext, file_size: buf.length } })
})

// GET /api/field-files/:id/file
router.get('/:id/file', async (req, res) => {
  const row = await findVisible(req.params.id, req.user)
  const file = path.join(FIELD_FILES_DIR, row.storage_key)
  try { await fs.access(file) } catch { throw new HttpError(404, 'Berkas fisik tidak ditemukan di server (storage).') }
  res.setHeader('Content-Type', MIME[row.file_ext] || 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(row.file_name)}`)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.sendFile(file)
})

// DELETE /api/field-files/:id — Admin: semua; UPT: miliknya (dipakai saat mengganti/menghapus isian kolom)
router.delete('/:id', async (req, res) => {
  const row = await findVisible(req.params.id, req.user)
  await pool.query('DELETE FROM field_files WHERE id = ?', [row.id])
  await fs.rm(path.join(FIELD_FILES_DIR, row.storage_key), { force: true })
  await logAudit(req.user, 'berkas_kolom_hapus', { kolom: row.field_key, upt: row.upt_key, berkas: row.file_name })
  res.json({ success: true })
})

/** Hapus berkas yatim (mis. baris rekap ikut terhapus saat UPT dihapus). Berkas < 1 jam dilewati. */
export async function sweepFieldFiles() {
  if (!enabled) return 0
  let names
  try { names = await fs.readdir(FIELD_FILES_DIR) } catch { return 0 }
  const [rows] = await pool.query('SELECT storage_key FROM field_files')
  const known = new Set(rows.map(r => r.storage_key))
  let n = 0
  for (const f of names) {
    if (known.has(f)) continue
    const p = path.join(FIELD_FILES_DIR, f)
    const st = await fs.stat(p).catch(() => null)
    if (st && Date.now() - st.mtimeMs > 3600_000) { await fs.rm(p, { force: true }); n++ }
  }
  return n
}

export default router
