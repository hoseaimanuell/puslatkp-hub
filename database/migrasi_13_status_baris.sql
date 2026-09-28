-- ==========================================================
-- MIGRASI 13 — Persetujuan Data Per-Baris (rekap_nilai / data_entries / dokumen_upload)
-- Jalankan SEKALI di phpMyAdmin pada database Puslatkp1a yang SUDAH terlanjur diimpor sebelumnya.
-- Instalasi baru dari puslatkp1a.sql terbaru tidak perlu menjalankan berkas ini.
--
-- Lapisan persetujuan BARU, terpisah dari & berjalan berdampingan dengan "Kirim Data" (periode_kirim,
-- migrasi_11/12) yang sudah ada:
--   1. Setiap kali UPT menyimpan data (bukan hanya saat menekan "Kirim" per periode), baris itu langsung
--      berstatus DRAFT ("menunggu persetujuan") — dipaksa server, UPT tidak bisa mengatur status sendiri.
--   2. Selagi draft, UPT masih bebas mengedit/menghapus baris itu sendiri tanpa perlu izin Admin, TAPI baris
--      itu belum dihitung di rekap/dashboard/grafik/halaman publik (hanya baris DISETUJUI yang dihitung).
--   3. Admin meninjau & menyetujui satu per satu (atau massal) lewat menu Permintaan -> DISETUJUI, baru saat
--      itu baris itu ikut dihitung di total resmi.
--   4. Begitu DISETUJUI, UPT tidak bisa lagi mengedit baris itu langsung (ditolak 403) -- harus mengajukan
--      hapus (memakai alur permintaan hapus yang sudah ada) dulu, baru bisa memasukkan data baru di posisinya.
--
-- Grain "satu baris": rekap_nilai per (jenis_data_id, upt_key, period_id, baris_ke) -- satu Simpan selalu
-- menyimpan SEMUA field satu baris_ke bersamaan, jadi status per baris DB (per field_key) otomatis tetap
-- sinkron dalam satu grup baris_ke. data_entries & dokumen_upload: satu baris DB = satu baris approval.
-- ==========================================================
USE `Puslatkp1a`;

ALTER TABLE rekap_nilai
  ADD COLUMN status              VARCHAR(10)  NOT NULL DEFAULT 'draft' COMMENT 'draft | disetujui' AFTER value_text,
  ADD COLUMN disetujui_at        DATETIME     NULL AFTER status,
  ADD COLUMN disetujui_by        CHAR(36)     NULL AFTER disetujui_at,
  ADD COLUMN disetujui_by_label  VARCHAR(190) NULL AFTER disetujui_by,
  ADD KEY idx_rekap_nilai_status (status),
  ADD CONSTRAINT fk_rn_disetujui_by FOREIGN KEY (disetujui_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE data_entries
  ADD COLUMN status              VARCHAR(10)  NOT NULL DEFAULT 'draft' COMMENT 'draft | disetujui' AFTER data_ekstra,
  ADD COLUMN disetujui_at        DATETIME     NULL AFTER status,
  ADD COLUMN disetujui_by        CHAR(36)     NULL AFTER disetujui_at,
  ADD COLUMN disetujui_by_label  VARCHAR(190) NULL AFTER disetujui_by,
  ADD KEY idx_data_entries_status (status),
  ADD CONSTRAINT fk_de_disetujui_by FOREIGN KEY (disetujui_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE dokumen_upload
  ADD COLUMN status              VARCHAR(10)  NOT NULL DEFAULT 'draft' COMMENT 'draft | disetujui' AFTER catatan,
  ADD COLUMN disetujui_at        DATETIME     NULL AFTER status,
  ADD COLUMN disetujui_by        CHAR(36)     NULL AFTER disetujui_at,
  ADD COLUMN disetujui_by_label  VARCHAR(190) NULL AFTER disetujui_by,
  ADD KEY idx_dokumen_upload_status (status),
  ADD CONSTRAINT fk_du_disetujui_by FOREIGN KEY (disetujui_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Data yang sudah ada sebelum migrasi ini (dibuat semasa belum ada lapisan persetujuan per-baris) dianggap
-- sudah disetujui, supaya dashboard/rekap yang sudah berjalan tidak tiba-tiba kehilangan datanya.
UPDATE rekap_nilai   SET status = 'disetujui', disetujui_at = updated_at  WHERE deleted_at IS NULL;
UPDATE data_entries  SET status = 'disetujui', disetujui_at = created_at WHERE deleted_at IS NULL;
UPDATE dokumen_upload SET status = 'disetujui', disetujui_at = created_at WHERE deleted_at IS NULL;

-- Halaman publik (v_publik_rekap) hanya boleh menghitung data yang sudah disetujui.
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
JOIN periods p ON p.id = de.period_id
WHERE jd.publik_boleh_lihat = 1 AND jd.aktif = 1 AND de.deleted_at IS NULL AND de.status = 'disetujui'
GROUP BY de.jenis_data_id, jd.judul, de.period_id, p.label, p.level, p.tahun, p.bulan;
