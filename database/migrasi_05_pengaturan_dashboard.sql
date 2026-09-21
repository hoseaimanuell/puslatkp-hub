-- ==========================================================
-- MIGRASI 05 — Pengaturan Dashboard (menu Admin "Kelola Dashboard")
-- Jalankan SEKALI di phpMyAdmin pada database Puslatkp1a yang SUDAH terlanjur diimpor.
-- Tabel dibiarkan kosong: dashboard memakai tampilan bawaan sampai Admin menyimpan pengaturannya
-- (tombol "Salin tampilan bawaan" di menu Kelola Dashboard).
-- ==========================================================
USE `Puslatkp1a`;

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
