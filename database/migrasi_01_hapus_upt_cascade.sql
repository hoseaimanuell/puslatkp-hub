-- ==========================================================
-- MIGRASI 01 — Hapus UPT ikut menghapus datanya (ON DELETE CASCADE)
-- Jalankan SEKALI di phpMyAdmin pada database Puslatkp1a yang SUDAH terlanjur
-- diimpor dari versi sebelumnya (tab SQL atau Import). Instalasi baru dari
-- puslatkp1a.sql terbaru tidak perlu menjalankan berkas ini.
--
-- Efek: menghapus 1 baris di `upt_list` otomatis menghapus semua akun, rekap_nilai,
-- data_entries, dokumen_upload, dan daily_activity milik UPT tersebut.
-- ==========================================================
USE `Puslatkp1a`;

ALTER TABLE profiles       DROP FOREIGN KEY fk_profiles_upt;
ALTER TABLE profiles       ADD CONSTRAINT fk_profiles_upt FOREIGN KEY (upt_key) REFERENCES upt_list(`key`) ON DELETE CASCADE;

ALTER TABLE rekap_nilai    DROP FOREIGN KEY fk_rn_upt;
ALTER TABLE rekap_nilai    ADD CONSTRAINT fk_rn_upt FOREIGN KEY (upt_key) REFERENCES upt_list(`key`) ON DELETE CASCADE;

ALTER TABLE data_entries   DROP FOREIGN KEY fk_de_upt;
ALTER TABLE data_entries   ADD CONSTRAINT fk_de_upt FOREIGN KEY (upt_key) REFERENCES upt_list(`key`) ON DELETE CASCADE;

ALTER TABLE dokumen_upload DROP FOREIGN KEY fk_du_upt;
ALTER TABLE dokumen_upload ADD CONSTRAINT fk_du_upt FOREIGN KEY (upt_key) REFERENCES upt_list(`key`) ON DELETE CASCADE;

ALTER TABLE daily_activity DROP FOREIGN KEY fk_da_upt;
ALTER TABLE daily_activity ADD CONSTRAINT fk_da_upt FOREIGN KEY (upt_key) REFERENCES upt_list(`key`) ON DELETE CASCADE;
