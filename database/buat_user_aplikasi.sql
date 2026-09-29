-- ==========================================================
-- Membuat user MySQL KHUSUS aplikasi (pengganti `root` di server produksi).
-- Hak akses hanya pada database Puslatkp1a: bila aplikasi dibobol, database lain dan pengaturan MySQL tetap aman.
--
-- Cara pakai (sekali saja, sebagai root di phpMyAdmin tab SQL / mysql CLI):
--   1. Ganti GANTI_DENGAN_PASSWORD_KUAT di bawah (minimal 16 karakter acak).
--   2. Bila backend berjalan di komputer/kontainer lain, ganti 'localhost' dengan IP/host backend (atau '%').
--   3. Jalankan berkas ini, lalu isi be/.env:  DB_USER=puslatkp_app  DB_PASSWORD=<password tadi>
--   4. Restart backend dan buka /api/health — harus "status":"ok".
--
-- Hak yang diberikan: baca/tulis data (dipakai aplikasi sehari-hari), ubah struktur tabel (dipakai
-- `npm run migrate`), dan SHOW VIEW/LOCK TABLES (dipakai `npm run backup`).
-- ==========================================================
CREATE USER IF NOT EXISTS 'puslatkp_app'@'localhost' IDENTIFIED BY 'GANTI_DENGAN_PASSWORD_KUAT';

GRANT SELECT, INSERT, UPDATE, DELETE,
      CREATE, ALTER, DROP, INDEX, REFERENCES, CREATE VIEW, SHOW VIEW, LOCK TABLES
   ON `Puslatkp1a`.* TO 'puslatkp_app'@'localhost';

FLUSH PRIVILEGES;
