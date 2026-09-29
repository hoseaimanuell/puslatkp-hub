-- ==========================================================
-- MIGRASI 15 — Ajukan Edit Baris Disetujui (Permintaan Edit)
-- Jalankan SEKALI di phpMyAdmin pada database Puslatkp1a yang SUDAH terlanjur diimpor migrasi_10.
-- Instalasi baru dari puslatkp1a.sql terbaru tidak perlu menjalankan berkas ini.
--
-- Sebelumnya, baris rekap_nilai/data_entries yang sudah disetujui Admin hanya bisa diubah lewat
-- "Ajukan Hapus" lalu memasukkan data baru dari nol (isian lama tidak dipakai lagi). Migrasi ini
-- memakai ulang tabel permintaan_hapus untuk aksi kedua, "edit": UPT menekan tombol Edit pada baris
-- yang sudah disetujui, formnya terisi nilai lama seperti biasa, dan menyimpan mengajukan nilai baru
-- ke Admin alih-alih menulis langsung. Setelah Admin menyetujui, nilai baru itu yang dipakai dan baris
-- langsung berstatus disetujui lagi -- tidak perlu antre kedua kalinya di Persetujuan Baris Data.
-- ==========================================================
USE `Puslatkp1a`;

ALTER TABLE permintaan_hapus
  ADD COLUMN aksi VARCHAR(10) NOT NULL DEFAULT 'hapus' COMMENT 'hapus | edit' AFTER tabel,
  ADD COLUMN data_baru_json JSON NULL COMMENT 'Nilai baru yang diajukan UPT (hanya diisi saat aksi = edit)' AFTER filter_json;
