/**
 * routes/permintaan-hapus.js
 * Admin: setujui/tolak permintaan hapus & permintaan edit dari akun UPT (lihat lib/query.js: createDeleteRequest,
 * routes/permintaan-edit.js: simpanPermintaanEdit). Keduanya berbagi tabel `permintaan_hapus`, dibedakan lewat
 * kolom `aksi` ('hapus' | 'edit'). Daftar permintaan sendiri dibaca lewat endpoint generik POST /api/db/query
 * (table: 'permintaan_hapus'), bukan di sini — hanya aksi yang benar-benar mengeksekusinya yang butuh route khusus.
 */
import { Router } from 'express'
import { pool } from '../db.js'
import { TABLES } from '../schema.js'
import { requireAdmin } from '../auth.js'
import { HttpError, buildWhere, executeSoftDelete, runQuery } from '../lib/query.js'
import { logAudit } from '../lib/audit.js'

const router = Router()
router.use(requireAdmin)

async function loadPending(id) {
  const [[row]] = await pool.query('SELECT * FROM permintaan_hapus WHERE id = ?', [id])
  if (!row) throw new HttpError(404, 'Permintaan tidak ditemukan.')
  if (row.status !== 'pending') throw new HttpError(409, 'Permintaan ini sudah diproses sebelumnya.')
  return row
}

/** aksi='hapus' — benar-benar menghapus (masuk Tempat Sampah seperti biasa). */
async function applyHapus(reqRow, def, filters, user) {
  const spec = { table: reqRow.tabel, filters }
  const { sql: where, params } = buildWhere(def, spec, user, true)
  return executeSoftDelete(def, reqRow.tabel, where, params, user)
}

/**
 * aksi='edit' — tulis nilai baru yang diajukan UPT (lihat routes/permintaan-edit.js). Dijalankan lewat
 * runQuery() dengan konteks Admin (req.user), supaya prepareRow() otomatis menstempel baris itu balik
 * 'disetujui' (cabang admin di be/src/lib/query.js) alih-alih harus antre Persetujuan Baris Data lagi.
 */
async function applyEdit(reqRow, filters, user) {
  const dataBaru = typeof reqRow.data_baru_json === 'string' ? JSON.parse(reqRow.data_baru_json) : reqRow.data_baru_json
  let count = 0
  if (reqRow.tabel === 'rekap_nilai') {
    const def = TABLES.rekap_nilai
    if (dataBaru.values?.length) {
      await runQuery({ table: 'rekap_nilai', op: 'upsert', values: dataBaru.values, onConflict: def.unique.join(',') }, user)
      count += dataBaru.values.length
    }
    if (dataBaru.clearedFields?.length) {
      const delSpec = { table: 'rekap_nilai', op: 'delete', liveEdit: true, filters: [...filters, { col: 'field_key', op: 'in', val: dataBaru.clearedFields }] }
      const delResult = await runQuery(delSpec, user)
      count += delResult.count || 0
    }
  } else {
    await runQuery({ table: reqRow.tabel, op: 'update', values: dataBaru.values, filters }, user)
    count = 1
  }
  return { count }
}

// POST /api/permintaan-hapus/:id/setujui — hapus (masuk Tempat Sampah) atau tulis nilai baru (edit)
router.post('/:id/setujui', async (req, res) => {
  const reqRow = await loadPending(req.params.id)
  const def = TABLES[reqRow.tabel]
  if (!def) throw new HttpError(400, 'Tabel pada permintaan ini tidak dikenal (mungkin migrasi belum lengkap).')

  const filters = typeof reqRow.filter_json === 'string' ? JSON.parse(reqRow.filter_json) : reqRow.filter_json
  const result = reqRow.aksi === 'edit' ? await applyEdit(reqRow, filters, req.user) : await applyHapus(reqRow, def, filters, req.user)

  await pool.query(
    'UPDATE permintaan_hapus SET status = ?, reviewed_by = ?, reviewed_by_label = ?, reviewed_at = NOW() WHERE id = ?',
    ['disetujui', req.user.id, req.user.email, req.params.id],
  )
  const action = reqRow.aksi === 'edit' ? 'setujui_edit' : 'setujui_hapus'
  await logAudit(req.user, action, { tabel: reqRow.tabel, jumlah: result.count, permintaan_id: req.params.id, ringkasan: reqRow.ringkasan, upt: reqRow.upt_key })
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
  const action = reqRow.aksi === 'edit' ? 'tolak_edit' : 'tolak_hapus'
  await logAudit(req.user, action, { tabel: reqRow.tabel, jumlah: reqRow.jumlah_baris, permintaan_id: req.params.id, ringkasan: reqRow.ringkasan, upt: reqRow.upt_key, catatan })
  res.json({ success: true })
})

export default router
