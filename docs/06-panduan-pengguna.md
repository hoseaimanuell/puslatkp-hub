# 06 — Panduan Pengguna

Aplikasi dibuka di `http://localhost:3000` (atau domain produksi). Tampilan berwarna gelap; sidebar dapat
dibuka/ditutup lewat ikon ☰ di kiri atas dan otomatis menyempit di layar kecil.

## Masuk & keluar

1. Buka aplikasi → isi **Email** dan **Password** → **Masuk**. Akun diberikan Admin.
2. Ikon **↪** di kanan atas untuk **Keluar**. Sesi berakhir otomatis setelah 12 jam.
3. **Tampilan Publik** (tanpa login): tautan di bawah form login, atau langsung `/publik`.

Indikator di bar atas: **Tersambung (MySQL)** (hijau) berarti backend & database normal; **Server Terputus**
(merah) berarti aplikasi tidak bisa menjangkau backend – klik untuk detail.

## Prinsip: setiap UPT hanya melihat datanya sendiri

Akun **UPT** hanya melihat dan mengisi data **UPT-nya sendiri** di seluruh menu (Dashboard, Input Mingguan,
Input Bulanan, Rekap Bulanan, Arsip). Ini ditegakkan di server, bukan hanya di tampilan.
Akun **Admin** melihat semua UPT dan dapat memilih UPT saat memfilter/menginput.

## Menu & fungsinya

| Menu | Alamat | Untuk | Fungsi |
| :-- | :-- | :-- | :-- |
| Dashboard | `/dashboard` | Semua | Ringkasan mingguan dari isian UPT (lihat di bawah) |
| **Input Mingguan** | `/input-mingguan` | Semua | Input & rekap data **mingguan** |
| **Input Bulanan** | `/input-bulanan` | Semua | Input data **bulanan** + tab **Rekap Bulanan** |
| **Rekap Triwulan & Tahun** | `/rekap-triwulan-tahun` | Semua | Hasil rekap **triwulan** dan **tahunan** (baca saja) |
| Kelola Akun UPT | `/kelola-upt` | Admin | Buat/hapus akun UPT, tambah/hapus UPT |
| Kelola Jenis Data | `/kelola-jenis-data` | Admin | Form Builder: jenis data & kolom |
| **Dokumen & Arsip** | `/dokumen-arsip` | Semua | Dua tab: **Dokumen & Panduan** (pedoman, SOP, template Excel) dan **Arsip Data Historis** (berkas Excel/PDF tahun lalu; UPT hanya miliknya) |
| **Kelola Dashboard** | `/kelola-dashboard` | Admin | Mengatur kartu & grafik Dashboard tanpa coding |
| **Pengaturan Lanjutan** (menu lipat) | — | Admin | Jarang dipakai: **Kelola Periode** (`/kelola-periode`), **Impor Data Historis** (`/impor-historis`), **Tempat Sampah** (`/tempat-sampah`) |
| Tampilan Publik | `/publik` | Publik | Satu halaman ringkas: total capaian per kategori data untuk satu tahun |

Alamat lama `/documents`, `/arsip-historis`, `/highlights`, dan `/daily-activity` dialihkan otomatis (Highlights & Daily Activity sudah dihapus).

Alamat lama `/input-data` dan `/rekap-bulanan` otomatis dialihkan ke `/input-mingguan` dan `/input-bulanan`.

## Dashboard

Semua angka di dashboard **berasal dari isian UPT** dan mengikuti **periode mingguan** yang dipilih pada filter
di bagian atas (tombol ◀ ▶ untuk pindah minggu; bawaan = minggu berjalan).

* **3 kartu utama**
  * **Masyarakat Dilatih** – jumlah peserta Jenis Data *Masyarakat*.
  * **Aparatur Dilatih** – jumlah peserta Jenis Data *Aparatur*.
  * **SDM Pelatih** – jumlah instruktur dan widyaiswara (*Data Instruktur dan WI*).
* **Realisasi Anggaran per Sumber Dana** (nilai kumulatif: nilai terakhir tiap UPT sampai minggu terpilih; dari *Data Capaian Anggaran per Sumber Dana*): kotak **RM**,
  **PNBP/BLU**, **SBSN**, dan **Total Realisasi Anggaran** (= RM + PNBP/BLU + SBSN), masing-masing dengan pagunya.
