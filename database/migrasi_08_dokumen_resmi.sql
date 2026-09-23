-- ==========================================================
-- MIGRASI 08 — Dokumen & Panduan tersimpan di database (bukan localStorage)
-- Jalankan SEKALI di phpMyAdmin pada database Puslatkp1a yang SUDAH terlanjur diimpor.
-- Instalasi baru dari puslatkp1a.sql terbaru tidak perlu menjalankan berkas ini.
--
-- Sebelumnya menu "Dokumen & Panduan" (tab pertama di Dokumen & Arsip) menyimpan daftar dokumennya di
-- localStorage BROWSER, bukan database — dokumen yang ditambahkan Admin hanya tersimpan di browser Admin
-- sendiri dan TIDAK terlihat oleh siapapun yang login dari perangkat/browser lain (termasuk akun UPT),
-- sehingga tampak seolah-olah menu ini "hanya bisa dilihat Admin". Tabel ini memindahkan penyimpanannya ke
-- database supaya dokumen yang ditambahkan Admin bisa dilihat semua akun yang login (UPT & Admin), sesuai
-- pengaturan Kelola Akun UPT masing-masing.
--
-- Sebelum migrasi ini dijalankan, halaman Dokumen & Panduan tetap tampil apa adanya dari localStorage
-- (perilaku lama, bug di atas belum diperbaiki).
-- ==========================================================
USE `Puslatkp1a`;

CREATE TABLE IF NOT EXISTS dokumen_resmi (
  id                CHAR(36)     NOT NULL,
  judul             VARCHAR(255) NOT NULL,
  deskripsi         VARCHAR(500) NULL,
  kategori          VARCHAR(50)  NOT NULL DEFAULT 'Pedoman',
  format            VARCHAR(10)  NOT NULL DEFAULT 'TXT',
  isi               LONGTEXT     NULL,
  file_name         VARCHAR(255) NULL,
  mime              VARCHAR(100) NULL,
  created_by        CHAR(36)     NULL,
  created_by_label  VARCHAR(190) NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_dokres_by FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pindahkan 3 dokumen bawaan yang sebelumnya hardcode di kode frontend, supaya isinya tidak hilang.
INSERT INTO dokumen_resmi (id, judul, deskripsi, kategori, format, isi, file_name, mime) VALUES
(UUID(), 'Petunjuk Teknis Pelaporan Kinerja & Aktivitas Harian UPT',
 'Buku panduan pengisian daily activity, batas waktu pelaporan, dan rekonsiliasi data mingguan.',
 'Pedoman', 'TXT',
 'PETUNJUK TEKNIS PELAPORAN KINERJA & AKTIVITAS HARIAN UPT\nPUSLATKP - KEMENTERIAN KELAUTAN DAN PERIKANAN\n\n1. Ketentuan Umum:\n- Seluruh UPT wajib melaporkan aktivitas harian dan rekap mingguan.\n- Batas waktu input data mingguan adalah setiap akhir periode berjalan.\n- Rekonsiliasi bulanan mencocokkan total peserta 4 minggu dengan rincian data peserta by name.\n\n2. Format & Prosedur:\n- Gunakan template excel resmi untuk unggah massal.\n- Laporkan kendala dan output nyata kegiatan pada modul Daily Activity.',
 'Juknis_Pelaporan_Kinerja_UPT_PUSLATKP.txt', 'text/plain;charset=utf-8;'),
(UUID(), 'Kepmen KKP tentang Standar Pelatihan Kelautan dan Perikanan',
 'Dasar regulasi dan acuan standar kompetensi pelatihan aparatur dan masyarakat kelautan perikanan.',
 'Regulasi', 'TXT',
 'SALINAN KEPUTUSAN MENTERI KELAUTAN DAN PERIKANAN REPUBLIK INDONESIA\nTENTANG STANDAR PELATIHAN KELAUTAN DAN PERIKANAN\n\nMenimbang: Perlunya standardisasi mutu kompetensi sumber daya manusia kelautan dan perikanan...\nMengingat: Undang-Undang Kelautan dan Perikanan Republik Indonesia...\n\nMenetapkan:\nStandar Kurikulum, Silabus, Sarana Prasarana, dan Tenaga Pendidik / Instruktur / Widyaiswara pada Balai Pelatihan Kelautan dan Perikanan.',
 'Kepmen_Standar_Pelatihan_Kelautan_Perikanan.txt', 'text/plain;charset=utf-8;'),
(UUID(), 'Standar Operasional Prosedur (SOP) Validasi Selisih Data',
 'Protokol penyesuaian saat terdeteksi selisih angka antara level Bulanan dan Mingguan.',
 'SOP', 'TXT',
 'STANDAR OPERASIONAL PROSEDUR (SOP) VALIDASI DATA & REKONSILIASI SELISIH\n\nLangkah-langkah Penanganan:\n1. Buka modul Input Data pada jenis data yang bersangkutan.\n2. Cek banner status validasi pada tab Bulan.\n3. Periksa selisih jumlah baris nama peserta dengan angka total mingguan.\n4. Lakukan penyesuaian data baris atau perbarui nilai form mingguan sebelum periode dikunci oleh admin.',
 'SOP_Validasi_Selisih_Data_PUSLATKP.txt', 'text/plain;charset=utf-8;');
