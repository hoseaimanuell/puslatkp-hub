-- ==========================================================
-- MIGRASI 06 — Kolom bertipe "Berkas" (mis. Link Laporan Pelatihan diganti unggah berkas)
-- Jalankan SEKALI di phpMyAdmin pada database Puslatkp1a yang SUDAH terlanjur diimpor.
-- Instalasi baru dari puslatkp1a.sql terbaru tidak perlu menjalankan berkas ini.
--
-- Menambahkan pilihan tipe kolom "Berkas" di Kelola Jenis Data: UPT mengunggah PDF/Word/Excel
-- (maks. 10 MB) langsung dari form, bukan lagi mengetik link. Isi berkas disimpan di folder
-- be/storage/field-files (bukan di database) — sertakan folder itu dalam backup.
--
-- Sebelum migrasi ini dijalankan aplikasi tetap berfungsi seperti biasa; hanya tipe kolom "Berkas"
-- belum bisa dipilih di Kelola Jenis Data.
-- ==========================================================
USE `Puslatkp1a`;

ALTER TABLE field_definitions MODIFY COLUMN tipe ENUM('angka','teks','teks_panjang','tanggal','pilihan','file') NOT NULL DEFAULT 'teks';

CREATE TABLE IF NOT EXISTS field_files (
  id                CHAR(36)     NOT NULL,
  upt_key           VARCHAR(64)  NOT NULL,
  jenis_data_id     CHAR(36)     NOT NULL,
  field_key         VARCHAR(120) NOT NULL,
  file_name         VARCHAR(255) NOT NULL,
  file_ext          VARCHAR(10)  NOT NULL,
  file_size         BIGINT       NOT NULL,
  storage_key       VARCHAR(80)  NOT NULL COMMENT 'Nama berkas di folder storage/field-files',
  uploaded_by       CHAR(36)     NULL,
  uploaded_by_label VARCHAR(190) NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_field_files_scope (jenis_data_id, field_key, upt_key),
  CONSTRAINT fk_ff_upt FOREIGN KEY (upt_key)       REFERENCES upt_list(`key`) ON DELETE CASCADE,
  CONSTRAINT fk_ff_jd  FOREIGN KEY (jenis_data_id) REFERENCES jenis_data(id)   ON DELETE CASCADE,
  CONSTRAINT fk_ff_by  FOREIGN KEY (uploaded_by)   REFERENCES profiles(id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
