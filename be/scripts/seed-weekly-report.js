/**
 * Jenis data mingguan yang mengikuti "Form Weekly Report" UPT (formulir Excel yang rutin dikirim tiap minggu).
 * Satu sumber untuk: data bawaan instalasi baru (seed-data.js -> puslatkp1a.sql) dan
 * database/migrasi_17_weekly_report.sql (database yang sudah berjalan) — keduanya dibangun `npm run db:build`.
 * Setelah terpasang, semuanya bisa diubah Admin di Kelola Jenis Data seperti jenis data lain.
 *
 * Peta formulir -> jenis data (nomor kelompok sesuai formulir):
 *   1a-c Belanja Pegawai/Barang/Modal -> data_capaian_anggaran_per_jenis_belanja (+ pagu AWAL, lihat WR_FIELDS_TAMBAHAN)
 *   1    Target & Realisasi PNBP, MP PNBP -> pnbp_dan_mp_pnbp
 *   2a-c RM / PNBP-BLU / SBSN            -> data_capaian_anggaran_per_sumber_dana (+ pagu AWAL)
 *   3.1  Masyarakat per program prioritas (fisik + anggaran) -> capaian_masyarakat_per_program
 *        Masyarakat per bidang usaha     -> capaian_masyarakat_per_bidang
 *        Masyarakat per pembiayaan       -> capaian_masyarakat_per_pembiayaan
 *        Masyarakat per metode           -> capaian_masyarakat_per_metode
 *   3.2  Diklat aparatur per metode      -> capaian_aparatur_per_metode
 *   3.3  Lulusan DUDIKA                  -> lulusan_dudika
 *   3.4  Pelatihan Non-APBN              -> pelatihan_non_apbn
 * Total Balai (bagian 1 & 2 paling atas) tidak disimpan: selalu = jumlah rinciannya.
 *
 * Angka di formulir adalah angka berjalan sejak awal tahun, jadi rekap bulan/triwulan/tahun memakai nilai terakhir
 * (agregasi bawaan kolom angka mingguan). Peran di rekap sengaja dikosongkan (peran_rekap: null) supaya angka
 * Pelatihan/Peserta/Pagu/Realisasi yang sudah ada tidak terhitung dua kali; Admin bisa mengaturnya nanti.
 */

export const JD_WR = {
  pnbp: '11111111-0010-0000-0000-000000000010',
  program: '11111111-0011-0000-0000-000000000011',
  bidang: '11111111-0012-0000-0000-000000000012',
  pembiayaan: '11111111-0013-0000-0000-000000000013',
  metode: '11111111-0014-0000-0000-000000000014',
  aparatur: '11111111-0015-0000-0000-000000000015',
  dudika: '11111111-0016-0000-0000-000000000016',
  nonApbn: '11111111-0017-0000-0000-000000000017',
}
const JD_ANGGARAN_BELANJA_ID = '11111111-0008-0000-0000-000000000008'
const JD_ANGGARAN_DANA_ID = '11111111-0009-0000-0000-000000000009'

export const OPSI_PROGRAM_PRIORITAS = [
  'Konservasi Laut',
  'Penangkapan Ikan Terukur Berbasis Kuota',
  'Pengembangan Budidaya Air Laut, Tawar, Payau yang Berkelanjutan',
  'Pengelolaan dan Pengawasan Pesisir dan Pulau-Pulau Kecil',
  'Penanganan Sampah Plastik/BCL',
  'Lainnya (Pengolahan, Garam, Pemasaran, Manajemen, dll)',
]
export const OPSI_BIDANG_USAHA = [
  'Sistem Jaminan Mutu',
  'Pembentukan Keahlian Awak Kapal Perikanan (AKP)',
  'Budidaya',
  'Pengolahan dan Pemasaran',
  'Konservasi dan Kemitigasian',
  'Kelautan dan Kemaritiman',
  'Pengawasan dan Kepelabuhan',
  'Permesinan dan Mekanisasi',
  'Peningkatan Keahlian Awak Kapal Perikanan (AKP)',
  'Penangkapan dan Alat Tangkap',
  'Teknis Lainnya',
]
export const OPSI_PEMBIAYAAN = ['Aspirasi', 'Reguler', 'PNBP / BLU']
export const OPSI_METODE_MASYARAKAT = ['Online', 'Luring', 'Blended']
export const OPSI_METODE_APARATUR = ['Blended', 'Reguler', 'Full Online']

