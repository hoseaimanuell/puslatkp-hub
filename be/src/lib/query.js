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
export function buildWhere(def, spec, user, forWrite) {
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
  // Kolom yang nilainya selalu dipaksa server, tidak boleh diatur klien (mis. `status` selalu 'draft' saat
  // UPT mengirim — hanya endpoint persetujuan khusus yang boleh mengubahnya jadi 'disetujui'). Admin menulis
  // langsung (mis. mengoreksi data UPT lewat form yang sama) dianggap sudah final — tidak perlu antre
  // persetujuannya sendiri, jadi distempel `disetujui` alih-alih dipaksa `draft`.
  if (def.forceOnWrite) {
    if (user.role === 'admin' && def.rowApprovalGate) {
      row[def.rowApprovalGate.column] = def.rowApprovalGate.values[0]
      if (def.cols.includes('disetujui_at')) row.disetujui_at = new Date()
      if (def.cols.includes('disetujui_by')) row.disetujui_by = user.id
      if (def.cols.includes('disetujui_by_label')) row.disetujui_by_label = user.email
      if (def.cols.includes('catatan_admin')) row.catatan_admin = null
    } else {
      for (const [col, val] of Object.entries(def.forceOnWrite)) row[col] = val
    }
  }
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

  await ensureRowsNotApproved(def, spec, user, rows)
  await ensurePeriodNotLocked(def, spec, user, rows.map(r => r.period_id))
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
  if (def.periodLockCheck && user.role !== 'admin') {
    let periodIds = spec.values?.period_id ? [spec.values.period_id] : []
    if (!periodIds.length) {
      const [existing] = await pool.query(`SELECT DISTINCT t.period_id FROM ${q(spec.table)} AS t${where}`, params)
      periodIds = existing.map(r => r.period_id)
    }
    await ensurePeriodNotLocked(def, spec, user, periodIds)
  }
  await ensureUpdateTargetNotApproved(def, spec, user, where, params)
  const [res] = await pool.query(`UPDATE ${q(spec.table)} AS t SET ${sets.join(', ')}${where}`, [...setParams, ...params])
  if (spec.table === 'periods' && res.affectedRows) {
    await logAudit(user, 'ubah_periode', { jumlah: res.affectedRows, perubahan: spec.values, filter: (spec.filters || []).map(f => `${f.col}=${JSON.stringify(f.val)}`).join(', ').slice(0, 200) })
  }
  return { data: null, count: res.affectedRows }
}

/** Tempat sampah: sembunyikan baris (bukan hapus permanen), satu aksi = satu batch, dan catat ke log. */
export async function executeSoftDelete(def, tableName, where, params, user) {
  const cols = ['id', ...def.ctx].map(c => `t.${q(c)}`).join(', ')
  const [rows] = await pool.query(`SELECT ${cols} FROM ${q(tableName)} AS t${where}`, params)
  if (!rows.length) return { data: null, count: 0 }
  const batch = randomUUID()
  await pool.query(
    `UPDATE ${q(tableName)} AS t SET t.deleted_at = NOW(), t.deleted_by = ?, t.deleted_batch = ?${where}`,
    [user.id, batch, ...params],
  )
  await logAudit(user, rows.length > 1 ? 'hapus_massal' : 'hapus', {
    tabel: tableName, jumlah: rows.length, batch, ...(await describeRows(rows)),
  })
  return { data: null, count: rows.length }
}

const REQUEST_TABLE_LABEL = { rekap_nilai: 'baris data mingguan/bulanan', data_entries: 'baris data rincian (nama)', dokumen_upload: 'berkas dokumen', periode_kirim: 'kunci periode (buka kunci)' }

/**
 * Dari daftar period_id, kembalikan yang sedang 'disetujui' (terkunci) bagi UPT ini. Dipakai baik untuk menggerbang
 * hapus (`periodLockCheck` pada deleteRequiresApproval) maupun menolak tulis/ubah langsung (`ensurePeriodNotLocked`)
 * pada rekap_nilai/data_entries/dokumen_upload — supaya periode yang sudah dikunci Admin benar-benar tidak bisa
 * diubah lewat API, bukan cuma disembunyikan di tampilan. Aman-gagal (kosong) bila migrasi periode_kirim belum ada.
 */