* **Grafik** *Peserta Dilatih* dan *Pagu vs Realisasi* per UPT.
* **Status Pengisian Data** – tabel ✔ *Sudah* / ⏳ *Menunggu* per UPT untuk tiap Jenis Data mingguan.
* Akses cepat ke Input Mingguan, Input Bulanan, Rekap Triwulan & Tahun, dan Dokumen & Arsip.

Bila periode tersedia untuk lebih dari satu tahun, di samping pilihan minggu tampil pilihan **Tahun** (daftar minggu hanya
menampilkan 48 minggu pada tahun terpilih).

Selama UPT belum memasukkan data pada minggu itu, kartu menampilkan **–** dengan keterangan
*"Menunggu input UPT"*, dan grafik menampilkan pesan menunggu. Begitu data disimpan di **Input Mingguan**, angka
otomatis muncul (Admin juga melihat "N dari M UPT sudah input"). Untuk akun UPT, dashboard hanya berisi data UPT tersebut.

## Input Mingguan

Berisi **hanya Jenis Data mingguan**: Masyarakat, Aparatur, Data Instruktur dan WI, Data Belanja Modal, Capaian
Anggaran per Jenis Belanja, dan per Sumber Dana.

1. Halaman menampilkan **rekap mingguan** (filter tahun/triwulan/bulan/minggu/jenis data; Admin juga memilih UPT).
2. Klik **Input Mingguan** (kanan atas) → pilih **Jenis Data** (daftar sudah terfilter mingguan) → pilih periode
   (**Minggu ke-1…4** tiap bulan: tanggal 1–7, 8–14, 15–21, 22–akhir bulan) → isi form → **Simpan**.
   Seluruh isian disimpan sekaligus; **mengosongkan sebuah kolom lalu menyimpan akan menghapus nilainya**
   (masuk Tempat Sampah).
3. **Beberapa pelatihan dalam seminggu.** Bawaannya satu formulir (satu pelatihan). Pada jenis data daftar pelatihan
   (*Masyarakat, Aparatur, Data Belanja Modal*) ada tombol **+ Tambah pelatihan lain (opsional)** yang menambah blok
   *Pelatihan ke-2, ke-3, …*. Tiap blok berisi kolom yang sama; blok dapat dihapus lewat **Hapus pelatihan ini**.
   Angka pada minggu itu = **jumlah semua pelatihan** (mis. peserta 12 + 8 = 20).
4. **Angka kumulatif.** Kolom bertanda **kumulatif** (Pagu, Realisasi, jumlah SDM) diisi dengan **total sampai minggu
   tersebut**, bukan tambahan minggu itu saja. Rekap bulan/triwulan/tahun memakai **nilai terakhir** yang sudah diisi,
   sehingga pagu/realisasi tidak terhitung berulang. Kolom lain (mis. jumlah peserta) dijumlahkan.
5. Tab **Triwulan** dan **Tahun** hanya **rekap otomatis** (sesuai cara rekap tiap kolom) — **tidak ada input
   maupun upload**; tersedia tombol *Download Excel*.
6. Nilai yang disimpan langsung tampil di Dashboard.

## Input Bulanan

Berisi **hanya Jenis Data bulanan**. Setiap jenis data bulanan berbentuk salah satu dari dua:
**Per nama (rincian)** atau **Rekap angka saja**. Terdapat dua tab:

### Tab "Input Bulanan"
Pilih Jenis Data bulanan (sudah terfilter) lalu periode bulan.

| Jenis | Cara isi |
| :-- | :-- |
| **Per nama (rincian)** (mis. Data Masyarakat, Data Aparatur) | **Tambah Baris** (per orang) atau **Upload Excel**. Baris dapat diedit/dihapus |
| **Rekap angka saja** | Hanya angka total per bulan yang dijumlahkan otomatis dari isian mingguan pasangannya; tidak diisi manual |
| Unggah berkas *(mode lama)* | Hanya untuk jenis data lama yang sudah memakainya (mis. Data Instruktur dan Widyaiswara bawaan). Tidak tersedia untuk jenis data baru; ganti ke salah satu mode di atas lewat Kelola Jenis Data bila perlu |

