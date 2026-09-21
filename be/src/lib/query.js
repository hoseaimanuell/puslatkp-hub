import { randomUUID } from 'node:crypto'
import { pool, todayJakarta } from '../db.js'
import { TABLES } from '../schema.js'
import { logAudit, describeRows } from './audit.js'

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const bad = msg => new HttpError(400, msg)
const q = name => '`' + name + '`'
const marks = arr => arr.map(() => '?').join(',')

const MYSQL_MESSAGES = {
  ER_DUP_ENTRY: 'Data duplikat: nilai unik tersebut sudah ada.',
  ER_NO_REFERENCED_ROW_2: 'Referensi data tidak valid (data induk tidak ditemukan).',
  ER_ROW_IS_REFERENCED_2: 'Data tidak dapat dihapus karena masih dipakai data lain.',
  ER_DATA_TOO_LONG: 'Ada isian yang terlalu panjang.',
  ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: 'Ada isian dengan format tidak valid.',
  ER_WRONG_VALUE_FOR_TYPE: 'Ada isian dengan format tidak valid.',
  WARN_DATA_TRUNCATED: 'Ada isian dengan nilai tidak valid.',
}

export function friendlyError(err) {
  if (err instanceof HttpError) return err
  if (err?.code && MYSQL_MESSAGES[err.code]) return new HttpError(409, MYSQL_MESSAGES[err.code])
  console.error(err)
  return new HttpError(500, 'Terjadi kesalahan pada server.')
}

// ---------- Konversi nilai ----------
function toDb(def, col, v) {
  if (v === undefined || v === null) return v
  if (def.json.includes(col)) return JSON.stringify(v)
  if (def.bool.includes(col)) return v ? 1 : 0
  return v
}

function fromDb(def, row) {
  for (const c of def.bool) if (row[c] !== undefined && row[c] !== null) row[c] = !!row[c]
  return row
}

function parseColumns(def, columns) {
  if (!columns || columns === '*') return def.cols
  const list = String(columns).split(',').map(s => s.trim()).filter(Boolean)
  for (const c of list) if (!def.cols.includes(c)) throw bad(`Kolom tidak dikenal: ${c}`)
  return list
}

// ---------- Hak akses ----------
function authorize(def, user, kind) {
  const level = kind === 'read' ? def.read : def.write
  if (level === 'none') throw new HttpError(403, 'Operasi tidak diizinkan pada objek ini.')
  if (level === 'public') return
  if (!user) throw new HttpError(401, 'Silakan login terlebih dahulu.')
  if (level === 'admin' && user.role !== 'admin') throw new HttpError(403, 'Hanya Admin yang boleh melakukan aksi ini.')
}

/** Susun WHERE dari filter klien + pembatas hak akses (pengganti RLS). */
function buildWhere(def, spec, user, forWrite) {
  const parts = []
  const params = []
  const filters = spec.filters || []

  for (const f of filters) {
    if (!def.cols.includes(f.col)) throw bad(`Kolom filter tidak dikenal: ${f.col}`)
    const col = `t.${q(f.col)}`
    if (f.op === 'eq') {
      if (f.val === null) parts.push(`${col} IS NULL`)
      else { parts.push(`${col} = ?`); params.push(toDb(def, f.col, f.val)) }
    } else if (f.op === 'in') {
      if (!Array.isArray(f.val)) throw bad('Filter "in" membutuhkan array.')
      if (f.val.length === 0) parts.push('1 = 0')
      else { parts.push(`${col} IN (${marks(f.val)})`); params.push(...f.val.map(v => toDb(def, f.col, v))) }
    } else throw bad(`Operator filter tidak didukung: ${f.op}`)
  }

  if (!user) {
    for (const [c, v] of Object.entries(def.anon?.force || {})) { parts.push(`t.${q(c)} = ?`); params.push(v) }
  } else if (user.role !== 'admin') {
    if (def.scope === 'upt') {
      parts.push('t.`upt_key` = ?'); params.push(user.upt_key)
    } else if (def.scope === 'key') {
      parts.push('t.`key` = ?'); params.push(user.upt_key)
    } else if (def.scope === 'self') {
      parts.push('t.`id` = ?'); params.push(user.id)
    }
  }

  if (def.soft) parts.push('t.`deleted_at` IS NULL') // baris di tempat sampah tidak terlihat/terubah

  if (forWrite && !filters.length) throw bad('Operasi ubah/hapus wajib memakai filter.')
  return { sql: parts.length ? ' WHERE ' + parts.join(' AND ') : '', params }
}

