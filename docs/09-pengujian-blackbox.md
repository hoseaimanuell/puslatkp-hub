# Pengujian Blackbox

Laporan pengujian fungsional PUSLATKP Management Hub dengan metode **blackbox**: setiap fitur diuji hanya dari
masukan dan keluarannya (apa yang dikirim pengguna dan apa yang diterimanya), tanpa melihat isi kode. Kasus uji
disusun dengan teknik **partisi ekuivalen** (masukan sah vs tidak sah), **analisis nilai batas** (mis. password 7
karakter, tahun 1999, 5001 baris), dan **uji hak akses per peran** (pengunjung, UPT, Admin).

## Lingkungan pengujian

| Komponen | Keterangan |
| :-- | :-- |
| Tanggal | 30 September 2026 |
| Backend | Node.js 22.21, Express 5, MySQL 8.0.30 (Laragon) |
| Frontend | Next.js 16 (build produksi, `next start`), Chromium (panel browser aplikasi) |
| Data uji | 2 UPT sementara ("UPT Uji Blackbox 1" & "2") beserta akunnya, dibuat di awal pengujian dan **dihapus seluruhnya** di akhir (termasuk berkas unggahan). Data UPT asli tidak disentuh |
| Alat | `npm run uji:blackbox` (folder `be`) untuk uji lewat API; panel browser aplikasi untuk uji tampilan |

## Ringkasan hasil