const jenis = (id, key, judul, deskripsi, multi) => ({
  id, key, judul, deskripsi, level_utama: 'minggu', mode_bulanan: null, butuh_input_bulanan: false,
  pasangan_mingguan_id: null, publik_boleh_lihat: false, multi_baris: multi, aktif: true,
})

export const WR_JENIS_DATA = [
  jenis(JD_WR.pnbp, 'pnbp_dan_mp_pnbp', 'Target & Realisasi PNBP',
    'Weekly Report bagian 1: target & realisasi penerimaan PNBP serta pagu & realisasi MP PNBP (angka berjalan sejak awal tahun).', false),
  jenis(JD_WR.program, 'capaian_masyarakat_per_program', 'Capaian Masyarakat per Program Prioritas',
    'Weekly Report bagian 3.1: target, realisasi, dan anggaran pelatihan masyarakat per program prioritas. Satu baris = satu program.', true),
  jenis(JD_WR.bidang, 'capaian_masyarakat_per_bidang', 'Capaian Masyarakat per Bidang Usaha',
    'Weekly Report bagian 3.1: realisasi fisik & anggaran pelatihan masyarakat per bidang usaha. Satu baris = satu bidang.', true),
  jenis(JD_WR.pembiayaan, 'capaian_masyarakat_per_pembiayaan', 'Capaian Masyarakat per Pembiayaan',
    'Weekly Report bagian 3.1: target, realisasi, dan anggaran masyarakat dilatih per jenis pembiayaan (Aspirasi, Reguler, PNBP/BLU).', true),
  jenis(JD_WR.metode, 'capaian_masyarakat_per_metode', 'Capaian Masyarakat per Metode',
    'Weekly Report bagian 3.1: target, realisasi, dan anggaran masyarakat dilatih per metode (Online, Luring, Blended).', true),
  jenis(JD_WR.aparatur, 'capaian_aparatur_per_metode', 'Capaian Diklat Aparatur per Metode',
    'Weekly Report bagian 3.2 (Layanan Manajemen SDM Internal): target, realisasi, dan anggaran diklat aparatur per metode.', true),
  jenis(JD_WR.dudika, 'lulusan_dudika', 'Lulusan DUDIKA',
    'Weekly Report bagian 3.3: target DUDIKA sesuai PK, capaian pelatihan, dan realisasi lulusan yang terserap DUDIKA.', false),
  jenis(JD_WR.nonApbn, 'pelatihan_non_apbn', 'Pelatihan Non-APBN',
    'Weekly Report bagian 3.4: pelatihan di luar APBN (mis. kerja sama mitra). Satu baris = satu pelatihan.', true),
]

let n = 0
const kolom = (jenis_data_id, field_key, label, tipe = 'angka', extra = {}) => ({
  id: `wr-${jenis_data_id.slice(-2)}-${++n}`, jenis_data_id, level: 'minggu', field_key, label, tipe,
  wajib: false, aktif: true, peran_rekap: null, ...extra,
})
const capaianFisikAnggaran = jd => [
  kolom(jd, 'target_orang', 'Target (Orang)'),
  kolom(jd, 'realisasi_orang', 'Realisasi (Orang)'),
  kolom(jd, 'pagu_awal', 'Pagu Awal (Rp)'),
  kolom(jd, 'pagu_aktif', 'Pagu Aktif (Rp)'),
  kolom(jd, 'realisasi_anggaran', 'Realisasi Anggaran (Rp)'),
]