// ---------- Eksekusi ----------
async function doSelect(def, spec, user) {
  let cols = parseColumns(def, spec.columns)
  if (!user && def.anon) {
    const allowed = cols.filter(c => def.anon.cols.includes(c))
    if (!allowed.length) throw new HttpError(403, 'Kolom tidak boleh diakses publik.')
    cols = allowed
  }
  const { sql: where, params } = buildWhere(def, spec, user, false)
  const from = `${q(spec.table)} AS t${where}`

  if (spec.head) {
    const [[r]] = await pool.query(`SELECT COUNT(*) AS c FROM ${from}`, params)
    return { data: null, count: Number(r.c) }
  }

  let sql = `SELECT ${cols.map(c => `t.${q(c)}`).join(', ')} FROM ${from}`
  const orders = (spec.order || []).map(o => {
    if (!def.cols.includes(o.column)) throw bad(`Kolom urut tidak dikenal: ${o.column}`)
    return `t.${q(o.column)} ${o.ascending === false ? 'DESC' : 'ASC'}`
  })
  if (orders.length) sql += ' ORDER BY ' + orders.join(', ')
  if (spec.limit) sql += ` LIMIT ${Math.max(1, Math.min(Math.trunc(Number(spec.limit)) || 1, 10000))}`

  const [rows] = await pool.query(sql, params)
  rows.forEach(r => fromDb(def, r))
  if (spec.single) {
    if (rows.length !== 1) return { data: null, error: { message: 'Data tidak ditemukan', code: 'PGRST116' } }
    return { data: rows[0] }
  }
  return { data: rows, count: rows.length }
}

/** Ambil hanya kolom yang boleh ditulis klien, lalu tambahkan id & stempel dari server. */
function prepareRow(def, raw, user) {
  const row = {}
  for (const c of def.writable) {
    const v = toDb(def, c, raw[c])
    if (v !== undefined) row[c] = v
  }
  if (def.pk === 'id') row.id = randomUUID()
  for (const [col, from] of Object.entries(def.stamp || {})) row[col] = user[from] ?? null
  if (def.scope === 'upt' && user.role !== 'admin') row.upt_key = user.upt_key
  return row
}

/**
 * Deadline BUKAN kunci: akun UPT tetap boleh menyimpan data setelah deadline periode, tetapi baris itu ditandai
 * `terlambat` (dicap server, tidak bisa dipalsukan). Tulisan Admin (mis. impor/koreksi) tidak ditandai.
 */
async function stampLate(def, rows, user) {
  if (!def.cols.includes('terlambat')) return // database belum dimigrasi
  if (user.role === 'admin') { rows.forEach(r => { r.terlambat = 0 }); return }
  const ids = [...new Set(rows.map(r => r.period_id).filter(Boolean))]
  if (!ids.length) throw bad('period_id wajib diisi.')
  const [found] = await pool.query(`SELECT id, deadline FROM periods WHERE id IN (${marks(ids)})`, ids)
  if (found.length !== ids.length) throw bad('Periode tidak ditemukan.')
  const today = todayJakarta()
  const late = new Set(found.filter(p => p.deadline < today).map(p => p.id))
  rows.forEach(r => { r.terlambat = late.has(r.period_id) ? 1 : 0 })
}

// Aksi log yang boleh dicatat dari browser. Semua aksi lain (hapus, pulihkan, ...) hanya ditulis oleh server
// agar catatan penghapusan tidak dapat dipalsukan oleh pengguna.
const CLIENT_AUDIT_ACTIONS = { import_kolom_tidak_dikenal: null, impor_historis: 'admin' } // aksi -> peran yang boleh (null = semua)

