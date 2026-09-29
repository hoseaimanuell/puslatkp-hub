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

Akun **UPT** hanya melihat dan mengisi data **UPT-nya sendiri** di seluruh menu yang bisa diaksesnya (Dashboard,
Input Mingguan, Input Bulanan, Rekap Triwulan & Tahun). Ini ditegakkan di server, bukan hanya di tampilan.
Akun **Admin** melihat semua UPT dan dapat memilih UPT (termasuk **Semua UPT**, lihat masing-masing menu) saat
memfilter/menginput/menghapus.

## Menu & fungsinya

| Menu | Alamat | Untuk | Fungsi |
| :-- | :-- | :-- | :-- |
| Dashboard | `/dashboard` | Semua | Ringkasan mingguan dari isian UPT (lihat di bawah) |
| **Input Mingguan** | `/input-mingguan` | Semua | Input & rekap data **mingguan** |
| **Input Bulanan** | `/input-bulanan` | Semua | Rekap bulanan (akumulasi 4 minggu / data by name) + popup **Input Bulanan** |
| **Rekap Triwulan & Tahun** | `/rekap-triwulan-tahun` | Semua | Hasil rekap **triwulan** dan **tahunan** (baca saja) |
| **Dokumen & Arsip** | `/dokumen-arsip` | **Admin** | Dua tab: **Dokumen & Panduan** (pedoman, SOP, template Excel — tersimpan di database) dan **Arsip Data Historis** (berkas Excel/PDF tahun lalu) |
| Kelola Akun UPT | `/kelola-upt` | Admin | Buat/hapus akun UPT, reset password, tambah/hapus UPT |
| **Permintaan** | `/permintaan-hapus` | Admin | Setujui/tolak baris data per baris (Persetujuan Baris Data), serta setujui/tolak permintaan hapus data |
| Kelola Jenis Data | `/kelola-jenis-data` | Admin | Form Builder: jenis data & kolom, termasuk wizard **Buat dari Excel** |
| **Kelola Dashboard** | `/kelola-dashboard` | Admin | Mengatur kartu & grafik Dashboard tanpa coding |
| **Pengaturan Lanjutan** (menu lipat) | — | Admin | Jarang dipakai: **Kelola Periode** (`/kelola-periode`), **Impor Data Historis** (`/impor-historis`), **Tempat Sampah** (`/tempat-sampah`) |
| Tampilan Publik | `/publik` | Publik | Satu halaman ringkas: total capaian per kategori data untuk satu tahun |

Alamat lama `/documents`, `/arsip-historis`, `/highlights`, dan `/daily-activity` dialihkan otomatis (Highlights & Daily Activity sudah dihapus).

Alamat lama `/input-data` dan `/rekap-bulanan` otomatis dialihkan ke `/input-mingguan` dan `/input-bulanan`.

## Dashboard

Semua angka di dashboard **berasal dari isian UPT** dan mengikuti **Periode Mingguan** yang dipilih pada filter
di bagian atas (tombol ◀ ▶ untuk pindah minggu; bawaan = minggu berjalan).

**Semua angka bersifat kumulatif dari minggu ke-1 tahun berjalan.** Memilih minggu ke-4 menjumlahkan seluruh data
dari minggu ke-1 Januari sampai minggu ke-4 itu (bukan hanya minggu yang dipilih) — berlaku untuk semua kartu dan
grafik, bukan cuma kolom bertanda "kumulatif" (Pagu/Realisasi/dsb.). Memilih minggu lebih akhir dalam tahun yang
sama selalu menghasilkan angka yang sama atau lebih besar.

Isi kartu & grafik **diatur Admin lewat menu Kelola Dashboard** (lihat bawah) — bukan tetap di kode. Bawaannya:

* **4 kotak sejajar Realisasi Anggaran**: **RM**, **PNBP/BLU**, **SBSN** (dari *Data Capaian Anggaran per Sumber
  Dana*, opsional) dan **Total Realisasi Anggaran** (dijumlahkan dari kolom Pagu/Realisasi Anggaran milik
  *Masyarakat + Aparatur + Data Belanja Modal* — jenis data yang memang diisi UPT tiap minggu). Total **tidak**
  dijumlahkan dari RM+PNBP/BLU+SBSN (supaya anggaran yang sama tidak terhitung dua kali kalau UPT mengisi kedua
  jenis data itu) — keempatnya tampil sejajar satu grup, tapi sumber angkanya sengaja terpisah.
