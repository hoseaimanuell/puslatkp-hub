/**
 * Tes pustaka Excel (SheetJS) untuk fungsi-fungsi yang dipakai aplikasi: buat, tulis, baca ulang.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { bacaTabel } from '../src/lib/bacaTabelExcel.js'

// Tulis ke berkas .xlsx lalu baca ulang (sama seperti unggahan UPT), kemudian ubah jadi tabel impor
function lewatExcel(aoa, merges = []) {
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = merges
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'S')
  const dibaca = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer', cellDates: true }).Sheets.S
  return bacaTabel(XLSX.utils.sheet_to_json(dibaca, { header: 1, defval: null, blankrows: true }), dibaca['!merges'])
}
const g = (r1, c1, r2, c2) => ({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } })

test('Excel gaya kantor: judul digabung, judul kolom dua tingkat, sel data digabung', () => {
  const t = lewatExcel([
    ['REKAP PESERTA PELATIHAN SEPTEMBER 2026', null, null, null],
    ['Nama', 'NIK', 'Jumlah Peserta', null],
    [null, null, 'L', 'P'],
    ['Budi', '111', 3, 2],
    ['Sari', '222', 1, null],
  ], [g(0, 0, 0, 3), g(1, 2, 1, 3), g(1, 0, 2, 0), g(1, 1, 2, 1), g(4, 2, 4, 3)])
  assert.deepEqual(t.headers, ['Nama', 'NIK', 'Jumlah Peserta L', 'Jumlah Peserta P'])
  assert.equal(t.barisJudul, 2)
  assert.deepEqual(t.rows, [
    { Nama: 'Budi', NIK: '111', 'Jumlah Peserta L': 3, 'Jumlah Peserta P': 2 },
    { Nama: 'Sari', NIK: '222', 'Jumlah Peserta L': 1, 'Jumlah Peserta P': 1 },
  ])
})

test('sel digabung ke bawah diisi ke setiap baris; baris kosong & JUMLAH dilewati', () => {
  const t = lewatExcel([
    ['UPT', 'Nama Pelatihan', 'Peserta'],
    ['BPPP Tegal', 'Budidaya Lele', 20],
    [null, 'Pengolahan Ikan', 15],
    [null, null, null],
    ['JUMLAH', null, 35],
  ], [g(1, 0, 2, 0)])
  assert.deepEqual(t.rows.map(r => [r.UPT, r['Nama Pelatihan'], r.Peserta]), [['BPPP Tegal', 'Budidaya Lele', 20], ['BPPP Tegal', 'Pengolahan Ikan', 15]])
})

test('Template Excel aplikasi (tanpa gabungan) terbaca persis seperti sebelumnya', () => {
  const aoa = [['Nama', 'NIK', 'Tanggal Lahir', 'Jenis Kelamin'], ['Budi', '3500000000000001', null, 'Laki-laki'], ['Sari', '3500000000000002', null, 'Perempuan']]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const lama = XLSX.utils.sheet_to_json(ws, { defval: null })
  const baru = bacaTabel(XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true }), ws['!merges'])
  assert.deepEqual(baru.headers, Object.keys(lama[0]))
  assert.deepEqual(baru.rows, lama)
})

test('judul kolom kosong & kembar diberi nama unik', () => {
  const t = lewatExcel([['Nama', null, 'Nama'], ['Budi', 'x', 'Budi S']])
  assert.deepEqual(t.headers, ['Nama', 'Kolom 2', 'Nama (2)'])
})

test('tulis lalu baca ulang workbook (ekspor & impor Excel)', () => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Nama: 'Budi', 'Jumlah Peserta': 25 }, { Nama: 'Sari', 'Jumlah Peserta': 30 }]), 'Data')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Judul'], ['Rekap September 2026']]), 'Info')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const dibaca = XLSX.read(buf, { type: 'buffer' })
  assert.deepEqual(dibaca.SheetNames, ['Data', 'Info'])
  assert.deepEqual(XLSX.utils.sheet_to_json(dibaca.Sheets.Data), [{ Nama: 'Budi', 'Jumlah Peserta': 25 }, { Nama: 'Sari', 'Jumlah Peserta': 30 }])
  assert.equal(typeof XLSX.writeFile, 'function')
})