async function doInsert(def, spec, user, upsert) {
  if (def.noInsert) throw new HttpError(403, 'Gunakan endpoint khusus untuk membuat data ini.')
  let items = Array.isArray(spec.values) ? spec.values : [spec.values]
  if (spec.table === 'audit_log') {
    items = items.map(i => {
      const needRole = CLIENT_AUDIT_ACTIONS[i?.action]
      if (needRole === undefined || (needRole && user.role !== needRole)) throw new HttpError(403, 'Aksi log ini hanya dapat dicatat oleh server.')
      const detail = i.detail && typeof i.detail === 'object' && !Array.isArray(i.detail) ? i.detail : {}
      return { action: i.action, detail: { ...detail, oleh: user.email } }
    })
  }
  if (!items.length || items.some(i => !i || typeof i !== 'object')) throw bad('Data tidak valid.')
  const rows = items.map(i => prepareRow(def, i, user))

  if (def.late) await stampLate(def, rows, user)

  const conflict = upsert ? String(spec.onConflict || def.pk).split(',').map(s => s.trim()) : []
  for (const c of conflict) if (!def.cols.includes(c)) throw bad(`Kolom onConflict tidak dikenal: ${c}`)

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    for (const row of rows) {
      const cols = Object.keys(row)
      if (def.soft && !upsert && def.unique && def.unique.every(c => row[c] !== undefined && row[c] !== null)) {
        // data yang sama pernah dihapus (ada di tempat sampah): buang permanen agar tidak bentrok
        await conn.query(`DELETE FROM ${q(spec.table)} WHERE deleted_at IS NOT NULL AND ${def.unique.map(c => `${q(c)} = ?`).join(' AND ')}`, def.unique.map(c => row[c]))
      }
      let sql = `INSERT INTO ${q(spec.table)} (${cols.map(q).join(', ')}) VALUES (${marks(cols)})`
      if (upsert) {
        const upd = cols.filter(c => !conflict.includes(c) && c !== 'id' && c !== 'upt_key' && c !== 'terlambat')
        const sets = upd.map(c => `${q(c)} = VALUES(${q(c)})`)
        if (def.soft) sets.push('deleted_at = NULL', 'deleted_by = NULL', 'deleted_batch = NULL') // menyimpan ulang = memulihkan
        if (def.late && cols.includes('terlambat')) sets.push('terlambat = GREATEST(terlambat, VALUES(terlambat))')
        sql += ' ON DUPLICATE KEY UPDATE ' + (sets.length ? sets.join(', ') : `${q(def.pk)} = ${q(def.pk)}`)
      }
      await conn.query(sql, cols.map(c => row[c]))
    }
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }

  if (upsert || def.pk !== 'id') return { data: null }
  const ids = rows.map(r => r.id)
  const [saved] = await pool.query(`SELECT * FROM ${q(spec.table)} WHERE id IN (${marks(ids)})`, ids)
  saved.forEach(r => fromDb(def, r))
  return { data: Array.isArray(spec.values) ? saved : saved[0] }
}

async function doUpdate(def, spec, user) {
  if (def.insertOnly) throw new HttpError(403, 'Data ini tidak dapat diubah.')
  const sets = []
  const setParams = []
  for (const c of def.writable) {
    if (c === 'upt_key' && def.scope === 'upt' && user.role !== 'admin') continue
    const v = toDb(def, c, spec.values?.[c])
    if (v !== undefined) { sets.push(`t.${q(c)} = ?`); setParams.push(v) }
  }
  if (!sets.length) throw bad('Tidak ada kolom yang dapat diubah.')
  if (def.late && def.cols.includes('terlambat') && user.role !== 'admin') {
    sets.push('t.`terlambat` = IF(EXISTS (SELECT 1 FROM periods p WHERE p.id = t.period_id AND p.deadline < ?), 1, t.`terlambat`)')
    setParams.push(todayJakarta())
  }
  const { sql: where, params } = buildWhere(def, spec, user, true)
  const [res] = await pool.query(`UPDATE ${q(spec.table)} AS t SET ${sets.join(', ')}${where}`, [...setParams, ...params])
  if (spec.table === 'periods' && res.affectedRows) {
    await logAudit(user, 'ubah_periode', { jumlah: res.affectedRows, perubahan: spec.values, filter: (spec.filters || []).map(f => `${f.col}=${JSON.stringify(f.val)}`).join(', ').slice(0, 200) })
  }
  return { data: null, count: res.affectedRows }
}

