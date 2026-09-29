/**
 * routes/permintaan-edit.js
 * Akun UPT: ajukan edit pada baris rekap_nilai/data_entries yang SUDAH disetujui Admin. Menulis langsung ke
 * baris yang sudah disetujui selalu ditolak (403, lihat rowApprovalGate di be/src/lib/query.js) — sebelumnya
 * satu-satunya jalan mengubahnya adalah "Ajukan Hapus" lalu memasukkan data baru dari nol. Di sini nilai baru
 * diajukan sebagai satu baris `permintaan_hapus` (aksi = 'edit', lihat migrasi_15); setelah Admin menyetujui
 * (POST /api/permintaan-hapus/:id/setujui, cabang aksi='edit'), nilai baru itu yang ditulis dan baris langsung
 * berstatus disetujui lagi -- tidak perlu antre kedua kalinya di Persetujuan Baris Data. Menolak (endpoint yang
 * sama seperti permintaan hapus) tidak menyentuh data, baris tetap seperti sebelumnya.
 */
import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { pool } from '../db.js'
import { requireAuth } from '../auth.js'
import { HttpError } from '../lib/query.js'
import { logAudit } from '../lib/audit.js'
import { features } from '../lib/compat.js'

const router = Router()
router.use(requireAuth)

function requireEditEnabled(_req, _res, next) {
  if (!features.permintaanEdit) throw new HttpError(409, 'Fitur Ajukan Edit belum aktif. Jalankan database/migrasi_15_permintaan_edit.sql lalu restart backend.')
  next()
}
function requireUpt(req, _res, next) {
  if (req.user.role === 'admin') throw new HttpError(403, 'Admin selalu bisa menulis langsung, tidak perlu mengajukan edit.')
  next()
}
router.use(requireEditEnabled, requireUpt)

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