**Uji fungsional lewat API: 79 kasus, 79 lulus. Uji tampilan di browser: 15 kasus, 15 lulus.**
Tiga bug ditemukan selama pengujian ini dan sudah diperbaiki sebelum hasil akhir diambil (lihat
[Bug yang ditemukan](#bug-yang-ditemukan-dan-diperbaiki)).

| Modul | Jumlah kasus | Lulus | Gagal |
| :-- | :-: | :-: | :-: |
| Autentikasi | 8 | 8 | 0 |
| Kelola Akun | 11 | 11 | 0 |
| Hak Akses | 10 | 10 | 0 |
| Input Mingguan | 15 | 15 | 0 |
| Input Bulanan | 9 | 9 | 0 |
| Tempat Sampah | 3 | 3 | 0 |
| Periode | 4 | 4 | 0 |
| Arsip Historis | 6 | 6 | 0 |
| Kolom Berkas | 3 | 3 | 0 |
| Kelola Jenis Data | 5 | 5 | 0 |
| Dokumen & Panduan | 2 | 2 | 0 |
| Kelola Dashboard | 1 | 1 | 0 |
| Tampilan Publik | 2 | 2 | 0 |
| **Total** | **79** | **79** | **0** |

## 1. Uji fungsional lewat API

Setiap kasus mengirim permintaan seperti yang dilakukan halaman web, lalu mencocokkan jawaban server (kode status,
pesan, dan isi data) dengan hasil yang diharapkan. Kode status: **200/201** berhasil, **400** masukan tidak sah,
**401** belum login, **403** tidak berhak, **404** tidak ditemukan, **409** bentrok/duplikat, **413** terlalu besar.

### A. Autentikasi (8/8 lulus)

| ID | Skenario | Masukan | Hasil yang diharapkan | Hasil aktual | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| A01 | Login Admin dengan email & password benar | email & password Admin | 200 + token | 200 + token | ✅ Lulus |
| A02 | Batas percobaan login aktif | header RateLimit | batas 30 per 15 menit | RateLimit-Limit: 30 | ✅ Lulus |
| A03 | Login dengan password salah | email Admin + password salah | 401 ditolak | 401 "Invalid login credentials" | ✅ Lulus |
| A04 | Login dengan email tidak terdaftar | email acak | 401, pesan sama dengan password salah | 401 "Invalid login credentials" | ✅ Lulus |
| A05 | Login tanpa isian | body kosong | 401 ditolak | 401 "Invalid login credentials" | ✅ Lulus |
| A06 | Login dengan SQL injection | ' OR '1'='1 | 401 ditolak | 401 "Invalid login credentials" | ✅ Lulus |
| A07 | Lihat profil sendiri dengan token sah | token Admin | 200, tanpa password_hash | 200, role=admin, password_hash tidak ada | ✅ Lulus |
| A08 | Akses dengan token palsu | token acak | 401 | 401 "Silakan login terlebih dahulu." | ✅ Lulus |

### B. Kelola Akun (11/11 lulus)

| ID | Skenario | Masukan | Hasil yang diharapkan | Hasil aktual | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| K01 | Admin membuat akun UPT baru | email, password 8+ karakter, nama, UPT | 201 akun dibuat | 201 | ✅ Lulus |
| K02 | Membuat akun dengan email yang sudah dipakai | email sama | 409 ditolak | 409 "Email sudah digunakan oleh akun lain" | ✅ Lulus |
| K03 | Format email tidak valid | "bukan-email" | 400 ditolak | 400 "Format email tidak valid" | ✅ Lulus |
| K04 | Password 7 karakter (batas bawah - 1) | "1234567" | 400 minimal 8 karakter | 400 "Password minimal 8 karakter" | ✅ Lulus |
| K05 | UPT tidak terdaftar | upt_key acak | 400 ditolak | 400 "UPT 'upt_tidak_ada' tidak valid atau tidak aktif" | ✅ Lulus |
| K06 | Nama lengkap hanya spasi | "   " | 400 wajib diisi | 400 "Nama lengkap wajib diisi" | ✅ Lulus |
| K07 | Login dengan akun UPT yang baru dibuat | email & password akun baru | 200 + token | 200 + token | ✅ Lulus |
| K07b | Profil UPT memuat nama UPT (bukan kode) | token UPT | upt_label = "UPT Uji Blackbox 1" | upt_label "UPT Uji Blackbox 1" | ✅ Lulus |
| K08 | Akun UPT mencoba membuat akun | token UPT | 403 ditolak | 403 "Hanya Admin yang boleh melakukan aksi ini." | ✅ Lulus |
| K09 | Admin mengatur ulang password | password baru 8+ karakter | password lama ditolak, baru diterima | reset 200; lama 401; baru 200 | ✅ Lulus |
| K10 | Atur ulang password terlalu pendek | "pendek" | 400 ditolak | 400 "Password minimal 8 karakter" | ✅ Lulus |

### C. Hak Akses (10/10 lulus)

| ID | Skenario | Masukan | Hasil yang diharapkan | Hasil aktual | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| H01 | Pengunjung tanpa login membaca data rekap | tanpa token | 401 | 401 "Silakan login terlebih dahulu." | ✅ Lulus |
| H02 | UPT membaca data UPT lain | filter upt_key UPT lain | 0 baris | 200, 0 baris | ✅ Lulus |
| H03 | UPT membaca daftar akun | select profiles | hanya akunnya sendiri | 1 akun: uji.blackbox1@kkp.go.id | ✅ Lulus |
| H04 | UPT mengubah Jenis Data | update jenis_data | 403 | 403 "Hanya Admin yang boleh melakukan aksi ini." | ✅ Lulus |
| H05 | UPT membaca log audit | select audit_log | 403 | 403 "Hanya Admin yang boleh melakukan aksi ini." | ✅ Lulus |
| H06 | Meminta kolom password_hash (bahkan Admin) | columns password_hash | 400 ditolak | 400 "Kolom tidak dikenal: password_hash" | ✅ Lulus |
| H07 | Tabel di luar daftar izin | mysql.user | 400 ditolak | 400 "Tabel tidak dikenal." | ✅ Lulus |
| H08 | Hapus tanpa filter (seluruh tabel) | delete tanpa filter | 400 ditolak | 400 "Operasi ubah/hapus wajib memakai filter." | ✅ Lulus |
| H09 | Pengunjung membaca daftar jenis data | tanpa token | hanya kolom publik (id,judul,deskripsi,key) | 200, kolom: deskripsi,id,judul,key | ✅ Lulus |
| H10 | Kiriman besar dari pengunjung anonim | body 150 KB tanpa token | 413 terlalu besar | 413 "Ukuran data terlalu besar." | ✅ Lulus |

### D. Input Mingguan (15/15 lulus)

| ID | Skenario | Masukan | Hasil yang diharapkan | Hasil aktual | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| M01 | UPT menyimpan data mingguan sebelum deadline | nama pelatihan + 20 peserta | tersimpan, status draft, tidak terlambat | 200; status draft; terlambat false | ✅ Lulus |
| M02 | UPT menyimpan data setelah deadline | periode yang deadline-nya sudah lewat | tetap tersimpan, ditandai terlambat | 200; terlambat true | ✅ Lulus |
| M03 | UPT mengirim status "disetujui" sendiri | status: disetujui | status tetap draft | status draft | ✅ Lulus |
| M04 | UPT menulis atas nama UPT lain | upt_key UPT lain | data tercatat milik UPT sendiri | baris di UPT lain: 0 | ✅ Lulus |
| M05 | Admin menyetujui satu baris | baris #1 | status disetujui | 200; status disetujui | ✅ Lulus |
| M06 | UPT mencoba menyetujui barisnya sendiri | endpoint persetujuan, token UPT | 403 | 403 "Hanya Admin yang boleh melakukan aksi ini." | ✅ Lulus |
| M07 | UPT menimpa baris yang sudah disetujui | baris #1 dengan 99 peserta | 403, diarahkan ke tombol Edit | 403 "Baris ini sudah disetujui Admin, jadi tidak bisa ditimpa langsung. Tekan Edit pada baris itu untuk mengajukan perubahan ke Admin." | ✅ Lulus |
| M08 | UPT mengajukan edit baris disetujui | peserta 20 -> 25 | permintaan terkirim, nilai lama tetap | 200; nilai sekarang 20 | ✅ Lulus |
| M09 | Admin menyetujui permintaan edit | setujui permintaan | nilai 25, tetap disetujui | 200; nilai 25; status disetujui | ✅ Lulus |
| M10 | Menyetujui permintaan yang sama dua kali | setujui ulang | 409 sudah diproses | 409 "Permintaan ini sudah diproses sebelumnya." | ✅ Lulus |
| M11 | UPT menghapus baris draft | hapus baris #2 (draft) | langsung terhapus | 200; pending=false; sisa 0 | ✅ Lulus |
| M12 | UPT menghapus baris disetujui | hapus baris #1 | jadi permintaan, data belum hilang | 200; pending=true; sisa 2 | ✅ Lulus |
| M13 | Admin menolak permintaan hapus | tolak + catatan | data tetap ada | 200; sisa 2 | ✅ Lulus |
| M14 | Admin menolak baris + catatan, UPT melihatnya | tolak baris #4 | status ditolak, catatan terlihat UPT | 200; ditolak; "peserta kurang" | ✅ Lulus |
| M15 | UPT memperbaiki baris yang ditolak | simpan ulang baris #4 | kembali draft, catatan dikosongkan | draft; catatan null | ✅ Lulus |

### E. Input Bulanan (9/9 lulus)

| ID | Skenario | Masukan | Hasil yang diharapkan | Hasil aktual | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| B01 | Impor Excel pertama kali | 2 baris (1 tanpa NIK) | 2 baru, menunggu persetujuan | {"baru":2,"sama":0} | ✅ Lulus |
| B02 | Unggah ulang berkas yang sama | berkas identik | 0 baru, 2 dilewati (tidak dobel) | {"baru":0,"sama":2} | ✅ Lulus |
| B03 | Admin "Setujui Semua" data per nama | 2 id sekaligus | 2 disetujui dalam 1 permintaan | 200; jumlah 2 | ✅ Lulus |
| B04 | Unggah ulang: baris disetujui berubah | usia 30 -> 31 | terdeteksi 1 baris disetujui berubah | {"disetujuiBerubah":1,"sama":1} | ✅ Lulus |
| B05 | Pilih "Lewati" untuk perubahan baris disetujui | ajukanPerubahan: false | data disetujui tidak berubah | dilewati 1; usia 30 | ✅ Lulus |
| B06 | UPT mengubah baris yang sudah disetujui langsung | update baris disetujui | 403 ditolak | 403 "Baris ini sudah disetujui Admin, jadi tidak bisa ditimpa langsung. Tekan Edit pada baris itu untuk mengajukan perubahan ke Admin." | ✅ Lulus |
| B07 | UPT menyetujui sendiri lewat update | status: disetujui pada baris draft | status tetap draft | 200; status draft | ✅ Lulus |
| B08 | UPT lain membaca data per nama UPT ini | token UPT 2 | 0 baris | 0 baris | ✅ Lulus |
| B09 | Impor lebih dari 5000 baris | 5001 baris | 400 ditolak | 400 "Maksimal 5000 baris per unggahan. Pecah berkasnya menjadi beberapa bagian." | ✅ Lulus |

### F. Tempat Sampah (3/3 lulus)

| ID | Skenario | Masukan | Hasil yang diharapkan | Hasil aktual | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| T01 | Data yang dihapus masuk tempat sampah | hapus baris #5 | terlihat di daftar, sisa hari 30 | 200; 2 baris, sisa 30 hari | ✅ Lulus |
| T02 | Admin memulihkan data | pulihkan batch | data kembali | 200; 2 baris kembali | ✅ Lulus |
| T03 | UPT membuka tempat sampah | token UPT | 403 | 403 "Hanya Admin yang boleh melakukan aksi ini." | ✅ Lulus |

### G. Periode (4/4 lulus)

| ID | Skenario | Masukan | Hasil yang diharapkan | Hasil aktual | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| P01 | Buat periode dengan rentang terbalik | dari 2030 sampai 2020 | 400 ditolak | 400 "Rentang tahun tidak valid (2000–2100, dari ≤ sampai)." | ✅ Lulus |
| P02 | Buat periode lebih dari 12 tahun | 2030-2045 | 400 ditolak | 400 "Maksimal 12 tahun per permintaan." | ✅ Lulus |
| P03 | UPT membuat periode | token UPT | 403 | 403 "Hanya Admin yang boleh melakukan aksi ini." | ✅ Lulus |
| P04 | Buat ulang periode tahun yang sudah ada | tahun berjalan | tidak menggandakan (0 dibuat) | 200; dibuat 0 | ✅ Lulus |

### H. Arsip Historis (6/6 lulus)

| ID | Skenario | Masukan | Hasil yang diharapkan | Hasil aktual | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| R01 | UPT mengunggah PDF | berkas PDF sah | 201 tersimpan | 201 | ✅ Lulus |
| R02 | Unggah berkas .exe | virus.exe | 400 format tidak didukung | 400 "Format berkas tidak didukung. Gunakan PDF, XLSX, XLS, atau CSV." | ✅ Lulus |
| R03 | Berkas bernama .pdf tapi isinya bukan PDF | palsu.pdf | 400 isi tidak sesuai | 400 "Isi berkas tidak sesuai dengan ekstensi .pdf." | ✅ Lulus |
| R04 | Tahun di luar batas (1999) | tahun 1999 | 400 ditolak | 400 "Tahun tidak valid." | ✅ Lulus |
| R05 | UPT lain mengunduh arsip UPT ini | token UPT 2 | 404 (tidak terlihat) | 404 "Arsip tidak ditemukan." | ✅ Lulus |
| R06 | Pemilik mengunduh arsipnya | token UPT 1 | 200 | 200 | ✅ Lulus |

### I. Kolom Berkas (3/3 lulus)

| ID | Skenario | Masukan | Hasil yang diharapkan | Hasil aktual | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| F01 | Unggah berkas ke kolom yang bukan bertipe Berkas | field jumlah_peserta | 400 ditolak | 400 "Kolom ini bukan bertipe Berkas (atau sudah diubah). Muat ulang halaman." | ✅ Lulus |
| F02 | Unggah PDF ke kolom Berkas | link_laporan_pelatihan | 201 tersimpan | 201 | ✅ Lulus |
| F03 | UPT lain mengunduh berkas ini | token UPT 2 | ditolak (403/404) | 404 "Berkas tidak ditemukan." | ✅ Lulus |

### J. Kelola Jenis Data (5/5 lulus)

| ID | Skenario | Masukan | Hasil yang diharapkan | Hasil aktual | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| J01 | Admin membuat jenis data baru | judul + level minggu | tersimpan | 200 id ada | ✅ Lulus |
| J02 | Admin menambah kolom dengan peran rekap | kolom angka, peran peserta | tersimpan | 200 | ✅ Lulus |
| J03 | Kode kolom ganda dalam satu jenis data | field_key sama | 409 duplikat | 409 "Data duplikat: nilai unik tersebut sudah ada." | ✅ Lulus |
| J04 | UPT membuat jenis data | token UPT | 403 | 403 "Hanya Admin yang boleh melakukan aksi ini." | ✅ Lulus |
| J05 | Kunci jenis data ganda | key sama | 409 duplikat | 409 "Data duplikat: nilai unik tersebut sudah ada." | ✅ Lulus |

### K. Dokumen & Panduan (2/2 lulus)

| ID | Skenario | Masukan | Hasil yang diharapkan | Hasil aktual | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| D01 | UPT membaca dokumen & panduan | token UPT | 200 | 200; 6 dokumen | ✅ Lulus |
| D02 | UPT menambah dokumen | token UPT | 403 | 403 "Hanya Admin yang boleh melakukan aksi ini." | ✅ Lulus |

### L. Kelola Dashboard (1/1 lulus)

| ID | Skenario | Masukan | Hasil yang diharapkan | Hasil aktual | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| D03 | UPT mengubah pengaturan dashboard | token UPT | 403 | 403 "Hanya Admin yang boleh melakukan aksi ini." | ✅ Lulus |

### M. Tampilan Publik (2/2 lulus)

| ID | Skenario | Masukan | Hasil yang diharapkan | Hasil aktual | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| U01 | Pengunjung membaca rekap publik | tanpa token | 200, tanpa data pribadi | 200; kolom jenis_data_id,jenis_data_judul,period_id,period_label,level,tahun,bulan,total_baris | ✅ Lulus |
| U02 | Menghapus data tampilan publik | token Admin | 403 (hanya-baca) | 403 "Operasi tidak diizinkan pada objek ini." | ✅ Lulus |


## 2. Uji tampilan di browser

| ID | Skenario | Langkah / masukan | Hasil yang diharapkan | Hasil aktual | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| UI01 | Membuka aplikasi tanpa login | Buka `/dashboard` tanpa sesi | Halaman Login tampil (logo KKP, formulir) | Halaman Login tampil lengkap | ✅ Lulus |
| UI02 | Format email salah | Ketik `bukan-email` | Formulir tidak terkirim, ada pesan | "Sertakan '@' pada alamat email" | ✅ Lulus |
| UI03 | Kolom wajib | Email & password kosong | Keduanya wajib diisi | Atribut wajib aktif di kedua kolom | ✅ Lulus |
| UI04 | Password salah | Email Admin + password salah | Pesan kesalahan jelas, tetap di Login | "Email atau password salah. Coba lagi." | ✅ Lulus |
| UI05 | Login Admin | Email & password benar | Masuk ke Dashboard | Masuk ke Dashboard, sesi tersimpan | ✅ Lulus |
| UI06 | Semua halaman Admin terbuka | Buka 12 halaman Admin + Tampilan Publik | Setiap halaman tampil tanpa error | Input Mingguan, Input Bulanan, Rekap Triwulan & Tahun, Dokumen & Arsip, Kelola Akun UPT, Permintaan, Kelola Jenis Data, Kelola Dashboard, Kelola Periode, Impor Data Historis, Tempat Sampah, Publik: semua tampil, tanpa error di konsol | ✅ Lulus |
| UI07 | Filter Jenis Data di Rekap Bulanan | November, pilih jenis data bergantian | Kartu ringkasan mengikuti filter | Semua 25 peserta · Masyarakat 25 · Data Masyarakat (Bulanan) 25 · Aparatur 0 · Belanja Modal 0 | ✅ Lulus (setelah perbaikan bug 1) |
| UI08 | Keluar | Tekan tombol Keluar | Sesi dihapus, kembali ke Login | Sesi terhapus, halaman Login tampil | ✅ Lulus |
| UI09 | Menu akun UPT | Login sebagai UPT | Hanya menu UPT | Dashboard, Input Mingguan, Input Bulanan, Rekap Triwulan & Tahun | ✅ Lulus |
| UI10 | UPT membuka halaman Admin lewat alamat langsung | `/kelola-upt`, `/tempat-sampah` | Tidak bisa dibuka | Dialihkan ke Dashboard | ✅ Lulus |
| UI11 | Nama UPT di header & Dashboard | Login sebagai UPT | Nama UPT, bukan kode | "UPT • UPT Uji Blackbox 1" | ✅ Lulus (setelah perbaikan bug 3) |
| UI12 | Status di tabel Rekap UPT/Balai | Input Mingguan, Minggu ke-2 November | Status sesuai kenyataan | Ada draft: "Menunggu Persetujuan"; tanpa isian: "Belum Diisi" | ✅ Lulus (setelah perbaikan bug 2) |
| UI13 | Membuka halaman dalam setelah keluar | Keluar, lalu buka `/kelola-jenis-data` | Isi halaman tidak tampil | Halaman Login yang tampil | ✅ Lulus |
| UI14 | Login di layar HP | Ukuran 375×812 | Formulir utuh, tidak perlu geser ke samping | Panel biru disembunyikan, formulir utuh, lebar halaman = lebar layar | ✅ Lulus |
| UI15 | "Setujui Semua" di menu Permintaan | 4 baris data per nama menunggu | Semua disetujui sekaligus | 1 permintaan ke server, antrean kosong (diuji 29 Sep 2026 saat perbaikan impor Excel) | ✅ Lulus |

## Bug yang ditemukan dan diperbaiki

| No | Bug | Tingkat | Ditemukan | Perbaikan |
| :-: | :-- | :-: | :-- | :-- |
| 1 | Kartu ringkasan **Rekap Bulanan** selalu menjumlahkan semua jenis data, walau filter Jenis Data sudah dipilih | Sedang | Pemeriksaan kode, 30 Sep | Kartu mengikuti filter (commit `026c962`) |
| 2 | Tabel Rekap UPT/Balai menampilkan **"Draft"** untuk jenis data yang belum diisi sama sekali; ekspor Excel memakai status bahasa Inggris ("Approved"/"Draft") | Rendah | UI12, 30 Sep | Status 4 macam dalam bahasa Indonesia, sama di tabel & Excel (`026c962`) |
| 3 | Header, Dashboard, dan Arsip Historis menampilkan **kode UPT** ("upt • upt_medan"), bukan namanya | Rendah | UI09, 30 Sep | Profil login menyertakan nama UPT (`026c962`) |
| 4 | Akun UPT bisa **menyetujui barisnya sendiri** lewat perintah update, dan baris yang ditolak lalu diperbaiki tidak kembali ke antrean Admin | Tinggi | Pemeriksaan fitur impor, 29 Sep | Status dipaksa server pada semua jalur tulis (`a27a470`); diuji ulang di M03, M15, B07 |
| 5 | Impor Excel **Data by Name** menggandakan baris tanpa NIK saat diunggah ulang, dan satu kelompok 100 baris gagal total bila ada satu NIK yang sudah disetujui | Sedang | Pemeriksaan fitur impor, 29 Sep | Pencocokan per baris di server (`a27a470`); diuji ulang di B01–B05 |

## Yang belum tercakup

* **Unggah Excel lewat tombol di browser.** Jendela pilih berkas tidak bisa dioperasikan otomatis. Logika impornya
  diuji lewat API (B01–B09) dan tes otomatis `be/test/impor-rincian.test.js`.
* **Excel dengan sel gabungan (merge).** Belum didukung: judul yang digabung di baris atas atau judul kolom dua
  tingkat membuat pemetaan kolom gagal. Template Excel dari aplikasi aman karena tidak memakai sel gabungan.
* **Pemblokiran setelah 30 kali login gagal** tidak dipicu sungguhan, supaya pengguna tidak terkunci 15 menit;
  yang diverifikasi adalah batas yang terpasang (A02).
* **Sesi lama setelah ganti password.** Mengatur ulang password tidak memutus sesi yang sudah login di perangkat
  lain; sesi itu tetap berlaku sampai habis (maks. 12 jam, `JWT_EXPIRES_IN`).
* Browser lain (Firefox, Safari) dan uji beban/performa belum dilakukan.

## Mengulang pengujian

Backend harus berjalan. Dari folder `be`:

```bash
UJI_ADMIN_EMAIL=admin@... UJI_ADMIN_PASSWORD=... npm run uji:blackbox -- --laporan hasil.json
```

Di PowerShell, isi dulu `$env:UJI_ADMIN_EMAIL` dan `$env:UJI_ADMIN_PASSWORD`, lalu jalankan `npm run uji:blackbox`.
Skrip membuat UPT uji sementara, menjalankan seluruh kasus di atas, lalu menghapus semua data ujinya. Satu kali jalan
memakai sekitar 12 percobaan login, jadi beri jeda 15 menit bila dijalankan beberapa kali berturut-turut. Uji
tampilan (bagian 2) dilakukan manual di browser.
