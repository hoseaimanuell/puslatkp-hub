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


-- ==========================================================
-- DATA MASTER — UPT
-- ==========================================================
INSERT INTO `upt_list` (`key`, `label`, `aktif`) VALUES
  ('upt_jakarta', 'BPPP Jakarta', 1),
  ('upt_medan', 'BPPP Medan', 1),
  ('upt_banyuwangi', 'BPPP Banyuwangi', 1),
  ('upt_tegal', 'BPPP Tegal', 1),
  ('upt_bitung', 'BPPP Bitung', 1),
  ('upt_ambon', 'BPPP Ambon', 1),
  ('upt_padang', 'BPPP Padang', 1),
  ('upt_pontianak', 'BPPP Pontianak', 1),
  ('upt_makassar', 'BPPP Makassar', 1),
  ('upt_sorong', 'BPPP Sorong', 1)
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`), `aktif` = VALUES(`aktif`);

-- ==========================================================
-- AKUN AWAL (password di-hash bcrypt; lihat docs/05-akun-dan-keamanan.md)
-- ==========================================================
INSERT IGNORE INTO `profiles` (`id`, `email`, `password_hash`, `role`, `upt_key`, `nama_lengkap`, `created_at`) VALUES
  ('0d0fcaf3-78a1-4ee0-8446-9a5c81167ffd', 'admin@puslatkp.kkp.go.id', '$2b$10$hzGtVtj.X/8Y/voOlfELVOIQkbN1b6RmrW6bYi1eWgpKBHiZcEJGS', 'admin', NULL, 'Admin PUSLATKP', '2026-01-01 00:00:00'),
  ('9802d06b-f2a0-4f6c-82e8-940d7e13a1df', 'bppp.jakarta@kkp.go.id', '$2b$10$ezbGxTj6mWFNjiTeSMgMdewFb/Kduj2Ob5bi6KoX6TuiebBGfMr7G', 'upt', 'upt_jakarta', 'BPPP Jakarta', '2026-01-01 00:00:00'),
  ('d5ae756b-5036-45bd-8f57-a22ae970b179', 'bppp.medan@kkp.go.id', '$2b$10$t0Y9tpDCOX3wtxaPLXMK7.TDk2M1FqDF9y.mHtajC6QJLFIwCWKwa', 'upt', 'upt_medan', 'BPPP Medan', '2026-01-01 00:00:00'),
  ('cb80a328-398c-4339-8e9b-a7c27db00701', 'bppp.banyuwangi@kkp.go.id', '$2b$10$XNwPoUDIT9BXVZr/.TYYeerx7MGGgJOezWAhTfu4aSJk1yGtEIrPS', 'upt', 'upt_banyuwangi', 'BPPP Banyuwangi', '2026-01-01 00:00:00'),
  ('1d1c82c1-cc51-4431-8f3b-69487d0fc662', 'bppp.tegal@kkp.go.id', '$2b$10$2Lfe7lgqTwcdVtTqVOxSHekj3CEmLlCh4Z/9ESsrQpEJvLOxhk3Py', 'upt', 'upt_tegal', 'BPPP Tegal', '2026-01-01 00:00:00'),
  ('66bcf275-7c59-45d7-8cc6-942667bcdfdf', 'bppp.bitung@kkp.go.id', '$2b$10$53fq5qZpoUZY0uxZAfE8kuRcpuvQWOTEigmWSjbBFHclYG4gwgTXy', 'upt', 'upt_bitung', 'BPPP Bitung', '2026-01-01 00:00:00'),
  ('e8a1fe30-d2fe-47ee-85fd-429f76d696a7', 'bppp.ambon@kkp.go.id', '$2b$10$7wSsWsuLki8rap/Ido5Pvu8LMEBOTaG2kO9.JV9TB2s.VKAnA4ZX6', 'upt', 'upt_ambon', 'BPPP Ambon', '2026-01-01 00:00:00'),
  ('050b142e-809a-4212-800c-b90b91584fbd', 'bppp.padang@kkp.go.id', '$2b$10$vDibNjvKIcsjwgiaxdKXieOsphLFhGwg6Na4lfGPqlkhp/SHFsP16', 'upt', 'upt_padang', 'BPPP Padang', '2026-01-01 00:00:00'),
  ('1357883c-c49d-4d5b-8c58-573713f9505d', 'bppp.pontianak@kkp.go.id', '$2b$10$kACOJK6z1tD7BPxO37RPve110/LHPPIGLIK7XLYA1VJhNuhPJMUWq', 'upt', 'upt_pontianak', 'BPPP Pontianak', '2026-01-01 00:00:00'),
  ('9a8aa809-b18e-48cb-86d8-fb903f4fa692', 'bppp.makassar@kkp.go.id', '$2b$10$5m0/w2mCeaIEejplpO70k.ZbfzRpMruf3B1XNN/T4.EiGSxlq6FAW', 'upt', 'upt_makassar', 'BPPP Makassar', '2026-01-01 00:00:00'),
  ('f380f850-fc65-4d66-817b-8f55abf1f172', 'bppp.sorong@kkp.go.id', '$2b$10$rOrvewRRtpczMfkQLkcNIejINExb8kJQz7nJFRUQ0rW6bnw2kzjCi', 'upt', 'upt_sorong', 'BPPP Sorong', '2026-01-01 00:00:00');

-- ==========================================================
-- DATA MASTER — 9 JENIS DATA
-- ==========================================================
INSERT IGNORE INTO `jenis_data` (`id`, `key`, `judul`, `deskripsi`, `level_utama`, `mode_bulanan`, `butuh_input_bulanan`, `pasangan_mingguan_id`, `publik_boleh_lihat`, `multi_baris`, `aktif`) VALUES
  ('11111111-0001-0000-0000-000000000001', 'masyarakat', 'Masyarakat', 'Data mingguan pelatihan masyarakat: pagu, realisasi anggaran, jumlah peserta, dan metode.', 'minggu', NULL, 0, NULL, 1, 1, 1),
  ('11111111-0003-0000-0000-000000000003', 'aparatur', 'Aparatur', 'Data mingguan pelatihan aparatur: kategori diklat, jumlah peserta, pagu, realisasi, dan metode.', 'minggu', NULL, 0, NULL, 1, 1, 1),
  ('11111111-0005-0000-0000-000000000005', 'data_instruktur_dan_wi', 'Data Instruktur dan WI', 'Data mingguan instruktur dan widyaiswara berdasarkan jenjang jabatan dan keahlian.', 'minggu', NULL, 0, NULL, 1, 0, 1),
  ('11111111-0006-0000-0000-000000000006', 'data_instruktur_dan_widyaiswara', 'Data Instruktur dan Widyaiswara', 'Laporan bulanan tenaga pendidik instruktur dan widyaiswara — upload file PDF/Excel dari UPT.', 'bulan', 'upload_file', 0, NULL, 1, 0, 1),
  ('11111111-0007-0000-0000-000000000007', 'data_belanja_modal', 'Data Belanja Modal', 'Data mingguan belanja modal: volume, realisasi anggaran, realisasi fisik, progress, dan hambatan.', 'minggu', NULL, 0, NULL, 0, 1, 1),
  ('11111111-0008-0000-0000-000000000008', 'data_capaian_anggaran_per_jenis_belanja', 'Data Capaian Anggaran per Jenis Belanja', 'Data mingguan pagu & realisasi belanja pegawai, belanja barang, dan belanja modal.', 'minggu', NULL, 0, NULL, 0, 0, 1),
  ('11111111-0009-0000-0000-000000000009', 'data_capaian_anggaran_per_sumber_dana', 'Data Capaian Anggaran per Sumber Dana', 'Data mingguan pagu & realisasi sumber dana RM, PNBP/BLU, dan SBSN.', 'minggu', NULL, 0, NULL, 0, 0, 1),
  ('11111111-0002-0000-0000-000000000002', 'data_masyarakat', 'Data Masyarakat', 'Rekap bulanan peserta pelatihan masyarakat — dihitung otomatis dari gabungan data Minggu 1–4.', 'bulan', 'rincian', 1, '11111111-0001-0000-0000-000000000001', 1, 0, 1),
  ('11111111-0004-0000-0000-000000000004', 'data_aparatur', 'Data Aparatur', 'Rekap bulanan aparatur peserta pelatihan — dihitung otomatis dari gabungan data Minggu 1–4.', 'bulan', 'rincian', 1, '11111111-0003-0000-0000-000000000003', 1, 0, 1);

-- ==========================================================
-- DATA MASTER — DEFINISI KOLOM (FORM BUILDER)
-- ==========================================================
INSERT IGNORE INTO `field_definitions` (`id`, `jenis_data_id`, `level`, `field_key`, `label`, `tipe`, `opsi_pilihan`, `agregasi`, `wajib`, `is_identitas`, `urutan`, `aktif`) VALUES
  ('c85c402d-e8a0-4c8b-8ae2-ef22f9ba0d0d', '11111111-0001-0000-0000-000000000001', 'minggu', 'nama_pelatihan', 'Nama Pelatihan/Judul Pelatihan', 'teks', NULL, 'sum', 1, 0, 1, 1),
  ('5a5ca0d3-81f2-4f14-81a1-cce375082b9c', '11111111-0001-0000-0000-000000000001', 'minggu', 'jumlah_peserta', 'Jumlah Peserta', 'angka', NULL, 'sum', 1, 0, 2, 1),
  ('ea9f67e6-8053-4d4c-895f-719f26968bb0', '11111111-0001-0000-0000-000000000001', 'minggu', 'tanggal_pelatihan', 'Tanggal Pelatihan', 'tanggal', NULL, 'sum', 0, 0, 3, 1),
  ('5c833b18-d1e5-4d69-8067-e5e10a836415', '11111111-0001-0000-0000-000000000001', 'minggu', 'pagu_anggaran', 'Pagu Anggaran (Rp)', 'angka', NULL, 'last', 0, 0, 4, 1),
  ('a2d6bee4-0680-4c7c-8d4a-af7091723233', '11111111-0001-0000-0000-000000000001', 'minggu', 'realisasi_anggaran', 'Realisasi Anggaran (Rp)', 'angka', NULL, 'last', 0, 0, 5, 1),
  ('6cf29338-d3bf-4c3b-8b59-21dbc8d65069', '11111111-0001-0000-0000-000000000001', 'minggu', 'sumber_dana', 'Sumber Dana', 'pilihan', '[\"RM\",\"PNBP\",\"BLU\",\"SBSN\"]', 'sum', 0, 0, 6, 1),
  ('1424433f-a02e-4b3b-8305-c3df9b7f3da9', '11111111-0001-0000-0000-000000000001', 'minggu', 'bidang_kompetensi', 'Bidang Kompetensi (Sesuai E-Laut)', 'pilihan', '[\"Kepelautan\",\"Penangkapan Ikan\",\"Permesinan Kapal\",\"Budidaya Perikanan\",\"Pengolahan Hasil Perikanan\",\"Konservasi Perairan\",\"Sosial Ekonomi KP\"]', 'sum', 0, 0, 7, 1),
  ('b22a3514-702f-403a-8da3-6cc87c156cbb', '11111111-0001-0000-0000-000000000001', 'minggu', 'program_prioritas', 'Program Prioritas', 'pilihan', '[\"Ekonomi Biru 1 (Konservasi)\",\"Ekonomi Biru 2 (Penangkapan Terukur)\",\"Ekonomi Biru 3 (Budidaya Berkelanjutan)\",\"Ekonomi Biru 4 (Pengawasan Wilayah)\",\"Ekonomi Biru 5 (Pembersihan Sampah Plastik Laut)\"]', 'sum', 0, 0, 8, 1),
  ('cdb4fe55-c013-457c-86a0-6e928c01eb79', '11111111-0001-0000-0000-000000000001', 'minggu', 'metode_pelatihan', 'Metode Pelatihan', 'pilihan', '[\"Luring\",\"Blended\",\"Full Online\"]', 'sum', 0, 0, 9, 1),
  ('654db731-a6eb-4ba3-88af-42970dc4e79e', '11111111-0001-0000-0000-000000000001', 'minggu', 'link_laporan_pelatihan', 'Link Laporan Pelatihan', 'teks', NULL, 'sum', 0, 0, 10, 1),
  ('459bb81b-362e-4bc5-8bfc-7262135b78ca', '11111111-0002-0000-0000-000000000002', 'bulan', 'no_urut', 'No', 'teks', NULL, 'sum', 0, 0, 1, 1),
  ('5df74d33-bb61-45d0-8df4-55adf76d9249', '11111111-0002-0000-0000-000000000002', 'bulan', 'penyelenggara_pelatihan', 'Penyelenggara Pelatihan', 'teks', NULL, 'sum', 0, 0, 2, 1),
  ('a69168db-73c2-4923-8fa5-7b5cde073adf', '11111111-0002-0000-0000-000000000002', 'bulan', 'nama', 'Nama Lulusan Pelatihan', 'teks', NULL, 'sum', 1, 1, 3, 1),
  ('5a4e65f5-4168-4af5-8ae4-c631e04651c0', '11111111-0002-0000-0000-000000000002', 'bulan', 'nik', 'NIK', 'teks', NULL, 'sum', 1, 1, 4, 1),
  ('8ec967b6-91b9-4a6e-86bf-f16e153eb845', '11111111-0002-0000-0000-000000000002', 'bulan', 'tempat_lahir', 'Tempat Lahir', 'teks', NULL, 'sum', 0, 0, 5, 1),
  ('aca24494-05ec-4226-83a0-10813dbdd125', '11111111-0002-0000-0000-000000000002', 'bulan', 'tanggal_lahir', 'Tanggal Lahir', 'tanggal', NULL, 'sum', 0, 0, 6, 1),
  ('21157569-6805-4702-89f1-912e5469afd4', '11111111-0002-0000-0000-000000000002', 'bulan', 'jenis_kelamin', 'Jenis Kelamin (L/P)', 'pilihan', '[\"Laki-laki\",\"Perempuan\"]', 'sum', 0, 0, 7, 1),
  ('67296a6d-b7bd-4213-8608-5e4a96b26a98', '11111111-0002-0000-0000-000000000002', 'bulan', 'pendidikan_terakhir', 'Pendidikan Terakhir', 'pilihan', '[\"SD\",\"SMP\",\"SMA/SMK\",\"D1\",\"D2\",\"D3\",\"D4/S1\",\"S2\",\"S3\"]', 'sum', 0, 0, 8, 1),
  ('de5cf510-47e8-4a1b-82e1-a4bf16494386', '11111111-0002-0000-0000-000000000002', 'bulan', 'no_telepon', 'Nomor Tlp.', 'teks', NULL, 'sum', 0, 1, 9, 1),
  ('36564bee-324e-4f08-8b44-61245aabc002', '11111111-0002-0000-0000-000000000002', 'bulan', 'alamat', 'Alamat', 'teks', NULL, 'sum', 0, 1, 10, 1),
  ('b9153387-4f6f-4d71-802f-0599534e0175', '11111111-0002-0000-0000-000000000002', 'bulan', 'provinsi', 'Provinsi', 'teks', NULL, 'sum', 0, 0, 11, 1),
  ('43f2ab37-5daa-4915-8abc-07e092028b9b', '11111111-0002-0000-0000-000000000002', 'bulan', 'kab_kota', 'Kab/Kota', 'teks', NULL, 'sum', 0, 0, 12, 1),
  ('7d91ffd7-91c8-4561-8e92-51a0ed8febeb', '11111111-0002-0000-0000-000000000002', 'bulan', 'bidang_pelatihan', 'Bidang Pelatihan', 'teks', NULL, 'sum', 0, 0, 13, 1),
  ('9c3f05c2-28e0-4b17-80bd-e8a0393a55a1', '11111111-0002-0000-0000-000000000002', 'bulan', 'jenis_pelatihan_dukungan_program_terobosan', 'Jenis Pelatihan Dukungan Program Terobosan', 'teks', NULL, 'sum', 0, 0, 14, 1),
  ('48bafae6-dd6e-420e-890c-4710899cf6f3', '11111111-0002-0000-0000-000000000002', 'bulan', 'nama_pelatihan', 'Nama Pelatihan', 'teks', NULL, 'sum', 1, 0, 15, 1),
  ('d5373366-f32a-4b75-822a-91485aaeaecc', '11111111-0002-0000-0000-000000000002', 'bulan', 'tanggal_pelatihan', 'Tanggal Pelatihan', 'tanggal', NULL, 'sum', 0, 0, 16, 1),
  ('2b961023-4621-4754-882d-3e6b61359404', '11111111-0002-0000-0000-000000000002', 'bulan', 'no_sertifikat_pelatihan', 'No Sertifikat Pelatihan', 'teks', NULL, 'sum', 0, 0, 17, 1),
  ('0590bf64-215d-4079-877e-505be7ce5726', '11111111-0002-0000-0000-000000000002', 'bulan', 'link_sertifikat_pelatihan_by_name', 'Link Sertifikat Pelatihan by Name', 'teks', NULL, 'sum', 0, 0, 18, 1),
  ('0c8a5a12-c29a-41c1-8dcd-aec9ec78be09', '11111111-0002-0000-0000-000000000002', 'bulan', 'no_kusuka', 'No KUSUKA', 'teks', NULL, 'sum', 0, 0, 19, 1),
  ('48cf95d6-d3d7-4b21-83da-313b79484b80', '11111111-0002-0000-0000-000000000002', 'bulan', 'jenis_pelatihan', 'Jenis Pelatihan', 'pilihan', '[\"Aspirasi\",\"Reguler\",\"Kerjasama\",\"Mandiri\"]', 'sum', 0, 0, 20, 1),
  ('60c16f4b-b7b5-4a4b-878f-fa7e13ae320d', '11111111-0003-0000-0000-000000000003', 'minggu', 'nama_pelatihan', 'Nama Pelatihan/Judul Pelatihan', 'teks', NULL, 'sum', 1, 0, 1, 1),
  ('f773f15d-5b50-42a5-87e6-d5818bd48063', '11111111-0003-0000-0000-000000000003', 'minggu', 'kategori_pelatihan', 'Kategori Pelatihan', 'pilihan', '[\"Struktural\",\"Fungsional\",\"Teknis\",\"Manajerial\"]', 'sum', 0, 0, 2, 1),
  ('d219205b-25c3-45bc-8d68-0822075799fb', '11111111-0003-0000-0000-000000000003', 'minggu', 'jumlah_peserta', 'Jumlah Peserta', 'angka', NULL, 'sum', 1, 0, 3, 1),
  ('172c12f7-aca1-4400-8a19-c04120580b2f', '11111111-0003-0000-0000-000000000003', 'minggu', 'tanggal_pelatihan', 'Tanggal Pelatihan', 'tanggal', NULL, 'sum', 0, 0, 4, 1),
  ('9322e74a-7f29-4139-8b60-aa93bc9325e9', '11111111-0003-0000-0000-000000000003', 'minggu', 'pagu_anggaran', 'Pagu Anggaran (Rp)', 'angka', NULL, 'last', 0, 0, 5, 1),
  ('1993bb48-8d51-4102-8080-cc693fdbd910', '11111111-0003-0000-0000-000000000003', 'minggu', 'realisasi_anggaran', 'Realisasi Anggaran (Rp)', 'angka', NULL, 'last', 0, 0, 6, 1),
  ('494cb840-c6cf-4f18-828b-dba1766a0074', '11111111-0003-0000-0000-000000000003', 'minggu', 'sumber_dana', 'Sumber Dana', 'pilihan', '[\"RM\",\"PNBP\",\"BLU\",\"SBSN\"]', 'sum', 0, 0, 7, 1),
  ('9015f86d-5810-4b89-8c9e-1f3bf02e2ac2', '11111111-0003-0000-0000-000000000003', 'minggu', 'asal_instansi', 'Asal Instansi', 'teks', NULL, 'sum', 0, 0, 8, 1),
  ('936185f6-f7d6-4bfe-8648-1f742fe744b5', '11111111-0003-0000-0000-000000000003', 'minggu', 'metode_pelatihan', 'Metode Pelatihan', 'pilihan', '[\"Luring\",\"Blended\",\"Full Online\"]', 'sum', 0, 0, 9, 1),
  ('3804262d-2408-408e-87a1-87b908d1a6d8', '11111111-0004-0000-0000-000000000004', 'bulan', 'nama', 'Nama Lulusan Pelatihan', 'teks', NULL, 'sum', 1, 1, 1, 1),
  ('955c60cf-4270-404f-874b-299511f2b70d', '11111111-0004-0000-0000-000000000004', 'bulan', 'nik', 'NIK', 'teks', NULL, 'sum', 1, 1, 2, 1),
  ('f3da5313-7bd4-40e9-8d7b-a7cddfff8e48', '11111111-0004-0000-0000-000000000004', 'bulan', 'tempat_tanggal_lahir', 'Tempat & Tanggal Lahir', 'teks', NULL, 'sum', 0, 0, 3, 1),
  ('ef99b0f6-77b8-4147-8a89-84dc04b97f35', '11111111-0004-0000-0000-000000000004', 'bulan', 'jenis_kelamin', 'Jenis Kelamin (L/P)', 'pilihan', '[\"Laki-laki\",\"Perempuan\"]', 'sum', 0, 0, 4, 1),
  ('c64b41e0-6f24-4074-8e12-27ae13bf9eae', '11111111-0004-0000-0000-000000000004', 'bulan', 'nip', 'NIP', 'teks', NULL, 'sum', 0, 1, 5, 1),
  ('a49c16be-112e-4c9e-812f-6e7837c3cb00', '11111111-0004-0000-0000-000000000004', 'bulan', 'jabatan', 'Jabatan', 'teks', NULL, 'sum', 0, 0, 6, 1),
  ('1df35e13-43ae-4db8-8159-0920f8d12e35', '11111111-0004-0000-0000-000000000004', 'bulan', 'pangkat_gol_ruang', 'Pangkat/Gol. Ruang', 'teks', NULL, 'sum', 0, 0, 7, 1),
  ('fc238e3e-8c2c-4772-87a2-83a92cd0c14e', '11111111-0004-0000-0000-000000000004', 'bulan', 'pendidikan_terakhir', 'Pendidikan Terakhir', 'pilihan', '[\"SMA/SMK\",\"D3\",\"D4/S1\",\"S2\",\"S3\"]', 'sum', 0, 0, 8, 1),
  ('a360f38c-9f70-44eb-8dd1-33fa2a2e8adf', '11111111-0004-0000-0000-000000000004', 'bulan', 'no_telepon', 'Nomor Tlp.', 'teks', NULL, 'sum', 0, 1, 9, 1),
  ('c0c42f99-3dc3-4cd2-89f8-7fb1c3b7d394', '11111111-0004-0000-0000-000000000004', 'bulan', 'unit_kerja_eselon_i', 'Unit Kerja Eselon I', 'teks', NULL, 'sum', 0, 0, 10, 1),
  ('fec48047-01ef-4c1d-8e47-416fe2eb8847', '11111111-0004-0000-0000-000000000004', 'bulan', 'unit_kerja', 'Unit Kerja', 'teks', NULL, 'sum', 0, 0, 11, 1),
  ('9758ef78-1a0f-427f-82a1-31fea1384a2e', '11111111-0004-0000-0000-000000000004', 'bulan', 'alamat_kantor', 'Alamat Kantor', 'teks', NULL, 'sum', 0, 0, 12, 1),
  ('0fff38e9-c4ba-42c7-86fc-ce3a6102c48c', '11111111-0004-0000-0000-000000000004', 'bulan', 'nama_pelatihan', 'Nama Pelatihan', 'teks', NULL, 'sum', 1, 0, 13, 1),
  ('0e89e70f-76fc-4a1c-88a5-fe46f7c189b6', '11111111-0004-0000-0000-000000000004', 'bulan', 'jenis_diklat', 'Jenis Diklat', 'pilihan', '[\"Reguler\",\"Full Online\",\"Blended\"]', 'sum', 0, 0, 14, 1),
  ('1ad0c8bc-a4c6-4dea-88ca-72031ea791cf', '11111111-0004-0000-0000-000000000004', 'bulan', 'tanggal_pelatihan', 'Tanggal Pelatihan', 'tanggal', NULL, 'sum', 0, 0, 15, 1),
  ('6f285277-065b-4f99-8e85-87abf26ed496', '11111111-0005-0000-0000-000000000005', 'minggu', 'jumlah_instruktur_wi', 'Jumlah Instruktur dan Widyaiswara', 'angka', NULL, 'last', 1, 0, 1, 1),
  ('e0e424ed-24a7-4049-8346-639b9e8adf09', '11111111-0005-0000-0000-000000000005', 'minggu', 'jenjang_jabatan_instruktur', 'Jenjang Jabatan Instruktur', 'pilihan', '[\"Penyelia\",\"Pertama\",\"Muda\",\"Madya\"]', 'sum', 0, 0, 2, 1),
  ('a7720900-0807-4ca3-8f4a-ebffb2870bb5', '11111111-0005-0000-0000-000000000005', 'minggu', 'jenjang_jabatan_widyaiswara', 'Jenjang Jabatan Widyaiswara', 'pilihan', '[\"Pertama\",\"Muda\",\"Madya\",\"Utama\"]', 'sum', 0, 0, 3, 1),
  ('f58ab378-d55e-4f64-8726-f85f42e0029c', '11111111-0005-0000-0000-000000000005', 'minggu', 'instruktur_berdasarkan_keahlian', 'Instruktur Berdasarkan Keahlian', 'angka', NULL, 'last', 0, 0, 4, 1),
  ('fdaf3d2f-3310-4bb6-87fc-f0caf136ef7c', '11111111-0005-0000-0000-000000000005', 'minggu', 'widyaiswara_berdasarkan_keahlian', 'Widyaiswara Berdasarkan Keahlian', 'angka', NULL, 'last', 0, 0, 5, 1),
  ('776dec62-8302-4932-88ad-800a5030f2d9', '11111111-0006-0000-0000-000000000006', 'bulan', 'nama', 'Nama Lengkap', 'teks', NULL, 'sum', 1, 0, 1, 1),
  ('8f26b516-016d-4054-87fe-e95162f8887c', '11111111-0006-0000-0000-000000000006', 'bulan', 'nip', 'NIP', 'teks', NULL, 'sum', 1, 1, 2, 1),
  ('2c6603d6-0980-40ae-8cbf-f5a78f3c0bcb', '11111111-0006-0000-0000-000000000006', 'bulan', 'jenis_kelamin', 'Jenis Kelamin', 'pilihan', '[\"Laki-laki\",\"Perempuan\"]', 'sum', 0, 0, 3, 1),
  ('df0b700b-098c-4499-8c9b-c669415d66c4', '11111111-0006-0000-0000-000000000006', 'bulan', 'jabatan', 'Jabatan (Instruktur / Widyaiswara)', 'teks', NULL, 'sum', 0, 0, 4, 1),
  ('074b83c0-284c-46e5-8dc8-e92a1a445664', '11111111-0006-0000-0000-000000000006', 'bulan', 'bidang_keahlian', 'Bidang Keahlian', 'teks', NULL, 'sum', 0, 0, 5, 1),
  ('bbf9167a-cc82-40ea-8907-f73fd58c5327', '11111111-0006-0000-0000-000000000006', 'bulan', 'pendidikan', 'Pendidikan', 'pilihan', '[\"D3\",\"D4/S1\",\"S2\",\"S3\"]', 'sum', 0, 0, 6, 1),
  ('770927c6-895e-456c-8c8b-d14fa4c5c034', '11111111-0006-0000-0000-000000000006', 'bulan', 'status_asn', 'Status ASN (PNS/PPPK)', 'pilihan', '[\"PNS\",\"PPPK\"]', 'sum', 0, 0, 7, 1),
  ('424c755f-f1d5-4650-8f41-bbf86e3746c4', '11111111-0007-0000-0000-000000000007', 'minggu', 'judul_kegiatan', 'Judul Kegiatan', 'teks', NULL, 'sum', 1, 0, 1, 1),
  ('bb461ccf-83b1-4806-8ce5-8e5f079973d9', '11111111-0007-0000-0000-000000000007', 'minggu', 'volume', 'Volume', 'angka', NULL, 'last', 0, 0, 2, 1),
  ('30060afd-98fa-4997-8825-d68f0bd64915', '11111111-0007-0000-0000-000000000007', 'minggu', 'satuan', 'Satuan', 'teks', NULL, 'sum', 0, 0, 3, 1),
  ('1ef0df31-3e43-4b6f-8103-81b591e62cbc', '11111111-0007-0000-0000-000000000007', 'minggu', 'pagu_anggaran', 'Pagu Anggaran (Rp)', 'angka', NULL, 'last', 0, 0, 4, 1),
  ('f590ccfe-41d2-4fce-8572-6008bf3098de', '11111111-0007-0000-0000-000000000007', 'minggu', 'sumber_dana', 'Sumber Dana', 'pilihan', '[\"RM\",\"PNBP\",\"BLU\",\"SBSN\"]', 'sum', 0, 0, 5, 1),
  ('bb5fb0be-7840-4639-84db-7ea67dfd0757', '11111111-0007-0000-0000-000000000007', 'minggu', 'realisasi_anggaran', 'Realisasi Anggaran (Rp)', 'angka', NULL, 'last', 0, 0, 6, 1),
  ('67b341eb-1f02-4b78-8351-8364ad11b8a3', '11111111-0007-0000-0000-000000000007', 'minggu', 'realisasi_fisik', 'Realisasi Fisik (%)', 'angka', NULL, 'last', 0, 0, 7, 1),
  ('67ebc88d-670b-4f17-86cb-54642c85fcd8', '11111111-0007-0000-0000-000000000007', 'minggu', 'progress_pelaksanaan', 'Progress Pelaksanaan', 'teks_panjang', NULL, 'sum', 0, 0, 8, 1),
  ('77553025-e356-4819-8f46-63adaf77c6c6', '11111111-0007-0000-0000-000000000007', 'minggu', 'permasalahan', 'Permasalahan', 'teks_panjang', NULL, 'sum', 0, 0, 9, 1),
  ('eca6ee86-ea6d-42fa-814b-cd971d6b9643', '11111111-0008-0000-0000-000000000008', 'minggu', 'pagu_belanja_pegawai', 'Pagu Belanja Pegawai (Rp)', 'angka', NULL, 'last', 0, 0, 1, 1),
  ('f6aa1e86-919f-4413-84f3-d1800b1764a2', '11111111-0008-0000-0000-000000000008', 'minggu', 'realisasi_belanja_pegawai', 'Realisasi Belanja Pegawai (Rp)', 'angka', NULL, 'last', 0, 0, 2, 1),
  ('45a0ba2f-9850-4d8a-8d3d-8cb81544f431', '11111111-0008-0000-0000-000000000008', 'minggu', 'pagu_belanja_barang', 'Pagu Belanja Barang (Rp)', 'angka', NULL, 'last', 0, 0, 3, 1),
  ('4821dbf2-6847-4400-8e34-a79f007604af', '11111111-0008-0000-0000-000000000008', 'minggu', 'realisasi_belanja_barang', 'Realisasi Belanja Barang (Rp)', 'angka', NULL, 'last', 0, 0, 4, 1),
  ('197aac04-9c1a-4b61-8932-91c2ffd81eff', '11111111-0008-0000-0000-000000000008', 'minggu', 'pagu_belanja_modal', 'Pagu Belanja Modal (Rp)', 'angka', NULL, 'last', 0, 0, 5, 1),
  ('ee572fba-7d4d-4966-89f7-2b8044dea50f', '11111111-0008-0000-0000-000000000008', 'minggu', 'realisasi_belanja_modal', 'Realisasi Belanja Modal (Rp)', 'angka', NULL, 'last', 0, 0, 6, 1),
  ('9f2bf9f9-0397-48c1-8010-ac8419ca44dc', '11111111-0009-0000-0000-000000000009', 'minggu', 'pagu_rm', 'Pagu RM (Rp)', 'angka', NULL, 'last', 0, 0, 1, 1),
  ('cde7a89f-4f69-4a97-88ce-d0da124fc618', '11111111-0009-0000-0000-000000000009', 'minggu', 'realisasi_rm', 'Realisasi RM (Rp)', 'angka', NULL, 'last', 0, 0, 2, 1),
  ('3b97b137-609d-460c-8b7c-a308b445fb1b', '11111111-0009-0000-0000-000000000009', 'minggu', 'pagu_pnbp_blu', 'Pagu PNBP/BLU (Rp)', 'angka', NULL, 'last', 0, 0, 3, 1),
  ('9511f385-9837-427d-8d75-fbf30bef37e4', '11111111-0009-0000-0000-000000000009', 'minggu', 'realisasi_pnbp_blu', 'Realisasi PNBP/BLU (Rp)', 'angka', NULL, 'last', 0, 0, 4, 1),
  ('dd4602e0-7b06-4ab2-89ce-3e4231439623', '11111111-0009-0000-0000-000000000009', 'minggu', 'pagu_sbsn', 'Pagu SBSN (Rp)', 'angka', NULL, 'last', 0, 0, 5, 1),
  ('fb5897b9-706a-4a5b-8eaf-d5acb6fdbf18', '11111111-0009-0000-0000-000000000009', 'minggu', 'realisasi_sbsn', 'Realisasi SBSN (Rp)', 'angka', NULL, 'last', 0, 0, 6, 1);

-- ==========================================================
-- DATA MASTER — PERIODE 2026 (1 tahun + 4 triwulan + 12 bulan + 48 minggu)
-- ==========================================================
INSERT INTO `periods` (`id`, `level`, `tahun`, `triwulan_ke`, `bulan`, `minggu_ke`, `tanggal_mulai`, `tanggal_selesai`, `deadline`, `label`) VALUES
  ('afcc502d-6c5f-43f9-8ba9-2d936b6b6203', 'tahun', 2026, NULL, NULL, NULL, '2026-01-01', '2026-12-31', '2027-06-30', 'Tahun 2026'),
  ('87b6e6eb-0622-4b23-874b-42f7ab222cc8', 'triwulan', 2026, 1, NULL, NULL, '2026-01-01', '2026-03-31', '2026-06-30', 'Triwulan I 2026'),
  ('5d01d097-bada-428a-8cea-9e0053c7c41b', 'triwulan', 2026, 2, NULL, NULL, '2026-04-01', '2026-06-30', '2026-09-30', 'Triwulan II 2026'),
  ('4c1293e8-01b7-4e78-8872-a39f250e4639', 'triwulan', 2026, 3, NULL, NULL, '2026-07-01', '2026-09-30', '2026-12-31', 'Triwulan III 2026'),
  ('45aba5c6-47cc-4aba-8eb7-57928830a35b', 'triwulan', 2026, 4, NULL, NULL, '2026-10-01', '2026-12-31', '2027-03-31', 'Triwulan IV 2026'),
  ('7b40d40b-8e81-4073-8e8e-2cdf3294d311', 'bulan', 2026, 1, 1, NULL, '2026-01-01', '2026-01-31', '2026-02-28', 'Januari 2026'),
  ('af16379e-5d6b-47d0-82ff-682b7224cdac', 'minggu', 2026, 1, 1, 1, '2026-01-01', '2026-01-07', '2026-01-14', 'Minggu ke-1 Januari 2026'),
  ('d159a763-34b7-442c-84e6-892995eea779', 'minggu', 2026, 1, 1, 2, '2026-01-08', '2026-01-14', '2026-01-21', 'Minggu ke-2 Januari 2026'),
  ('10631ab0-42ae-4c35-8247-f8aaa5c8bcca', 'minggu', 2026, 1, 1, 3, '2026-01-15', '2026-01-21', '2026-01-31', 'Minggu ke-3 Januari 2026'),
  ('6caee8a8-4577-4100-8893-f1ea3d4045ae', 'minggu', 2026, 1, 1, 4, '2026-01-22', '2026-01-31', '2026-02-07', 'Minggu ke-4 Januari 2026'),
  ('55b95264-67eb-4146-859d-b7af02751332', 'bulan', 2026, 1, 2, NULL, '2026-02-01', '2026-02-28', '2026-03-31', 'Februari 2026'),
  ('ea578c47-2543-46cd-804c-9d454d7e0d0d', 'minggu', 2026, 1, 2, 1, '2026-02-01', '2026-02-07', '2026-02-14', 'Minggu ke-1 Februari 2026'),
  ('692b2794-c143-439c-890d-2f3295a7971c', 'minggu', 2026, 1, 2, 2, '2026-02-08', '2026-02-14', '2026-02-21', 'Minggu ke-2 Februari 2026'),
  ('8b2224ff-8585-496a-8e3d-e81aae6b742a', 'minggu', 2026, 1, 2, 3, '2026-02-15', '2026-02-21', '2026-02-28', 'Minggu ke-3 Februari 2026'),
  ('8c4aa0d3-f945-44aa-8e92-cf79ef754606', 'minggu', 2026, 1, 2, 4, '2026-02-22', '2026-02-28', '2026-03-07', 'Minggu ke-4 Februari 2026'),
  ('ba6a5e6c-2523-4340-8b3b-ea58e44b3105', 'bulan', 2026, 1, 3, NULL, '2026-03-01', '2026-03-31', '2026-04-30', 'Maret 2026'),
  ('09379f3f-fd6b-4c83-870f-caf462208947', 'minggu', 2026, 1, 3, 1, '2026-03-01', '2026-03-07', '2026-03-14', 'Minggu ke-1 Maret 2026'),
  ('4bb8dd50-504e-418c-86ea-127f8b22e71b', 'minggu', 2026, 1, 3, 2, '2026-03-08', '2026-03-14', '2026-03-21', 'Minggu ke-2 Maret 2026'),
  ('39ad66d4-cad6-4761-8c4e-d774cf3786da', 'minggu', 2026, 1, 3, 3, '2026-03-15', '2026-03-21', '2026-03-31', 'Minggu ke-3 Maret 2026'),
  ('41d8c597-e0e6-4000-8092-2e46c3a51222', 'minggu', 2026, 1, 3, 4, '2026-03-22', '2026-03-31', '2026-04-07', 'Minggu ke-4 Maret 2026'),
  ('18f319fe-adcc-4764-8488-70199281a60f', 'bulan', 2026, 2, 4, NULL, '2026-04-01', '2026-04-30', '2026-05-31', 'April 2026'),
  ('46cd18c0-6b34-4708-8786-91af8735251a', 'minggu', 2026, 2, 4, 1, '2026-04-01', '2026-04-07', '2026-04-14', 'Minggu ke-1 April 2026'),
  ('d60b32b2-3e37-459f-8830-7c652c9a3324', 'minggu', 2026, 2, 4, 2, '2026-04-08', '2026-04-14', '2026-04-21', 'Minggu ke-2 April 2026'),
  ('dc1a129c-f622-400c-89c2-947c7a8e9c09', 'minggu', 2026, 2, 4, 3, '2026-04-15', '2026-04-21', '2026-04-30', 'Minggu ke-3 April 2026'),
  ('ceaf730c-b709-4cdc-8a65-002e6ad8be91', 'minggu', 2026, 2, 4, 4, '2026-04-22', '2026-04-30', '2026-05-07', 'Minggu ke-4 April 2026'),
  ('702061dd-8848-4ac8-8cdf-1497cd58d9b6', 'bulan', 2026, 2, 5, NULL, '2026-05-01', '2026-05-31', '2026-06-30', 'Mei 2026'),
  ('94db11af-6460-49ac-8e39-fa2b9f9d5f07', 'minggu', 2026, 2, 5, 1, '2026-05-01', '2026-05-07', '2026-05-14', 'Minggu ke-1 Mei 2026'),
  ('7e51993a-7ad6-4795-8876-672f02302b97', 'minggu', 2026, 2, 5, 2, '2026-05-08', '2026-05-14', '2026-05-21', 'Minggu ke-2 Mei 2026'),
  ('e7a29a91-350c-453a-8fc4-c73f236b9c80', 'minggu', 2026, 2, 5, 3, '2026-05-15', '2026-05-21', '2026-05-31', 'Minggu ke-3 Mei 2026'),
  ('e9a45d14-7a8d-4949-888f-52e23cdaef3d', 'minggu', 2026, 2, 5, 4, '2026-05-22', '2026-05-31', '2026-06-07', 'Minggu ke-4 Mei 2026'),
  ('c114af78-4922-4dc6-8984-27b8aa10899e', 'bulan', 2026, 2, 6, NULL, '2026-06-01', '2026-06-30', '2026-07-31', 'Juni 2026'),
  ('34159791-e7ce-4704-81c2-33ddf40553e9', 'minggu', 2026, 2, 6, 1, '2026-06-01', '2026-06-07', '2026-06-14', 'Minggu ke-1 Juni 2026'),
  ('1ed791b1-9d9d-41de-8175-2bd04333d22c', 'minggu', 2026, 2, 6, 2, '2026-06-08', '2026-06-14', '2026-06-21', 'Minggu ke-2 Juni 2026'),
  ('be511fb7-e1d5-4259-8dce-48d1e0a8c8c8', 'minggu', 2026, 2, 6, 3, '2026-06-15', '2026-06-21', '2026-06-30', 'Minggu ke-3 Juni 2026'),
  ('de687757-49e1-4efd-85d8-cf252dd9f192', 'minggu', 2026, 2, 6, 4, '2026-06-22', '2026-06-30', '2026-07-07', 'Minggu ke-4 Juni 2026'),
  ('90363b95-50bb-48cc-8b7b-62b1583c6ba6', 'bulan', 2026, 3, 7, NULL, '2026-07-01', '2026-07-31', '2026-08-31', 'Juli 2026'),
  ('e070aa4a-dda1-4364-8295-370d44a2ba2d', 'minggu', 2026, 3, 7, 1, '2026-07-01', '2026-07-07', '2026-07-14', 'Minggu ke-1 Juli 2026'),
  ('5586d8a1-a407-4c0f-8238-e189a21bf0cb', 'minggu', 2026, 3, 7, 2, '2026-07-08', '2026-07-14', '2026-07-21', 'Minggu ke-2 Juli 2026'),
  ('c707ca28-cc41-4998-86ca-c9e2315f1731', 'minggu', 2026, 3, 7, 3, '2026-07-15', '2026-07-21', '2026-07-31', 'Minggu ke-3 Juli 2026'),
  ('e392998d-eba2-4fbd-8762-982cf3651564', 'minggu', 2026, 3, 7, 4, '2026-07-22', '2026-07-31', '2026-08-07', 'Minggu ke-4 Juli 2026'),
  ('51ae39ba-6263-412d-888c-d46cb3d7eeb2', 'bulan', 2026, 3, 8, NULL, '2026-08-01', '2026-08-31', '2026-09-30', 'Agustus 2026'),
  ('8d9b68df-73ac-4c95-876f-4edf4bfee02a', 'minggu', 2026, 3, 8, 1, '2026-08-01', '2026-08-07', '2026-08-14', 'Minggu ke-1 Agustus 2026'),
  ('71d3bfc8-35c0-4990-8342-6ddb6c277fdd', 'minggu', 2026, 3, 8, 2, '2026-08-08', '2026-08-14', '2026-08-21', 'Minggu ke-2 Agustus 2026'),
  ('74cc0b8f-ead7-413a-88ad-8045a394b112', 'minggu', 2026, 3, 8, 3, '2026-08-15', '2026-08-21', '2026-08-31', 'Minggu ke-3 Agustus 2026'),
  ('1ad30a46-872a-48c5-8fcd-06bbe27e3a81', 'minggu', 2026, 3, 8, 4, '2026-08-22', '2026-08-31', '2026-09-07', 'Minggu ke-4 Agustus 2026'),
  ('f7a73c9c-6ec7-4ac9-836b-d0d5443485c1', 'bulan', 2026, 3, 9, NULL, '2026-09-01', '2026-09-30', '2026-10-31', 'September 2026'),
  ('ebbc6670-9425-4ac3-8a2a-ded99512af4d', 'minggu', 2026, 3, 9, 1, '2026-09-01', '2026-09-07', '2026-09-14', 'Minggu ke-1 September 2026'),
  ('1311586b-b51d-4179-83f6-d223e1cc81c1', 'minggu', 2026, 3, 9, 2, '2026-09-08', '2026-09-14', '2026-09-21', 'Minggu ke-2 September 2026'),
  ('926eabee-edd5-47c8-8918-a9eb31c8ea1d', 'minggu', 2026, 3, 9, 3, '2026-09-15', '2026-09-21', '2026-09-30', 'Minggu ke-3 September 2026'),
  ('40bb437e-fff8-45ec-8674-9e5c05a48d9e', 'minggu', 2026, 3, 9, 4, '2026-09-22', '2026-09-30', '2026-10-07', 'Minggu ke-4 September 2026'),
  ('368cbba0-9525-4713-8a45-5b1657fb3bde', 'bulan', 2026, 4, 10, NULL, '2026-10-01', '2026-10-31', '2026-11-30', 'Oktober 2026'),
  ('2a9fbec6-693c-4a94-8ad0-24a937719e1d', 'minggu', 2026, 4, 10, 1, '2026-10-01', '2026-10-07', '2026-10-14', 'Minggu ke-1 Oktober 2026'),
  ('cfdab632-554a-4306-8f7f-06f0f9716fbe', 'minggu', 2026, 4, 10, 2, '2026-10-08', '2026-10-14', '2026-10-21', 'Minggu ke-2 Oktober 2026'),
  ('ffdec946-05f8-4705-8d28-a55cf4fda8cf', 'minggu', 2026, 4, 10, 3, '2026-10-15', '2026-10-21', '2026-10-31', 'Minggu ke-3 Oktober 2026'),
  ('f6b1b224-b7e7-4372-8623-299b885927c5', 'minggu', 2026, 4, 10, 4, '2026-10-22', '2026-10-31', '2026-11-07', 'Minggu ke-4 Oktober 2026'),
  ('f91ff680-46f1-449b-82f7-f37aabcb92b7', 'bulan', 2026, 4, 11, NULL, '2026-11-01', '2026-11-30', '2026-12-31', 'November 2026'),
  ('bf223454-21b8-4ef0-8b76-f288f24444c9', 'minggu', 2026, 4, 11, 1, '2026-11-01', '2026-11-07', '2026-11-14', 'Minggu ke-1 November 2026'),
  ('12e6b86b-c935-42da-8f5d-735cd50dcd4d', 'minggu', 2026, 4, 11, 2, '2026-11-08', '2026-11-14', '2026-11-21', 'Minggu ke-2 November 2026'),
  ('7650c186-6e66-4a25-8878-34cc4feb993b', 'minggu', 2026, 4, 11, 3, '2026-11-15', '2026-11-21', '2026-11-30', 'Minggu ke-3 November 2026'),
  ('8b689e97-ec5f-4e19-88b7-44daecaf5f1c', 'minggu', 2026, 4, 11, 4, '2026-11-22', '2026-11-30', '2026-12-07', 'Minggu ke-4 November 2026'),
  ('6a958bd7-4c0b-4997-8788-9aad8a53ded0', 'bulan', 2026, 4, 12, NULL, '2026-12-01', '2026-12-31', '2027-01-31', 'Desember 2026'),
  ('475131f5-2318-426c-8bff-83098e0e12c7', 'minggu', 2026, 4, 12, 1, '2026-12-01', '2026-12-07', '2026-12-14', 'Minggu ke-1 Desember 2026'),
  ('62952c6e-5ef5-4d2a-86c2-54175fb4d68e', 'minggu', 2026, 4, 12, 2, '2026-12-08', '2026-12-14', '2026-12-21', 'Minggu ke-2 Desember 2026'),
  ('ade58ff1-bc06-41e1-89ec-1fbbdc407276', 'minggu', 2026, 4, 12, 3, '2026-12-15', '2026-12-21', '2026-12-31', 'Minggu ke-3 Desember 2026'),
  ('eedda1ac-8b60-4213-8361-57cc91a87a0a', 'minggu', 2026, 4, 12, 4, '2026-12-22', '2026-12-31', '2027-01-07', 'Minggu ke-4 Desember 2026')
ON DUPLICATE KEY UPDATE `tanggal_mulai` = VALUES(`tanggal_mulai`), `tanggal_selesai` = VALUES(`tanggal_selesai`), `deadline` = VALUES(`deadline`), `label` = VALUES(`label`);
