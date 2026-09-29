/**
 * Tes pustaka Excel (SheetJS) untuk fungsi-fungsi yang dipakai aplikasi: buat, tulis, baca ulang.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'

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
