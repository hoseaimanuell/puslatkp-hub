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
(berkas Arsip Historis + kolom bertipe Berkas) — keduanya harus dari waktu yang sama; simpan di luar server.

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
| `database/migrasi_06_kolom_berkas.sql` | Menambah tipe kolom `file` (Kelola Jenis Data) + tabel `field_files`. Jalankan setelah migrasi_05, lalu restart be |
| `database/migrasi_02_tempat_sampah.sql` | Menambah kolom tempat sampah (`deleted_*`) pada 4 tabel data + memperbarui view publik. Jalankan **setelah** migrasi_01 |
| `database/migrasi_07_kumulatif_bulanan.sql` | Menambah `jenis_data.kumulatif_bulanan` (toggle "Data kumulatif" di Kelola Jenis Data). Jalankan setelah migrasi_06, lalu restart be |
| `database/migrasi_08_dokumen_resmi.sql` | Membuat tabel `dokumen_resmi` (menu Dokumen & Panduan) dan menyemai 3 dokumen bawaan. Jalankan setelah migrasi_07, lalu restart be |
| `database/migrasi_09_opsi_bersyarat.sql` | Menambah `field_definitions.opsi_bersyarat` (kolom Pilihan dengan opsi tergantung kolom lain). Jalankan setelah migrasi_08, lalu restart be |
| `database/migrasi_10_permintaan_hapus.sql` | Membuat tabel `permintaan_hapus` (menu Permintaan, bagian "Hapus & Buka Kunci") — akun UPT tidak lagi langsung menghapus data, perlu persetujuan Admin. Jalankan setelah migrasi_09, lalu restart be |
| `database/migrasi_11_periode_kirim.sql` | Membuat tabel `periode_kirim` (fitur "Kirim Data") dan menambah kolom `permintaan_hapus.period_id`/`jenis_data_id`. Akun UPT bisa mengirim/mengunci periode. Jalankan setelah migrasi_10, lalu restart be |
| `database/migrasi_12_status_kirim.sql` | Menambah `periode_kirim.status`/`disetujui_at`/`disetujui_by`/`disetujui_by_label` — "Kirim" kini membuat status **draft** (masih bebas diedit/dihapus UPT), baru terkunci setelah Admin **Setujui** (menu Permintaan, bagian "Persetujuan Data"). Baris lama dibackfill jadi `disetujui`. Jalankan setelah migrasi_11, lalu restart be |
| `database/migrasi_13_status_baris.sql` | Menambah `status`/`disetujui_at`/`disetujui_by`/`disetujui_by_label` pada `rekap_nilai`, `data_entries`, `dokumen_upload` — lapisan KEDUA persetujuan, terpisah dari migrasi_12: setiap baris yang UPT **simpan** (bukan cuma saat Kirim) langsung **draft**, dihitung di rekap/dashboard/publik baru setelah Admin **Setujui** per baris (menu Permintaan, bagian "Persetujuan Baris Data"). Baris lama dibackfill jadi `disetujui`; `v_publik_rekap` diperbarui untuk hanya menghitung baris `disetujui`. Jalankan setelah migrasi_12, lalu restart be |

