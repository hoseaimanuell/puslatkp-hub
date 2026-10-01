# 06 — Panduan Pengguna

Panduan ini untuk tiga jenis pengguna:

* **Akun UPT**: pegawai UPT/Balai yang mengisi data mingguan dan bulanan.
* **Admin**: pengelola di PUSLATKP yang memeriksa, menyetujui, dan mengatur isi aplikasi.
* **Pengunjung**: siapa saja yang membuka Tampilan Publik tanpa login.

Hal teknis (pemasangan, database, backup) ada di dokumen lain, mulai dari [README](../README.md).

## Masuk dan keluar

1. Buka alamat aplikasi yang diberikan Admin. Isi **Email** dan **Password**, lalu klik **Masuk**.
2. Akun dibuat oleh Admin. Kalau lupa password, minta Admin mengatur ulang password Anda.
3. Untuk keluar, klik ikon keluar di pojok kanan atas. Sesi juga berakhir sendiri setelah 12 jam.
4. Tampilan Publik bisa dibuka tanpa login lewat tautan **Tampilan Publik** di bawah formulir login.

Sidebar di kiri bisa dibuka dan ditutup dengan ikon ☰ di kiri atas. Di layar HP, sidebar tertutup dengan sendirinya.
Kalau muncul tulisan merah **Server terputus** di bagian atas, aplikasi sedang tidak bisa menghubungi server. Tunggu
sebentar lalu muat ulang halaman. Kalau masih terjadi, hubungi Admin.

## Prinsip: setiap UPT hanya melihat datanya sendiri

Akun **UPT** hanya melihat dan mengisi data **UPT-nya sendiri** di seluruh menu yang bisa diaksesnya (Dashboard,
Input Mingguan, Input Bulanan, Rekap Triwulan & Tahun). Ini ditegakkan di server, bukan hanya di tampilan.
Akun **Admin** melihat semua UPT dan dapat memilih UPT (termasuk **Semua UPT**, lihat masing-masing menu) saat
memfilter/menginput/menghapus.

## Alur kerja singkat

1. UPT mengisi data di **Input Mingguan** dan **Input Bulanan**, atau mengunggah Weekly Report.
2. Setiap baris yang disimpan UPT berstatus **Menunggu Persetujuan**.
3. Admin memeriksa dan menyetujui (atau menolak) di menu **Permintaan**.
4. Hanya data yang sudah **Disetujui** yang masuk Dashboard, rekap, dan Tampilan Publik.

## Menu

| Menu | Untuk | Isi |
| :-- | :-- | :-- |
| Dashboard | Semua | Ringkasan angka dan grafik |
| Input Mingguan | Semua | Mengisi dan melihat data mingguan |
| Input Bulanan | Semua | Mengisi data bulanan dan melihat rekap bulanan |
| Rekap Triwulan & Tahun | Semua | Rekap otomatis per triwulan dan per tahun (hanya dibaca) |
| Dokumen & Arsip | Admin | Pedoman, SOP, template Excel, dan arsip berkas tahun-tahun lalu |
| Kelola Akun UPT | Admin | Akun pengguna dan daftar UPT |
| Permintaan | Admin | Menyetujui data UPT, permintaan hapus, dan permintaan edit |
| Kelola Jenis Data | Admin | Mengatur jenis data dan kolom isiannya |
| Kelola Dashboard | Admin | Mengatur kartu dan grafik Dashboard |
| Pengaturan Lanjutan | Admin | Kelola Periode, Impor Data Historis, dan Tempat Sampah (jarang dipakai) |

## Dashboard

Dashboard menampilkan ringkasan dari data UPT yang sudah disetujui. Pilih minggu di bagian atas (tombol ◀ ▶ untuk
berpindah minggu). Bawaannya minggu yang sedang berjalan. Kalau ada data lebih dari satu tahun, pilihan **Tahun**
juga muncul.

Angka di Dashboard dihitung **dari minggu pertama tahun itu sampai minggu yang dipilih**. Jadi memilih minggu yang
lebih akhir selalu menghasilkan angka yang sama atau lebih besar.

Bawaannya Dashboard berisi:

* Kartu **Masyarakat Dilatih**, **Aparatur Dilatih**, dan **SDM Pelatih** (instruktur dan widyaiswara).
* Kotak **Realisasi Anggaran**: RM, PNBP/BLU, SBSN, dan Total Realisasi Anggaran.
* Grafik **Peserta Dilatih** dan **Pagu vs Realisasi** per UPT. Tombol kecil di pojok kartu grafik mengganti
  tampilan menjadi tabel angka.