Mode dipilih Admin saat membuat jenis data bulanan di **Kelola Jenis Data**. "Rekap angka saja" wajib memilih Pasangan Jenis Data Mingguan.

**Validasi silang**: pada jenis data bulanan yang berpasangan dengan mingguan, aplikasi membandingkan jumlah
baris rincian bulan dengan total peserta dari 4 minggu pasangannya dan menampilkan status kelengkapan
(mis. "Baru 3 dari 4 minggu terisi …") serta selisihnya.

**Impor Excel**
1. Klik **Template Excel** untuk mengunduh berkas dengan kolom sesuai definisi jenis data saat ini.
2. Isi data, lalu **Upload Excel**. Layar **pemetaan kolom** mencocokkan kolom berkas dengan kolom sistem
   secara otomatis; Anda dapat mengoreksinya.
3. Kolom yang tidak dikenali disimpan sebagai *data ekstra* dan dicatat di `audit_log`.
4. Mengimpor ulang baris dengan NIK yang sama **memperbarui** baris tersebut, bukan menggandakan.

### Tab "Rekap Bulanan"
Pindahan dari menu *Rekap Bulanan* yang lama. Pilih **Tahun**, **Bulan**, **UPT** (Admin), dan **Jenis Data**, lalu
pilih tampilan:

* **Rekap 4 Minggu** – total pelatihan, peserta, pagu, realisasi, berkas; rincian per Jenis Data dan status
  kelengkapan tiap minggu. **Download Excel Bulanan** menghasilkan berkas multi-sheet.
* **Data by Name (Unggahan UPT)** – baris per orang hasil unggahan **satu UPT** (Excel sesuai template atau form).
  **Tanpa kolom UPT**; kolom mengikuti template Jenis Data tersebut (No, Nama, NIK, Alamat, Nama Pelatihan, dst.).
  Tersedia pencarian, pilihan 25/50/100/250 baris per halaman, dan **Download Excel**. Opsi "Semua UPT" tidak
  tersedia di tampilan ini; akun UPT otomatis melihat UPT-nya sendiri.

