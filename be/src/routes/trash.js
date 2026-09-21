import { Router } from 'express'
import { pool } from '../db.js'
import { config } from '../config.js'
import { TABLES } from '../schema.js'
import { requireAdmin } from '../auth.js'
import { HttpError } from '../lib/query.js'
import { SOFT_TABLES, trashEnabled } from '../lib/trash.js'
import { logAudit } from '../lib/audit.js'

const router = Router()
router.use(requireAdmin)

const TABLE_LABEL = {
  rekap_nilai: 'Data Mingguan',
  data_entries: 'Data Bulanan (rincian nama)',
  dokumen_upload: 'Berkas Unggahan',
  daily_activity: 'Daily Activity',
}

const ensureEnabled = () => {
  if (!trashEnabled()) throw new HttpError(409, 'Tempat sampah belum aktif. Jalankan database/migrasi_02_tempat_sampah.sql terlebih dahulu.')
}

const marks = arr => arr.map(() => '?').join(',')

// GET /api/trash — daftar batch yang ada di tempat sampah
router.get('/', async (_req, res) => {
  if (!trashEnabled()) return res.json({ enabled: false, retentionDays: config.trashRetentionDays, items: [] })

  const items = []
  for (const t of SOFT_TABLES) {
    const ctx = TABLES[t].ctx
    const extra = ctx.filter(c => ['jenis_data_id', 'period_id', 'upt_key'].includes(c)).map(c => `MIN(t.\`${c}\`) AS \`${c}\``).join(', ')
    const dateCol = ctx.includes('tanggal') ? ', MIN(t.`tanggal`) AS tanggal' : ''
    const [rows] = await pool.query(
      `SELECT t.deleted_batch AS batch, MIN(t.deleted_at) AS deleted_at, MIN(t.deleted_by) AS deleted_by, COUNT(*) AS jumlah,
              COUNT(DISTINCT t.upt_key) AS n_upt${extra ? ', ' + extra : ''}${dateCol}
         FROM \`${t}\` AS t WHERE t.deleted_at IS NOT NULL GROUP BY t.deleted_batch`,
    )
    rows.forEach(r => items.push({ ...r, tabel: t }))
  }

  const ids = col => [...new Set(items.map(i => i[col]).filter(Boolean))]
  const pick = async (sql, list) => (list.length ? (await pool.query(sql, [list]))[0] : [])
  const [upts, jds, pers, users] = await Promise.all([
    pick('SELECT `key` AS k, label AS v FROM upt_list WHERE `key` IN (?)', ids('upt_key')),
    pick('SELECT id AS k, judul AS v FROM jenis_data WHERE id IN (?)', ids('jenis_data_id')),
    pick('SELECT id AS k, label AS v FROM periods WHERE id IN (?)', ids('period_id')),
    pick('SELECT id AS k, email AS v FROM profiles WHERE id IN (?)', ids('deleted_by')),
  ])
  const map = rows => Object.fromEntries(rows.map(r => [r.k, r.v]))
  const [mUpt, mJd, mPer, mUser] = [map(upts), map(jds), map(pers), map(users)]

  const out = items
    .map(i => {
      const ageDays = Math.floor((Date.now() - new Date(i.deleted_at).getTime()) / 86400000)
      return {
        batch: i.batch,
        tabel: i.tabel,
        tabel_label: TABLE_LABEL[i.tabel],
        jumlah: Number(i.jumlah),
        upt: i.n_upt > 1 ? `${i.n_upt} UPT` : (mUpt[i.upt_key] || i.upt_key),
        jenis_data: mJd[i.jenis_data_id] || null,
        periode: mPer[i.period_id] || (i.tanggal ? String(i.tanggal) : null),
        dihapus_oleh: mUser[i.deleted_by] || null,
        dihapus_pada: i.deleted_at,
        sisa_hari: Math.max(0, config.trashRetentionDays - ageDays),
      }
    })
    .sort((a, b) => new Date(b.dihapus_pada) - new Date(a.dihapus_pada))

  res.json({ enabled: true, retentionDays: config.trashRetentionDays, items: out })
})

// POST /api/trash/restore { batch } — pulihkan satu aksi hapus
router.post('/restore', async (req, res) => {
  ensureEnabled()
  const batch = String(req.body?.batch || '')
  if (!batch) throw new HttpError(400, 'batch wajib diisi.')
  const restored = {}
  let total = 0
  for (const t of SOFT_TABLES) {
    const [r] = await pool.query(
      `UPDATE \`${t}\` SET deleted_at = NULL, deleted_by = NULL, deleted_batch = NULL WHERE deleted_batch = ? AND deleted_at IS NOT NULL`,
      [batch],
    )
    if (r.affectedRows) { restored[t] = r.affectedRows; total += r.affectedRows }
  }
  if (!total) throw new HttpError(404, 'Data tidak ditemukan di tempat sampah (mungkin sudah dipulihkan atau dibuang permanen).')
  await logAudit(req.user, 'pulihkan', { batch, jumlah: total, tabel: restored })
  res.json({ success: true, jumlah: total })
})

// POST /api/trash/purge { batch } — buang permanen satu aksi hapus
router.post('/purge', async (req, res) => {
  ensureEnabled()
  const batch = String(req.body?.batch || '')
  if (!batch) throw new HttpError(400, 'batch wajib diisi.')
  const removed = {}
  let total = 0
  for (const t of SOFT_TABLES) {
    const [r] = await pool.query(`DELETE FROM \`${t}\` WHERE deleted_batch = ? AND deleted_at IS NOT NULL`, [batch])
    if (r.affectedRows) { removed[t] = r.affectedRows; total += r.affectedRows }
  }
  if (!total) throw new HttpError(404, 'Data tidak ditemukan di tempat sampah.')
  await logAudit(req.user, 'hapus_permanen', { batch, jumlah: total, tabel: removed })
  res.json({ success: true, jumlah: total })
})

export default router
