-- ==========================================================
-- MIGRASI 10 — Permintaan Hapus (akun UPT tidak lagi menghapus langsung, perlu persetujuan Admin)
-- Jalankan SEKALI di phpMyAdmin pada database Puslatkp1a yang SUDAH terlanjur diimpor.
-- Instalasi baru dari puslatkp1a.sql terbaru tidak perlu menjalankan berkas ini.
--
-- Sebelumnya akun UPT bisa menghapus data mingguan/bulanan/berkas unggahan miliknya sendiri secara
-- langsung (masuk Tempat Sampah, hanya Admin yang bisa memulihkan — tapi penghapusannya sendiri terjadi
-- seketika tanpa persetujuan). Mulai migrasi ini, tombol hapus/kosongkan pada tabel `rekap_nilai`,
-- `data_entries`, dan `dokumen_upload` milik akun UPT TIDAK langsung menghapus — sistem membuat baris
-- "permintaan hapus" di sini, dan data baru benar-benar terhapus (masuk Tempat Sampah seperti biasa)
-- setelah Admin menyetujuinya lewat menu Permintaan Hapus. Mengedit/mengosongkan isian secara langsung
-- (tanpa lewat tombol Hapus) saat masih dalam sesi input mingguan/bulanan TIDAK terpengaruh migrasi ini.
--
-- Sebelum migrasi ini dijalankan, tombol hapus/kosongkan akun UPT tetap berperilaku seperti sebelumnya
-- (langsung menghapus, masuk Tempat Sampah) — aplikasi mendeteksi tabel ini belum ada dan menonaktifkan
-- fitur persetujuan secara otomatis (lihat GET /api/health -> features.permintaanHapus).
-- ==========================================================
USE `Puslatkp1a`;

CREATE TABLE IF NOT EXISTS permintaan_hapus (
  id                  CHAR(36)     NOT NULL,
  tabel               VARCHAR(30)  NOT NULL COMMENT 'rekap_nilai | data_entries | dokumen_upload',
  upt_key             VARCHAR(50)  NOT NULL,
  filter_json         JSON         NOT NULL COMMENT 'Filter WHERE (sudah termasuk upt_key) untuk dieksekusi ulang saat disetujui',
  ringkasan           VARCHAR(500) NULL,
  jumlah_baris        INT          NOT NULL DEFAULT 0,
  alasan              VARCHAR(500) NULL COMMENT 'Alasan opsional dari UPT saat mengajukan',
  status              VARCHAR(10)  NOT NULL DEFAULT 'pending' COMMENT 'pending | disetujui | ditolak',
  catatan_admin       VARCHAR(1000) NULL,
  requested_by        CHAR(36)     NULL,
  requested_by_label  VARCHAR(190) NULL,
  reviewed_by         CHAR(36)     NULL,
  reviewed_by_label   VARCHAR(190) NULL,
  reviewed_at         DATETIME     NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_permintaan_status (status),
  KEY idx_permintaan_upt (upt_key),
  CONSTRAINT fk_permintaan_upt FOREIGN KEY (upt_key) REFERENCES upt_list(`key`) ON DELETE CASCADE,
  CONSTRAINT fk_permintaan_requested_by FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_permintaan_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
