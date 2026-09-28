-- ==========================================================
-- MIGRASI 14 — Tolak Baris Data (catatan penolakan Admin, terlihat UPT)
-- Jalankan SEKALI di phpMyAdmin pada database Puslatkp1a yang SUDAH terlanjur diimpor migrasi_13.
-- Instalasi baru dari puslatkp1a.sql terbaru tidak perlu menjalankan berkas ini.
--
-- Melengkapi Persetujuan Baris Data (migrasi_13): Admin sekarang bisa menekan "Tolak" pada satu baris draft,
-- bukan cuma "Setujui". Baris itu TIDAK dihapus/diubah isinya -- statusnya berubah jadi 'ditolak' dan
-- `catatan_admin` diisi alasan (opsional), terlihat UPT sebagai badge merah pada baris/entri/berkasnya. UPT
-- tetap bebas mengedit/menghapus baris 'ditolak' kapan saja (sama seperti 'draft') -- begitu disimpan ulang,
-- server otomatis mengembalikan statusnya ke 'draft' (menunggu ditinjau lagi) dan mengosongkan catatan lama.
-- ==========================================================
USE `Puslatkp1a`;

ALTER TABLE rekap_nilai
  MODIFY COLUMN status VARCHAR(10) NOT NULL DEFAULT 'draft' COMMENT 'draft | disetujui | ditolak',
  ADD COLUMN catatan_admin VARCHAR(500) NULL AFTER disetujui_by_label;

ALTER TABLE data_entries
  MODIFY COLUMN status VARCHAR(10) NOT NULL DEFAULT 'draft' COMMENT 'draft | disetujui | ditolak',
  ADD COLUMN catatan_admin VARCHAR(500) NULL AFTER disetujui_by_label;

ALTER TABLE dokumen_upload
  MODIFY COLUMN status VARCHAR(10) NOT NULL DEFAULT 'draft' COMMENT 'draft | disetujui | ditolak',
  ADD COLUMN catatan_admin VARCHAR(500) NULL AFTER disetujui_by_label;
