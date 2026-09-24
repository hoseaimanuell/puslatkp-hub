/**
 * routes/permintaan-hapus.js
 * Admin: setujui/tolak permintaan hapus dari akun UPT (lihat lib/query.js: createDeleteRequest).
 * Daftar permintaan sendiri dibaca lewat endpoint generik POST /api/db/query (table: 'permintaan_hapus'),
 * bukan di sini — hanya aksi yang benar-benar mengeksekusi penghapusan yang butuh route khusus.
 */
import { Router } from 'express'
import { pool } from '../db.js'
import { TABLES } from '../schema.js'
import { requireAdmin } from '../auth.js'
import { HttpError, buildWhere, executeSoftDelete } from '../lib/query.js'
import { logAudit } from '../lib/audit.js'

const router = Router()
router.use(requireAdmin)

async function loadPending(id) {
  const [[row]] = await pool.query('SELECT * FROM permintaan_hapus WHERE id = ?', [id])
  if (!row) throw new HttpError(404, 'Permintaan tidak ditemukan.')
  if (row.status !== 'pending') throw new HttpError(409, 'Permintaan ini sudah diproses sebelumnya.')
  return row
}

// POST /api/permintaan-hapus/:id/setujui — benar-benar menghapus (masuk Tempat Sampah seperti biasa)
router.post('/:id/setujui', async (req, res) => {
  const reqRow = await loadPending(req.params.id)
  const def = TABLES[reqRow.tabel]
  if (!def) throw new HttpError(400, 'Tabel pada permintaan ini tidak dikenal (mungkin migrasi belum lengkap).')

  const filters = typeof reqRow.filter_json === 'string' ? JSON.parse(reqRow.filter_json) : reqRow.filter_json
  const spec = { table: reqRow.tabel, filters }
  const { sql: where, params } = buildWhere(def, spec, req.user, true)
  const result = await executeSoftDelete(def, reqRow.tabel, where, params, req.user)

  await pool.query(
    'UPDATE permintaan_hapus SET status = ?, reviewed_by = ?, reviewed_by_label = ?, reviewed_at = NOW() WHERE id = ?',
    ['disetujui', req.user.id, req.user.email, req.params.id],
  )
  await logAudit(req.user, 'setujui_hapus', { tabel: reqRow.tabel, jumlah: result.count, permintaan_id: req.params.id, ringkasan: reqRow.ringkasan, upt: reqRow.upt_key })
  res.json({ success: true, dihapus: result.count })
})

// POST /api/permintaan-hapus/:id/tolak  { catatan_admin? } — data tidak disentuh
router.post('/:id/tolak', async (req, res) => {
  const reqRow = await loadPending(req.params.id)
  const catatan = req.body?.catatan_admin ? String(req.body.catatan_admin).trim().slice(0, 1000) || null : null

  await pool.query(
    'UPDATE permintaan_hapus SET status = ?, catatan_admin = ?, reviewed_by = ?, reviewed_by_label = ?, reviewed_at = NOW() WHERE id = ?',
    ['ditolak', catatan, req.user.id, req.user.email, req.params.id],
  )
  await logAudit(req.user, 'tolak_hapus', { tabel: reqRow.tabel, jumlah: reqRow.jumlah_baris, permintaan_id: req.params.id, ringkasan: reqRow.ringkasan, upt: reqRow.upt_key, catatan })
  res.json({ success: true })
})

export default router
