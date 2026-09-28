/**
 * routes/persetujuan-baris.js
 * Admin: setujui/tolak baris data yang disimpan UPT ('draft' -> 'disetujui'/'ditolak'), lapisan KEDUA yang
 * terpisah dari & berjalan berdampingan dengan periode-kirim.js (Kirim Data per periode). Di sini
 * granularitasnya per baris — rekap_nilai per (jenis_data_id, upt_key, period_id, baris_ke), data_entries/
 * dokumen_upload per id. Tolak TIDAK menghapus/mengubah isi baris — hanya menandainya 'ditolak' + catatan
 * alasan (migrasi_14), terlihat UPT sebagai peringatan. UPT tetap bebas mengedit/menghapus baris 'draft' atau
 * 'ditolak' kapan saja tanpa perlu izin; menyimpan ulang otomatis mengembalikan status ke 'draft' (lihat
 * forceOnWrite di be/src/schema.js) dan mengosongkan catatan lama.
 */
import { Router } from 'express'
import { pool } from '../db.js'
import { requireAdmin } from '../auth.js'
import { HttpError } from '../lib/query.js'
import { logAudit } from '../lib/audit.js'
import { features } from '../lib/compat.js'

const router = Router()
router.use(requireAdmin)

function requireTolakEnabled(_req, _res, next) {
  if (!features.tolakBaris) throw new HttpError(409, 'Fitur Tolak belum aktif. Jalankan database/migrasi_14_tolak_baris.sql lalu restart backend.')
  next()
}

async function labelUpt(uptKey) {
  const [[row]] = await pool.query('SELECT label FROM upt_list WHERE `key` = ?', [uptKey])
  return row?.label || uptKey
}
async function labelPeriod(periodId) {
  const [[row]] = await pool.query('SELECT label FROM periods WHERE id = ?', [periodId])
  return row?.label || periodId
}
async function labelJenisData(jenisDataId) {
  const [[row]] = await pool.query('SELECT judul FROM jenis_data WHERE id = ?', [jenisDataId])
  return row?.judul || jenisDataId
}

// POST /api/persetujuan-baris/rekap-nilai/setujui — satu "baris" (satu baris_ke, semua field-nya sekaligus)
router.post('/rekap-nilai/setujui', async (req, res) => {
  const { jenis_data_id, upt_key, period_id, baris_ke } = req.body || {}
  if (!jenis_data_id || !upt_key || !period_id || baris_ke === undefined || baris_ke === null) {
    throw new HttpError(400, 'jenis_data_id, upt_key, period_id, dan baris_ke wajib diisi.')
  }
  const [res1] = await pool.query(
    `UPDATE rekap_nilai SET status = 'disetujui', disetujui_at = NOW(), disetujui_by = ?, disetujui_by_label = ?
     WHERE jenis_data_id = ? AND upt_key = ? AND period_id = ? AND baris_ke = ? AND status = 'draft' AND deleted_at IS NULL`,
    [req.user.id, req.user.email, jenis_data_id, upt_key, period_id, baris_ke],
  )
  if (!res1.affectedRows) throw new HttpError(404, 'Baris ini tidak ditemukan atau sudah diproses sebelumnya.')
  const [jd, upt, period] = await Promise.all([labelJenisData(jenis_data_id), labelUpt(upt_key), labelPeriod(period_id)])
  await logAudit(req.user, 'setujui_baris', { tabel: 'rekap_nilai', jenis_data: jd, upt, periode: period, baris_ke, jumlah: res1.affectedRows })
  res.json({ success: true, jumlah: res1.affectedRows })
})

// POST /api/persetujuan-baris/rekap-nilai/tolak — tandai 'ditolak' + catatan, baris TIDAK dihapus/diubah isinya
router.post('/rekap-nilai/tolak', requireTolakEnabled, async (req, res) => {
  const { jenis_data_id, upt_key, period_id, baris_ke, catatan_admin } = req.body || {}
  if (!jenis_data_id || !upt_key || !period_id || baris_ke === undefined || baris_ke === null) {
    throw new HttpError(400, 'jenis_data_id, upt_key, period_id, dan baris_ke wajib diisi.')
  }
  const catatan = catatan_admin ? String(catatan_admin).trim().slice(0, 500) || null : null
  const [res1] = await pool.query(
    `UPDATE rekap_nilai SET status = 'ditolak', catatan_admin = ?
     WHERE jenis_data_id = ? AND upt_key = ? AND period_id = ? AND baris_ke = ? AND status = 'draft' AND deleted_at IS NULL`,
    [catatan, jenis_data_id, upt_key, period_id, baris_ke],
  )
  if (!res1.affectedRows) throw new HttpError(404, 'Baris ini tidak ditemukan atau sudah diproses sebelumnya.')
  const [jd, upt, period] = await Promise.all([labelJenisData(jenis_data_id), labelUpt(upt_key), labelPeriod(period_id)])
  await logAudit(req.user, 'tolak_baris', { tabel: 'rekap_nilai', jenis_data: jd, upt, periode: period, baris_ke, catatan })
  res.json({ success: true, jumlah: res1.affectedRows })
})

// POST /api/persetujuan-baris/rekap-nilai/setujui-massal — sekaligus banyak baris_ke (kepraktisan Admin)
router.post('/rekap-nilai/setujui-massal', async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : []
  if (!items.length) throw new HttpError(400, 'Tidak ada baris yang dipilih.')
  let total = 0
  for (const it of items) {
    if (!it?.jenis_data_id || !it?.upt_key || !it?.period_id || it.baris_ke === undefined || it.baris_ke === null) continue
    const [r] = await pool.query(
      `UPDATE rekap_nilai SET status = 'disetujui', disetujui_at = NOW(), disetujui_by = ?, disetujui_by_label = ?
       WHERE jenis_data_id = ? AND upt_key = ? AND period_id = ? AND baris_ke = ? AND status = 'draft' AND deleted_at IS NULL`,
      [req.user.id, req.user.email, it.jenis_data_id, it.upt_key, it.period_id, it.baris_ke],
    )
    total += r.affectedRows
  }
  await logAudit(req.user, 'setujui_baris_massal', { tabel: 'rekap_nilai', jumlah_diajukan: items.length, jumlah_disetujui: total })
  res.json({ success: true, jumlah: total })
})

