# 07 — Pemeliharaan & Pengembangan

## Tugas rutin

### Periode tahun baru (otomatis)
Server membuat periode **tahun berjalan dan tahun depan** secara otomatis (saat start dan tiap 12 jam), sehingga pergantian
tahun tidak lagi membutuhkan tindakan manual. Periode yang sudah ada **tidak ditimpa**, jadi deadline yang pernah
diperpanjang Admin tetap aman.

Untuk tahun lain (mis. data historis) gunakan menu **Kelola Periode**, atau terminal:

```bash
cd be
npm run periods -- 2021 2025        # rentang tahun (maks. 12 tahun)
npm run periods -- 2024 --reset     # KEMBALIKAN tanggal & deadline tahun itu ke aturan bawaan (menimpa perubahan Admin)
```

### Checklist tahunan (Desember)
1. **Backup** database (`mysqldump`) dan simpan di luar server; uji pulihkan sesekali.
2. Menu **Kelola Periode**: pastikan tahun depan sudah ada (65 / 65).
3. Tinjau **Kelola Akun UPT** (akun baru/tidak aktif) dan **Kelola Jenis Data**. Untuk kolom yang tidak dipakai lagi,
   **nonaktifkan** (jangan hapus) agar data tahun-tahun lalu tetap terbaca.
4. Ganti password akun penting; periksa dependensi (`npm audit`) dan versi Node/MySQL.
5. Bersihkan **Tempat Sampah** bila perlu dan tinjau **Catatan Aktivitas**.

