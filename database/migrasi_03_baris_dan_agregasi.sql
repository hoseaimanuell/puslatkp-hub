-- ==========================================================
-- MIGRASI 03 — Beberapa pelatihan per minggu + cara rekap kumulatif
-- Jalankan SEKALI di phpMyAdmin pada database Puslatkp1a yang SUDAH terlanjur diimpor.
-- Instalasi baru dari puslatkp1a.sql terbaru tidak perlu menjalankan berkas ini.
--
-- 1) rekap_nilai.baris_ke   : satu minggu boleh berisi lebih dari 1 pelatihan/baris (bawaan = 1)
-- 2) jenis_data.multi_baris : jenis data mana yang menampilkan tombol "Tambah pelatihan lain"
-- 3) field_definitions.agregasi : cara rekap bulan/triwulan/tahun per kolom angka
--      sum  = dijumlahkan | last = NILAI TERAKHIR (untuk angka kumulatif) | avg = rata-rata | max = maksimum
--    Pagu, realisasi, dan jumlah SDM diset 'last' karena bersifat kumulatif.
--
-- Sebelum migrasi ini dijalankan, aplikasi tetap berfungsi (1 baris per minggu; pagu/realisasi/SDM
-- otomatis diperlakukan kumulatif oleh tampilan berdasarkan nama kolomnya).
-- ==========================================================
USE `Puslatkp1a`;

ALTER TABLE jenis_data
  ADD COLUMN multi_baris TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Mingguan: boleh >1 pelatihan/baris per minggu' AFTER publik_boleh_lihat;

ALTER TABLE field_definitions
  ADD COLUMN agregasi ENUM('sum','last','avg','max') NOT NULL DEFAULT 'sum'
    COMMENT 'Cara rekap bulan/triwulan/tahun dari data mingguan (last = nilai kumulatif terakhir)' AFTER opsi_pilihan;

ALTER TABLE rekap_nilai
  ADD COLUMN baris_ke SMALLINT NOT NULL DEFAULT 1 COMMENT 'Urutan pelatihan/baris dalam satu minggu' AFTER period_id,
  DROP INDEX uq_rekap,
  ADD UNIQUE KEY uq_rekap (jenis_data_id, upt_key, period_id, baris_ke, field_key);

-- Jenis data bertipe daftar pelatihan: boleh lebih dari 1 baris per minggu
UPDATE jenis_data SET multi_baris = 1 WHERE `key` IN ('masyarakat', 'aparatur', 'data_belanja_modal');

-- Kolom kumulatif: pagu, realisasi (termasuk realisasi fisik), dan jumlah SDM/volume -> nilai terakhir
UPDATE field_definitions
   SET agregasi = 'last'
 WHERE `level` = 'minggu' AND tipe = 'angka'
   AND (field_key LIKE 'pagu%' OR field_key LIKE 'realisasi%'
        OR field_key IN ('jumlah_instruktur_wi', 'instruktur_berdasarkan_keahlian', 'widyaiswara_berdasarkan_keahlian', 'volume'));