Kalau belum ada data, kartu menampilkan **–** dan tulisan *Menunggu input UPT*. Admin juga melihat berapa UPT yang
sudah mengisi. Isi kartu dan grafik bisa diubah Admin di **Kelola Dashboard**.

## Input Mingguan

Halaman ini menampilkan tabel rekap mingguan. Gunakan filter di atas tabel (tahun, triwulan, bulan, minggu, jenis
data; Admin juga memilih UPT). Satu bulan dibagi empat minggu: tanggal 1–7, 8–14, 15–21, dan 22 sampai akhir bulan.

### Mengisi data

1. Klik **Input Mingguan** di kanan atas.
2. Pilih jenis data, minggu, dan (untuk Admin) UPT.
3. Klik **Tambah Pelatihan**, atau **Isi Data Minggu Ini** untuk jenis data yang hanya punya satu baris per minggu.
4. Isi kolomnya, lalu klik **Simpan**. Baris baru langsung muncul di tabel dengan status *Menunggu Persetujuan*.

Untuk mengubah, klik ikon pensil di kolom **Aksi**. Untuk menghapus, klik ikon tempat sampah. Aturan untuk baris yang
sudah disetujui ada di bagian [Mengubah dan menghapus data](#mengubah-dan-menghapus-data).

Beberapa jenis data (misalnya Masyarakat dan Aparatur) boleh berisi **lebih dari satu pelatihan dalam seminggu**.
Klik **Tambah Pelatihan** lagi untuk setiap pelatihan. Angka minggu itu adalah jumlah semua pelatihannya.

Di jenis data tertentu, pilihan satu kolom menentukan pilihan kolom lain. Contohnya di *Data Instruktur dan WI*:
pilih dulu **Jenis** (Instruktur atau Widyaiswara), baru pilihan **Jenjang Jabatan** yang sesuai muncul.

### Angka berjalan (kumulatif)

Kolom bertanda **kumulatif**, seperti pagu, realisasi, dan jumlah SDM, diisi dengan **total sejak awal tahun sampai
minggu itu**, bukan tambahan minggu itu saja. Contoh: realisasi minggu pertama Rp10 juta, minggu kedua bertambah
Rp20 juta, maka minggu kedua diisi Rp30 juta. Rekap bulanan, triwulan, dan tahunan memakai angka terakhir ini.
Kolom lain, seperti jumlah peserta, dijumlahkan dari minggu ke minggu.

### Kolom data dukung

Kolom seperti *Laporan Pelatihan*, *Data Dukung PNBP*, dan *Bukti Dukung* bisa diisi dengan salah satu cara:

* **Unggah berkas** PDF, Word, atau Excel, paling besar 10 MB, atau
* **Tempel link** di isian *atau link*, misalnya link folder Google Drive. Link harus diawali `http://` atau
  `https://`.

Di tabel, berkas tampil sebagai tombol unduh dan link tampil sebagai **Buka link**.

### Impor Weekly Report

UPT yang biasa mengirim **Form Weekly Report** (Excel) tidak perlu mengetik ulang isinya.

1. Klik **Impor Weekly Report** di samping tombol *Input Mingguan*, lalu pilih berkasnya.
2. Aplikasi membaca nama UPT dan tanggal laporan dari formulir, lalu memilih minggu yang sesuai. Contohnya, laporan
   24 September 2026 masuk ke Minggu ke-4 September 2026. Admin bisa mengganti UPT dan minggunya bila perlu.
3. Periksa **pratinjau**. Setiap bagian formulir tampil sebagai tabel. Kotak **Perlu dicek** memberi tahu kalau ada
   angka yang janggal, misalnya pagu per jenis belanja tidak sama dengan pagu per sumber dana.
4. Klik **Simpan**. Data masuk dengan status *Menunggu Persetujuan*, sama seperti input biasa.

Mengimpor ulang laporan minggu yang sama hanya memperbarui angkanya, tidak menggandakan. Bagian formulir yang kosong
tidak mengubah data yang sudah ada. Setelah tersimpan, semua angka tetap bisa diubah di Input Mingguan. Total Balai
dan persentase di formulir tidak disimpan karena aplikasi menghitungnya sendiri.

## Input Bulanan

Halaman ini menampilkan rekap bulanan. Tombol **Input Bulanan** di kanan atas membuka jendela untuk mengisi data.
Jenis data bulanan ada dua macam:

* **Per nama**: satu baris untuk satu orang, misalnya Data Masyarakat dan Data Aparatur. Diisi lewat
  **Tambah Baris** atau **Upload Excel**.
* **Rekap angka**: angkanya dihitung otomatis dari data mingguan, jadi tidak perlu diisi.

### Upload Excel

1. Klik **Template Excel** untuk mengunduh berkas dengan kolom yang benar, lalu isi datanya.
2. Klik **Upload Excel** dan pilih berkasnya.
3. Periksa layar **pemetaan kolom**. Aplikasi mencocokkan kolom Excel dengan kolom isian secara otomatis. Perbaiki
   bila ada yang keliru, lalu lanjutkan.

Excel buatan sendiri juga bisa dipakai, termasuk yang memakai sel gabungan (merge). Judul laporan di baris paling
atas dilewati, judul kolom dua tingkat digabung (misalnya "Jumlah Peserta" di atas "L" dan "P" menjadi "Jumlah
Peserta L" dan "Jumlah Peserta P"), dan baris JUMLAH atau TOTAL diabaikan. Hanya sheet pertama yang dibaca. Satu kali
unggah paling banyak 5.000 baris.

Setiap baris dicocokkan dengan data yang sudah ada lewat **NIK**, atau lewat **nama** kalau NIK kosong. Karena itu,
mengunggah berkas yang sama dua kali tidak membuat data dobel:

* Baris yang isinya sama dilewati.
* Baris yang berubah dan belum disetujui diperbarui.
* Baris baru ditambahkan.
* Baris yang sudah disetujui tapi isinya berubah tidak langsung ditimpa. Aplikasi bertanya apakah perubahan itu
  diajukan ke Admin (**Ajukan ke Admin**) atau diabaikan (**Lewati**).

Setelah selesai, muncul ringkasan jumlah baris baru, diperbarui, dilewati, dan diajukan.

### Rekap bulanan

Pilih tahun, bulan, jenis data, dan (Admin) UPT. Ada dua tampilan:

* **Rekap 4 Minggu**: total pelatihan, peserta, pagu, dan realisasi bulan itu, serta kelengkapan isian tiap minggu.
  **Download Excel Bulanan** mengunduh rekapnya.
* **Data by Name**: daftar baris per orang, lengkap dengan pencarian dan **Download Excel**. Kalau ada baris yang
  persis sama, tombol **Hapus Duplikat** muncul.

Untuk jenis data bulanan yang berpasangan dengan data mingguan, aplikasi membandingkan jumlah orang di data bulanan
dengan jumlah peserta dari empat minggunya dan menampilkan selisihnya.

## Rekap Triwulan & Tahun

Halaman ini hanya untuk dibaca. Semua angkanya dihitung otomatis dari data mingguan yang sudah disetujui.

1. Pilih **Triwulan** (lalu Triwulan I sampai IV) atau **Tahunan**, dan pilih tahunnya.
2. Admin bisa memilih satu UPT atau **Semua UPT**.
3. Filter **Jenis Data** membatasi tabel di bagian bawah.

Isinya: kartu ringkasan, rincian per bulan atau per triwulan, tabel per jenis data, dan tombol **Download Excel**.

## Status data

Setiap baris data punya status:

| Status | Artinya | Yang bisa dilakukan UPT |
| :-- | :-- | :-- |
| Menunggu Persetujuan (kuning) | Sudah tersimpan, belum diperiksa Admin, belum masuk rekap | Mengubah dan menghapus langsung |
| Disetujui (hijau) | Sudah resmi dan masuk rekap | Mengajukan perubahan atau penghapusan ke Admin |
| Ditolak (merah) | Admin menolak, disertai alasan bila diisi | Memperbaiki lalu menyimpan lagi; statusnya kembali *Menunggu Persetujuan* |

Data yang dimasukkan Admin langsung berstatus *Disetujui*.

## Mengubah dan menghapus data

**Baris yang belum disetujui** (menunggu atau ditolak) boleh diubah dan dihapus langsung oleh UPT.

**Baris yang sudah disetujui** tidak bisa diubah langsung oleh UPT:

* Klik **Edit**, ubah isinya, lalu **Simpan**. Perubahan itu dikirim ke Admin sebagai **permintaan edit**. Angka lama
  tetap berlaku sampai Admin menyetujuinya. Kalau Anda mengajukan edit lagi sebelum Admin memproses, pengajuan lama
  diganti dengan yang baru.
* Klik ikon hapus untuk mengajukan **permintaan hapus**. Datanya tetap ada sampai Admin menyetujui.

Untuk menghapus banyak data sekaligus:

* **Kosongkan Data Minggu Ini** di Input Mingguan, atau **Hapus Semua Data Bulan Ini** di Input Bulanan. Anda harus
  mengetik **HAPUS** untuk memastikan.
* Kalau di antara data itu ada yang sudah disetujui, seluruh penghapusan diajukan ke Admin lebih dulu.
* Admin bisa memilih **Semua UPT** untuk menghapus data satu periode dari semua UPT sekaligus.

Data yang dihapus masuk **Tempat Sampah** selama 30 hari dan masih bisa dipulihkan oleh Admin.

## Deadline dan tanda Terlambat

Setiap minggu dan bulan punya batas waktu pengisian. Setelah batas waktu lewat, UPT **tetap bisa** mengisi dan
mengubah data. Bedanya, data yang disimpan setelah batas waktu diberi tanda merah **Terlambat**. Tanda ini tidak hilang
walaupun data disimpan ulang. Data yang dimasukkan Admin tidak pernah diberi tanda Terlambat.

## Khusus Admin

### Permintaan

Halaman ini punya dua bagian.

**Persetujuan Baris Data** berisi data UPT yang menunggu persetujuan, dikelompokkan per UPT, jenis data, dan periode.

* **Setujui** menyetujui satu baris. **Setujui Semua** menyetujui satu kelompok sekaligus.
* **Tolak** menandai baris sebagai ditolak. Anda bisa menulis alasannya, dan UPT akan melihat alasan itu. Barisnya
  tidak dihapus.

**Hapus & Edit** berisi permintaan dari UPT untuk menghapus atau mengubah data yang sudah disetujui. Label merah
berarti permintaan hapus, label kuning berarti permintaan edit (nilai barunya terlihat di daftar).

* **Setujui** pada permintaan hapus memindahkan data ke Tempat Sampah. Pada permintaan edit, nilai baru langsung
  berlaku dan tetap berstatus disetujui.
* **Tolak** tidak mengubah data apa pun. Anda bisa menulis alasannya.

### Kelola Akun UPT

* **Buat Akun Baru**: isi email, password (minimal 8 karakter), nama lengkap, dan UPT. Satu UPT boleh punya beberapa
  akun. Sebaiknya setiap pegawai punya akun sendiri supaya tercatat siapa mengisi apa.
* **Reset Password**: ikon kunci pada baris akun. Password baru hanya ditampilkan sekali, jadi salin dan berikan
  langsung ke pemilik akun.
* **Tambah UPT**: isi kode UPT (huruf kecil dan garis bawah, misalnya `upt_kupang`) dan nama UPT.
* **Hapus UPT**: menghapus UPT ikut menghapus **permanen** semua akun dan datanya. Langkah ini tidak bisa dibatalkan,
  jadi pastikan ada backup sebelumnya.

### Kelola Jenis Data

Di sini Admin mengatur jenis data dan kolom isiannya. Perubahan langsung berlaku untuk formulir input dan template
Excel.

* **Jenis data**: judul, diisi mingguan atau bulanan, pasangan mingguannya (untuk data bulanan), boleh tampil di
  Tampilan Publik atau tidak, dan boleh berisi lebih dari satu pelatihan per minggu atau tidak.
* **Buat dari Excel**: membuat jenis data bulanan per nama langsung dari contoh berkas Excel. Kolom dan jenis isiannya
  ditebak dari isi berkas, bisa Anda periksa dulu, lalu seluruh baris berkas ikut diimpor.
* **Kolom**: tambah, ubah, sembunyikan, hapus, atau ubah urutan dengan menyeret. Jenis isian yang tersedia: angka,
  teks singkat, teks panjang, tanggal, pilihan, dan berkas. Centang **Data pribadi** untuk kolom seperti NIK supaya
  tidak pernah tampil di Tampilan Publik.
* **Dihitung di rekap sebagai** (jenis data mingguan): menentukan kolom mana yang menjadi jumlah Pelatihan, Peserta,
  Pagu, dan Realisasi di tabel rekap. Panel **Cara data ini dihitung di rekap** merangkumnya. Untuk dua rincian dari
  angka yang sama (misalnya anggaran per jenis belanja dan per sumber dana), pilih salah satu saja supaya tidak
  terhitung dua kali.
* **Cara rekap** (kolom angka mingguan): *nilai terakhir* untuk angka berjalan seperti pagu dan realisasi, atau
  *jumlahkan* untuk angka yang dicatat terpisah tiap minggu.
* **Opsi bersyarat** (kolom pilihan): pilihan kolom ini mengikuti nilai kolom pilihan lain di baris yang sama.

Menghapus jenis data ikut menghapus kolom dan semua datanya. Kalau sebuah kolom dipakai di Dashboard lalu dihapus atau
diganti, periksa lagi **Kelola Dashboard**.

### Kelola Dashboard

1. Klik **Salin tampilan bawaan** supaya tampilan Dashboard bisa diubah.
2. **Kartu**: atur judul, bagian, gaya, satuan (angka atau rupiah), dan sumber angkanya (jenis data dan kolom; bisa
   lebih dari satu, nanti dijumlahkan).
3. **Grafik**: batang per UPT. Setiap seri punya nama, warna, dan sumber angka.
4. Gunakan tombol panah untuk mengubah urutan, ikon mata untuk menyembunyikan, pensil untuk mengubah, dan tempat sampah
   untuk menghapus. **Kembali ke bawaan** mengembalikan tampilan semula.

Pengaturan ini berlaku untuk semua akun. Akun UPT tetap hanya melihat angka UPT-nya sendiri.

### Dokumen & Arsip

**Dokumen & Panduan** berisi pedoman, regulasi, dan SOP yang bisa dicari, diunduh, ditambah, dan dihapus. Di sini juga
ada **Template Standar Impor Excel**: pilih jenis data, lalu unduh templatenya.

**Arsip Data Historis** menyimpan berkas data tahun-tahun lalu apa adanya.

1. Pilih tahun data dan UPT (atau Pusat), isi judul, pilih berkas PDF, XLSX, XLS, atau CSV (paling besar 30 MB), lalu
   klik **Unggah**.
2. Klik **Lihat** untuk membuka berkasnya langsung di web. Berkas Excel tampil sebagai tabel.

### Pengaturan Lanjutan

**Kelola Periode.** Periode tahun berjalan dan tahun depan dibuat otomatis. Di sini Admin bisa membuat periode untuk
tahun-tahun lalu dan mengubah batas waktu (deadline) setiap periode.

**Impor Data Historis.** Untuk memasukkan data per nama tahun-tahun lalu supaya ikut di rekap.

1. Pastikan periode tahun itu sudah ada di Kelola Periode.
2. Pilih jenis data, lalu pilih berkas dari komputer atau dari Arsip Data Historis.
3. Periksa pemetaan kolom. Kalau berkas tidak punya kolom UPT, tahun, atau bulan, isi nilainya untuk seluruh berkas.
4. Klik **Periksa Data**. Baris yang bermasalah ditampilkan beserta alasannya. Lanjutkan dengan **Impor**.

**Tempat Sampah.** Berisi data yang dihapus dalam 30 hari terakhir. **Pulihkan** mengembalikan datanya, ikon tempat
sampah membuangnya permanen. Tab **Catatan Aktivitas** mencatat penghapusan, pemulihan, perubahan periode, dan impor.

## Tampilan Publik

Pengunjung tanpa login bisa memilih tahun dan melihat total data per kategori untuk jenis data yang diizinkan Admin.
Data pribadi seperti nama, NIK, telepon, alamat, dan NIP tidak pernah ditampilkan di halaman ini.

## Jika ada masalah

| Masalah | Yang perlu dicek |
| :-- | :-- |
| Lupa password | Minta Admin melakukan Reset Password |
| Data sudah diisi tapi tidak muncul di Dashboard atau rekap | Statusnya mungkin masih *Menunggu Persetujuan*. Data baru dihitung setelah disetujui Admin |
| Tidak bisa mengubah data | Baris itu sudah disetujui. Klik **Edit** dan simpan untuk mengajukan perubahan ke Admin |
| Tulisan merah **Server terputus** | Muat ulang halaman setelah beberapa saat. Kalau masih terjadi, hubungi Admin |
| Angka di tabel rekap 0 padahal datanya ada | Admin perlu memeriksa **Dihitung di rekap sebagai** pada jenis data itu |
| Muncul pesan terlalu banyak percobaan login | Tunggu 15 menit, lalu coba lagi dengan password yang benar |