> ✅ **`database/puslatkp1a.sql` sudah memuat migrasi_01–13 secara penuh** (`be/scripts/ddl.sql` dan `seed-data.js`
> disinkronkan ulang — lihat catatan di [04-database.md](04-database.md#data-awal-seed)). **Instalasi baru cukup
> mengimpor `puslatkp1a.sql` sekali saja**, tanpa perlu menjalankan berkas `migrasi_*.sql` satu per satu. Tabel di
> atas hanya untuk **database lama** yang sudah terlanjur diimpor sebelum tanggal sinkronisasi ini.

Jalankan setiap berkas **sekali saja** (menjalankan ulang sebagian besar menghasilkan galat "Duplicate column"/"Table
already exists" yang tidak berbahaya). Backend tetap berjalan sebelum migrasi_02 dijalankan — tempat sampah otomatis
nonaktif dan penghapusan bersifat permanen sampai migrasi dijalankan. Cek hasil: di phpMyAdmin buka tabel
`rekap_nilai` → *Structure* → *Relation view*; kolom `upt_key` harus berstatus `ON DELETE CASCADE`.

Alternatif tanpa phpMyAdmin (dari folder `be`, kredensial diambil dari `be/.env`):

```bash
node scripts/run-migration.mjs migrasi_07_kumulatif_bulanan.sql
node scripts/run-migration.mjs migrasi_08_dokumen_resmi.sql
node scripts/run-migration.mjs migrasi_09_opsi_bersyarat.sql
node scripts/run-migration.mjs migrasi_10_permintaan_hapus.sql
node scripts/run-migration.mjs migrasi_11_periode_kirim.sql
node scripts/run-migration.mjs migrasi_12_status_kirim.sql
node scripts/run-migration.mjs migrasi_13_status_baris.sql
```

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
* Dashboard: kartu & kotak anggaran terhitung dari isian UPT (Total Realisasi Anggaran dari *Masyarakat + Aparatur +
  Data Belanja Modal*, **bukan** dijumlah dari RM/PNBP-BLU/SBSN — lihat [06-panduan-pengguna.md](06-panduan-pengguna.md#dashboard)),
  angka bersifat kumulatif dari minggu ke-1 tahun berjalan, status "Menunggu" bila belum ada isian, dan akun UPT
  hanya melihat UPT-nya sendiri.
* Hapus UPT: akun, `rekap_nilai`, `data_entries`, `daily_activity` UPT tersebut ikut terhapus; UPT lain tidak
  bisa menghapus UPT (403); token akun yang dihapus langsung tidak berlaku.

Belum diuji di lingkungan ini: `docker compose` (Docker tidak terpasang) dan MariaDB.

## Batasan yang diketahui

* **Jenis data uji coba di lingkungan pengembangan ini tidak ikut disemai.** Saat menyinkronkan `seed-data.js`
  (lihat di atas), ditemukan beberapa jenis data hasil eksperimen langsung lewat menu Kelola Jenis Data di database
  pengembangan ini yang tampak seperti data uji, bukan desain permanen: `data_masyarakat_2` (kosong, tanpa kolom),
  `data_aparatur_2` (duplikat "Data Aparatur"), dan jenis data asli berkunci `data_aparatur` yang judulnya berubah
  jadi "Data Instruktur dan WI" dengan kolom yang disederhanakan (bentrok nama dengan jenis data asli
  `data_instruktur_dan_wi`). **Semua itu sengaja TIDAK dimasukkan** ke `seed-data.js`/`puslatkp1a.sql` — bila
  ternyata salah satu memang permanen, beri tahu agar ditambahkan dengan benar.
* **`Rekap Triwulan & Tahun`** ("Total Realisasi Anggaran") masih dijumlahkan dari RM + PNBP/BLU + SBSN (belum
  disamakan dengan perbaikan yang sudah diterapkan di **Dashboard**, yang totalnya dari Masyarakat + Aparatur +
  Data Belanja Modal). Berpotensi memberi angka yang berbeda antara dua halaman itu untuk periode yang sama.
* **Berkas unggahan** (kolom bertipe `file`, Arsip Historis) disimpan di disk (`STORAGE_DIR`); **berkas mode lama**
  (`dokumen_upload`, jenis data `upload_file`) masih disimpan base64 di database (LONGTEXT). Daftar berkas memuat
  isi berkas; untuk volume besar pisahkan ke penyimpanan berkas.
* **Halaman `views/admin/RekapEksporSemuaUPT.jsx`** ikut dimigrasikan tetapi tidak dipakai oleh menu mana pun (sudah demikian di versi lama).
* **Impor Excel** dikirim per batch 100 baris (tiap batch atomik). Bila gagal di tengah, batch sebelumnya sudah tersimpan;
  mengimpor ulang berkas yang sama aman (NIK yang sama diperbarui). Baris tanpa NIK akan terduplikasi bila diimpor ulang.
* **Data by name / rekap bulanan admin** masih memuat seluruh baris bulan itu ke browser (aman sampai ±puluhan ribu baris);
  untuk volume lebih besar perlu agregasi & paginasi di server.
* **Ganti password** belum ada di UI (gunakan `npm run user:password`).
* **Pembatasan jenis data per organisasi** (mis. "hanya organisasi tertentu yang mengisi jenis data tertentu")
  belum ada — semua akun UPT saat ini bisa mengisi semua Jenis Data yang levelnya sesuai.
* **Impor Data Historis**: belum ada pilihan "Perbarui/Tambah" vs "Ganti Semua" saat mengunggah ulang berkas untuk
  jenis data & periode yang sama — perilaku saat ini selalu memperbarui baris ber-NIK yang sama (lihat bagian
  [Impor Data Historis](06-panduan-pengguna.md#impor-data-historis)).
* **UPT yang sudah tidak ada** belum dapat dinonaktifkan dari UI (hanya dihapus, yang ikut menghapus datanya). Biarkan tetap di daftar.
* Token disimpan di `localStorage` (umum untuk SPA); bila kebijakan Anda mengharuskan cookie `HttpOnly`,
  ini perlu penyesuaian di `be/src/routes/auth.js` dan `fe/src/lib/db.js`.

## Pemecahan masalah lanjutan

| Gejala | Cek |
| :-- | :-- |
| Data tidak muncul untuk akun UPT | Pastikan `profiles.upt_key` terisi & sama dengan `upt_key` pada data |
| Data UPT bertanda merah "Terlambat" | Disimpan setelah deadline. Normal; tidak dapat diubah kecuali data dihapus & diisi ulang oleh Admin |
| "Arsip Historis belum aktif" (409) | Jalankan `database/migrasi_04_terlambat_dan_arsip.sql` lalu restart be |
| "Kolom bertipe Berkas belum aktif" (409) | Jalankan `database/migrasi_06_kolom_berkas.sql` lalu restart be |
| Toggle "Data kumulatif" tidak muncul di Kelola Jenis Data | Jalankan `database/migrasi_07_kumulatif_bulanan.sql` lalu restart be (cek `GET /api/health` → `features.kumulatifBulanan`) |
| Menu **Dokumen & Panduan** kosong / "Tabel tidak dikenal: dokumen_resmi" | Jalankan `database/migrasi_08_dokumen_resmi.sql` lalu restart be |
| Kolom pilihan bersyarat tidak berfungsi (opsi tidak berubah) | Jalankan `database/migrasi_09_opsi_bersyarat.sql` lalu restart be; pastikan juga `field_definitions.opsi_bersyarat` sudah diisi untuk kolom tersebut |
| Akun UPT masih bisa menghapus data langsung (tidak masuk Permintaan) | Jalankan `database/migrasi_10_permintaan_hapus.sql` lalu restart be (cek `GET /api/health` → `features.permintaanHapus`) |
| Menu **Permintaan** kosong / "Tabel tidak dikenal: permintaan_hapus" | Jalankan `database/migrasi_10_permintaan_hapus.sql` lalu restart be |
| Tombol **"Kirim"** tidak muncul di Input Mingguan/Bulanan | Jalankan `database/migrasi_11_periode_kirim.sql` lalu restart be (cek `GET /api/health` → `features.periodeKirim`) |
| "Kirim" langsung mengunci (tidak ada status draft/persetujuan) | Jalankan `database/migrasi_12_status_kirim.sql` lalu restart be — tanpa ini, `periode_kirim.status` belum ada dan fitur draft/disetujui nonaktif total |
| Data yang UPT simpan langsung resmi (tidak ada badge "Menunggu Persetujuan", bagian "Persetujuan Baris Data" di menu Permintaan tidak muncul) | Jalankan `database/migrasi_13_status_baris.sql` lalu restart be (cek `GET /api/health` → `features.persetujuanBaris`) |
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
