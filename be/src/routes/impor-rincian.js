/**
 * routes/impor-rincian.js
 * Impor Excel "Data by Name" (data_entries) untuk satu jenis data + UPT + periode, dalam satu permintaan.
 *
 * Menggantikan upsert per-100-baris dari browser, yang (1) gagal satu batch penuh bila ada NIK yang sudah
 * disetujui, dan (2) menggandakan baris tanpa NIK setiap kali berkas yang sama diunggah ulang. Di sini setiap
 * baris dicocokkan dulu dengan data tersimpan (be/src/lib/imporRincian.js), lalu:
 *   - baru                 -> disimpan (UPT: menunggu persetujuan; Admin: langsung disetujui)
 *   - berubah, belum disetujui -> diperbarui dan kembali menunggu persetujuan
 *   - sama persis          -> dilewati (unggah ulang berkas yang sama tidak mengubah apa pun)
 *   - berubah, SUDAH disetujui -> UPT: diajukan sebagai permintaan edit ke Admin bila `ajukanPerubahan`, selain itu
 *                             dilewati; Admin: diperbarui langsung
 * Semua tulisan lewat runQuery(), jadi aturan akses, status draft, penanda terlambat, dan tempat sampah tetap sama
 * dengan jalur lain. `pratinjau: true` hanya menghitung tanpa menyimpan (dipakai untuk konfirmasi di browser).
 */
import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth.js'
import { HttpError, runQuery } from '../lib/query.js'
import { logAudit } from '../lib/audit.js'
import { features } from '../lib/compat.js'
import { trashEnabled } from '../lib/trash.js'
import { klasifikasiImpor } from '../lib/imporRincian.js'
import { simpanPermintaanEdit } from './permintaan-edit.js'

const router = Router()
router.use(requireAuth)

const MAKS_BARIS = 5000
const BATCH = 200

function bersihkanBaris(r) {
  if (!r || typeof r !== 'object') throw new HttpError(400, 'Format baris tidak valid.')
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : null)
  return {
    nama: r.nama === undefined || r.nama === null || r.nama === '' ? null : String(r.nama).slice(0, 255),
    nik: r.nik === undefined || r.nik === null || String(r.nik).trim() === '' ? null : String(r.nik).trim().slice(0, 64),
    data_json: obj(r.data_json) || {},
    data_ekstra: obj(r.data_ekstra),
  }
}

// POST /api/impor-rincian
router.post('/', async (req, res) => {
  const { jenis_data_id, period_id, rows, pratinjau, ajukanPerubahan, alasan } = req.body || {}
  const isAdmin = req.user.role === 'admin'
  const upt_key = isAdmin ? req.body?.upt_key : req.user.upt_key
  if (!jenis_data_id || !period_id || !upt_key) throw new HttpError(400, 'jenis_data_id, period_id, dan upt_key wajib diisi.')
  if (!Array.isArray(rows) || !rows.length) throw new HttpError(400, 'Tidak ada baris untuk diimpor.')
  if (rows.length > MAKS_BARIS) throw new HttpError(400, `Maksimal ${MAKS_BARIS} baris per unggahan. Pecah berkasnya menjadi beberapa bagian.`)

  const [[jd]] = await pool.query('SELECT id, judul FROM jenis_data WHERE id = ?', [jenis_data_id])
  const [[period]] = await pool.query('SELECT id, label FROM periods WHERE id = ?', [period_id])
  const [[upt]] = await pool.query('SELECT `key`, label FROM upt_list WHERE `key` = ?', [upt_key])
  if (!jd || !period || !upt) throw new HttpError(400, 'Jenis data, periode, atau UPT tidak ditemukan.')

  const baris = rows.map(bersihkanBaris)
  const [existing] = await pool.query(
    `SELECT * FROM data_entries WHERE jenis_data_id = ? AND upt_key = ? AND period_id = ?${trashEnabled() ? ' AND deleted_at IS NULL' : ''}`,
    [jenis_data_id, upt_key, period_id],
  )
  const k = klasifikasiImpor(existing, baris)
  const bisaAjukan = !isAdmin && features.permintaanEdit
  const ringkasanAngka = {
    baru: k.baru.length,
    diperbarui: k.ubah.length + (isAdmin ? k.disetujuiBerubah.length : 0), // Admin menimpa langsung
    sama: k.sama + k.disetujuiSama,
    disetujuiBerubah: isAdmin ? 0 : k.disetujuiBerubah.length,
    bisaAjukan,
  }
  if (pratinjau) return res.json({ pratinjau: true, ...ringkasanAngka })

  const konteks = { jenis_data_id, upt_key, period_id }
  // 1. Baris baru. Ber-NIK lewat upsert (memulihkan baris ber-NIK sama yang ada di Tempat Sampah), tanpa NIK insert.
  const baruNik = k.baru.filter(r => r.nik).map(r => ({ ...konteks, ...r }))
  const baruTanpaNik = k.baru.filter(r => !r.nik).map(r => ({ ...konteks, ...r }))
  for (let i = 0; i < baruNik.length; i += BATCH) {
    await runQuery({ table: 'data_entries', op: 'upsert', values: baruNik.slice(i, i + BATCH), onConflict: 'jenis_data_id,upt_key,period_id,nik' }, req.user)
  }
  for (let i = 0; i < baruTanpaNik.length; i += BATCH) {
    await runQuery({ table: 'data_entries', op: 'insert', values: baruTanpaNik.slice(i, i + BATCH) }, req.user)
  }

  // 2. Baris yang isinya berubah dan belum disetujui (Admin: termasuk yang sudah disetujui)
  const langsung = isAdmin ? [...k.ubah, ...k.disetujuiBerubah] : k.ubah
  for (const { id, row } of langsung) {
    await runQuery({ table: 'data_entries', op: 'update', values: row, filters: [{ col: 'id', op: 'eq', val: id }] }, req.user)
  }

  // 3. UPT: baris yang sudah disetujui tapi isinya berubah -> permintaan edit (satu per baris, menimpa pengajuan lama)
  let diajukan = 0
  if (bisaAjukan && ajukanPerubahan) {
    for (const { id, row } of k.disetujuiBerubah) {
      await simpanPermintaanEdit({
        tabel: 'data_entries', uptKey: upt_key, periodId: period_id, jenisDataId: jenis_data_id,
        filters: [{ col: 'id', op: 'eq', val: id }, { col: 'upt_key', op: 'eq', val: upt_key }],
        dataBaru: { values: row },
        ringkasan: `${jd.judul} · ${period.label} · ${upt.label} — ajukan edit ${row.nama || 'satu baris rincian'} (impor Excel)`.slice(0, 500),
        user: req.user, alasan: alasan || 'Perubahan dari unggahan Excel',
      })
      diajukan++
    }
  }

  const hasil = { ...ringkasanAngka, diajukan, dilewatiDisetujui: ringkasanAngka.disetujuiBerubah - diajukan }
  await logAudit(req.user, 'impor_rincian', { jenis_data: jd.judul, periode: period.label, upt: upt.label, jumlah_baris: rows.length, ...hasil })
  res.json(hasil)
})

export default router
