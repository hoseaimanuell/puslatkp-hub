/**
 * Tes pencocokan impor Excel "Data by Name" (be/src/lib/imporRincian.js) dan status yang dipaksa server
 * (kolomPaksaan di be/src/lib/query.js). Tidak butuh MySQL.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { klasifikasiImpor, stabil } from '../src/lib/imporRincian.js'

process.env.JWT_SECRET ||= 'rahasia-khusus-tes-minimal-16-karakter'
const { kolomPaksaan } = await import('../src/lib/query.js')
const { TABLES } = await import('../src/schema.js')

const e = (id, nama, nik, data_json, status = 'draft') => ({ id, nama, nik, data_json, data_ekstra: null, status })
const r = (nama, nik, data_json) => ({ nama, nik, data_json })

test('unggah ulang berkas yang sama tidak mengubah apa pun (termasuk baris tanpa NIK)', () => {
  const existing = [e('1', 'Budi', '111', { usia: 30 }), e('2', 'Sari', null, { usia: 25 }), e('3', 'Sari', null, { usia: 40 })]
  const rows = [r('Budi', '111', { usia: 30 }), r('Sari', '', { usia: 25 }), r('Sari', null, { usia: 40 })]
  const k = klasifikasiImpor(existing, rows)
  assert.deepEqual([k.baru.length, k.ubah.length, k.sama], [0, 0, 3])
})

test('nama beda huruf besar/spasi tetap dianggap orang yang sama (diperbarui, bukan baris baru)', () => {
  const k = klasifikasiImpor([e('2', 'Sari', null, { usia: 25 })], [r('  sari ', null, { usia: 25 })])
  assert.equal(k.baru.length, 0)
  assert.deepEqual(k.ubah.map(u => u.id), ['2'])
})

test('baris tanpa NIK yang baru ditambahkan, bukan menggandakan yang lama', () => {
  const k = klasifikasiImpor([e('2', 'Sari', null, { usia: 25 })], [r('Sari', null, { usia: 25 }), r('Sari', null, { usia: 33 })])
  assert.equal(k.sama, 1)
  assert.equal(k.baru.length, 1)
  assert.equal(k.baru[0].data_json.usia, 33)
})

test('isi berubah pada baris belum disetujui -> diperbarui', () => {
  const k = klasifikasiImpor([e('1', 'Budi', '111', { usia: 30 }, 'ditolak')], [r('Budi', '111', { usia: 31 })])
  assert.deepEqual(k.ubah.map(u => u.id), ['1'])
})

test('baris sudah disetujui: sama dilewati, berubah dipisahkan (tidak ditimpa langsung)', () => {
  const existing = [e('1', 'Budi', '111', { usia: 30 }, 'disetujui'), e('2', 'Ani', '222', { usia: 20 }, 'disetujui')]
  const k = klasifikasiImpor(existing, [r('Budi', '111', { usia: 30 }), r('Ani', '222', { usia: 21 }), r('Cici', '333', {})])
  assert.equal(k.disetujuiSama, 1)
  assert.deepEqual(k.disetujuiBerubah.map(u => u.id), ['2'])
  assert.deepEqual(k.baru.map(b => b.nik), ['333'])
  assert.equal(k.ubah.length, 0)
})

test('berkas kedua melengkapi NIK: baris lama tanpa NIK diperbarui, bukan dibuat baru', () => {
  const k = klasifikasiImpor([e('2', 'Sari', null, { usia: 25 })], [r('Sari', '999', { usia: 25 })])
  assert.equal(k.baru.length, 0)
  assert.equal(k.ubah[0].row.nik, '999')
})

test('berkas tanpa kolom NIK tidak menghapus NIK tersimpan', () => {
  const k = klasifikasiImpor([e('1', 'Budi', '111', { usia: 30 })], [r('Budi', null, { usia: 30 })])
  assert.equal(k.sama, 1)
})

test('NIK berbeda = orang berbeda walau namanya sama', () => {
  const k = klasifikasiImpor([e('1', 'Budi', '111', {})], [r('Budi', '222', {})])
  assert.equal(k.baru.length, 1)
})

test('NIK ganda di dalam berkas: baris terakhir yang dipakai', () => {
  const k = klasifikasiImpor([], [r('Budi', '111', { usia: 1 }), r('Budi', '111', { usia: 2 })])
  assert.equal(k.baru.length, 1)
  assert.equal(k.baru[0].data_json.usia, 2)
})

test('perbandingan isi tidak peka urutan kunci dan kolom kosong', () => {
  assert.equal(stabil({ a: 1, b: '', c: null }), stabil({ a: 1 }))
  assert.equal(stabil({ b: 2, a: 1 }), stabil({ a: 1, b: 2 }))
  assert.equal(stabil({}), stabil(null))
})

test('UPT selalu dipaksa draft, termasuk saat update (tidak bisa menyetujui sendiri)', () => {
  const p = kolomPaksaan(TABLES.data_entries, { id: 'u1', role: 'upt', upt_key: 'x' })
  assert.equal(p.status, 'draft')
  assert.equal(p.disetujui_by, null)
  assert.equal(p.catatan_admin, null) // catatan penolakan lama dikosongkan saat UPT memperbaiki
})

test('Admin yang menulis langsung distempel disetujui', () => {
  const p = kolomPaksaan(TABLES.data_entries, { id: 'a1', role: 'admin', email: 'admin@x' })
  assert.equal(p.status, 'disetujui')
  assert.equal(p.disetujui_by, 'a1')
})

test('tabel tanpa persetujuan tidak dipaksa apa pun', () => {
  assert.deepEqual(kolomPaksaan(TABLES.periods, { role: 'admin' }), {})
})