### Memasukkan data tahun-tahun lalu
1. **Kelola Periode** → *Buat 5 tahun ke belakang*.
2. **Impor Data Historis** untuk tiap jenis data (template Excel per jenis data) — lihat panduan di
   [06-panduan-pengguna.md](06-panduan-pengguna.md#impor-data-historis).
3. **Jangan menghapus UPT** yang sudah tidak ada: menghapus UPT menghapus seluruh datanya. Biarkan di daftar.
4. Verifikasi di **Rekap Triwulan & Tahun** (pilih tahun lampau) dan bandingkan dengan sumber data lama.

### Backup
Lihat [04-database.md](04-database.md#backup--restore). Jadwalkan `mysqldump` harian pada produksi **dan salin folder `be/storage`**
(berkas Arsip Historis) — keduanya harus dari waktu yang sama; simpan di luar server.

### Mengganti password / membuat akun
[05-akun-dan-keamanan.md](05-akun-dan-keamanan.md#mengelola-akun).

### Memperbarui aplikasi
* **Tanpa coding** (via menu Admin, langsung berlaku): jenis data, kolom form, akun & daftar UPT.
* **Perubahan kode**: ubah di `fe/` atau `be/`, uji lokal, lalu
  * Docker: `docker compose up -d --build`
  * pm2: `git pull`, `npm ci`, `npm run build` (fe), `pm2 restart …`

## Peningkatan dari versi sebelumnya (migrasi database)

Jika database `Puslatkp1a` sudah terlanjur diimpor sebelum fitur *hapus UPT ikut menghapus datanya*, jalankan
**sekali** di phpMyAdmin (tab **Import**, atau tab **SQL**):

| Berkas | Fungsi |
| :-- | :-- |
| `database/migrasi_01_hapus_upt_cascade.sql` | Mengubah foreign key `upt_key` menjadi `ON DELETE CASCADE` (data & akun UPT ikut terhapus saat UPT dihapus) |
| `database/migrasi_03_baris_dan_agregasi.sql` | Menambah `rekap_nilai.baris_ke`, `jenis_data.multi_baris`, `field_definitions.agregasi` (beberapa pelatihan per minggu + cara rekap kumulatif) dan mengisi nilai bawaannya. Jalankan **setelah** migrasi_02 |
| `database/migrasi_04_terlambat_dan_arsip.sql` | Menambah kolom `terlambat` (deadline tidak lagi mengunci) pada 3 tabel data + tabel `arsip_historis` (Arsip Data Historis). Jalankan **setelah** migrasi_03. Folder `be/storage` dibuat otomatis oleh server |
| `database/migrasi_05_pengaturan_dashboard.sql` | Membuat tabel `dashboard_widgets` (menu Kelola Dashboard). Tabel kosong = tampilan bawaan. Jalankan setelah migrasi_04, lalu restart be |
| `database/migrasi_02_tempat_sampah.sql` | Menambah kolom tempat sampah (`deleted_*`) pada 4 tabel data + memperbarui view publik. Jalankan **setelah** migrasi_01 |

Instalasi baru dari `puslatkp1a.sql` terbaru sudah memuat keduanya. Jalankan setiap berkas **sekali saja**
(menjalankan ulang migrasi_02 menghasilkan galat "Duplicate column" yang tidak berbahaya). Backend tetap berjalan sebelum
migrasi_02 dijalankan — tempat sampah otomatis nonaktif dan penghapusan bersifat permanen sampai migrasi dijalankan. Cek hasil: di phpMyAdmin buka tabel `rekap_nilai` →
*Structure* → *Relation view*; kolom `upt_key` harus berstatus `ON DELETE CASCADE`.

## Mengubah skema database

1. Edit `be/scripts/ddl.sql` (untuk instalasi baru) **dan** siapkan skrip `ALTER TABLE` untuk database yang sudah
   berjalan (jalankan lewat phpMyAdmin).
2. Jika menambah **tabel/kolom baru** yang akan diakses dari UI, daftarkan di `be/src/schema.js`
   (kolom, kolom JSON/boolean, aturan baca/tulis, `scope`/`lock`). Tanpa itu, be akan menolak dengan
   *"Tabel tidak dikenal"* / *"Kolom tidak dikenal"*.
3. `cd be && npm run db:build` untuk memperbarui `database/puslatkp1a.sql`.

Contoh menambah kolom `catatan` di `daily_activity`:

```sql
ALTER TABLE daily_activity ADD COLUMN catatan TEXT NULL;
```

```js
// be/src/schema.js → daily_activity.cols
cols: [..., 'feedback', 'catatan', 'created_at', 'updated_at'],
```

## Mengubah data seed
Data master ada di `be/scripts/seed-data.js` (UPT, akun, jenis data, kolom). Setelah mengubahnya jalankan
`npm run db:build`. Ingat: impor ulang memakai `INSERT IGNORE`/`ON DUPLICATE KEY UPDATE`, sehingga data yang
sudah ada (mis. password yang sudah diganti) **tidak ditimpa**.

## Migrasi dari versi lama (Vite + Supabase)

* Kode lama diarsipkan di `_legacy-vite/` (termasuk skema PostgreSQL asli di `_legacy-vite/supabase/`,
  `mockClient.js`, dan dependensinya). Folder ini boleh dihapus setelah Anda yakin tidak membutuhkannya.
* **Data lama tidak dimigrasikan otomatis.** Mode demo menyimpan data di Local Storage browser, dan proyek
  Supabase (bila ada) berisi data terpisah. Jika ada data Supabase yang harus dibawa, ekspor tabelnya ke CSV lalu
  impor ke MySQL lewat phpMyAdmin (urutan: `upt_list` → `periods` → `jenis_data` → `field_definitions` →
  `rekap_nilai` / `data_entries`), atau minta dibuatkan skrip migrasi.
* Akun Supabase Auth tidak dapat dipindah (hash berbeda); buat ulang akun lewat menu Kelola Akun UPT.

## Pengujian yang sudah dilakukan

Pada pengembangan ini (MySQL 8.0.30, Node 22, Next.js 16.3.5):

* `puslatkp1a.sql` dan `puslatkp1a_contoh_data.sql` diimpor tanpa galat pada MySQL 8.0.
* Backend: login benar/salah, pembatasan anonim (401), akun UPT tidak dapat membaca/menulis data UPT lain,
  penandaan `terlambat` (UPT setelah deadline vs Admin), Arsip Historis (unggah/tolak jenis berkas/scope/unduh/hapus), upsert idempoten, `insert(...).select().single()`, JSON/boolean,
  buat akun + email ganda (409), larangan hapus diri sendiri, penolakan kolom/nama berbahaya (SQL injection),
  `UPDATE`/`DELETE` tanpa filter.
* Frontend: `next build` sukses (semua route), build `standalone` sukses, dan alur login → dashboard →
  input mingguan → input bulanan (+ rekap) diverifikasi di browser terhadap data MySQL nyata.
* Dashboard: kartu & kotak anggaran terhitung dari isian UPT (total = RM + PNBP/BLU + SBSN), status "Menunggu"
  bila belum ada isian, dan akun UPT hanya melihat UPT-nya sendiri.
* Hapus UPT: akun, `rekap_nilai`, `data_entries`, `daily_activity` UPT tersebut ikut terhapus; UPT lain tidak
  bisa menghapus UPT (403); token akun yang dihapus langsung tidak berlaku.

Belum diuji di lingkungan ini: `docker compose` (Docker tidak terpasang) dan MariaDB.

## Batasan yang diketahui

* **Halaman Documents**: dokumen tambahan tersimpan di Local Storage per browser (perilaku bawaan versi lama).
* **Berkas unggahan** disimpan base64 di database (LONGTEXT). Daftar berkas memuat isi berkas; untuk volume besar
  pisahkan ke penyimpanan berkas.
* **Halaman `views/admin/RekapEksporSemuaUPT.jsx`** ikut dimigrasikan tetapi tidak dipakai oleh menu mana pun (sudah demikian di versi lama).
* **Impor Excel** dikirim per batch 100 baris (tiap batch atomik). Bila gagal di tengah, batch sebelumnya sudah tersimpan;
  mengimpor ulang berkas yang sama aman (NIK yang sama diperbarui). Baris tanpa NIK akan terduplikasi bila diimpor ulang.
* **Data by name / rekap bulanan admin** masih memuat seluruh baris bulan itu ke browser (aman sampai ±puluhan ribu baris);
  untuk volume lebih besar perlu agregasi & paginasi di server.
* **Ganti password** belum ada di UI (gunakan `npm run user:password`).
* **UPT yang sudah tidak ada** belum dapat dinonaktifkan dari UI (hanya dihapus, yang ikut menghapus datanya). Biarkan tetap di daftar.
* Token disimpan di `localStorage` (umum untuk SPA); bila kebijakan Anda mengharuskan cookie `HttpOnly`,
  ini perlu penyesuaian di `be/src/routes/auth.js` dan `fe/src/lib/db.js`.

## Pemecahan masalah lanjutan

| Gejala | Cek |
| :-- | :-- |
| Data tidak muncul untuk akun UPT | Pastikan `profiles.upt_key` terisi & sama dengan `upt_key` pada data |
| Data UPT bertanda merah "Terlambat" | Disimpan setelah deadline. Normal; tidak dapat diubah kecuali data dihapus & diisi ulang oleh Admin |
| "Arsip Historis belum aktif" (409) | Jalankan `database/migrasi_04_terlambat_dan_arsip.sql` lalu restart be |
| "Berkas fisik tidak ditemukan di server" | Folder `be/storage`/`STORAGE_DIR` tidak ikut dipulihkan dari backup |
| "Kolom tidak dikenal: …" | Kolom baru belum didaftarkan di `be/src/schema.js` |
| Jam/tanggal bergeser satu hari | Sesi MySQL dipaksa UTC; `DATE` dikirim sebagai teks tanpa konversi zona waktu, `DATETIME` sebagai ISO UTC |
| `Data tidak dapat dihapus karena masih dipakai` | UPT/jenis data masih punya data terkait (FK) – hapus data turunannya dulu |
| Ingin melihat log server | Terminal `be`, atau `docker compose logs -f be` |

## Membagikan web lewat internet sementara

Untuk demo/uji sebelum hosting kantor siap. Jalankan **`bagikan-online.bat`** (klik ganda) di komputer ini:

1. Build frontend, lalu menyalakan be (port 4100) dan fe (port 3100) — terpisah dari `npm run dev` (3000/4000).
2. Membuka tunnel: memakai `cloudflared` bila sudah terpasang, jika tidak memakai SSH bawaan Windows ke `localhost.run`
   (gratis, tanpa akun). Alamat `https://...` muncul di jendela **TUNNEL**; itu yang dibagikan.
3. **Mematikan**: tutup jendela TUNNEL, FE, dan BE. Alamat langsung tidak berlaku lagi.

Catatan: komputer harus menyala; alamat berubah setiap tunnel dijalankan; database yang dipakai adalah database di `be/.env`.
**Ganti password bawaan** ([05-akun-dan-keamanan.md](05-akun-dan-keamanan.md)) sebelum membagikan alamatnya — siapa pun yang punya alamat
bisa mencoba login. Di balik layar, fe meneruskan `/api` ke be (`API_PROXY`), sehingga browser hanya memakai satu alamat.