async function findLockedPeriodIds(uptKey, periodIds) {
  if (!TABLES.periode_kirim || !uptKey || !periodIds.length) return new Set()
  const [rows] = await pool.query(
    `SELECT period_id FROM periode_kirim WHERE upt_key = ? AND status = 'disetujui' AND deleted_at IS NULL AND period_id IN (${marks(periodIds)})`,
    [uptKey, ...periodIds],
  )
  return new Set(rows.map(r => r.period_id))
}

/** Sebelum insert/upsert/update pada tabel ber-`periodLockCheck`: tolak keras (403) bila periode terkait sudah dikunci. */
async function ensurePeriodNotLocked(def, spec, user, periodIds) {
  if (!def.periodLockCheck || user.role === 'admin') return
  const locked = await findLockedPeriodIds(user.upt_key, [...new Set(periodIds.filter(Boolean))])
  if (locked.size) throw new HttpError(403, 'Periode ini sudah disetujui Admin & terkunci. Ajukan buka kunci ke Admin untuk mengedit lagi.')
}

const ROW_APPROVED_MSG = 'Baris ini sudah disetujui Admin. Ajukan hapus untuk mengedit ulang, lalu masukkan datanya lagi.'

/**
 * Sebelum insert/upsert pada tabel ber-`rowApprovalGate` (lapisan persetujuan per-baris, terpisah dari
 * periodLockCheck): tolak keras (403) bila baris yang SUDAH ADA di DB — dicocokkan lewat `groupBy` (grain
 * lebih kasar, mis. satu `baris_ke` rekap_nilai yang field-nya tersebar di banyak baris DB) atau kunci unik
 * tabel itu sendiri — statusnya sudah 'disetujui'. Tanpa ini, `forceOnWrite` akan diam-diam menurunkan baris
 * yang sudah disetujui balik ke 'draft' setiap kali UPT menekan Simpan lagi. Admin selalu bebas.
 */
async function ensureRowsNotApproved(def, spec, user, rows) {
  if (!def.rowApprovalGate || user.role === 'admin' || !rows.length) return
  const keyCols = def.rowApprovalGate.groupBy || def.unique
  if (!keyCols || !keyCols.length) return
  const conds = []
  const condParams = []
  const seen = new Set()
  for (const row of rows) {
    const vals = keyCols.map(c => row[c])
    if (vals.some(v => v === undefined || v === null)) continue
    const sig = vals.join('\u0000')
    if (seen.has(sig)) continue
    seen.add(sig)
    conds.push(`(${keyCols.map(c => `${q(c)} = ?`).join(' AND ')})`)
    condParams.push(...vals)
  }
  if (!conds.length) return
  const { column, values } = def.rowApprovalGate
  const [existing] = await pool.query(
    `SELECT 1 FROM ${q(spec.table)} WHERE deleted_at IS NULL AND ${q(column)} IN (${marks(values)}) AND (${conds.join(' OR ')}) LIMIT 1`,
    [...values, ...condParams],
  )
  if (existing.length) throw new HttpError(403, ROW_APPROVED_MSG)
}

/** Variannya untuk UPDATE (bukan insert/upsert): cek langsung baris yang cocok dengan filter/WHERE update itu. */
async function ensureUpdateTargetNotApproved(def, spec, user, where, params) {
  if (!def.rowApprovalGate || user.role === 'admin') return
  const { column, values } = def.rowApprovalGate
  const [existing] = await pool.query(
    `SELECT 1 FROM ${q(spec.table)} AS t${where} AND t.${q(column)} IN (${marks(values)}) LIMIT 1`,
    [...params, ...values],
  )
  if (existing.length) throw new HttpError(403, ROW_APPROVED_MSG)
}

/**
 * Untuk tabel ber-`deleteRequiresApproval`: true bila operasi hapus ini perlu digerbang jadi permintaan, false bila
 * boleh langsung dieksekusi. Tanpa def.approvalGate/def.rowApprovalGate/def.periodLockCheck, selalu true (gerbang
 * tanpa syarat). Ketiga gerbang independen, digabung sebagai union (butuh persetujuan bila SALAH SATU cocok).
 */
async function gateNeedsApproval(def, spec, user) {
  if (!def.approvalGate && !def.rowApprovalGate && !def.periodLockCheck) return true
  const { sql: where, params } = buildWhere(def, spec, user, true)
  const gate = def.approvalGate || def.rowApprovalGate
  const cols = new Set(gate ? [gate.column] : [])
  if (def.periodLockCheck) cols.add('period_id')
  const [rows] = await pool.query(`SELECT ${[...cols].map(c => `t.${q(c)}`).join(', ')} FROM ${q(spec.table)} AS t${where}`, params)
  if (gate && rows.some(r => gate.values.includes(r[gate.column]))) return true
  if (def.periodLockCheck) {
    const locked = await findLockedPeriodIds(user.upt_key, [...new Set(rows.map(r => r.period_id).filter(Boolean))])
    if (locked.size > 0) return true
  }
  return false
}

