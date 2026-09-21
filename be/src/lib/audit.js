import { randomUUID } from 'node:crypto'
import { pool } from '../db.js'

/** Catat aksi ke audit_log. Kegagalan mencatat tidak menggagalkan aksi utama. */
export async function logAudit(user, action, detail = {}) {
  try {
    await pool.query(
      'INSERT INTO audit_log (id, actor_id, actor_upt_key, action, detail) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), user?.id ?? null, user?.upt_key ?? null, action, JSON.stringify({ ...detail, oleh: user?.email ?? 'sistem' })],
    )
  } catch (e) {
    console.error('Gagal menulis audit_log:', e.message)
  }
}

const unique = (rows, col) => [...new Set(rows.map(r => r[col]).filter(v => v !== undefined && v !== null))]

async function labels(sql, ids) {
  if (!ids.length) return {}
  const [rows] = await pool.query(sql, [ids])
  return Object.fromEntries(rows.map(r => [r.k, r.v]))
}

const join = list => (list.length > 3 ? `${list.slice(0, 3).join(', ')} +${list.length - 3} lainnya` : list.join(', '))

/** Ubah baris konteks (upt_key, jenis_data_id, period_id, tanggal) menjadi teks yang mudah dibaca. */
export async function describeRows(rows) {
  const [upt, jd, per] = await Promise.all([
    labels('SELECT `key` AS k, label AS v FROM upt_list WHERE `key` IN (?)', unique(rows, 'upt_key')),
    labels('SELECT id AS k, judul AS v FROM jenis_data WHERE id IN (?)', unique(rows, 'jenis_data_id')),
    labels('SELECT id AS k, label AS v FROM periods WHERE id IN (?)', unique(rows, 'period_id')),
  ])
  const out = {}
  const u = unique(rows, 'upt_key').map(k => upt[k] || k)
  const j = unique(rows, 'jenis_data_id').map(k => jd[k] || k)
  const p = unique(rows, 'period_id').map(k => per[k] || k)
  const t = unique(rows, 'tanggal').map(String)
  if (u.length) out.upt = join(u)
  if (j.length) out.jenis_data = join(j)
  if (p.length) out.periode = join(p)
  if (t.length) out.tanggal = join(t)
  return out
}
