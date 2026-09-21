-- ==========================================================
-- MIGRASI 02 — Tempat Sampah (soft delete) + view publik yang mengabaikan data terhapus
-- Jalankan SEKALI di phpMyAdmin pada database Puslatkp1a yang SUDAH terlanjur diimpor.
-- Instalasi baru dari puslatkp1a.sql terbaru tidak perlu menjalankan berkas ini.
--
-- Efek: data yang dihapus dari tabel rekap_nilai, data_entries, dokumen_upload, dan daily_activity
-- tidak langsung hilang; ia disembunyikan (deleted_at terisi), dapat dipulihkan Admin, lalu dibuang
-- permanen otomatis setelah 30 hari (TRASH_RETENTION_DAYS di be/.env).
--
-- Sebelum migrasi ini dijalankan, backend tetap berfungsi tetapi penghapusan bersifat permanen.
-- ==========================================================
USE `Puslatkp1a`;

ALTER TABLE rekap_nilai
  ADD COLUMN deleted_at    DATETIME NULL COMMENT 'Tempat sampah: NULL = aktif',
  ADD COLUMN deleted_by    CHAR(36) NULL,
  ADD COLUMN deleted_batch CHAR(36) NULL COMMENT 'Satu aksi hapus = satu batch (untuk pulihkan sekaligus)',
  ADD KEY idx_rekap_trash (deleted_at, deleted_batch);

ALTER TABLE data_entries
  ADD COLUMN deleted_at    DATETIME NULL COMMENT 'Tempat sampah: NULL = aktif',
  ADD COLUMN deleted_by    CHAR(36) NULL,
  ADD COLUMN deleted_batch CHAR(36) NULL COMMENT 'Satu aksi hapus = satu batch (untuk pulihkan sekaligus)',
  ADD KEY idx_entries_trash (deleted_at, deleted_batch);

ALTER TABLE dokumen_upload
  ADD COLUMN deleted_at    DATETIME NULL COMMENT 'Tempat sampah: NULL = aktif',
  ADD COLUMN deleted_by    CHAR(36) NULL,
  ADD COLUMN deleted_batch CHAR(36) NULL COMMENT 'Satu aksi hapus = satu batch (untuk pulihkan sekaligus)',
  ADD KEY idx_du_trash (deleted_at, deleted_batch);

ALTER TABLE daily_activity
  ADD COLUMN deleted_at    DATETIME NULL COMMENT 'Tempat sampah: NULL = aktif',
  ADD COLUMN deleted_by    CHAR(36) NULL,
  ADD COLUMN deleted_batch CHAR(36) NULL COMMENT 'Satu aksi hapus = satu batch (untuk pulihkan sekaligus)',
  ADD KEY idx_daily_trash (deleted_at, deleted_batch);

-- View publik: jangan hitung data yang ada di tempat sampah
CREATE OR REPLACE VIEW v_publik_rekap AS
SELECT
  de.jenis_data_id,
  jd.judul AS jenis_data_judul,
  de.period_id,
  p.label  AS period_label,
  p.`level` AS `level`,
  p.tahun,
  p.bulan,
  COUNT(*) AS total_baris
FROM data_entries de
JOIN jenis_data jd ON jd.id = de.jenis_data_id
JOIN periods p     ON p.id  = de.period_id
WHERE jd.publik_boleh_lihat = 1 AND jd.aktif = 1 AND de.deleted_at IS NULL
GROUP BY de.jenis_data_id, jd.judul, de.period_id, p.label, p.`level`, p.tahun, p.bulan;