/** Ringkasan singkat untuk ditampilkan ke Admin di menu Permintaan Hapus, dari kolom konteks yang sudah dibaca. */
async function summarizeDeleteRequest(tableName, rows, count) {
  const parts = []
  const jdId = rows[0]?.jenis_data_id
  const periodId = rows[0]?.period_id
  if (jdId) {
    const [[jd]] = await pool.query('SELECT judul FROM jenis_data WHERE id = ?', [jdId])
    if (jd) parts.push(jd.judul)
  }
  if (periodId) {
    const [[p]] = await pool.query('SELECT label FROM periods WHERE id = ?', [periodId])
    if (p) parts.push(p.label)
  }
  parts.push(`${count} ${REQUEST_TABLE_LABEL[tableName] || 'baris data'}`)
  return parts.join(' · ').slice(0, 500)
}

/**
 * Akun UPT (bukan Admin) pada tabel ber-`deleteRequiresApproval`: bukan langsung menghapus, tapi membuat baris
 * `permintaan_hapus`. Filter yang disimpan SUDAH dilengkapi `upt_key` secara eksplisit (buildWhere menambahkannya
 * otomatis untuk non-admin, tapi tidak untuk Admin) supaya saat Admin menyetujui nanti, penghapusan tetap terbatas
 * pada data UPT pemohon meskipun dijalankan oleh akun Admin.
 */
async function createDeleteRequest(def, spec, user) {
  const { sql: where, params } = buildWhere(def, spec, user, true)
  const cols = ['id', ...def.ctx].map(c => `t.${q(c)}`).join(', ')
  const [rows] = await pool.query(`SELECT ${cols} FROM ${q(spec.table)} AS t${where}`, params)
  if (!rows.length) return { data: null, count: 0 }

  const filters = [...(spec.filters || []), { col: 'upt_key', op: 'eq', val: user.upt_key }]
  const ringkasan = await summarizeDeleteRequest(spec.table, rows, rows.length)
  const id = randomUUID()
  const alasan = spec.alasan ? String(spec.alasan).trim().slice(0, 500) || null : null
  await pool.query(
    `INSERT INTO permintaan_hapus (id, tabel, upt_key, period_id, jenis_data_id, filter_json, ringkasan, jumlah_baris, alasan, requested_by, requested_by_label)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, spec.table, user.upt_key, rows[0]?.period_id || null, rows[0]?.jenis_data_id || null, JSON.stringify(filters), ringkasan, rows.length, alasan, user.id, user.email],
  )
  await logAudit(user, 'ajukan_hapus', { tabel: spec.table, jumlah: rows.length, permintaan_id: id, ringkasan })
  return { data: null, count: 0, pending: true, requestId: id }
}

async function doDelete(def, spec, user) {
  if (def.insertOnly) throw new HttpError(403, 'Data ini tidak dapat dihapus.')
  if (spec.table === 'profiles' && (spec.filters || []).some(f => f.col === 'id' && f.op === 'eq' && f.val === user.id)) {
    throw bad('Anda tidak dapat menghapus akun Anda sendiri.')
  }

  // UPT: tabel ber-`deleteRequiresApproval` tidak dihapus langsung, kecuali penghapusan implisit saat masih
  // mengedit form (spec.liveEdit) — mis. mengosongkan satu kolom lalu menyimpan minggu yang sama.
  // Hanya digerbang bila kondisinya butuh persetujuan (mis. status 'disetujui' pada periode_kirim, atau periode
  // terkait sudah terkunci untuk rekap_nilai dkk.). Draft/periode yang belum dikunci boleh dihapus bebas oleh
  // UPT sendiri, tanpa perlu izin — belum ada yang benar-benar dikunci Admin.
  if (def.deleteRequiresApproval && user.role !== 'admin' && !spec.liveEdit && (await gateNeedsApproval(def, spec, user))) {
    return createDeleteRequest(def, spec, user)
  }

  const { sql: where, params } = buildWhere(def, spec, user, true)

  if (def.soft) return executeSoftDelete(def, spec.table, where, params, user)

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
