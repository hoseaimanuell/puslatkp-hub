/**
 * Tes aturan hak akses endpoint generik /api/db/query (be/src/lib/query.js + be/src/schema.js).
 * Semua kasus di sini ditolak/disusun SEBELUM menyentuh database, jadi tes tidak butuh MySQL.
 *   npm test   (dari folder be)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.JWT_SECRET ||= 'rahasia-khusus-tes-minimal-16-karakter'
const { runQuery, buildWhere } = await import('../src/lib/query.js')
const { TABLES } = await import('../src/schema.js')

const admin = { id: 'a1', role: 'admin', upt_key: null }
const upt = { id: 'u1', role: 'upt', upt_key: 'bpppu_medan' }

const ditolak = (status) => err => err.status === status

test('tabel di luar whitelist ditolak', async () => {
  await assert.rejects(runQuery({ table: 'mysql.user', op: 'select' }, admin), ditolak(400))
  await assert.rejects(runQuery({ table: 'profiles; DROP TABLE profiles', op: 'select' }, admin), ditolak(400))
})

test('pengunjung tanpa login tidak bisa membaca data UPT', async () => {
  for (const table of ['rekap_nilai', 'data_entries', 'profiles', 'permintaan_hapus']) {
    await assert.rejects(runQuery({ table, op: 'select' }, null), ditolak(401), table)
  }
})

test('akun UPT tidak bisa menulis tabel khusus Admin', async () => {
  for (const table of ['jenis_data', 'field_definitions', 'periods', 'upt_list', 'dashboard_widgets', 'dokumen_resmi']) {
    await assert.rejects(runQuery({ table, op: 'update', values: {}, filters: [{ col: 'id', op: 'eq', val: 'x' }] }, upt), ditolak(403), table)
    await assert.rejects(runQuery({ table, op: 'delete', filters: [{ col: 'id', op: 'eq', val: 'x' }] }, upt), ditolak(403), table)
  }
})

test('akun UPT tidak bisa membaca audit_log', async () => {
  await assert.rejects(runQuery({ table: 'audit_log', op: 'select' }, upt), ditolak(403))
})

test('permintaan_hapus & view publik tidak bisa ditulis lewat endpoint generik, bahkan oleh Admin', async () => {
  await assert.rejects(runQuery({ table: 'permintaan_hapus', op: 'insert', values: {} }, admin), ditolak(403))
  await assert.rejects(runQuery({ table: 'v_publik_rekap', op: 'delete', filters: [{ col: 'tahun', op: 'eq', val: 2026 }] }, admin), ditolak(403))
})

test('kolom rahasia (password_hash) tidak bisa dipilih', async () => {
  await assert.rejects(runQuery({ table: 'profiles', op: 'select', columns: 'id,password_hash' }, admin), ditolak(400))
})

test('nama kolom filter/urut yang tidak dikenal ditolak (mencegah SQL injection lewat nama kolom)', async () => {
  assert.throws(() => buildWhere(TABLES.rekap_nilai, { filters: [{ col: 'upt_key` OR 1=1 -- ', op: 'eq', val: 'x' }] }, admin), ditolak(400))
  assert.throws(() => buildWhere(TABLES.rekap_nilai, { filters: [{ col: 'upt_key', op: 'like', val: '%' }] }, admin), ditolak(400))
  await assert.rejects(runQuery({ table: 'periods', op: 'select', order: [{ column: 'SLEEP(5)' }] }, admin), ditolak(400))
})

test('akun UPT selalu dibatasi ke UPT-nya sendiri, walau memfilter UPT lain', () => {
  const { sql, params } = buildWhere(TABLES.rekap_nilai, { filters: [{ col: 'upt_key', op: 'eq', val: 'upt_lain' }] }, upt)
  assert.match(sql, /t\.`upt_key` = \?.*AND t\.`upt_key` = \?/)
  assert.deepEqual(params.slice(0, 2), ['upt_lain', 'bpppu_medan'])
})

test('akun UPT hanya melihat profil & baris upt_list miliknya', () => {
  const p = buildWhere(TABLES.profiles, {}, upt)
  assert.match(p.sql, /t\.`id` = \?/)
  assert.deepEqual(p.params, ['u1'])
  const u = buildWhere(TABLES.upt_list, {}, upt)
  assert.match(u.sql, /t\.`key` = \?/)
  assert.deepEqual(u.params, ['bpppu_medan'])
})

test('Admin tidak dibatasi UPT', () => {
  const { sql } = buildWhere(TABLES.rekap_nilai, {}, admin)
  assert.doesNotMatch(sql, /upt_key/)
})

test('pengunjung publik hanya melihat jenis data publik & aktif', () => {
  const { sql, params } = buildWhere(TABLES.jenis_data, {}, null)
  assert.match(sql, /publik_boleh_lihat/)
  assert.match(sql, /aktif/)
  assert.deepEqual(params, [1, 1])
})

test('baris di tempat sampah tidak ikut terbaca/terubah', () => {
  assert.match(buildWhere(TABLES.rekap_nilai, {}, admin).sql, /deleted_at` IS NULL/)
})

test('ubah/hapus tanpa filter ditolak (mencegah mengubah seluruh tabel)', () => {
  assert.throws(() => buildWhere(TABLES.rekap_nilai, {}, admin, true), ditolak(400))
})

test('filter "in" kosong tidak mengembalikan apa pun', () => {
  assert.match(buildWhere(TABLES.periods, { filters: [{ col: 'id', op: 'in', val: [] }] }, admin).sql, /1 = 0/)
})