### Deadline & penanda terlambat
Setiap periode punya **deadline** (lihat [04-database.md](04-database.md#periods--periode-pelaporan)). Setelah
lewat, akun **UPT tetap dapat mengisi/mengubah/menghapus** data periode itu — tidak ada penguncian. Sebagai gantinya muncul banner
merah *"Lewat Deadline"*, dan data yang disimpan setelah deadline diberi label merah **Terlambat** (di Input Mingguan/Bulanan, kartu status
Dashboard, dan Rekap Admin). Penanda dicap oleh server dan tidak dapat dihapus dengan menyimpan ulang. Pengisian oleh **Admin** tidak ditandai.

## Rekap Triwulan & Tahun

Halaman **baca saja** (tanpa input/upload): seluruh angka **dijumlahkan otomatis (SUM) dari data mingguan** yang sudah
diinput UPT.

1. Pilih tampilan **Triwulan** (lalu pilih Triwulan I–IV) atau **Tahunan**, serta **Tahun**.
2. **Admin** memilih **Semua UPT** atau satu UPT; **akun UPT** otomatis hanya melihat UPT-nya sendiri.
3. Filter **Jenis Data** membatasi tabel di bagian bawah ke satu jenis data mingguan.

Isi halaman:

* **Kartu ringkasan**: Masyarakat Dilatih, Aparatur Dilatih, SDM Pelatih, serta Realisasi **RM**, **PNBP/BLU**, **SBSN**
  dan **Total Realisasi Anggaran** (= RM + PNBP/BLU + SBSN) untuk periode terpilih.
* **Rincian per Bulan** (mode Triwulan) atau **per Triwulan** (mode Tahunan) untuk setiap indikator di atas, plus grafik peserta.
* **Rekap per Jenis Data**: tabel per UPT berisi seluruh kolom angka yang dijumlahkan, jumlah *minggu terisi* (mis. 4/12),
  dan baris TOTAL.
* **Download Excel** (sheet *Ringkasan* + satu sheet per Jenis Data).

Bila UPT belum menginput, indikator menampilkan **–** dan keterangan *"Menunggu input UPT"*. UPT yang dihapus otomatis
tidak lagi ikut terhitung.

> **Cara rekap per kolom.** Tiap kolom angka mingguan punya cara rekap: **Jumlahkan (Σ)**, **Nilai terakhir
> (kumulatif)**, **Rata-rata**, atau **Maksimum**. Bawaan: pagu, realisasi (termasuk realisasi fisik), jumlah
> instruktur/widyaiswara, dan volume = *nilai terakhir*; kolom lain = *jumlahkan*. Antar-UPT, angka *nilai terakhir*
> tetap dijumlahkan (total RM semua UPT = jumlah RM terakhir tiap UPT). Admin dapat mengubahnya di **Kelola Jenis Data**.

## Koreksi & Penghapusan Data

Data yang salah dapat **dikoreksi** atau **dihapus**. Penghapusan tidak langsung permanen: data masuk **Tempat Sampah**
selama **30 hari**, dan setiap penghapusan **tercatat** (siapa, kapan, apa).

| Kebutuhan | Cara |
| :-- | :-- |
| Mengoreksi nilai mingguan | Buka periodenya di **Input Mingguan**, ubah nilai, **Simpan** (menimpa nilai lama) |
| Mengoreksi satu baris bulanan | Ikon ✏️ pada baris di **Input Bulanan** → ubah → simpan. Impor Excel ulang dengan NIK yang sama juga memperbarui baris |
| Menghapus **satu** baris/berkas/aktivitas | Ikon 🗑️ pada item tersebut (ada konfirmasi) |
| Menghapus **seluruh isian satu periode** | **Input Mingguan** → tombol **Kosongkan Data Minggu Ini**; **Input Bulanan** → **Hapus Semua Data Bulan Ini**. Wajib mengetik **HAPUS** |

Aturan siapa yang boleh:

* **Akun UPT** boleh menghapus/mengosongkan **data UPT-nya sendiri**, kapan saja (termasuk setelah deadline).
* **Admin** boleh menghapus kapan saja, memilih UPT terlebih dulu.
* **Memulihkan** data dari Tempat Sampah hanya dapat dilakukan **Admin**.

Bila setelah menghapus Anda menyimpan data yang sama lagi (mis. mengisi ulang kolom mingguan atau memasukkan NIK
yang sama), data yang baru otomatis menggantikan salinan di tempat sampah.

## Menu Admin

### Kelola Akun UPT
* **Buat Akun Baru** – email, password (≥ 8 karakter), nama lengkap, UPT. Akun langsung aktif.
* Hapus akun (ikon tempat sampah). Akun sendiri tidak dapat dihapus.
* **Tambah UPT** – masukkan *key* (huruf kecil & underscore, mis. `upt_kupang`) dan nama UPT.
* **Hapus UPT** – ⚠️ menghapus UPT ikut menghapus **permanen** seluruh datanya: akun pengguna, rekap mingguan,
  data rincian bulanan, berkas unggahan, dan daily activity milik UPT itu. Dashboard, grafik, dan rekap otomatis
  tidak lagi memuatnya. Aksi ini meminta konfirmasi dan **tidak dapat dibatalkan** (lakukan backup lebih dulu).

### Kelola Periode
Periode (1 tahun = 65: 1 tahun, 4 triwulan, 12 bulan, 48 minggu) **tahun berjalan dan tahun depan dibuat otomatis** oleh
server — tidak perlu perintah manual saat pergantian tahun. Di menu ini Admin dapat:

* melihat tahun yang tersedia dan kelengkapannya (mis. 65 / 65);
* **membuat tahun lain**, termasuk **5 tahun ke belakang** (tombol satu klik) — periode yang sudah ada tidak ditimpa;
* **mengubah deadline per periode** (kolom Deadline). Memperpanjang deadline membuka periode itu bagi UPT; perubahan
  hanya berlaku untuk periode tersebut dan tercatat di log.

Deadline tahun lampau sudah lewat, sehingga isian UPT pada periode itu ditandai **terlambat**. Untuk data lama, gunakan **Arsip Data Historis** atau **Impor Data Historis**.

### Kelola Dashboard
Admin mengatur isi Dashboard sendiri, tanpa mengubah kode.

1. Buka **Kelola Dashboard**. Mulanya Dashboard memakai tampilan bawaan; klik **Salin tampilan bawaan** agar dapat diubah.
2. **Kartu**: judul, bagian, gaya (*berwarna* dengan ikon/warna, atau *putih* dengan pembanding seperti Pagu), satuan (angka/rupiah),
   dan **sumber angka** = jenis data + kolom (bisa lebih dari satu, dijumlahkan).
3. **Grafik**: batang per UPT; tiap **seri** punya nama, warna, dan sumber angka.
4. Tombol panah mengubah urutan, ikon mata menyembunyikan, pensil mengubah, tempat sampah menghapus; **Kembali ke bawaan** menghapus semua pengaturan.
5. Berlaku untuk semua akun; akun UPT tetap hanya melihat angka UPT-nya sendiri.

Jenis data atau kolom baru (Kelola Jenis Data, level mingguan, tipe angka) otomatis muncul sebagai pilihan sumber. Rumus yang berbeda
(mis. persentase realisasi terhadap pagu) belum tersedia sebagai tipe widget dan perlu ditambahkan di kode.

### Arsip Data Historis
Untuk data tahun-tahun lalu yang formatnya berbeda-beda: **unggah berkas Excel atau PDF apa adanya**, lalu lihat langsung di web.

1. Menu **Arsip Data Historis** → pilih **Tahun data**, (Admin: pilih **UPT** atau *Pusat/seluruh UPT*), isi judul, pilih berkas
   (PDF, XLSX, XLS, CSV — maks. 30 MB) → **Unggah**.
2. Klik **Lihat** pada daftar: PDF tampil di penampil bawaan; Excel/CSV tampil sebagai tabel (per sheet, 500 baris pertama).
3. Bila saat mengunggah dipilih **Jenis data**, sistem membandingkan kolom berkas dengan template: hijau *"Format sesuai template"*
   (kolom cocok ≥ 80%) atau kuning *"Format berbeda — ditampilkan apa adanya"*. Berkas berformat berbeda tetap tersimpan & tampil.
4. Akun UPT hanya melihat/menghapus arsip **UPT-nya sendiri**; Admin melihat semuanya. Isi berkas disimpan di folder `be/storage`
   (jangan lupa ikut di-backup — lihat [07-pemeliharaan.md](07-pemeliharaan.md)).

### Impor Data Historis
Untuk memasukkan data **tahunan/bulanan by name** tahun-tahun lalu ke dalam sistem (agar muncul di rekap). Hanya Admin.
**Data mingguan tidak diimpor massal.**

1. Pastikan tahunnya ada di **Kelola Periode** (tombol *Buat 5 tahun ke belakang*).
2. Pilih **Jenis Data** (bulanan rincian per nama) lalu **Unduh Template Excel** (opsional bila berkas Anda sudah rapi).
3. **Pilih berkas**: *Unggah dari komputer*, atau *Dari Arsip Data Historis* (berkas yang sudah diarsipkan).
4. Kolom dipetakan otomatis (dapat diubah). Bila berkas **tidak punya kolom UPT / Tahun / Bulan**, tentukan di kotak "nilai tetap":
   UPT untuk seluruh berkas, Tahun, dan Bulan — atau pilih **kolom tanggal** agar bulan & tahun tiap baris diturunkan dari tanggalnya.
5. **Periksa Data**: sistem menampilkan baris valid, baris bermasalah (nomor baris Excel + alasan), dan peringatan. Centang
   **Lewati baris bermasalah** bila ingin melanjutkan, lalu **Impor**. Angka boleh `1.250.000` / `Rp 1250000`; tanggal `YYYY-MM-DD` atau `DD/MM/YYYY`.

Mengimpor ulang baris ber-NIK yang sama **memperbarui** data (tidak menggandakan); baris tanpa NIK akan terduplikasi. Data hasil impor Admin
tidak ditandai terlambat. Jika format berkas sangat berbeda, cukup simpan di **Arsip Data Historis**.

### Tempat Sampah & Catatan Aktivitas
Menu **Tempat Sampah** (khusus Admin) berisi dua tab:

* **Tempat Sampah** – daftar data yang dihapus, dikelompokkan per aksi hapus: jenis data, UPT, periode, jumlah, siapa
  yang menghapus, waktu, dan **sisa hari** sebelum dibuang otomatis. Tombol **Pulihkan** mengembalikan seluruh data pada
  aksi itu; ikon 🗑️ membuangnya **permanen**.
* **Catatan Aktivitas** – 200 log terbaru: *Hapus*, *Hapus Massal*, *Pulihkan*, *Hapus Permanen*, *Dibuang Otomatis*
  (setelah 30 hari), *Hapus UPT* (beserta jumlah akun/data yang ikut terhapus), serta *Buat Periode*, *Ubah Deadline*, dan
  *Impor Historis*.

Data di tempat sampah tidak tampil di dashboard, rekap, ekspor Excel, maupun halaman publik. Mengubah lama penyimpanan:
`TRASH_RETENTION_DAYS` di `be/.env` (bawaan 30). Bila kotak kuning "Tempat sampah belum aktif" muncul, jalankan
`database/migrasi_02_tempat_sampah.sql` di phpMyAdmin. Urutan migrasi untuk database lama: 01 → 02 → 03 → 04.

### Kelola Jenis Data (Form Builder)
* Tambah/ubah/hapus **Jenis Data**; atur tingkat (mingguan/bulanan), pasangan mingguan, mode bulanan, dan
  **Boleh dilihat publik**. Tingkat (*level utama*) menentukan apakah jenis data muncul di **Input Mingguan**
  atau **Input Bulanan**.
* Kelola **kolom**: tambah, ubah, aktif/nonaktif, hapus, ubah urutan (seret-dan-lepas), tipe
  (*angka, teks, teks panjang, tanggal, pilihan*), opsi pilihan, wajib, dan penanda **Identitas Pribadi**
  (tidak pernah tampil di publik).
* Untuk kolom **angka** pada jenis data mingguan tersedia **Cara Rekap** (jumlahkan / nilai terakhir / rata-rata /
  maksimum) — atur *nilai terakhir* untuk angka kumulatif. Lencana cara rekap tampil di daftar kolom.
* Pada jenis data mingguan, kotak **Boleh lebih dari 1 pelatihan per minggu** (di *Edit Pengaturan*) menampilkan
  tombol "Tambah pelatihan lain" di form mingguan.
* Perubahan langsung berlaku bagi semua pengguna **tanpa deploy ulang** — form input dan template Excel mengikuti
  definisi terbaru.
* Menghapus Jenis Data menghapus juga kolom, nilai rekap, data rincian, dan berkas terkait (ada konfirmasi).

> Dashboard menghitung angka berdasarkan **key** Jenis Data bawaan (`masyarakat`, `aparatur`,
> `data_instruktur_dan_wi`, `data_capaian_anggaran_per_sumber_dana`) dan kolom `jumlah_peserta`,
> `jumlah_instruktur_wi`, `pagu_*`/`realisasi_*`. Jangan mengubah key/kolom tersebut bila dashboard masih dipakai.

## Dokumen & Arsip

Menu ini punya dua tab. Tab **Dokumen & Panduan**: repositori pedoman/regulasi/SOP dapat dicari dan diunduh, ditambah **template Excel** per jenis data yang dibuat
otomatis dari definisi kolom. Dokumen tambahan (**+ Tambah Dokumen**) hanya tersimpan di **browser** yang dipakai
(Local Storage), tidak di database, sehingga tidak terlihat oleh pengguna/peramban lain.

## Tampilan Publik

Tanpa login, satu halaman ringkas: pilih tahun, lalu lihat total data terdata per kategori (jenis data yang ditandai publik) beserta totalnya. Semua data yang bersifat
identitas pribadi (nama, NIK, telepon, alamat, NIP) **tidak pernah** dikirim ke halaman ini.
