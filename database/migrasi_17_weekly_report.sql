-- ==========================================================
-- MIGRASI 17: jenis data mingguan mengikuti "Form Weekly Report" UPT
-- DIBANGUN OTOMATIS oleh be/scripts/build-sql.js dari be/scripts/seed-weekly-report.js — jangan disunting manual.
-- Menambah 8 jenis data mingguan (PNBP, capaian masyarakat per program/bidang/pembiayaan/metode, diklat aparatur
-- per metode, lulusan DUDIKA, pelatihan Non-APBN) dan kolom "Pagu ... AWAL" pada 2 jenis data anggaran.
-- Kolom pagu lama tetap dipakai sebagai pagu AKTIF (labelnya diperjelas hanya bila belum diubah Admin).
-- Aman dijalankan ulang (INSERT IGNORE). Butuh migrasi_16. Cara termudah: npm run migrate (folder be).
-- ==========================================================
USE `Puslatkp1a`;

INSERT IGNORE INTO `jenis_data` (`id`, `key`, `judul`, `deskripsi`, `level_utama`, `mode_bulanan`, `butuh_input_bulanan`, `pasangan_mingguan_id`, `publik_boleh_lihat`, `multi_baris`, `kumulatif_bulanan`, `aktif`) VALUES
  ('11111111-0010-0000-0000-000000000010', 'pnbp_dan_mp_pnbp', 'Target & Realisasi PNBP', 'Weekly Report bagian 1: target & realisasi penerimaan PNBP serta pagu & realisasi MP PNBP (angka berjalan sejak awal tahun).', 'minggu', NULL, 0, NULL, 0, 0, 0, 1),
  ('11111111-0011-0000-0000-000000000011', 'capaian_masyarakat_per_program', 'Capaian Masyarakat per Program Prioritas', 'Weekly Report bagian 3.1: target, realisasi, dan anggaran pelatihan masyarakat per program prioritas. Satu baris = satu program.', 'minggu', NULL, 0, NULL, 0, 1, 0, 1),
  ('11111111-0012-0000-0000-000000000012', 'capaian_masyarakat_per_bidang', 'Capaian Masyarakat per Bidang Usaha', 'Weekly Report bagian 3.1: realisasi fisik & anggaran pelatihan masyarakat per bidang usaha. Satu baris = satu bidang.', 'minggu', NULL, 0, NULL, 0, 1, 0, 1),
  ('11111111-0013-0000-0000-000000000013', 'capaian_masyarakat_per_pembiayaan', 'Capaian Masyarakat per Pembiayaan', 'Weekly Report bagian 3.1: target, realisasi, dan anggaran masyarakat dilatih per jenis pembiayaan (Aspirasi, Reguler, PNBP/BLU).', 'minggu', NULL, 0, NULL, 0, 1, 0, 1),
  ('11111111-0014-0000-0000-000000000014', 'capaian_masyarakat_per_metode', 'Capaian Masyarakat per Metode', 'Weekly Report bagian 3.1: target, realisasi, dan anggaran masyarakat dilatih per metode (Online, Luring, Blended).', 'minggu', NULL, 0, NULL, 0, 1, 0, 1),
  ('11111111-0015-0000-0000-000000000015', 'capaian_aparatur_per_metode', 'Capaian Diklat Aparatur per Metode', 'Weekly Report bagian 3.2 (Layanan Manajemen SDM Internal): target, realisasi, dan anggaran diklat aparatur per metode.', 'minggu', NULL, 0, NULL, 0, 1, 0, 1),
  ('11111111-0016-0000-0000-000000000016', 'lulusan_dudika', 'Lulusan DUDIKA', 'Weekly Report bagian 3.3: target DUDIKA sesuai PK, capaian pelatihan, dan realisasi lulusan yang terserap DUDIKA.', 'minggu', NULL, 0, NULL, 0, 0, 0, 1),
  ('11111111-0017-0000-0000-000000000017', 'pelatihan_non_apbn', 'Pelatihan Non-APBN', 'Weekly Report bagian 3.4: pelatihan di luar APBN (mis. kerja sama mitra). Satu baris = satu pelatihan.', 'minggu', NULL, 0, NULL, 0, 1, 0, 1);

