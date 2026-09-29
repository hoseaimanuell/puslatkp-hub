-- ==========================================================
-- MIGRASI 16 — Peran kolom di rekap
-- Jalankan SEKALI di phpMyAdmin pada database Puslatkp1a yang SUDAH terlanjur diimpor sebelumnya.
-- Instalasi baru dari puslatkp1a.sql terbaru tidak perlu menjalankan berkas ini.
--
-- Sebelumnya tabel rekap (Rekap UPT/Balai, Rekap Bulanan) mencari kolom bernama persis nama_pelatihan,
-- jumlah_peserta, pagu..., realisasi_anggaran untuk menghitung Pelatihan/Peserta/Pagu/Realisasi — jenis data
-- buatan Admin dengan nama kolom lain selalu tampil 0 di rekap. Kini tiap kolom punya "peran di rekap" yang
-- dipilih Admin di Kelola Jenis Data.
--
-- Kolom yang sudah ada diisi PERSIS mengikuti aturan nama lama, sehingga angka rekap tidak berubah.
-- ==========================================================
USE `Puslatkp1a`;

ALTER TABLE field_definitions
  ADD COLUMN peran_rekap VARCHAR(20) NULL COMMENT 'judul | peserta | pagu | realisasi — cara kolom ini dihitung di tabel rekap';

UPDATE field_definitions SET peran_rekap = 'judul'     WHERE field_key = 'nama_pelatihan';
UPDATE field_definitions SET peran_rekap = 'peserta'   WHERE field_key = 'jumlah_peserta';
UPDATE field_definitions SET peran_rekap = 'pagu'      WHERE peran_rekap IS NULL AND field_key LIKE '%pagu%';
UPDATE field_definitions SET peran_rekap = 'realisasi' WHERE peran_rekap IS NULL AND field_key LIKE '%realisasi\_anggaran%';
