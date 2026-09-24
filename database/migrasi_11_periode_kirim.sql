-- ==========================================================
-- MIGRASI 11 — Kirim & Kunci Data (UPT tidak bisa edit data yang sudah dikirim tanpa izin Admin)
-- Jalankan SEKALI di phpMyAdmin pada database Puslatkp1a yang SUDAH terlanjur diimpor.
-- Instalasi baru dari puslatkp1a.sql terbaru tidak perlu menjalankan berkas ini.
--
-- Sebelumnya akun UPT bisa mengedit data mingguan/bulanan kapan saja sebelum deadline (deadline hanya menandai
-- "Terlambat", tidak pernah mengunci). Mulai migrasi ini, UPT bisa menekan tombol "Kirim & Kunci" pada suatu
-- periode (minggu atau bulan) untuk MENGUNCI seluruh jenis data periode itu sekaligus — setelah terkunci, UPT
-- hanya bisa melihat, tidak bisa mengedit/menghapus/menambah, sampai mengajukan "Buka Kunci" dan disetujui Admin
-- (memakai jalur persetujuan yang sama seperti Permintaan Hapus — lihat migrasi_10). Sebelum migrasi ini
-- dijalankan, tombol Kirim & Kunci tidak muncul dan data tetap bisa diedit kapan saja seperti sebelumnya
-- (aplikasi mendeteksi tabel ini belum ada dan menonaktifkan fitur secara otomatis).
-- ==========================================================
USE `Puslatkp1a`;

CREATE TABLE IF NOT EXISTS periode_kirim (
  id                CHAR(36)     NOT NULL,
  upt_key           VARCHAR(64)  NOT NULL,
  period_id         CHAR(36)     NOT NULL,
  terkirim_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  terkirim_by       CHAR(36)     NULL,
  terkirim_by_label VARCHAR(190) NULL,
  deleted_at        DATETIME     NULL COMMENT 'Tempat sampah: NULL = masih terkunci. Baris terhapus = kunci dibuka (lewat persetujuan Admin)',
  deleted_by        CHAR(36)     NULL,
  deleted_batch     CHAR(36)     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_periode_kirim (upt_key, period_id),
  KEY idx_periode_kirim_trash (deleted_at, deleted_batch),
  CONSTRAINT fk_pk_upt    FOREIGN KEY (upt_key)     REFERENCES upt_list(`key`) ON DELETE CASCADE,
  CONSTRAINT fk_pk_period FOREIGN KEY (period_id)   REFERENCES periods(id)     ON DELETE CASCADE,
  CONSTRAINT fk_pk_by     FOREIGN KEY (terkirim_by) REFERENCES profiles(id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- permintaan_hapus (migrasi_10) diperluas: period_id/jenis_data_id sebagai kolom asli (bukan hanya di dalam
-- filter_json) supaya bisa dicari langsung — dipakai untuk mengecek "apakah periode ini sedang menunggu
-- persetujuan buka kunci" dari sisi UPT tanpa membaca isi filter_json.
ALTER TABLE permintaan_hapus
  ADD COLUMN period_id     CHAR(36) NULL AFTER tabel,
  ADD COLUMN jenis_data_id CHAR(36) NULL AFTER period_id,
  ADD KEY idx_permintaan_period (period_id, status);
