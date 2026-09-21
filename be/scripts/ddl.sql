-- ==========================================================
-- PUSLATKP MANAGEMENT HUB — SKEMA DATABASE MySQL "Puslatkp1a"
-- Cara pakai (phpMyAdmin): buat database Puslatkp1a
-- (utf8mb4_unicode_ci) -> tab Import -> pilih berkas ini.
-- Aman dijalankan berulang kali (CREATE ... IF NOT EXISTS).
-- ==========================================================
CREATE DATABASE IF NOT EXISTS `Puslatkp1a` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `Puslatkp1a`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- CATATAN: tabel rekap_nilai, data_entries, dokumen_upload, daily_activity memakai TEMPAT SAMPAH (kolom deleted_*):
-- data yang dihapus hanya disembunyikan 30 hari, dapat dipulihkan Admin, lalu dibuang permanen otomatis.

-- 1. UPT  (menghapus sebuah UPT ikut MENGHAPUS akun, rekap, data rincian, berkas, dan aktivitas milik UPT itu: ON DELETE CASCADE)
CREATE TABLE IF NOT EXISTS upt_list (
  `key`  VARCHAR(64)  NOT NULL,
  label  VARCHAR(150) NOT NULL,
  aktif  TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Profil / akun pengguna (menggantikan auth.users + profiles Supabase)
CREATE TABLE IF NOT EXISTS profiles (
  id            CHAR(36)     NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  `role`        ENUM('admin','upt') NOT NULL,
  upt_key       VARCHAR(64)  NULL,
  nama_lengkap  VARCHAR(150) NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_profiles_email (email),
  KEY idx_profiles_upt (upt_key),
  CONSTRAINT fk_profiles_upt FOREIGN KEY (upt_key) REFERENCES upt_list(`key`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Jenis Data (9 jenis data berpasangan mingguan/bulanan)
CREATE TABLE IF NOT EXISTS jenis_data (
  id                   CHAR(36)     NOT NULL,
  `key`                VARCHAR(120) NOT NULL,
  judul                VARCHAR(200) NOT NULL,
  deskripsi            TEXT         NULL,
  level_utama          ENUM('minggu','bulan') NOT NULL DEFAULT 'minggu',
  mode_bulanan         ENUM('rincian','agregasi','upload_file') NULL,
  butuh_input_bulanan  TINYINT(1)   NOT NULL DEFAULT 1,
  pasangan_mingguan_id CHAR(36)     NULL,
  publik_boleh_lihat   TINYINT(1)   NOT NULL DEFAULT 0,
  multi_baris          TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Mingguan: boleh >1 pelatihan/baris per minggu',
  aktif                TINYINT(1)   NOT NULL DEFAULT 1,
  dibuat_oleh          CHAR(36)     NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_jenis_data_key (`key`),
  CONSTRAINT fk_jd_pasangan FOREIGN KEY (pasangan_mingguan_id) REFERENCES jenis_data(id) ON DELETE SET NULL,
  CONSTRAINT fk_jd_dibuat   FOREIGN KEY (dibuat_oleh) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Periode (tahun / triwulan / bulan / minggu)
CREATE TABLE IF NOT EXISTS periods (
  id              CHAR(36)     NOT NULL,
  `level`         ENUM('tahun','triwulan','bulan','minggu') NOT NULL,
  tahun           SMALLINT     NOT NULL,
  triwulan_ke     TINYINT      NULL,
  bulan           TINYINT      NULL,
  minggu_ke       TINYINT      NULL,
  tanggal_mulai   DATE         NOT NULL,
  tanggal_selesai DATE         NOT NULL,
  deadline        DATE         NOT NULL,
  label           VARCHAR(100) NULL,
  PRIMARY KEY (id),
  KEY idx_periods_lookup (`level`, tahun, bulan, minggu_ke)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Form Builder: kolom per Jenis Data per level
CREATE TABLE IF NOT EXISTS field_definitions (
  id            CHAR(36)     NOT NULL,
  jenis_data_id CHAR(36)     NOT NULL,
  `level`       ENUM('tahun','triwulan','bulan','minggu') NOT NULL,
  field_key     VARCHAR(120) NOT NULL,
  label         VARCHAR(255) NOT NULL,
  tipe          ENUM('angka','teks','teks_panjang','tanggal','pilihan') NOT NULL DEFAULT 'teks',
  opsi_pilihan  JSON         NULL,
  agregasi      ENUM('sum','last','avg','max') NOT NULL DEFAULT 'sum' COMMENT 'Cara rekap bulan/triwulan/tahun dari data mingguan (last = nilai kumulatif terakhir)',
  wajib         TINYINT(1)   NOT NULL DEFAULT 0,
  is_identitas  TINYINT(1)   NOT NULL DEFAULT 0,
  urutan        INT          NOT NULL DEFAULT 0,
  aktif         TINYINT(1)   NOT NULL DEFAULT 1,
  dibuat_oleh   CHAR(36)     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_field (jenis_data_id, `level`, field_key),
  CONSTRAINT fk_fd_jd     FOREIGN KEY (jenis_data_id) REFERENCES jenis_data(id) ON DELETE CASCADE,
  CONSTRAINT fk_fd_dibuat FOREIGN KEY (dibuat_oleh) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Rekap nilai mingguan / agregat
CREATE TABLE IF NOT EXISTS rekap_nilai (
  id            CHAR(36)      NOT NULL,
  jenis_data_id CHAR(36)      NOT NULL,
  upt_key       VARCHAR(64)   NOT NULL,
  period_id     CHAR(36)      NOT NULL,
  baris_ke      SMALLINT      NOT NULL DEFAULT 1 COMMENT 'Urutan pelatihan/baris dalam satu minggu',
  field_key     VARCHAR(120)  NOT NULL,
  `value`       DECIMAL(24,4) NULL,
  value_text    TEXT          NULL,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by    CHAR(36)      NULL,
  terlambat     TINYINT(1)    NOT NULL DEFAULT 0 COMMENT 'Diisi setelah deadline periode (dicap server)',
  deleted_at    DATETIME     NULL COMMENT 'Tempat sampah: NULL = aktif',
  deleted_by    CHAR(36)     NULL,
  deleted_batch CHAR(36)     NULL COMMENT 'Satu aksi hapus = satu batch (untuk pulihkan sekaligus)',
  PRIMARY KEY (id),
  KEY idx_rekap_trash (deleted_at, deleted_batch),
  UNIQUE KEY uq_rekap (jenis_data_id, upt_key, period_id, baris_ke, field_key),
  KEY idx_rekap_period (period_id),
  KEY idx_rekap_upt (upt_key),
  CONSTRAINT fk_rn_jd     FOREIGN KEY (jenis_data_id) REFERENCES jenis_data(id) ON DELETE CASCADE,
  CONSTRAINT fk_rn_upt    FOREIGN KEY (upt_key)       REFERENCES upt_list(`key`) ON DELETE CASCADE,
  CONSTRAINT fk_rn_period FOREIGN KEY (period_id)     REFERENCES periods(id) ON DELETE CASCADE,
  CONSTRAINT fk_rn_by     FOREIGN KEY (updated_by)    REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Data detail per baris (level bulan)
CREATE TABLE IF NOT EXISTS data_entries (
  id            CHAR(36)     NOT NULL,
  jenis_data_id CHAR(36)     NOT NULL,
  upt_key       VARCHAR(64)  NOT NULL,
  period_id     CHAR(36)     NOT NULL,
  nama          VARCHAR(255) NULL,
  nik           VARCHAR(32)  NULL,
  data_json     JSON         NOT NULL,
  data_ekstra   JSON         NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    CHAR(36)     NULL,
  terlambat     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Diisi setelah deadline periode (dicap server)',
  deleted_at    DATETIME     NULL COMMENT 'Tempat sampah: NULL = aktif',
  deleted_by    CHAR(36)     NULL,
  deleted_batch CHAR(36)     NULL COMMENT 'Satu aksi hapus = satu batch (untuk pulihkan sekaligus)',
  PRIMARY KEY (id),
  KEY idx_entries_trash (deleted_at, deleted_batch),
  UNIQUE KEY uq_entry (jenis_data_id, upt_key, period_id, nik),
  KEY idx_entries_period (period_id),
  KEY idx_entries_upt (upt_key),
  CONSTRAINT fk_de_jd     FOREIGN KEY (jenis_data_id) REFERENCES jenis_data(id) ON DELETE CASCADE,
  CONSTRAINT fk_de_upt    FOREIGN KEY (upt_key)       REFERENCES upt_list(`key`) ON DELETE CASCADE,
  CONSTRAINT fk_de_period FOREIGN KEY (period_id)     REFERENCES periods(id) ON DELETE CASCADE,
  CONSTRAINT fk_de_by     FOREIGN KEY (created_by)    REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Dokumen bulanan (mode upload_file)
CREATE TABLE IF NOT EXISTS dokumen_upload (
  id            CHAR(36)     NOT NULL,
  jenis_data_id CHAR(36)     NOT NULL,
  period_id     CHAR(36)     NOT NULL,
  upt_key       VARCHAR(64)  NOT NULL,
  judul         VARCHAR(255) NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  file_size     BIGINT       NULL,
  file_ext      VARCHAR(20)  NULL,
  file_type     VARCHAR(150) NULL,
  file_data     LONGTEXT     NULL COMMENT 'Data URL base64 berkas',
  catatan       TEXT         NULL,
  uploaded_by   VARCHAR(150) NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  terlambat     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Diisi setelah deadline periode (dicap server)',
  deleted_at    DATETIME     NULL COMMENT 'Tempat sampah: NULL = aktif',
  deleted_by    CHAR(36)     NULL,
  deleted_batch CHAR(36)     NULL COMMENT 'Satu aksi hapus = satu batch (untuk pulihkan sekaligus)',
  PRIMARY KEY (id),
  KEY idx_du_trash (deleted_at, deleted_batch),
  KEY idx_du_lookup (jenis_data_id, period_id, upt_key),
  CONSTRAINT fk_du_jd     FOREIGN KEY (jenis_data_id) REFERENCES jenis_data(id) ON DELETE CASCADE,
  CONSTRAINT fk_du_period FOREIGN KEY (period_id)     REFERENCES periods(id) ON DELETE CASCADE,
  CONSTRAINT fk_du_upt    FOREIGN KEY (upt_key)       REFERENCES upt_list(`key`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Daily activity
CREATE TABLE IF NOT EXISTS daily_activity (
  id                  CHAR(36)    NOT NULL,
  upt_key             VARCHAR(64) NOT NULL,
  tanggal             DATE        NOT NULL,
  `status`            ENUM('draft','proses','selesai') NOT NULL DEFAULT 'draft',
  uraian              TEXT        NULL,
  pic                 JSON        NULL,
  deskripsi           TEXT        NULL,
  lingkup             ENUM('internal_puslat','internal_kkp','internal_eksternal','eksternal') NULL,
  `output`            TEXT        NULL,
  foto_url            TEXT        NULL,
  dokumen_url         TEXT        NULL,
  hambatan            TINYINT(1)  NOT NULL DEFAULT 0,
  hambatan_keterangan TEXT        NULL,
  interaksi           TEXT        NULL,
  feedback            TEXT        NULL,
  created_at          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME     NULL COMMENT 'Tempat sampah: NULL = aktif',
  deleted_by CHAR(36)     NULL,
  deleted_batch CHAR(36)     NULL COMMENT 'Satu aksi hapus = satu batch (untuk pulihkan sekaligus)',
  PRIMARY KEY (id),
  KEY idx_daily_trash (deleted_at, deleted_batch),
  KEY idx_daily_upt_tgl (upt_key, tanggal),
  CONSTRAINT fk_da_upt FOREIGN KEY (upt_key) REFERENCES upt_list(`key`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id            CHAR(36)     NOT NULL,
  actor_id      CHAR(36)     NULL,
  actor_upt_key VARCHAR(64)  NULL,
  action        VARCHAR(120) NOT NULL,
  detail        JSON         NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_al_actor FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Arsip data historis (berkas Excel/PDF apa adanya; isi berkas disimpan di folder storage, bukan di database)
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

-- 12. Pengaturan Dashboard
-- Pengaturan isi Dashboard (kartu & grafik) — diatur Admin lewat menu Kelola Dashboard
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id           CHAR(36)     NOT NULL,
  tipe         VARCHAR(20)  NOT NULL COMMENT 'kartu | grafik',
  judul        VARCHAR(190) NOT NULL,
  grup         VARCHAR(190) NOT NULL DEFAULT 'Ringkasan' COMMENT 'Judul bagian tempat widget ditampilkan',
  gaya         VARCHAR(20)  NOT NULL DEFAULT 'berwarna' COMMENT 'berwarna | putih (kartu)',
  ikon         VARCHAR(40)  NULL,
  warna        VARCHAR(40)  NULL,
  satuan       VARCHAR(20)  NOT NULL DEFAULT 'angka' COMMENT 'angka | rupiah',
  konfigurasi  JSON         NULL COMMENT 'Sumber data: items [{jd, field}], pembanding, series, sorot',
  urutan       INT          NOT NULL DEFAULT 0,
  aktif        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_dashboard_urutan (urutan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. View publik (agregat saja, tanpa data pribadi)
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

SET FOREIGN_KEY_CHECKS = 1;