// POST /api/persetujuan-baris/data-entries/setujui — satu baris (satu orang/nik)
router.post('/data-entries/setujui', async (req, res) => {
  const { id } = req.body || {}
  if (!id) throw new HttpError(400, 'id wajib diisi.')
  const [[row]] = await pool.query('SELECT jenis_data_id, upt_key, period_id, nama FROM data_entries WHERE id = ? AND deleted_at IS NULL', [id])
  if (!row) throw new HttpError(404, 'Data tidak ditemukan (mungkin sudah dihapus).')
  const [res1] = await pool.query(
    `UPDATE data_entries SET status = 'disetujui', disetujui_at = NOW(), disetujui_by = ?, disetujui_by_label = ?
     WHERE id = ? AND status = 'draft'`,
    [req.user.id, req.user.email, id],
  )
  if (!res1.affectedRows) throw new HttpError(409, 'Data ini sudah diproses sebelumnya.')
  const [jd, upt, period] = await Promise.all([labelJenisData(row.jenis_data_id), labelUpt(row.upt_key), labelPeriod(row.period_id)])
  await logAudit(req.user, 'setujui_baris', { tabel: 'data_entries', jenis_data: jd, upt, periode: period, nama: row.nama })
  res.json({ success: true })
})

// POST /api/persetujuan-baris/data-entries/tolak
router.post('/data-entries/tolak', requireTolakEnabled, async (req, res) => {
  const { id, catatan_admin } = req.body || {}
  if (!id) throw new HttpError(400, 'id wajib diisi.')
  const [[row]] = await pool.query('SELECT jenis_data_id, upt_key, period_id, nama FROM data_entries WHERE id = ? AND deleted_at IS NULL', [id])
  if (!row) throw new HttpError(404, 'Data tidak ditemukan (mungkin sudah dihapus).')
  const catatan = catatan_admin ? String(catatan_admin).trim().slice(0, 500) || null : null
  const [res1] = await pool.query(
    `UPDATE data_entries SET status = 'ditolak', catatan_admin = ? WHERE id = ? AND status = 'draft'`,
    [catatan, id],
  )
  if (!res1.affectedRows) throw new HttpError(409, 'Data ini sudah diproses sebelumnya.')
  const [jd, upt, period] = await Promise.all([labelJenisData(row.jenis_data_id), labelUpt(row.upt_key), labelPeriod(row.period_id)])
  await logAudit(req.user, 'tolak_baris', { tabel: 'data_entries', jenis_data: jd, upt, periode: period, nama: row.nama, catatan })
  res.json({ success: true })
})

// POST /api/persetujuan-baris/dokumen-upload/setujui — satu berkas
router.post('/dokumen-upload/setujui', async (req, res) => {
  const { id } = req.body || {}
  if (!id) throw new HttpError(400, 'id wajib diisi.')
  const [[row]] = await pool.query('SELECT jenis_data_id, upt_key, period_id, judul FROM dokumen_upload WHERE id = ? AND deleted_at IS NULL', [id])
  if (!row) throw new HttpError(404, 'Berkas tidak ditemukan (mungkin sudah dihapus).')
  const [res1] = await pool.query(
    `UPDATE dokumen_upload SET status = 'disetujui', disetujui_at = NOW(), disetujui_by = ?, disetujui_by_label = ?
     WHERE id = ? AND status = 'draft'`,
    [req.user.id, req.user.email, id],
  )
  if (!res1.affectedRows) throw new HttpError(409, 'Berkas ini sudah diproses sebelumnya.')
  const [jd, upt, period] = await Promise.all([labelJenisData(row.jenis_data_id), labelUpt(row.upt_key), labelPeriod(row.period_id)])
  await logAudit(req.user, 'setujui_baris', { tabel: 'dokumen_upload', jenis_data: jd, upt, periode: period, judul: row.judul })
  res.json({ success: true })
})

// POST /api/persetujuan-baris/dokumen-upload/tolak
router.post('/dokumen-upload/tolak', requireTolakEnabled, async (req, res) => {
  const { id, catatan_admin } = req.body || {}
  if (!id) throw new HttpError(400, 'id wajib diisi.')
  const [[row]] = await pool.query('SELECT jenis_data_id, upt_key, period_id, judul FROM dokumen_upload WHERE id = ? AND deleted_at IS NULL', [id])
  if (!row) throw new HttpError(404, 'Berkas tidak ditemukan (mungkin sudah dihapus).')
  const catatan = catatan_admin ? String(catatan_admin).trim().slice(0, 500) || null : null
  const [res1] = await pool.query(
    `UPDATE dokumen_upload SET status = 'ditolak', catatan_admin = ? WHERE id = ? AND status = 'draft'`,
    [catatan, id],
  )
  if (!res1.affectedRows) throw new HttpError(409, 'Berkas ini sudah diproses sebelumnya.')
  const [jd, upt, period] = await Promise.all([labelJenisData(row.jenis_data_id), labelUpt(row.upt_key), labelPeriod(row.period_id)])
  await logAudit(req.user, 'tolak_baris', { tabel: 'dokumen_upload', jenis_data: jd, upt, periode: period, judul: row.judul, catatan })
  res.json({ success: true })
})

export default router
