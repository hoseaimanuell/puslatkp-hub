-- ==========================================================
-- MIGRASI 07 — Jenis Data Bulanan "Kumulatif" (bulan terbaru menggantikan bulan sebelumnya)
-- Jalankan SEKALI di phpMyAdmin pada database Puslatkp1a yang SUDAH terlanjur diimpor.
-- Instalasi baru dari puslatkp1a.sql terbaru tidak perlu menjalankan berkas ini.
--
-- Menambahkan toggle "Data kumulatif" di Kelola Jenis Data untuk jenis data bulanan bertipe
-- "Per nama" (rincian): UPT diharapkan mengunggah roster LENGKAP tiap bulan (bukan hanya
-- perubahan), dan bulan-bulan tetap tersimpan terpisah seperti biasa — yang berubah hanya
-- tampilan/rekap: secara bawaan akan menonjolkan bulan TERAKHIR yang sudah ada datanya sebagai
-- "data saat ini", bukan selalu bulan kalender berjalan.
--
-- Sebelum migrasi ini dijalankan aplikasi tetap berfungsi seperti biasa; hanya toggle "Data
-- kumulatif" belum muncul di Kelola Jenis Data (dianggap tidak kumulatif untuk semua jenis data).
-- ==========================================================
USE `Puslatkp1a`;

ALTER TABLE jenis_data ADD COLUMN kumulatif_bulanan TINYINT(1) NOT NULL DEFAULT 0 AFTER multi_baris;