* **3 kartu Progress & Status**
  * **Masyarakat Dilatih** – jumlah peserta Jenis Data *Masyarakat*.
  * **Aparatur Dilatih** – jumlah peserta Jenis Data *Aparatur*.
  * **SDM Pelatih** – jumlah instruktur dan widyaiswara (*Data Instruktur dan WI*).
* **Grafik** *Peserta Dilatih* dan *Pagu vs Realisasi* per UPT.

Bila periode tersedia untuk lebih dari satu tahun, di samping pilihan minggu tampil pilihan **Tahun** (daftar minggu hanya
menampilkan 48 minggu pada tahun terpilih).

Selama UPT belum memasukkan data pada minggu itu (atau minggu-minggu sebelumnya di tahun yang sama), kartu menampilkan
**–** dengan keterangan *"Menunggu input UPT"*, dan grafik menampilkan pesan menunggu. Begitu data disimpan di
**Input Mingguan**, angka otomatis muncul (Admin juga melihat "N dari M UPT sudah input"; angka ini mengikuti jumlah UPT
**aktif** saat ini — bila satu UPT dihapus, penyebutnya otomatis berkurang dan datanya tidak lagi ikut terhitung). Untuk
akun UPT, dashboard hanya berisi data UPT tersebut.

## Input Mingguan

Berisi **hanya Jenis Data mingguan**: Masyarakat, Aparatur, Data Instruktur dan WI, Data Belanja Modal, Capaian
Anggaran per Jenis Belanja, dan per Sumber Dana.

