-- ==========================================================
-- MIGRASI 09 — Kolom Pilihan dengan opsi bersyarat (tergantung kolom lain)
-- Jalankan SEKALI di phpMyAdmin pada database Puslatkp1a yang SUDAH terlanjur diimpor.
-- Instalasi baru dari puslatkp1a.sql terbaru tidak perlu menjalankan berkas ini.
--
-- Menambahkan kemampuan kolom bertipe "Pilihan" agar opsinya bisa BERBEDA tergantung nilai kolom pilihan
-- lain di baris yang sama (mis. kolom "Jenjang Jabatan" opsinya beda untuk "Jenis" = Instruktur vs Widyaiswara).
-- Dikonfigurasi lewat kolom field_definitions.opsi_bersyarat, format JSON:
--   { "depends_on": "<field_key kolom penentu>", "options": { "<nilai 1>": [...opsi...], "<nilai 2>": [...opsi...] } }
-- Kosong/NULL berarti kolom itu tetap pakai opsi_pilihan statis seperti biasa (perilaku lama tidak berubah).
--
-- Sebelum migrasi ini dijalankan aplikasi tetap berfungsi seperti biasa; hanya opsi bersyarat belum bisa dipakai.
-- ==========================================================
USE `Puslatkp1a`;

ALTER TABLE field_definitions ADD COLUMN opsi_bersyarat JSON NULL AFTER opsi_pilihan;
