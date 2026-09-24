-- ==========================================================
-- MIGRASI 12 — Status Draft/Disetujui pada Kirim & Kunci Data
-- Jalankan SEKALI di phpMyAdmin pada database Puslatkp1a yang SUDAH terlanjur diimpor migrasi_11.
-- Instalasi baru dari puslatkp1a.sql terbaru tidak perlu menjalankan berkas ini.
--
-- Sebelumnya (migrasi_11) menekan "Kirim & Kunci" LANGSUNG mengunci data — Admin hanya berperan menyetujui
-- permintaan BUKA KUNCI, tidak pernah menyetujui data itu sendiri. Migrasi ini mengubah alurnya:
--   1. UPT menekan "Kirim" -> status DRAFT (baris permintaan_hapus/kunci baru, TAPI belum mengunci apa pun;
--      UPT masih bebas mengedit/menghapus/membatalkan kirim selagi draft).
--   2. Admin meninjau lalu menyetujui (menu Permintaan) -> status DISETUJUI -> BARU SAAT INI data terkunci.
--   3. Selagi masih disetujui, UPT butuh persetujuan Admin lagi untuk edit/hapus (mekanisme "Ajukan Buka Kunci"
--      dari migrasi_11 tetap dipakai persis sama, hanya sekarang berlaku setelah status disetujui).
-- Sebelum migrasi ini dijalankan, tombol Kirim & Kunci tetap berperilaku seperti migrasi_11 (langsung mengunci).
-- ==========================================================
USE `Puslatkp1a`;

ALTER TABLE periode_kirim
  ADD COLUMN status              VARCHAR(10)  NOT NULL DEFAULT 'draft' COMMENT 'draft | disetujui' AFTER period_id,
  ADD COLUMN disetujui_at        DATETIME     NULL AFTER terkirim_by_label,
  ADD COLUMN disetujui_by        CHAR(36)     NULL AFTER disetujui_at,
  ADD COLUMN disetujui_by_label  VARCHAR(190) NULL AFTER disetujui_by,
  ADD KEY idx_periode_kirim_status (status),
  ADD CONSTRAINT fk_pk_disetujui_by FOREIGN KEY (disetujui_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Baris yang sudah ada sebelum migrasi ini (dibuat semasa "Kirim & Kunci" = langsung mengunci) dianggap sudah
-- disetujui, supaya perilakunya tidak berubah tiba-tiba jadi terbuka.
UPDATE periode_kirim SET status = 'disetujui', disetujui_at = terkirim_at WHERE deleted_at IS NULL;