1. Halaman menampilkan **rekap mingguan** (filter tahun/triwulan/bulan/minggu/jenis data; Admin juga memilih UPT).
2. Klik **Input Mingguan** (kanan atas) → pilih **Jenis Data** (daftar sudah terfilter mingguan) → pilih periode
   (**Minggu ke-1…4** tiap bulan: tanggal 1–7, 8–14, 15–21, 22–akhir bulan) → pilih **UPT**. Yang tampil adalah
   **tabel rekap** berisi baris yang sudah tersimpan (kosong bila belum ada), dengan kolom **Status** (badge
   Menunggu/Disetujui/Ditolak — lihat [Persetujuan Baris Data](#persetujuan-baris-data)) dan **Aksi** (Edit/Hapus)
   di paling kanan. Input data TIDAK lagi lewat form yang selalu terbuka — klik **+ Tambah Pelatihan** (atau
   **Isi Data Minggu Ini** untuk jenis data yang cuma satu baris nilai per minggu) untuk membuka jendela isian,
   isi kolomnya, lalu **Simpan** — jendela tertutup dan baris itu langsung muncul di tabel. Untuk mengubah baris
   yang sudah ada, klik ikon **Edit** di kolom Aksi (jendela yang sama terbuka terisi nilai lama); mengosongkan
   sebuah kolom lalu Simpan akan menghapus nilai kolom itu saja (masuk Tempat Sampah). Klik ikon **Hapus** di
   kolom Aksi untuk membuang seluruh baris (masuk Tempat Sampah 30 hari; berubah jadi **Ajukan Hapus** dengan
   ikon amber begitu baris itu sudah **Disetujui** Admin — lihat [Persetujuan Baris Data](#persetujuan-baris-data)).
3. **Beberapa pelatihan dalam seminggu.** Pada jenis data yang diaktifkan Admin (*Masyarakat, Aparatur, Data
   Belanja Modal, Data Instruktur dan WI*, dan lainnya bila diaktifkan lewat **Kelola Jenis Data** → *Boleh lebih
   dari 1 pelatihan per minggu*), tombol **+ Tambah Pelatihan** bisa diklik berkali-kali — tiap klik membuka
   jendela isian baru untuk satu pelatihan, dan tabel rekap menampilkan semua pelatihan sebagai baris terpisah
   (bernomor 1, 2, 3, …). Angka pada minggu itu = **jumlah semua pelatihan** (mis. peserta 12 + 8 = 20). Jenis
   data yang tidak diaktifkan opsi ini hanya punya **satu baris** nilai per minggu (tombol **Isi Data Minggu Ini**
   hilang setelah baris itu terisi, tersisa Edit/Hapus di tabel).
4. **Angka kumulatif.** Kolom bertanda **kumulatif** (Pagu, Realisasi, jumlah SDM) diisi dengan **total sampai minggu
   tersebut**, bukan tambahan minggu itu saja. Rekap bulan/triwulan/tahun memakai **nilai terakhir** yang sudah diisi,
   sehingga pagu/realisasi tidak terhitung berulang. Kolom lain (mis. jumlah peserta) dijumlahkan.
5. **Kolom pilihan bersyarat.** Pada jenis data tertentu (mis. *Data Instruktur dan WI*: kolom **Jenis** →
   Instruktur/Widyaiswara), memilih satu kolom mengubah **opsi** kolom lain yang bergantung padanya (mis.
   **Jenjang Jabatan** menampilkan opsi khusus Instruktur atau khusus Widyaiswara, dan menunjukkan
   "- Pilih Jenis dulu -" sampai kolom Jenis diisi). Mengganti pilihan pada kolom penentu mengosongkan ulang
   kolom yang bergantung padanya.
6. **Semua UPT — kosongkan/hapus massal.** Admin juga bisa memilih **Semua UPT** pada pemilih UPT. Form isian
   disembunyikan (nilai per-UPT tidak bisa digabung jadi satu form), tapi tombol **Kosongkan Data Minggu Ini
   (Semua UPT)** aktif — menghapus seluruh isian minggu itu **lintas semua UPT sekaligus** lewat dialog konfirmasi
   ketik **HAPUS** (masuk Tempat Sampah 30 hari, sama seperti penghapusan biasa).
7. Tab **Triwulan** dan **Tahun** hanya **rekap otomatis** (sesuai cara rekap tiap kolom) — **tidak ada input
   maupun upload**; tersedia tombol *Download Excel*.
8. Nilai yang disimpan langsung tampil di Dashboard.

## Input Bulanan

Pola halamannya sama seperti Input Mingguan: yang tampil pertama adalah **rekap bulanan**, dan tombol
**+ Input Bulanan** (kanan atas) membuka **popup** untuk mengisi/mengunggah data. Berisi **hanya Jenis Data bulanan**;
setiap jenis data bulanan berbentuk salah satu dari dua: **Per nama (rincian)** atau **Rekap angka saja**.

Saat filter **Jenis Data** di halaman diarahkan ke *Data Instruktur dan WI (Bulanan)*, 2 kartu ringkasan teratas
("Total Pelatihan"/"Total Peserta" — tidak relevan untuk jenis data ini) otomatis berganti jadi **Total Instruktur**
dan **Total Widyaiswara**, dihitung terpisah dari kolom "Jenis" per baris data mingguannya.

### Popup "Input Bulanan"
Di dalam popup: pilih Jenis Data bulanan (sudah terfilter), periode bulan, dan (Admin) UPT.

| Jenis | Cara isi |
| :-- | :-- |
| **Per nama (rincian)** (mis. Data Masyarakat, Data Aparatur) | **Tambah Baris** (per orang) atau **Upload Excel**. Baris dapat diedit/dihapus. Menyimpan satu baris **tidak menutup popup** — lanjutkan menambah baris berikutnya, lalu tutup popup (✕) saat selesai |
| **Rekap angka saja** | Hanya angka total per bulan yang dijumlahkan otomatis dari isian mingguan pasangannya; tidak diisi manual |
| Unggah berkas *(mode lama)* | Hanya untuk jenis data lama yang sudah memakainya. Tidak tersedia untuk jenis data baru; ganti ke salah satu mode di atas lewat Kelola Jenis Data bila perlu |

Mode dipilih Admin saat membuat jenis data bulanan di **Kelola Jenis Data**. "Rekap angka saja" wajib memilih Pasangan Jenis Data Mingguan.

**Semua UPT (khusus "Per nama").** Selain memilih satu UPT, Admin bisa memilih **Semua UPT** — tabel menampilkan
baris dari **semua UPT sekaligus** dengan kolom/badge UPT per baris. Karena baris baru butuh satu UPT tujuan yang
jelas, tombol **Tambah Baris**/**Upload Excel**/**Edit** disembunyikan selama "Semua UPT" dipilih (tetap bisa
Lihat & Hapus per baris, dan **Download Excel** ikut menyertakan kolom UPT). Dua tombol tambahan muncul:

* **Hapus Semua** (atau *Hapus Hasil Pencarian* bila sedang mencari) — menghapus sesuai cakupan filter aktif
  (termasuk lintas semua UPT bila "Semua UPT" dipilih), lewat dialog konfirmasi ketik **HAPUS**.
* **Hapus Duplikat** — mendeteksi otomatis baris yang UPT, periode, dan **seluruh isi kolomnya sama persis**
  (mis. akibat Excel yang sama diunggah dua kali), lalu menyisakan satu dan menghapus sisanya.

**Validasi silang**: pada jenis data bulanan yang berpasangan dengan mingguan, aplikasi membandingkan jumlah
baris rincian bulan dengan total peserta dari 4 minggu pasangannya dan menampilkan status kelengkapan
(mis. "Baru 3 dari 4 minggu terisi …") serta selisihnya. Validasi ini otomatis disembunyikan saat "Semua UPT"
dipilih (perbandingannya bersifat per-UPT, tidak berarti saat digabung).

**Impor Excel**
1. Klik **Template Excel** untuk mengunduh berkas dengan kolom sesuai definisi jenis data saat ini.
2. Isi data, lalu **Upload Excel**. Layar **pemetaan kolom** mencocokkan kolom berkas dengan kolom sistem
   secara otomatis; Anda dapat mengoreksinya.
3. Kolom yang tidak dikenali disimpan sebagai *data ekstra* dan dicatat di `audit_log`.
4. Mengimpor ulang baris dengan NIK yang sama **memperbarui** baris tersebut, bukan menggandakan (setelah impor
   selesai, popup otomatis menutup dan rekap di belakangnya menyegarkan).

Menutup popup (✕ / klik luar / Esc) selalu menyegarkan rekap di halaman Input Bulanan.

### Rekap Bulanan (tampilan utama halaman)
Pilih **Tahun**, **Bulan**, **UPT** (Admin), dan **Jenis Data**, lalu pilih tampilan:

* **Rekap 4 Minggu** – total pelatihan, peserta, pagu, realisasi, berkas; rincian per Jenis Data dan status
  kelengkapan tiap minggu. **Download Excel Bulanan** menghasilkan berkas multi-sheet.
* **Data by Name (Unggahan UPT)** – baris per orang hasil unggahan UPT (Excel sesuai template atau form). Admin
  bisa memilih **satu UPT** (tanpa kolom UPT, seperti sebelumnya) atau **Semua UPT** (kolom UPT ditambahkan per
  baris — lihat penjelasan "Semua UPT" di atas, berlaku sama di tampilan ini dan di dalam popup); akun UPT tetap
  otomatis terkunci ke UPT-nya sendiri. Tersedia pencarian, pilihan 25/50/100/250 baris per halaman, dan
  **Download Excel**.
  * **Jenis data kumulatif** (toggle *Data kumulatif* di Kelola Jenis Data, kolom `kumulatif_bulanan`): bila bulan
    yang dipilih belum ada datanya, tampilan otomatis loncat ke **bulan terakhir yang sudah ada datanya** — badge
    **KUMULATIF** muncul di judul, dan catatan biru menjelaskan bulan mana yang ditampilkan. Konsepnya: roster
    bulan terbaru **menggantikan** bulan sebelumnya (UPT mengunggah data lengkap tiap bulan), bukan dataset
    bulanan yang terpisah-pisah.

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
> (kumulatif)**, **Rata-rata**, atau **Maksimum**. Bawaan untuk kolom baru: **nilai terakhir** (angka dianggap
> berjalan/kumulatif — mis. minggu 1 = 10, minggu 2 = 30 → rekap bulan pakai 30, bukan 10 + 30); ganti ke *jumlahkan*
> hanya untuk kolom yang memang mencatat tambahan baru tiap minggu secara terpisah (mis. jumlah peserta pelatihan
> per sesi). Antar-UPT, angka *nilai terakhir* tetap dijumlahkan (total RM semua UPT = jumlah RM terakhir tiap UPT).
> Admin dapat mengubahnya per kolom di **Kelola Jenis Data**.

## Koreksi & Penghapusan Data

Data yang salah dapat **dikoreksi** atau **dihapus**. Mengoreksi (mengubah nilai lalu Simpan) selalu langsung
berlaku — hanya **menghapus** yang diatur di bawah ini.

| Kebutuhan | Cara |
| :-- | :-- |
| Mengoreksi nilai mingguan | Buka periodenya di **Input Mingguan**, klik ikon ✏️ Edit pada baris di tabel rekap, ubah nilai, **Simpan** |
| Mengoreksi satu baris bulanan | Ikon ✏️ pada baris di **Input Bulanan** → ubah → simpan. Impor Excel ulang dengan NIK yang sama juga memperbarui baris |
| Menghapus **satu** baris/berkas/aktivitas | Ikon 🗑️ pada item tersebut (ada konfirmasi) |
| Menghapus **seluruh isian satu periode** | **Input Mingguan** → tombol **Kosongkan Data Minggu Ini**; **Input Bulanan** → **Hapus Semua Data Bulan Ini**. Wajib mengetik **HAPUS** |
| Menghapus **lintas semua UPT sekaligus** (Admin) | Pilih **Semua UPT** di pemilih UPT (Input Mingguan/Bulanan, popup maupun tampilan Data by Name), lalu tombol Kosongkan/Hapus Semua mencakup semua UPT. Wajib mengetik **HAPUS** |
| Menghapus **data duplikat** (baris identik akibat impor dobel) | **Input Bulanan** → tampilan Data by Name / popup → tombol **Hapus Duplikat** (muncul otomatis bila terdeteksi) |

**Aturan siapa yang boleh:**

* **Akun UPT tidak bisa langsung menghapus** data mingguan/bulanan/berkas miliknya sendiri. Menekan tombol
  Hapus/Kosongkan/Hapus Duplikat di atas **mengajukan permintaan** ke Admin ("Akan mengajukan permintaan hapus …
  ke Admin. Data tidak langsung terhapus") — data tetap utuh sampai disetujui. Mengedit/mengosongkan isian biasa
  sambil masih mengisi form minggu/bulan berjalan (bukan lewat tombol Hapus) **tidak** kena aturan ini — tetap
  tersimpan langsung seperti biasa.
* **Admin** menghapus langsung, kapan saja, tanpa perlu persetujuan siapa pun (baik data UPT tertentu maupun
  "Semua UPT" sekaligus). Admin juga yang menyetujui/menolak permintaan dari UPT, lewat menu **Permintaan**,
  bagian **Hapus** (lihat [Menu Admin](#menu-admin) di bawah).
* **Memulihkan** data dari Tempat Sampah hanya dapat dilakukan **Admin**.

Setelah disetujui (atau dihapus langsung oleh Admin), data masuk **Tempat Sampah** selama **30 hari** dan tercatat
di log — bukan langsung permanen. Bila setelah dihapus Anda menyimpan data yang sama lagi (mis. mengisi ulang
kolom mingguan atau memasukkan NIK yang sama), data yang baru otomatis menggantikan salinan di tempat sampah.

## Persetujuan Baris Data

Setiap baris data yang Anda simpan menunggu persetujuan Admin sebelum dihitung resmi — berlaku otomatis pada
**setiap baris**, tanpa perlu tombol "kirim" terpisah.

1. Begitu Anda mengisi & menekan **Simpan** (mingguan, bulanan, atau upload berkas), baris/entri itu langsung
   muncul dengan badge kuning **"Menunggu Persetujuan"**. Anda masih bebas mengedit atau menghapusnya sendiri
   kapan saja selama masih berstatus ini.
2. Baris yang masih menunggu persetujuan **belum ikut dihitung** di Dashboard, Rekap, grafik, atau halaman
   publik — hanya baris yang sudah disetujui yang masuk total resmi. Data Anda tetap tersimpan dan tetap
   terlihat di form Anda sendiri, hanya belum "resmi".
3. Setelah Admin menekan **Setujui** (menu **Permintaan**, bagian "Persetujuan Baris Data"), badge berubah hijau
   **"Disetujui"** dan baris itu **tidak bisa diedit langsung lagi** — kolom formnya dinonaktifkan, tombol Edit
   disembunyikan.
4. Untuk mengubah baris yang sudah disetujui, klik **"Ajukan Hapus untuk Edit"** (mingguan) atau tombol Hapus
   biasa (bulanan/berkas) — ini membuat permintaan ke Admin, sama seperti permintaan hapus data lainnya. Setelah
   Admin menyetujui penghapusannya, Anda bisa memasukkan data baru di posisi itu, yang otomatis kembali berstatus
   menunggu persetujuan.
5. Admin juga bisa menekan **Tolak** alih-alih Setujui — baris itu TIDAK dihapus atau diubah, badge berubah
   merah **"Ditolak"** disertai catatan alasan dari Admin (bila diisi). Baris yang ditolak tetap bisa Anda
   edit/hapus bebas seperti biasa (sama seperti "Menunggu Persetujuan") — begitu Anda perbaiki & **Simpan**
   ulang, badge otomatis kembali kuning "Menunggu Persetujuan" dan catatan penolakan lama hilang, menunggu
   ditinjau Admin lagi dari awal.

**Data yang Admin masukkan sendiri langsung dianggap disetujui** — Admin tidak pernah perlu menyetujui isian
dirinya sendiri.

## Menu Admin

### Kelola Akun UPT
* **Buat Akun Baru** – email, password (≥ 8 karakter), nama lengkap, UPT. Akun langsung aktif.
* Hapus akun (ikon tempat sampah). Akun sendiri tidak dapat dihapus.
* **Tambah UPT** – masukkan *key* (huruf kecil & underscore, mis. `upt_kupang`) dan nama UPT.
* **Hapus UPT** – ⚠️ menghapus UPT ikut menghapus **permanen** seluruh datanya: akun pengguna, rekap mingguan,
  data rincian bulanan, berkas unggahan, dan daily activity milik UPT itu. Dashboard, grafik, dan rekap otomatis
  tidak lagi memuatnya. Aksi ini meminta konfirmasi dan **tidak dapat dibatalkan** (lakukan backup lebih dulu).

### Permintaan
Ada dua bagian berbeda di halaman ini:

**Persetujuan Baris Data** (lihat [Persetujuan Baris Data](#persetujuan-baris-data)): daftar baris data
mingguan/bulanan/berkas yang UPT simpan dan masih menunggu disetujui, dikelompokkan per UPT · Jenis Data ·
Periode. Tiap grup menampilkan pratinjau ringkas tiap baris (nama pelatihan, nama orang, atau judul berkas)
dengan tombol **Setujui** dan **Tolak** per baris, plus tombol **Setujui Semua** di judul grup untuk menyetujui
banyak baris sekaligus. Menekan **Tolak** membuka kotak dialog untuk mengisi alasan (opsional) — baris itu TIDAK
dihapus, hanya ditandai "Ditolak" dengan catatan yang terlihat UPT; mereka tetap bebas mengedit/menghapus baris
draft maupun yang ditolak sendiri kapan saja.

**Hapus** – daftar permintaan hapus data (lihat [Koreksi & Penghapusan Data](#koreksi--penghapusan-data)),
dikelompokkan **Menunggu Persetujuan** dan **Riwayat**. Tiap permintaan menampilkan UPT pengaju, jenis permintaan
(data mingguan/bulanan/berkas), periode, jumlah baris, dan alasan (bila diisi UPT). Dua aksi:

* **Setujui** – benar-benar menjalankan penghapusannya (masuk Tempat Sampah 30 hari seperti penghapusan biasa,
  dapat dipulihkan).
* **Tolak** – data tidak disentuh; boleh menambahkan catatan alasan penolakan (terlihat UPT di riwayat).

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
3. **Grafik**: batang per UPT; tiap **seri** punya nama, warna, dan sumber angka. Di Dashboard, tiap kartu grafik punya
   tombol kecil untuk beralih tampilan **grafik batang ↔ tabel angka** (ikon grafik/tabel di pojok kanan atas kartu) —
   sumber angkanya sama persis, tidak perlu diatur ulang; pilihan tampilan ini per pengguna/per kunjungan, tidak tersimpan.
4. Tombol panah mengubah urutan, ikon mata menyembunyikan, pensil mengubah, tempat sampah menghapus; **Kembali ke bawaan** menghapus semua pengaturan.
5. Berlaku untuk semua akun; akun UPT tetap hanya melihat angka UPT-nya sendiri.

Jenis data atau kolom baru (Kelola Jenis Data, level mingguan, tipe angka) otomatis muncul sebagai pilihan sumber. Rumus yang berbeda
(mis. persentase realisasi terhadap pagu) belum tersedia sebagai tipe widget dan perlu ditambahkan di kode.

### Dokumen & Panduan
Repositori pedoman/regulasi/SOP: dapat dicari, diunduh, ditambah (**+ Tambah Dokumen**), dan dihapus — tersimpan di
**database** (tabel `dokumen_resmi`), bukan di browser, jadi dokumen yang ditambahkan seorang Admin langsung
terlihat bagi Admin lain juga. Ditambah **template Excel** per jenis data, dibuat otomatis dari definisi kolom.

### Arsip Data Historis
Untuk data tahun-tahun lalu yang formatnya berbeda-beda: **unggah berkas Excel atau PDF apa adanya**, lalu lihat langsung di web.

1. Menu **Arsip Data Historis** → pilih **Tahun data**, (Admin: pilih **UPT** atau *Pusat/seluruh UPT*), isi judul, pilih berkas
   (PDF, XLSX, XLS, CSV — maks. 30 MB) → **Unggah**.
2. Klik **Lihat** pada daftar: PDF tampil di penampil bawaan; Excel/CSV tampil sebagai tabel (per sheet, 500 baris pertama).
3. Bila saat mengunggah dipilih **Jenis data**, sistem membandingkan kolom berkas dengan template: hijau *"Format sesuai template"*
   (kolom cocok ≥ 80%) atau kuning *"Format berbeda — ditampilkan apa adanya"*. Berkas berformat berbeda tetap tersimpan & tampil.
4. Seluruh menu **Dokumen & Arsip** (tab ini dan tab **Dokumen & Panduan**) **khusus Admin** — server tetap membatasi
   baca/tulis per `upt_key` bila diakses lewat API, tapi menunya disembunyikan dari UPT di UI. Isi berkas
   disimpan di folder `be/storage` (jangan lupa ikut di-backup — lihat [07-pemeliharaan.md](07-pemeliharaan.md)).

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
`database/migrasi_02_tempat_sampah.sql` di phpMyAdmin. Urutan migrasi lengkap untuk database lama ada di
[07-pemeliharaan.md](07-pemeliharaan.md#peningkatan-dari-versi-sebelumnya-migrasi-database) (01 sampai 09).

### Kelola Jenis Data (Form Builder)
* Tambah/ubah/hapus **Jenis Data**; atur tingkat (mingguan/bulanan), pasangan mingguan, mode bulanan, dan
  **Boleh dilihat publik**. Tingkat (*level utama*) menentukan apakah jenis data muncul di **Input Mingguan**
  atau **Input Bulanan**.
* **Buat dari Excel** (tombol di sebelah *Buat Jenis Data Baru*) — cara cepat membuat Jenis Data bulanan "Per nama"
  langsung dari contoh berkas Excel:
  1. Unggah berkas (baris pertama = judul kolom). Sistem menebak kolom identitas **UPT/Tahun/Bulan** (alias yang
     sama dengan Impor Data Historis) dan tipe tiap kolom isian (teks/angka/tanggal/pilihan, termasuk opsi
     dropdown-nya) dari isi selnya.
  2. Tinjau & koreksi: judul jenis data, tiap kolom (label, field key, tipe, wajib, identitas pribadi), serta
     kolom UPT/Tahun/Bulan (kolom dari berkas, atau "nilai tetap" bila berkas tidak punya kolom itu).
  3. Konfirmasi → Jenis Data + kolom-kolomnya dibuat, dan **seluruh baris berkas langsung diimpor** sebagai data
     pertamanya (baris bermasalah dilewati & dilaporkan, memakai mesin validasi yang sama dengan Impor Data
     Historis).
* Kelola **kolom**: tambah, ubah, aktif/nonaktif, hapus, ubah urutan (seret-dan-lepas), tipe
  (*angka, teks, teks panjang, tanggal, pilihan, berkas*), opsi pilihan, wajib, dan penanda **Identitas Pribadi**
  (tidak pernah tampil di publik).
* **Tipe Berkas** — UPT mengunggah berkas (PDF, Word, atau Excel; maks. **10 MB**) langsung dari form, menggantikan
  cara lama mengetik link (mis. "Link Laporan Pelatihan"). Di tabel rekap, sel ini menampilkan tombol **📎 unduh**
  berisi nama berkas asli, bukan teks link. Mengganti berkas otomatis membuang berkas lama. **Tidak bisa** diisi
  lewat Excel — kolom bertipe Berkas dikecualikan dari template & impor Excel (termasuk Impor Data Historis).
* Untuk kolom **angka** pada jenis data mingguan tersedia **Cara Rekap** (jumlahkan / nilai terakhir / rata-rata /
  maksimum). **Bawaan kolom baru: Nilai terakhir** (angka dianggap berjalan/kumulatif — mis. minggu 1 = 10, minggu 2
  = 30 → rekap bulan pakai 30, bukan 10 + 30). Ganti ke *Jumlahkan* hanya untuk kolom yang memang mencatat tambahan
  baru tiap minggu secara terpisah. Lencana cara rekap tampil di daftar kolom.
* Pada jenis data mingguan, kotak **Boleh lebih dari 1 pelatihan per minggu** (di *Edit Pengaturan*) mengizinkan
  tombol "Tambah Pelatihan" di Input Mingguan diklik berkali-kali (banyak baris per minggu); tanpa kotak ini,
  jenis data itu cuma bisa punya satu baris nilai per minggu ("Isi Data Minggu Ini").
* Pada jenis data bulanan **Per nama**, kotak **Data kumulatif (bulan terbaru menggantikan sebelumnya)** (di
  *Edit Pengaturan*) mengaktifkan perilaku loncat-otomatis-ke-bulan-terakhir di **Data by Name** — lihat
  [Input Bulanan](#input-bulanan).
* **Opsi bersyarat** untuk kolom bertipe *Pilihan*: opsinya bisa dibuat berbeda tergantung nilai kolom pilihan
  lain di baris yang sama (mis. "Jenjang Jabatan" berbeda untuk Instruktur vs Widyaiswara pada *Data Instruktur
  dan WI*). Saat menambah/mengubah kolom bertipe Pilihan, centang **"Opsi tergantung kolom lain (bersyarat)"**,
  pilih kolom *Pilihan* lain di level yang sama sebagai acuan (kolom acuan harus sudah punya opsi tetap sendiri),
  lalu isi opsi untuk **setiap** nilai kolom acuan itu. Tombol ini nonaktif bila belum ada kolom Pilihan lain yang
  bisa dijadikan acuan — buat kolom acuannya (opsi tetap biasa) terlebih dahulu.
* Perubahan langsung berlaku bagi semua pengguna **tanpa deploy ulang** — form input dan template Excel mengikuti
  definisi terbaru.
* Menghapus Jenis Data menghapus juga kolom, nilai rekap, data rincian, dan berkas terkait (ada konfirmasi).

> Kartu/grafik Dashboard mengambil angka dari **key** Jenis Data & **field_key** kolom yang dipilih di **Kelola
> Dashboard** (lihat menu Admin di bawah) — bukan lagi tertanam tetap di kode. Mengganti `key` jenis data atau
> `field_key` kolom yang sedang dipakai sebagai sumber widget membuat widget itu berhenti menemukan datanya
> (tampil kosong); buka **Kelola Dashboard** untuk memilih ulang sumbernya setelah mengganti key/kolom. Begitu
> pula mengganti **judul** Jenis Data: `key` internalnya tidak ikut berubah (stabil sejak dibuat), tapi mengubah
> struktur kolom suatu Jenis Data mengubah arti data yang sudah tersimpan di baris-baris lama miliknya.

## Tampilan Publik

Tanpa login, satu halaman ringkas: pilih tahun, lalu lihat total data terdata per kategori (jenis data yang ditandai publik) beserta totalnya. Semua data yang bersifat
identitas pribadi (nama, NIK, telepon, alamat, NIP) **tidak pernah** dikirim ke halaman ini.