async function doDelete(def, spec, user) {
  if (def.insertOnly) throw new HttpError(403, 'Data ini tidak dapat dihapus.')
  if (spec.table === 'profiles' && (spec.filters || []).some(f => f.col === 'id' && f.op === 'eq' && f.val === user.id)) {
    throw bad('Anda tidak dapat menghapus akun Anda sendiri.')
  }
  const { sql: where, params } = buildWhere(def, spec, user, true)

  // Tempat sampah: sembunyikan baris (bukan hapus permanen), satu aksi = satu batch, dan catat ke log
  if (def.soft) {
    const cols = ['id', ...def.ctx].map(c => `t.${q(c)}`).join(', ')
    const [rows] = await pool.query(`SELECT ${cols} FROM ${q(spec.table)} AS t${where}`, params)
    if (!rows.length) return { data: null, count: 0 }
    const batch = randomUUID()
    await pool.query(
      `UPDATE ${q(spec.table)} AS t SET t.deleted_at = NOW(), t.deleted_by = ?, t.deleted_batch = ?${where}`,
      [user.id, batch, ...params],
    )
    await logAudit(user, rows.length > 1 ? 'hapus_massal' : 'hapus', {
      tabel: spec.table, jumlah: rows.length, batch, ...(await describeRows(rows)),
    })
    return { data: null, count: rows.length }
  }

  // Menghapus UPT ikut menghapus datanya (FK CASCADE): catat ringkasan sebelum dihapus
  let uptSummary = null
  if (spec.table === 'upt_list') {
    const key = (spec.filters || []).find(f => f.col === 'key' && f.op === 'eq')?.val
    if (key) {
      const count = async t => (await pool.query(`SELECT COUNT(*) AS c FROM ${q(t)} WHERE upt_key = ?`, [key]))[0][0].c
      const [[found]] = await pool.query('SELECT label FROM upt_list WHERE `key` = ?', [key])
      uptSummary = {
        upt: key,
        label: found?.label,
        akun: await count('profiles'),
        data_mingguan: await count('rekap_nilai'),
        data_bulanan: await count('data_entries'),
        berkas: await count('dokumen_upload'),
        aktivitas: await count('daily_activity'),
      }
    }
  }

  const [res] = await pool.query(`DELETE t FROM ${q(spec.table)} AS t${where}`, params)
  if (res.affectedRows) {
    if (uptSummary) {
      await logAudit(user, 'hapus_upt', uptSummary)
    } else {
      const filter = (spec.filters || []).map(f => `${f.col}${f.op === 'in' ? ' in ' : '='}${JSON.stringify(f.val)}`).join(', ').slice(0, 300)
      await logAudit(user, 'hapus', { tabel: spec.table, jumlah: res.affectedRows, filter })
    }
  }
  return { data: null, count: res.affectedRows }
}

export async function runQuery(spec, user) {
  if (!spec || typeof spec !== 'object') throw bad('Permintaan tidak valid.')
  const def = TABLES[spec.table]
  if (!def) throw bad('Tabel tidak dikenal.')

  switch (spec.op) {
    case 'select':
      authorize(def, user, 'read')
      return doSelect(def, spec, user)
    case 'insert':
      authorize(def, user, 'write')
      return doInsert(def, spec, user, false)
    case 'upsert':
      authorize(def, user, 'write')
      if (def.insertOnly) throw new HttpError(403, 'Operasi tidak diizinkan.')
      return doInsert(def, spec, user, true)
    case 'update':
      authorize(def, user, 'write')
      return doUpdate(def, spec, user)
    case 'delete':
      authorize(def, user, 'write')
      return doDelete(def, spec, user)
    default:
      throw bad('Operasi tidak dikenal.')
  }
}