const WR_FIELDS_BARU = [
  kolom(JD_WR.pnbp, 'target_penerimaan_pnbp', 'Target Penerimaan PNBP (Rp)'),
  kolom(JD_WR.pnbp, 'realisasi_pnbp', 'Realisasi PNBP (Rp)'),
  kolom(JD_WR.pnbp, 'link_data_dukung_pnbp', 'Link Data Dukung PNBP', 'teks'),
  kolom(JD_WR.pnbp, 'pagu_total_mp_pnbp', 'Pagu Total MP PNBP (Rp)'),
  kolom(JD_WR.pnbp, 'pagu_mp1_pnbp', 'Pagu MP I PNBP (Rp)'),
  kolom(JD_WR.pnbp, 'realisasi_mp_pnbp', 'Realisasi MP PNBP (Rp)'),

  kolom(JD_WR.program, 'program_prioritas', 'Program Prioritas', 'pilihan', { opsi_pilihan: OPSI_PROGRAM_PRIORITAS, wajib: true }),
  kolom(JD_WR.program, 'target_dipa_awal', 'Target Output DIPA Awal (Orang)'),
  kolom(JD_WR.program, 'target_efektif', 'Target Berdasarkan Anggaran Efektif (Orang)'),
  kolom(JD_WR.program, 'realisasi_orang', 'Realisasi (Orang)'),
  kolom(JD_WR.program, 'anggaran_dipa_awal', 'Anggaran DIPA Awal (Rp)'),
  kolom(JD_WR.program, 'anggaran_efektif', 'Anggaran Efektif (Rp)'),
  kolom(JD_WR.program, 'realisasi_anggaran', 'Realisasi Anggaran (Rp)'),
  kolom(JD_WR.program, 'link_bukti_dukung', 'Link Bukti Dukung (Folder Laporan Pelatihan)', 'teks'),

  kolom(JD_WR.bidang, 'bidang_usaha', 'Bidang Usaha', 'pilihan', { opsi_pilihan: OPSI_BIDANG_USAHA, wajib: true }),
  kolom(JD_WR.bidang, 'realisasi_fisik', 'Realisasi Fisik (Orang)'),
  kolom(JD_WR.bidang, 'realisasi_anggaran', 'Realisasi Anggaran (Rp)'),

  kolom(JD_WR.pembiayaan, 'jenis_pembiayaan', 'Jenis Pembiayaan', 'pilihan', { opsi_pilihan: OPSI_PEMBIAYAAN, wajib: true }),
  ...capaianFisikAnggaran(JD_WR.pembiayaan),

  kolom(JD_WR.metode, 'metode', 'Metode', 'pilihan', { opsi_pilihan: OPSI_METODE_MASYARAKAT, wajib: true }),
  ...capaianFisikAnggaran(JD_WR.metode),

  kolom(JD_WR.aparatur, 'metode', 'Metode', 'pilihan', { opsi_pilihan: OPSI_METODE_APARATUR, wajib: true }),
  ...capaianFisikAnggaran(JD_WR.aparatur),

  kolom(JD_WR.dudika, 'target_dudika', 'Target DUDIKA Sesuai PK (Orang)'),
  kolom(JD_WR.dudika, 'capaian_pelatihan', 'Capaian Pelatihan (Orang)'),
  kolom(JD_WR.dudika, 'realisasi_dudika', 'Realisasi DUDIKA (Orang)'),

  kolom(JD_WR.nonApbn, 'nama_pelatihan', 'Nama Pelatihan', 'teks', { wajib: true }),
  kolom(JD_WR.nonApbn, 'jumlah_peserta', 'Jumlah Peserta'),
  kolom(JD_WR.nonApbn, 'sasaran', 'Sasaran (mis. Masyarakat)', 'teks'),
  kolom(JD_WR.nonApbn, 'keterangan', 'Keterangan (mis. Mitra xxx)', 'teks'),
]

// Tambahan pada 2 jenis data anggaran yang sudah ada: formulir memisahkan pagu AWAL dan pagu AKTIF. Kolom pagu
// lama (pagu_belanja_pegawai, pagu_rm, ...) tetap dipakai sebagai pagu AKTIF (datanya tidak berubah); hanya
// labelnya diperjelas di WR_UBAH_LABEL.
const WR_FIELDS_TAMBAHAN = [
  kolom(JD_ANGGARAN_BELANJA_ID, 'pagu_awal_belanja_pegawai', 'Pagu Belanja Pegawai AWAL (Rp)', 'angka', { urutan: 1 }),
  kolom(JD_ANGGARAN_BELANJA_ID, 'pagu_awal_belanja_barang', 'Pagu Belanja Barang AWAL (Rp)', 'angka', { urutan: 4 }),
  kolom(JD_ANGGARAN_BELANJA_ID, 'pagu_awal_belanja_modal', 'Pagu Belanja Modal AWAL (Rp)', 'angka', { urutan: 7 }),
  kolom(JD_ANGGARAN_DANA_ID, 'pagu_awal_rm', 'Pagu RM AWAL (Rp)', 'angka', { urutan: 1 }),
  kolom(JD_ANGGARAN_DANA_ID, 'pagu_awal_pnbp_blu', 'Pagu PNBP/BLU AWAL (Rp)', 'angka', { urutan: 4 }),
  kolom(JD_ANGGARAN_DANA_ID, 'pagu_awal_sbsn', 'Pagu SBSN AWAL (Rp)', 'angka', { urutan: 7 }),
]