// Satu baris hanya punya satu permintaan edit yang menunggu: mengajukan edit lagi sebelum Admin memproses
// yang lama menimpa nilai yang diajukan (bukan menambah permintaan kedua). Target dicocokkan lewat
// filter_json, yang selalu disusun dengan urutan yang sama untuk baris yang sama.
export async function simpanPermintaanEdit({ tabel, uptKey, periodId, jenisDataId, filters, dataBaru, ringkasan, user, alasan }) {
  const filterJson = JSON.stringify(filters)
  const [[lama]] = await pool.query(
    `SELECT id FROM permintaan_hapus
     WHERE status = 'pending' AND aksi = 'edit' AND tabel = ? AND upt_key = ? AND filter_json = CAST(? AS JSON) LIMIT 1`,
    [tabel, uptKey, filterJson],
  )
  if (lama) {
    await pool.query(
      `UPDATE permintaan_hapus SET data_baru_json = ?, ringkasan = ?, alasan = ?, requested_by = ?, requested_by_label = ?, created_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(dataBaru), ringkasan, alasan || null, user.id, user.email, lama.id],
    )
    await logAudit(user, 'ajukan_edit', { tabel, permintaan_id: lama.id, ringkasan, menggantikan_pengajuan_sebelumnya: true })
    return lama.id
  }

  const id = randomUUID()
  await pool.query(
    `INSERT INTO permintaan_hapus (id, tabel, aksi, upt_key, period_id, jenis_data_id, filter_json, data_baru_json, ringkasan, jumlah_baris, alasan, requested_by, requested_by_label)
     VALUES (?, ?, 'edit', ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [id, tabel, uptKey, periodId, jenisDataId, filterJson, JSON.stringify(dataBaru), ringkasan, alasan || null, user.id, user.email],
  )
  await logAudit(user, 'ajukan_edit', { tabel, permintaan_id: id, ringkasan })
  return id
}

// POST /api/permintaan-edit/rekap-nilai — satu baris mingguan (satu baris_ke, sekumpulan field sekaligus)
router.post('/rekap-nilai', async (req, res) => {
  const { jenis_data_id, period_id, baris_ke, upserts, clearedFields, alasan } = req.body || {}
  if (!jenis_data_id || !period_id || baris_ke === undefined || baris_ke === null) {
    throw new HttpError(400, 'jenis_data_id, period_id, dan baris_ke wajib diisi.')
  }
  const upt_key = req.user.upt_key
  const upsertItems = Array.isArray(upserts) ? upserts : []
  const cleared = Array.isArray(clearedFields) ? clearedFields.map(String) : []
  if (!upsertItems.length && !cleared.length) throw new HttpError(400, 'Tidak ada perubahan untuk diajukan.')
  for (const it of upsertItems) {
    if (!it?.field_key) throw new HttpError(400, 'Setiap perubahan wajib punya field_key.')
  }

  const [existing] = await pool.query(
    `SELECT 1 FROM rekap_nilai WHERE jenis_data_id = ? AND upt_key = ? AND period_id = ? AND baris_ke = ? AND status = 'disetujui' AND deleted_at IS NULL LIMIT 1`,
    [jenis_data_id, upt_key, period_id, baris_ke],
  )
  if (!existing.length) throw new HttpError(400, 'Baris ini belum disetujui Admin, gunakan tombol Simpan biasa.')

  const fullUpserts = upsertItems.map(it => ({
    jenis_data_id, upt_key, period_id, baris_ke,
    field_key: it.field_key, value: it.value ?? null, value_text: it.value_text ?? null,
  }))
  const filters = [
    { col: 'jenis_data_id', op: 'eq', val: jenis_data_id },
    { col: 'upt_key', op: 'eq', val: upt_key },
    { col: 'period_id', op: 'eq', val: period_id },
    { col: 'baris_ke', op: 'eq', val: baris_ke },
  ]
  const [jd, upt, period] = await Promise.all([labelJenisData(jenis_data_id), labelUpt(upt_key), labelPeriod(period_id)])
  const ringkasan = `${jd} · ${period} · ${upt} — ajukan edit baris #${baris_ke}`.slice(0, 500)

  const requestId = await simpanPermintaanEdit({
    tabel: 'rekap_nilai', uptKey: upt_key, periodId: period_id, jenisDataId: jenis_data_id,
    filters, dataBaru: { values: fullUpserts, clearedFields: cleared }, ringkasan, user: req.user, alasan,
  })
  res.json({ success: true, requestId })
})

// POST /api/permintaan-edit/data-entries — satu baris rincian (satu orang/nik)
router.post('/data-entries', async (req, res) => {
  const { id, values, alasan } = req.body || {}
  if (!id || !values || typeof values !== 'object') throw new HttpError(400, 'id dan values wajib diisi.')

  const [[row]] = await pool.query(
    'SELECT jenis_data_id, upt_key, period_id, status FROM data_entries WHERE id = ? AND deleted_at IS NULL', [id],
  )
  if (!row) throw new HttpError(404, 'Data tidak ditemukan (mungkin sudah dihapus).')
  if (row.upt_key !== req.user.upt_key) throw new HttpError(403, 'Data ini bukan milik UPT Anda.')
  if (row.status !== 'disetujui') throw new HttpError(400, 'Data ini belum disetujui Admin, gunakan tombol Simpan biasa.')

  const dataBaru = {
    nama: values.nama || values.nama_pelatihan || null,
    nik: values.nik ? String(values.nik) : null,
    data_json: values,
  }
  const filters = [{ col: 'id', op: 'eq', val: id }, { col: 'upt_key', op: 'eq', val: row.upt_key }]
  const [jd, upt, period] = await Promise.all([labelJenisData(row.jenis_data_id), labelUpt(row.upt_key), labelPeriod(row.period_id)])
  const ringkasan = `${jd} · ${period} · ${upt} — ajukan edit ${dataBaru.nama || 'satu baris rincian'}`.slice(0, 500)

  const requestId = await simpanPermintaanEdit({
    tabel: 'data_entries', uptKey: row.upt_key, periodId: row.period_id, jenisDataId: row.jenis_data_id,
    filters, dataBaru: { values: dataBaru }, ringkasan, user: req.user, alasan,
  })
  res.json({ success: true, requestId })
})

export default router
