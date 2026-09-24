/**
 * routes/periode-kirim.js
 * Admin: setujui data yang UPT kirim (status 'draft' -> 'disetujui'). Baru setelah disetujui, periode itu
 * terkunci bagi UPT — lihat be/src/lib/query.js (approvalGate) dan fe/src/views/InputData/PeriodeTabs.jsx.
 * Menolak/membatalkan draft tidak perlu route khusus: UPT sendiri bisa menghapusnya bebas (delete() biasa,
 * lolos dari approvalGate karena statusnya masih 'draft', bukan 'disetujui').
 */
import { Router } from 'express'
import { pool } from '../db.js'
import { requireAdmin } from '../auth.js'
import { HttpError } from '../lib/query.js'
import { logAudit } from '../lib/audit.js'

const router = Router()
router.use(requireAdmin)

// POST /api/periode-kirim/:id/setujui — kunci periode ini (semua jenis data periode itu jadi read-only bagi UPT)
router.post('/:id/setujui', async (req, res) => {
  const [[row]] = await pool.query('SELECT * FROM periode_kirim WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  if (!row) throw new HttpError(404, 'Data tidak ditemukan (mungkin sudah dibatalkan UPT).')
  if (row.status !== 'draft') throw new HttpError(409, 'Data ini sudah diproses sebelumnya.')

  await pool.query(
    'UPDATE periode_kirim SET status = ?, disetujui_at = NOW(), disetujui_by = ?, disetujui_by_label = ? WHERE id = ?',
    ['disetujui', req.user.id, req.user.email, req.params.id],
  )
  const [[upt]] = await pool.query('SELECT label FROM upt_list WHERE `key` = ?', [row.upt_key])
  const [[period]] = await pool.query('SELECT label FROM periods WHERE id = ?', [row.period_id])
  await logAudit(req.user, 'setujui_data', { upt: upt?.label || row.upt_key, periode: period?.label || row.period_id, permintaan_id: req.params.id })
  res.json({ success: true })
})

export default router