/**
 * Kolom lama pada jenis data anggaran: label & urutan baru supaya urut AWAL -> AKTIF -> Realisasi seperti formulir.
 * `peran_rekap`: per jenis belanja dan per sumber dana adalah dua rincian dari anggaran Balai yang SAMA, jadi hanya
 * satu yang boleh dihitung di rekap (dulu pagu keduanya terhitung -> total pagu 2x lipat, realisasi tidak terhitung
 * sama sekali). Dipilih per jenis belanja (pagu AKTIF + realisasi); per sumber dana tidak dihitung.
 */
export const WR_UBAH_LABEL = [
  { jenis_data_id: JD_ANGGARAN_BELANJA_ID, field_key: 'pagu_belanja_pegawai', label: 'Pagu Belanja Pegawai AKTIF (Rp)', urutan: 2 },
  { jenis_data_id: JD_ANGGARAN_BELANJA_ID, field_key: 'realisasi_belanja_pegawai', label: 'Realisasi Belanja Pegawai (Rp)', urutan: 3, peran_rekap: 'realisasi' },
  { jenis_data_id: JD_ANGGARAN_BELANJA_ID, field_key: 'pagu_belanja_barang', label: 'Pagu Belanja Barang AKTIF (Rp)', urutan: 5 },
  { jenis_data_id: JD_ANGGARAN_BELANJA_ID, field_key: 'realisasi_belanja_barang', label: 'Realisasi Belanja Barang (Rp)', urutan: 6, peran_rekap: 'realisasi' },
  { jenis_data_id: JD_ANGGARAN_BELANJA_ID, field_key: 'pagu_belanja_modal', label: 'Pagu Belanja Modal AKTIF (Rp)', urutan: 8 },
  { jenis_data_id: JD_ANGGARAN_BELANJA_ID, field_key: 'realisasi_belanja_modal', label: 'Realisasi Belanja Modal (Rp)', urutan: 9, peran_rekap: 'realisasi' },
  { jenis_data_id: JD_ANGGARAN_DANA_ID, field_key: 'pagu_rm', label: 'Pagu RM AKTIF (Rp)', urutan: 2, peran_rekap: null },
  { jenis_data_id: JD_ANGGARAN_DANA_ID, field_key: 'realisasi_rm', label: 'Realisasi RM (Rp)', urutan: 3 },
  { jenis_data_id: JD_ANGGARAN_DANA_ID, field_key: 'pagu_pnbp_blu', label: 'Pagu PNBP/BLU AKTIF (Rp)', urutan: 5, peran_rekap: null },
  { jenis_data_id: JD_ANGGARAN_DANA_ID, field_key: 'realisasi_pnbp_blu', label: 'Realisasi PNBP/BLU (Rp)', urutan: 6 },
  { jenis_data_id: JD_ANGGARAN_DANA_ID, field_key: 'pagu_sbsn', label: 'Pagu SBSN AKTIF (Rp)', urutan: 8, peran_rekap: null },
  { jenis_data_id: JD_ANGGARAN_DANA_ID, field_key: 'realisasi_sbsn', label: 'Realisasi SBSN (Rp)', urutan: 9 },
]

// Urutan kolom baru = urutan penulisan di atas (per jenis data), kecuali yang sudah menyebut `urutan`
const urutanPer = {}
export const WR_FIELDS = [...WR_FIELDS_BARU, ...WR_FIELDS_TAMBAHAN].map(f => {
  urutanPer[f.jenis_data_id] = (urutanPer[f.jenis_data_id] || 0) + 1
  return { urutan: urutanPer[f.jenis_data_id], ...f }
})