INSERT IGNORE INTO `field_definitions` (`id`, `jenis_data_id`, `level`, `field_key`, `label`, `tipe`, `opsi_pilihan`, `opsi_bersyarat`, `agregasi`, `peran_rekap`, `wajib`, `is_identitas`, `urutan`, `aktif`) VALUES
  ('fc7823ed-9c56-4d0c-8fe1-cc1fd4d46940', '11111111-0010-0000-0000-000000000010', 'minggu', 'target_penerimaan_pnbp', 'Target Penerimaan PNBP (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 1, 1),
  ('9dea54b6-afd0-46a1-8123-832671adefec', '11111111-0010-0000-0000-000000000010', 'minggu', 'realisasi_pnbp', 'Realisasi PNBP (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 2, 1),
  ('a61e76cc-85e0-4a29-822e-b8018b0d9651', '11111111-0010-0000-0000-000000000010', 'minggu', 'link_data_dukung_pnbp', 'Data Dukung PNBP (Berkas / Link)', 'file', NULL, NULL, 'sum', NULL, 0, 0, 3, 1),
  ('62f42b43-ea57-4007-88e7-9bd7091ffef5', '11111111-0010-0000-0000-000000000010', 'minggu', 'pagu_total_mp_pnbp', 'Pagu Total MP PNBP (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 4, 1),
  ('7ea65fba-dbdf-42db-843f-668b0e30a296', '11111111-0010-0000-0000-000000000010', 'minggu', 'pagu_mp1_pnbp', 'Pagu MP I PNBP (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 5, 1),
  ('f7f8bd74-0e9b-4dca-8046-c5eb126d8d44', '11111111-0010-0000-0000-000000000010', 'minggu', 'realisasi_mp_pnbp', 'Realisasi MP PNBP (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 6, 1),
  ('b51099dc-ab7d-42dd-8231-6552d9d561de', '11111111-0011-0000-0000-000000000011', 'minggu', 'program_prioritas', 'Program Prioritas', 'pilihan', '[\"Konservasi Laut\",\"Penangkapan Ikan Terukur Berbasis Kuota\",\"Pengembangan Budidaya Air Laut, Tawar, Payau yang Berkelanjutan\",\"Pengelolaan dan Pengawasan Pesisir dan Pulau-Pulau Kecil\",\"Penanganan Sampah Plastik/BCL\",\"Lainnya (Pengolahan, Garam, Pemasaran, Manajemen, dll)\"]', NULL, 'sum', NULL, 1, 0, 1, 1),
  ('9a1b3e83-3605-4106-8c79-8c30a48a9c00', '11111111-0011-0000-0000-000000000011', 'minggu', 'target_dipa_awal', 'Target Output DIPA Awal (Orang)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 2, 1),
  ('ac7a44a9-7919-4271-81fc-6603c7b6ecc6', '11111111-0011-0000-0000-000000000011', 'minggu', 'target_efektif', 'Target Berdasarkan Anggaran Efektif (Orang)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 3, 1),
  ('11d17184-530d-48da-871e-fdb4b9ba0ce8', '11111111-0011-0000-0000-000000000011', 'minggu', 'realisasi_orang', 'Realisasi (Orang)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 4, 1),
  ('f3d0acb3-b67a-4cc5-8462-5900b3deb848', '11111111-0011-0000-0000-000000000011', 'minggu', 'anggaran_dipa_awal', 'Anggaran DIPA Awal (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 5, 1),
  ('19b65d92-3be2-4ba5-8015-30e8f57998d9', '11111111-0011-0000-0000-000000000011', 'minggu', 'anggaran_efektif', 'Anggaran Efektif (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 6, 1),
  ('5363f512-faba-422e-8127-8e2225d45e21', '11111111-0011-0000-0000-000000000011', 'minggu', 'realisasi_anggaran', 'Realisasi Anggaran (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 7, 1),
  ('657337c9-4771-4b37-8481-7dd8035cd956', '11111111-0011-0000-0000-000000000011', 'minggu', 'link_bukti_dukung', 'Bukti Dukung (Berkas / Link Folder Laporan Pelatihan)', 'file', NULL, NULL, 'sum', NULL, 0, 0, 8, 1),
  ('016259c4-1c66-4bee-817a-d55761071142', '11111111-0012-0000-0000-000000000012', 'minggu', 'bidang_usaha', 'Bidang Usaha', 'pilihan', '[\"Sistem Jaminan Mutu\",\"Pembentukan Keahlian Awak Kapal Perikanan (AKP)\",\"Budidaya\",\"Pengolahan dan Pemasaran\",\"Konservasi dan Kemitigasian\",\"Kelautan dan Kemaritiman\",\"Pengawasan dan Kepelabuhan\",\"Permesinan dan Mekanisasi\",\"Peningkatan Keahlian Awak Kapal Perikanan (AKP)\",\"Penangkapan dan Alat Tangkap\",\"Teknis Lainnya\"]', NULL, 'sum', NULL, 1, 0, 1, 1),
  ('3f5a38fb-0651-493d-8886-2e2d633d9d68', '11111111-0012-0000-0000-000000000012', 'minggu', 'realisasi_fisik', 'Realisasi Fisik (Orang)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 2, 1),
  ('dfe1e40d-465c-4462-80b7-bd340b27c79b', '11111111-0012-0000-0000-000000000012', 'minggu', 'realisasi_anggaran', 'Realisasi Anggaran (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 3, 1),
  ('b8bf67f6-d145-458d-833f-4ce46e17970d', '11111111-0013-0000-0000-000000000013', 'minggu', 'jenis_pembiayaan', 'Jenis Pembiayaan', 'pilihan', '[\"Aspirasi\",\"Reguler\",\"PNBP / BLU\"]', NULL, 'sum', NULL, 1, 0, 1, 1),
  ('1da59830-bf29-495c-8324-b5ee793f060b', '11111111-0013-0000-0000-000000000013', 'minggu', 'target_orang', 'Target (Orang)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 2, 1),
  ('3e5b21f7-0ef9-4828-8a03-a3d69b714659', '11111111-0013-0000-0000-000000000013', 'minggu', 'realisasi_orang', 'Realisasi (Orang)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 3, 1),
  ('2655efff-e0fa-4898-82a6-1ce0c01cc4ae', '11111111-0013-0000-0000-000000000013', 'minggu', 'pagu_awal', 'Pagu Awal (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 4, 1),
  ('2eccf17c-cbcc-40ed-8ae1-2dbff5c0a9db', '11111111-0013-0000-0000-000000000013', 'minggu', 'pagu_aktif', 'Pagu Aktif (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 5, 1),
  ('e324c016-d074-4190-8191-b9868e060e87', '11111111-0013-0000-0000-000000000013', 'minggu', 'realisasi_anggaran', 'Realisasi Anggaran (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 6, 1),
  ('6fd01538-75b3-4f02-8c00-9f502485a5e5', '11111111-0014-0000-0000-000000000014', 'minggu', 'metode', 'Metode', 'pilihan', '[\"Online\",\"Luring\",\"Blended\"]', NULL, 'sum', NULL, 1, 0, 1, 1),
  ('528725e3-67d4-4f7b-85eb-80a75bb87b82', '11111111-0014-0000-0000-000000000014', 'minggu', 'target_orang', 'Target (Orang)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 2, 1),
  ('af890af5-f9ba-4a74-8985-a93429ac9968', '11111111-0014-0000-0000-000000000014', 'minggu', 'realisasi_orang', 'Realisasi (Orang)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 3, 1),
  ('6f1528a8-b2f0-4b55-8ce0-079401ff6ffa', '11111111-0014-0000-0000-000000000014', 'minggu', 'pagu_awal', 'Pagu Awal (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 4, 1),
  ('7c0f6187-b59f-4515-83e8-08c98b18e215', '11111111-0014-0000-0000-000000000014', 'minggu', 'pagu_aktif', 'Pagu Aktif (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 5, 1),
  ('6ed75e79-fd98-4de8-8a6d-23a283ce8ea7', '11111111-0014-0000-0000-000000000014', 'minggu', 'realisasi_anggaran', 'Realisasi Anggaran (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 6, 1),
  ('2cae9f9a-8e38-4fe9-82df-9486b9b54f13', '11111111-0015-0000-0000-000000000015', 'minggu', 'metode', 'Metode', 'pilihan', '[\"Blended\",\"Reguler\",\"Full Online\"]', NULL, 'sum', NULL, 1, 0, 1, 1),
  ('20306d0a-6d07-42d9-8303-9926e5972d4c', '11111111-0015-0000-0000-000000000015', 'minggu', 'target_orang', 'Target (Orang)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 2, 1),
  ('f8c6ada9-6e33-4962-8641-cd25fc9e9fed', '11111111-0015-0000-0000-000000000015', 'minggu', 'realisasi_orang', 'Realisasi (Orang)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 3, 1),
  ('070fc4a6-a245-49c0-8ac4-d7a780d1d3c7', '11111111-0015-0000-0000-000000000015', 'minggu', 'pagu_awal', 'Pagu Awal (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 4, 1),
  ('12db6012-833e-44a6-8acc-3ad5539708f1', '11111111-0015-0000-0000-000000000015', 'minggu', 'pagu_aktif', 'Pagu Aktif (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 5, 1),
  ('fdb65d14-bfdf-4a8a-81b0-f62f1bdc577b', '11111111-0015-0000-0000-000000000015', 'minggu', 'realisasi_anggaran', 'Realisasi Anggaran (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 6, 1),
  ('32cb04ac-6e6f-4d47-8a55-761e65ace5de', '11111111-0016-0000-0000-000000000016', 'minggu', 'target_dudika', 'Target DUDIKA Sesuai PK (Orang)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 1, 1),
  ('33de4972-dc9e-40c0-8df3-3ce452dfe618', '11111111-0016-0000-0000-000000000016', 'minggu', 'capaian_pelatihan', 'Capaian Pelatihan (Orang)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 2, 1),
  ('59f0ae85-1403-44c8-81c1-9cdd74ba2132', '11111111-0016-0000-0000-000000000016', 'minggu', 'realisasi_dudika', 'Realisasi DUDIKA (Orang)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 3, 1),
  ('6d83108c-7661-41ac-8455-4dab9b84cf82', '11111111-0017-0000-0000-000000000017', 'minggu', 'nama_pelatihan', 'Nama Pelatihan', 'teks', NULL, NULL, 'sum', NULL, 1, 0, 1, 1),
  ('c65ee6e8-55b1-453c-8a2e-e716021a40ce', '11111111-0017-0000-0000-000000000017', 'minggu', 'jumlah_peserta', 'Jumlah Peserta', 'angka', NULL, NULL, 'last', NULL, 0, 0, 2, 1),
  ('71fabe8d-ebf4-424d-866e-f0285ff45c00', '11111111-0017-0000-0000-000000000017', 'minggu', 'sasaran', 'Sasaran (mis. Masyarakat)', 'teks', NULL, NULL, 'sum', NULL, 0, 0, 3, 1),
  ('03ccc3c1-c49e-483a-89e2-c971321fabb9', '11111111-0017-0000-0000-000000000017', 'minggu', 'keterangan', 'Keterangan (mis. Mitra xxx)', 'teks', NULL, NULL, 'sum', NULL, 0, 0, 4, 1),
  ('75d89eb8-4f55-40cb-83ea-29ef55dc9449', '11111111-0008-0000-0000-000000000008', 'minggu', 'pagu_awal_belanja_pegawai', 'Pagu Belanja Pegawai AWAL (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 1, 1),
  ('16b8bfba-e744-4728-89af-f2e1b2180529', '11111111-0008-0000-0000-000000000008', 'minggu', 'pagu_awal_belanja_barang', 'Pagu Belanja Barang AWAL (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 4, 1),
  ('8adab8a7-ddf6-4fb2-811f-a3946b8a94cc', '11111111-0008-0000-0000-000000000008', 'minggu', 'pagu_awal_belanja_modal', 'Pagu Belanja Modal AWAL (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 7, 1),
  ('08d0dd84-d3f3-4816-8965-c69389c4132b', '11111111-0009-0000-0000-000000000009', 'minggu', 'pagu_awal_rm', 'Pagu RM AWAL (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 1, 1),
  ('9855f64a-6e9f-47da-8093-ce0046cbf037', '11111111-0009-0000-0000-000000000009', 'minggu', 'pagu_awal_pnbp_blu', 'Pagu PNBP/BLU AWAL (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 4, 1),
  ('cec78fd6-8f4d-48f7-8d52-3fa9d192c7a3', '11111111-0009-0000-0000-000000000009', 'minggu', 'pagu_awal_sbsn', 'Pagu SBSN AWAL (Rp)', 'angka', NULL, NULL, 'last', NULL, 0, 0, 7, 1);

-- Label & urutan kolom anggaran lama (hanya bila labelnya masih bawaan)
UPDATE field_definitions SET label = 'Pagu Belanja Pegawai AKTIF (Rp)', urutan = 2 WHERE jenis_data_id = '11111111-0008-0000-0000-000000000008' AND level = 'minggu' AND field_key = 'pagu_belanja_pegawai' AND label = 'Pagu Belanja Pegawai (Rp)';
UPDATE field_definitions SET label = 'Realisasi Belanja Pegawai (Rp)', urutan = 3 WHERE jenis_data_id = '11111111-0008-0000-0000-000000000008' AND level = 'minggu' AND field_key = 'realisasi_belanja_pegawai' AND label = 'Realisasi Belanja Pegawai (Rp)';
UPDATE field_definitions SET label = 'Pagu Belanja Barang AKTIF (Rp)', urutan = 5 WHERE jenis_data_id = '11111111-0008-0000-0000-000000000008' AND level = 'minggu' AND field_key = 'pagu_belanja_barang' AND label = 'Pagu Belanja Barang (Rp)';
UPDATE field_definitions SET label = 'Realisasi Belanja Barang (Rp)', urutan = 6 WHERE jenis_data_id = '11111111-0008-0000-0000-000000000008' AND level = 'minggu' AND field_key = 'realisasi_belanja_barang' AND label = 'Realisasi Belanja Barang (Rp)';
UPDATE field_definitions SET label = 'Pagu Belanja Modal AKTIF (Rp)', urutan = 8 WHERE jenis_data_id = '11111111-0008-0000-0000-000000000008' AND level = 'minggu' AND field_key = 'pagu_belanja_modal' AND label = 'Pagu Belanja Modal (Rp)';
UPDATE field_definitions SET label = 'Realisasi Belanja Modal (Rp)', urutan = 9 WHERE jenis_data_id = '11111111-0008-0000-0000-000000000008' AND level = 'minggu' AND field_key = 'realisasi_belanja_modal' AND label = 'Realisasi Belanja Modal (Rp)';
UPDATE field_definitions SET label = 'Pagu RM AKTIF (Rp)', urutan = 2 WHERE jenis_data_id = '11111111-0009-0000-0000-000000000009' AND level = 'minggu' AND field_key = 'pagu_rm' AND label = 'Pagu RM (Rp)';
UPDATE field_definitions SET label = 'Realisasi RM (Rp)', urutan = 3 WHERE jenis_data_id = '11111111-0009-0000-0000-000000000009' AND level = 'minggu' AND field_key = 'realisasi_rm' AND label = 'Realisasi RM (Rp)';
UPDATE field_definitions SET label = 'Pagu PNBP/BLU AKTIF (Rp)', urutan = 5 WHERE jenis_data_id = '11111111-0009-0000-0000-000000000009' AND level = 'minggu' AND field_key = 'pagu_pnbp_blu' AND label = 'Pagu PNBP/BLU (Rp)';
UPDATE field_definitions SET label = 'Realisasi PNBP/BLU (Rp)', urutan = 6 WHERE jenis_data_id = '11111111-0009-0000-0000-000000000009' AND level = 'minggu' AND field_key = 'realisasi_pnbp_blu' AND label = 'Realisasi PNBP/BLU (Rp)';
UPDATE field_definitions SET label = 'Pagu SBSN AKTIF (Rp)', urutan = 8 WHERE jenis_data_id = '11111111-0009-0000-0000-000000000009' AND level = 'minggu' AND field_key = 'pagu_sbsn' AND label = 'Pagu SBSN (Rp)';
UPDATE field_definitions SET label = 'Realisasi SBSN (Rp)', urutan = 9 WHERE jenis_data_id = '11111111-0009-0000-0000-000000000009' AND level = 'minggu' AND field_key = 'realisasi_sbsn' AND label = 'Realisasi SBSN (Rp)';

-- Kolom data dukung jadi tipe Berkas (bisa unggah berkas ATAU tempel link); versi awal migrasi ini membuatnya teks
UPDATE field_definitions SET tipe = 'file', label = 'Data Dukung PNBP (Berkas / Link)' WHERE jenis_data_id = '11111111-0010-0000-0000-000000000010' AND level = 'minggu' AND field_key = 'link_data_dukung_pnbp' AND tipe = 'teks';
UPDATE field_definitions SET tipe = 'file', label = 'Bukti Dukung (Berkas / Link Folder Laporan Pelatihan)' WHERE jenis_data_id = '11111111-0011-0000-0000-000000000011' AND level = 'minggu' AND field_key = 'link_bukti_dukung' AND tipe = 'teks';

-- Peran di rekap: anggaran per jenis belanja & per sumber dana adalah rincian dari total yang SAMA -> hanya per jenis
-- belanja yang dihitung (pagu AKTIF + realisasi). Hanya bila perannya masih bawaan lama (belum diubah Admin).
UPDATE field_definitions SET peran_rekap = 'realisasi' WHERE jenis_data_id = '11111111-0008-0000-0000-000000000008' AND level = 'minggu' AND field_key = 'realisasi_belanja_pegawai' AND peran_rekap <=> NULL;
UPDATE field_definitions SET peran_rekap = 'realisasi' WHERE jenis_data_id = '11111111-0008-0000-0000-000000000008' AND level = 'minggu' AND field_key = 'realisasi_belanja_barang' AND peran_rekap <=> NULL;
UPDATE field_definitions SET peran_rekap = 'realisasi' WHERE jenis_data_id = '11111111-0008-0000-0000-000000000008' AND level = 'minggu' AND field_key = 'realisasi_belanja_modal' AND peran_rekap <=> NULL;
UPDATE field_definitions SET peran_rekap = NULL WHERE jenis_data_id = '11111111-0009-0000-0000-000000000009' AND level = 'minggu' AND field_key = 'pagu_rm' AND peran_rekap <=> 'pagu';
UPDATE field_definitions SET peran_rekap = NULL WHERE jenis_data_id = '11111111-0009-0000-0000-000000000009' AND level = 'minggu' AND field_key = 'pagu_pnbp_blu' AND peran_rekap <=> 'pagu';
UPDATE field_definitions SET peran_rekap = NULL WHERE jenis_data_id = '11111111-0009-0000-0000-000000000009' AND level = 'minggu' AND field_key = 'pagu_sbsn' AND peran_rekap <=> 'pagu';
