# PUSLATKP Management Hub

Portal pelaporan aktivitas dan kinerja tim **Pusat Pelatihan Kelautan dan Perikanan (PUSLATKP)** – KKP.
Mencakup Jenis Data dinamis (Form Builder), pelaporan mingguan/bulanan/triwulan/tahunan, validasi silang
mingguan vs bulanan, penanda **terlambat** setelah deadline, Arsip Data Historis (Excel/PDF), impor/ekspor Excel, dan 3 tingkat akses (Admin, UPT, Publik).

| Lapisan | Teknologi | Servis |
| :-- | :-- | :-- |
| Frontend | **Next.js 16** (App Router) + React 19 + Tailwind CSS 4 | `fe` (port 3000) |
| Backend | **Express 5** (Node.js) + JWT + bcrypt | `be` (port 4000) |
| Database | **MySQL** – nama database **`Puslatkp1a`** (dikelola lewat phpMyAdmin) | – |

> Tampilan aplikasi **sama persis** dengan versi sebelumnya. Yang berubah adalah mesin di belakangnya:
> Supabase/Local Storage diganti backend Express + MySQL.

## Struktur proyek

```
puslatkp-hub/
├─ fe/                  Frontend Next.js (servis "fe")
│  └─ src/app/          Route Next.js: /dashboard, /input-mingguan, /input-bulanan, /publik, ...
│  └─ src/views/        Halaman & komponen UI (tampilan asli)
│  └─ src/lib/db.js     Klien API ke backend
├─ be/                  Backend Express (servis "be")
│  ├─ src/              server, auth, aturan akses tabel, query engine
│  └─ scripts/          pembangun SQL, init DB, generator periode, ganti password
├─ database/
│  ├─ puslatkp1a.sql              Skema + data master + akun awal  (IMPORT INI)
│  ├─ puslatkp1a_contoh_data.sql  Data contoh, opsional
│  ├─ migrasi_01_hapus_upt_cascade.sql  Peningkatan DB lama (hapus UPT = hapus datanya)
│  ├─ migrasi_02_tempat_sampah.sql      Peningkatan DB lama (tempat sampah / soft delete)
│  ├─ migrasi_03_baris_dan_agregasi.sql Peningkatan DB lama (beberapa pelatihan/minggu + rekap kumulatif)
│  ├─ migrasi_04_terlambat_dan_arsip.sql Peningkatan DB lama (penanda terlambat + Arsip Data Historis)
│  └─ migrasi_05_pengaturan_dashboard.sql Peningkatan DB lama (menu Kelola Dashboard)
├─ docs/                Dokumentasi lengkap
├─ docker-compose.yml   Menjalankan fe + be
├─ run.bat / run.ps1    Peluncur development di Windows (Laragon)
└─ _legacy-vite/        Arsip proyek lama (Vite + Supabase) – tidak dipakai lagi
```

## Mulai cepat (Windows + Laragon + phpMyAdmin)

1. **Database** – buka phpMyAdmin → *New* → buat database **`Puslatkp1a`** (collation `utf8mb4_unicode_ci`) →
   tab **Import** → pilih `database/puslatkp1a.sql` → *Go*. (Opsional: impor juga `puslatkp1a_contoh_data.sql`.)
2. **Backend** – salin `be/.env.example` menjadi `be/.env`, isi `JWT_SECRET` (min. 16 karakter acak). Bila MySQL
   Laragon Anda memakai password, isi `DB_PASSWORD`.
3. **Jalankan** – klik dua kali **`run.bat`** (menginstal dependensi otomatis lalu menjalankan `be` dan `fe`).
4. Buka **http://localhost:3000** dan login.

Cara manual, Docker, dan deployment produksi: lihat [docs/02-instalasi-dan-menjalankan.md](docs/02-instalasi-dan-menjalankan.md).

## Akun awal

| Peran | Email | Password |
| :-- | :-- | :-- |
| Admin | `admin@puslatkp.kkp.go.id` | `AdminPuslatkp2026!` |
| UPT (contoh) | `bppp.jakarta@kkp.go.id` | `Jakarta2026!` |

Daftar lengkap 10 akun BPPP ada di [docs/05-akun-dan-keamanan.md](docs/05-akun-dan-keamanan.md).
**Ganti password bawaan sebelum dipakai di produksi** (`npm run user:password`).

## Dokumentasi

| Berkas | Isi |
| :-- | :-- |
| [01-arsitektur.md](docs/01-arsitektur.md) | Arsitektur, alur data, keputusan desain, perubahan dari versi lama |
| [02-instalasi-dan-menjalankan.md](docs/02-instalasi-dan-menjalankan.md) | Instalasi lokal, phpMyAdmin, Docker, produksi, pemecahan masalah |
| [03-api-reference.md](docs/03-api-reference.md) | Seluruh endpoint API + matriks hak akses per tabel |
| [04-database.md](docs/04-database.md) | ERD, deskripsi tabel & kolom, aturan periode/deadline |
| [05-akun-dan-keamanan.md](docs/05-akun-dan-keamanan.md) | Akun, peran, autentikasi, keamanan |
| [06-panduan-pengguna.md](docs/06-panduan-pengguna.md) | Cara memakai setiap menu, per peran |
| [07-pemeliharaan.md](docs/07-pemeliharaan.md) | Backup, tambah periode/tahun, pembaruan, batasan yang diketahui |
