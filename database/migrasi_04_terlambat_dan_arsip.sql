-- ==========================================================
-- MIGRASI 04 — Penanda "terlambat" (deadline tidak lagi mengunci) + Arsip Data Historis
-- Jalankan SEKALI di phpMyAdmin pada database Puslatkp1a yang SUDAH terlanjur diimpor.
-- Instalasi baru dari puslatkp1a.sql terbaru tidak perlu menjalankan berkas ini.
--
-- 1) rekap_nilai / data_entries / dokumen_upload.terlambat
--    Data yang disimpan akun UPT SETELAH deadline periode tetap diterima, tetapi ditandai terlambat (merah).
--    Baris lama tidak ditandai (waktu pengisian aslinya tidak tercatat).
-- 2) arsip_historis
--    Metadata berkas Excel/PDF data tahun-tahun lalu. Isi berkas disimpan di folder be/storage/arsip
--    (bukan di database) — sertakan folder itu dalam backup.
--
-- Sebelum migrasi ini dijalankan aplikasi tetap berfungsi: deadline sudah tidak mengunci, tetapi penandaan
-- terlambat dan Arsip Historis belum aktif.
-- ==========================================================
USE `Puslatkp1a`;

ALTER TABLE rekap_nilai    ADD COLUMN terlambat TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Diisi setelah deadline periode (dicap server)' AFTER updated_by;
ALTER TABLE data_entries   ADD COLUMN terlambat TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Diisi setelah deadline periode (dicap server)' AFTER created_by;
ALTER TABLE dokumen_upload ADD COLUMN terlambat TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Diisi setelah deadline periode (dicap server)' AFTER created_at;

-- Arsip data historis (berkas Excel/PDF apa adanya; isi berkas disimpan di folder storage, bukan di database)
CREATE TABLE IF NOT EXISTS arsip_historis (
  id                CHAR(36)     NOT NULL,
  upt_key           VARCHAR(64)  NULL COMMENT 'NULL = arsip pusat/seluruh UPT (hanya terlihat Admin)',
  tahun             SMALLINT     NOT NULL,
  jenis_data_id     CHAR(36)     NULL,
  judul             VARCHAR(255) NOT NULL,
  catatan           TEXT         NULL,
  file_name         VARCHAR(255) NOT NULL,
  file_ext          VARCHAR(10)  NOT NULL,
  file_size         BIGINT       NOT NULL,
  storage_key       VARCHAR(80)  NOT NULL COMMENT 'Nama berkas di folder storage/arsip',
  uploaded_by       CHAR(36)     NULL,
  uploaded_by_label VARCHAR(190) NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at        DATETIME     NULL COMMENT 'Tempat sampah: NULL = aktif',
  deleted_by        CHAR(36)     NULL,
  deleted_batch     CHAR(36)     NULL,
  PRIMARY KEY (id),
  KEY idx_arsip_tahun (tahun, upt_key),
  KEY idx_arsip_trash (deleted_at, deleted_batch),
  CONSTRAINT fk_arsip_upt FOREIGN KEY (upt_key)       REFERENCES upt_list(`key`) ON DELETE CASCADE,
  CONSTRAINT fk_arsip_jd  FOREIGN KEY (jenis_data_id) REFERENCES jenis_data(id)   ON DELETE SET NULL,
  CONSTRAINT fk_arsip_by  FOREIGN KEY (uploaded_by)   REFERENCES profiles(id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

