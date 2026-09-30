/**
 * Tes pembaca Form Weekly Report (fe/src/lib/weeklyReport.js) memakai formulir tiruan bertata letak sama dengan
 * template UPT (label C/D, nilai F; blok kanan J/L; tabel F-J). Data asli UPT sengaja tidak disimpan di repo.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bacaWeeklyReport, angka, tanggalLaporan } from '../src/lib/weeklyReport.js'

// Susun grid dari { 'F14': nilai, ... }
function form(sel) {
  const g = []
  for (const [addr, v] of Object.entries(sel)) {
    const m = /^([A-Z])(\d+)$/.exec(addr)
    const r = Number(m[2]) - 1, c = m[1].charCodeAt(0) - 65
    g[r] = g[r] || []
    g[r][c] = v
  }
  return Array.from({ length: g.length }, (_, i) => g[i] || [])
}

const CONTOH = form({
  B5: 'UPT', E5: ':', F5: 'BPPP CONTOH',
  B6: 'WEEKLY REPORT (Tanggal)', E6: ':', F6: '24 September 2026',
  B13: '1. REALISASI ANGGARAN BALAI/SATMINKAL',
  C19: 'a). Belanja Pegawai', H19: 'Target dan Realisasi PNPB ',
  D20: 'Pagu Belanja Pegawai AWAL (Rp)', F20: 1000, J20: 'Target Penerimaan PNBP (Rp)', L20: 'Rp.2,000,000',
  D21: 'Pagu Belanja Pegawai AKTIF (Rp)', F21: 900, J21: 'Realisasi PNBP (Rp)', L21: 1500000,
  D22: 'Realisasi (Rp)', F22: 400, J23: 'Data Dukung', L24: '* Data dukung berbentuk link',
  D23: 'Persentase (%)', F23: '44.44%',
  B37: '2. REALISASI ANGGARAN BERDASARKAN SUMBER ANGGARAN',
  C44: 'a). Rupiah Murni (RM)', D45: 'Pagu RM AWAL (Rp)', F45: 1000, D46: 'Pagu RM AKTIF (Rp)', F46: 950, D47: 'Realisasi (Rp)', F47: 400,
  B62: '3. CAPAIAN KEGIATAN PELATIHAN KP',
  D64: 'Detail Capaian Pelatihan Bagi Masyarakat Per Program Prioritas',
  F65: 'Target Output DIPA Awal', G65: 'Target Berdasarkan Anggaran Efektif', H65: 'Realisasi', J65: 'Link Bukti Dukung',
  D66: 'Konservasi Laut (orang)', K66: '* Diisi Link Drive Folder Laporan Pelatihan',
  D67: 'Penangkapan Ikan Terukur Berbasis Kuota (orang)', H67: 60, J67: 'https://drive.example/folder',
  D68: 'Pengembangan Budidaya Air Laut, Tawar, Payau yang Berkelanjutan (orang)', H68: 40,
  D69: 'Program Tak Dikenal (orang)', H69: 5,
  D72: 'Jumlah Realisasi (Orang)', H72: 99,
  D106: 'Jenis Masyarakat Dilatih Berdasarkan Pembiayaan: ',
  D107: 'a). Aspirasi', D110: 'Target (Orang)', F110: 50, J110: 'Pagu Awal (Rp)', L110: 700,
  D111: 'Realisasi (Orang)', F111: 30, J111: 'Pagu Aktif (Rp)', L111: 650,
  J112: 'Realisasi (Rp)', L112: 300,
  D113: 'Realisasi (Orang)', F113: 7, // baris tercecer, muncul dua kali
  D129: 'Jenis Masyarakat Dilatih Berdasarkan Metode: ',
  D183: 'Lulusan DUDIKA (76% dari realisasi Pelatihan)', D186: 'Target DUDIKA Sesuai PK (Orang)', F186: 80, D187: 'Capaian Pelatihan (Orang)', F187: 100, D188: 'Realisasi DUDIKA (Orang)', F188: 60,
  D192: 'Realisasi Pelatihan Non-APBN Lingkup Puslat KP',
  C194: 'No', D194: 'Nama Pelatihan', E194: 'Jumlah Peserta', F194: 'Sasaran (misal: Masyarakat)', G194: 'Keterangan (Misal: Mitra xxx)',
  C195: 1, D195: 'Pelatihan Mitra A', E195: 25, F195: 'Masyarakat', G195: 'Mitra A',
  N208: 'BPPP AMBON', // daftar pilihan dropdown di bawah formulir: bukan data
})

const hasil = bacaWeeklyReport(CONTOH)
const kel = key => hasil.kelompok.find(k => k.key === key)?.baris

test('identitas laporan: UPT & tanggal', () => {
  assert.equal(hasil.upt, 'BPPP CONTOH')
  assert.equal(hasil.tanggal, '2026-09-24')
})

test('anggaran per jenis belanja: pagu AWAL, AKTIF, realisasi; persentase diabaikan', () => {
  assert.deepEqual(kel('data_capaian_anggaran_per_jenis_belanja'), [{ pagu_awal_belanja_pegawai: 1000, pagu_belanja_pegawai: 900, realisasi_belanja_pegawai: 400 }])
})

test('PNBP di blok kanan (ejaan "PNPB" di formulir), catatan bertanda * bukan nilai', () => {
  assert.deepEqual(kel('pnbp_dan_mp_pnbp'), [{ target_penerimaan_pnbp: 2000000, realisasi_pnbp: 1500000 }])
})

test('sumber dana RM', () => {
  assert.deepEqual(kel('data_capaian_anggaran_per_sumber_dana'), [{ pagu_awal_rm: 1000, pagu_rm: 950, realisasi_rm: 400 }])
})

test('tabel program prioritas: kategori kosong dilewati, link terbaca, kategori asing & Jumlah tak cocok diperingatkan', () => {
  assert.deepEqual(kel('capaian_masyarakat_per_program'), [
    { program_prioritas: 'Penangkapan Ikan Terukur Berbasis Kuota', realisasi_orang: 60, link_bukti_dukung: 'https://drive.example/folder' },
    { program_prioritas: 'Pengembangan Budidaya Air Laut, Tawar, Payau yang Berkelanjutan', realisasi_orang: 40 },
  ])
  assert.ok(hasil.peringatan.some(p => /Program Tak Dikenal/.test(p)))
  assert.ok(hasil.peringatan.some(p => /Jumlah.*99.*100/.test(p)))
})

test('sub-bagian pembiayaan: target & pagu kiri-kanan, label ganda diperingatkan (nilai pertama dipakai)', () => {
  assert.deepEqual(kel('capaian_masyarakat_per_pembiayaan'), [{ jenis_pembiayaan: 'Aspirasi', target_orang: 50, realisasi_orang: 30, pagu_awal: 700, pagu_aktif: 650, realisasi_anggaran: 300 }])
  assert.ok(hasil.peringatan.some(p => /Aspirasi.*baris 113/.test(p)))
})

test('DUDIKA dan tabel Non-APBN', () => {
  assert.deepEqual(kel('lulusan_dudika'), [{ target_dudika: 80, capaian_pelatihan: 100, realisasi_dudika: 60 }])
  assert.deepEqual(kel('pelatihan_non_apbn'), [{ nama_pelatihan: 'Pelatihan Mitra A', jumlah_peserta: 25, sasaran: 'Masyarakat', keterangan: 'Mitra A' }])
})

test('selisih pagu AKTIF jenis belanja vs sumber dana diperingatkan', () => {
  assert.ok(hasil.peringatan.some(p => /selisih Rp50/.test(p)))
})

test('bukan formulir Weekly Report -> pesan jelas', () => {
  assert.throws(() => bacaWeeklyReport([['Nama', 'NIK'], ['Budi', '1']]), /bukan Form Weekly Report/)
})

test('angka dari berbagai format teks', () => {
  assert.equal(angka('Rp45,077,545,000'), 45077545000)
  assert.equal(angka('Rp.4.004.381.308'), 4004381308)
  assert.equal(angka(' 6,835 '), 6835)
  assert.equal(angka('Rp-'), null)
  assert.equal(angka('54.09%'), null)
  assert.equal(angka('* diisi manual'), null)
  assert.equal(tanggalLaporan(new Date(Date.UTC(2026, 8, 24))), '2026-09-24')
})
