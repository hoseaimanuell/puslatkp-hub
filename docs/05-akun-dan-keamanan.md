# 05 — Akun & Keamanan

## Akun awal (dari `database/puslatkp1a.sql`)

> ⚠️ Password di bawah adalah **password bawaan yang tercantum di dokumentasi**. Untuk lingkungan produksi
> **wajib diganti** (lihat bagian "Mengganti password").

| Peran | Nama | Email | Password |
| :-- | :-- | :-- | :-- |
| Admin | Admin PUSLATKP | `admin@puslatkp.kkp.go.id` | `AdminPuslatkp2026!` |
| UPT | BPPP Jakarta | `bppp.jakarta@kkp.go.id` | `Jakarta2026!` |
| UPT | BPPP Medan | `bppp.medan@kkp.go.id` | `Medan2026!` |
| UPT | BPPP Banyuwangi | `bppp.banyuwangi@kkp.go.id` | `Banyuwangi2026!` |
| UPT | BPPP Tegal | `bppp.tegal@kkp.go.id` | `Tegal2026!` |
| UPT | BPPP Bitung | `bppp.bitung@kkp.go.id` | `Bitung2026!` |
| UPT | BPPP Ambon | `bppp.ambon@kkp.go.id` | `Ambon2026!` |
| UPT | BPPP Padang | `bppp.padang@kkp.go.id` | `Padang2026!` |
| UPT | BPPP Pontianak | `bppp.pontianak@kkp.go.id` | `Pontianak2026!` |
| UPT | BPPP Makassar | `bppp.makassar@kkp.go.id` | `Makassar2026!` |
| UPT | BPPP Sorong | `bppp.sorong@kkp.go.id` | `Sorong2026!` |
| UPT | BDA Sukamandi | `bda.sukamandi@kkp.go.id` | `BdaSukamandi2026!` |
| UPT | BPMPKP Buleleng | `bpmpkp.buleleng@kkp.go.id` | `BpmpkpBuleleng2026!` |
| UPT | BPPPA Denpasar | `bpppa.denpasar@kkp.go.id` | `BpppaDenpasar2026!` |
| UPT | BPPSDMKP | `bppsdmkp@kkp.go.id` | `Bppsdmkp2026!` |
| UPT | BRBIH Depok | `brbih.depok@kkp.go.id` | `BrbihDepok2026!` |
| UPT | BRPBAPPP Maros | `brpbappp.maros@kkp.go.id` | `BrpbapppMaros2026!` |
| UPT | BRPI | `brpi@kkp.go.id` | `Brpi2026!` |
| UPT | Pusat Pelatihan KP | `pusat.pelatihan.kp@kkp.go.id` | `PusatPelatihanKp2026!` |

Ke-18 UPT di atas ada di `database/puslatkp1a.sql` sejak `be/scripts/seed-data.js` disinkronkan (lihat
[04-database.md](04-database.md#data-awal-seed)) — instalasi **baru** langsung mendapat semuanya tanpa langkah
tambahan. Di lingkungan pengembangan yang sudah lama berjalan (dibuat sebelum sinkronisasi ini), 8 UPT terakhir
mungkin sudah ada dengan **password berbeda** (dibuat manual lewat Kelola Akun UPT, password diberikan langsung ke
Admin saat itu dan tidak tersimpan sebagai teks biasa) — gunakan tombol **Reset Password** di menu Kelola Akun UPT
bila perlu menyamakan dengan tabel di atas.

**Akun alias lama tidak disertakan.** Versi sebelumnya punya `admin@kp.go.id` (password `admin`) dan
`upt@kp.go.id` (password `upt`). Karena password-nya mudah ditebak, keduanya sengaja tidak dimasukkan ke database.
Bila tetap dibutuhkan untuk uji coba lokal, buat lewat menu *Kelola Akun UPT* (UPT) atau `INSERT` manual.

## Peran & hak akses

| | Admin | UPT | Publik |
| :-- | :-- | :-- | :-- |
| Melihat data | Semua UPT | Hanya UPT sendiri | Agregat jenis data publik |
| Input/ubah data | Semua UPT, kapan saja | UPT sendiri; lewat deadline tetap boleh (ditandai **Terlambat**), tapi terkunci total begitu "Kirim & Kunci" ditekan | — |
| Hapus data (tombol Hapus/Kosongkan/Hapus Duplikat) | Langsung terhapus | **Perlu persetujuan Admin** (menu Permintaan Hapus & Buka Kunci) | — |
| Buka kunci periode yang sudah "Kirim & Kunci" | Langsung (tidak pernah terkunci) | **Perlu persetujuan Admin** ("Ajukan Buka Kunci") | — |
| Kelola akun UPT & daftar UPT | ✔ | — | — |
| Kelola Jenis Data & kolom | ✔ | — | — |
| Rekap & ekspor semua UPT | ✔ | — | — |

Detail per tabel: [03-api-reference.md](03-api-reference.md#matriks-hak-akses-per-tabel).

**Hapus data akun UPT perlu persetujuan Admin.** Tombol Hapus/Kosongkan/Hapus Duplikat pada data mingguan, bulanan,
dan berkas unggahan milik akun UPT tidak lagi langsung menghapus — sistem membuat **permintaan hapus** yang harus
disetujui Admin (menu **Permintaan Hapus & Buka Kunci**) sebelum data benar-benar terhapus (dan masuk Tempat
Sampah seperti biasa). Mengedit atau mengosongkan isian saat masih dalam sesi input mingguan/bulanan (tanpa
menekan tombol Hapus) tetap tersimpan langsung seperti biasa — pembatas ini hanya berlaku untuk aksi hapus yang
disengaja.

**Kirim & Kunci Data — buka kunci juga perlu persetujuan Admin.** Akun UPT dapat menekan **"Kirim & Kunci"** pada
suatu periode (minggu/bulan) di Input Mingguan/Bulanan setelah yakin datanya benar. Ini mengunci **semua** jenis
data periode itu sekaligus — form input, tombol hapus, dan tombol tambah/edit disembunyikan, UPT hanya bisa
melihat. Untuk mengedit lagi, UPT menekan **"Ajukan Buka Kunci"**, yang masuk ke menu Permintaan Hapus & Buka
Kunci yang sama seperti permintaan hapus — setelah Admin menyetujui, kunci dibuka dan UPT bisa mengedit sampai
menekan "Kirim" lagi. Admin sendiri tidak pernah terkunci, kapan pun.

## Mengelola akun

**Membuat akun UPT** – login sebagai Admin → menu **Kelola Akun UPT** → *Buat Akun Baru*: isi email, password (min. 8
karakter), nama lengkap, dan UPT. Akun langsung aktif.

**Menghapus akun** – tombol tempat sampah pada daftar akun (akun sendiri tidak dapat dihapus).

**Melihat/mengganti password akun UPT** – password tersimpan sebagai hash bcrypt satu arah, jadi password yang sudah
ada **tidak bisa ditampilkan ulang** (baik lewat UI maupun database) — ini bukan keterbatasan, melainkan desain
keamanan standar. Untuk memberikan password baru ke UPT: tombol **ikon kunci** (Reset Password) pada baris akun di
menu **Kelola Akun UPT** → password baru dibuat otomatis (bisa diketik ulang manual) → klik **Reset Password** →
password baru ditampilkan **satu kali** dengan tombol salin, lalu berikan ke UPT terkait. Halaman tidak menyimpan
atau menampilkannya lagi setelah modal ditutup.

Cara lama lewat command line (`npm run user:password -- email password`, dari folder `be/`) tetap berfungsi dan
berguna untuk akun Admin sendiri (menu Reset Password di UI hanya untuk akun ber-peran UPT).

## Autentikasi

* Password disimpan sebagai **hash bcrypt** (`profiles.password_hash`); password asli tidak pernah tersimpan.
* Login menghasilkan **JWT** (HS256) berisi ID akun, masa berlaku `JWT_EXPIRES_IN` (default 12 jam), ditandatangani
  `JWT_SECRET`. Token disimpan di `localStorage` browser.
* Di **setiap** permintaan be memuat ulang akun dari database → akun yang dihapus atau diubah perannya langsung
  berlaku, walaupun token belum kedaluwarsa. Bila token ditolak (401), frontend otomatis kembali ke halaman login.
* Login dibatasi 30 percobaan / 15 menit / IP, dan pesan galat sama untuk email/password salah.
* **Mengganti `JWT_SECRET`** membatalkan seluruh sesi aktif.

## Perlindungan lain

| Ancaman | Perlindungan |
| :-- | :-- |
| SQL injection | Nama tabel/kolom whitelist; nilai berparameter; diuji dengan nama kolom berbahaya → ditolak 400 |
| Akses lintas UPT | Pembatas `upt_key` ditambahkan server pada SELECT/UPDATE/DELETE, dipaksa pada INSERT |
| Ubah data setelah deadline | Diperiksa server (`periods.deadline`), bukan hanya tampilan |
| Pemalsuan kolom sistem | `id`, `created_by`, `actor_id`, dll. diisi server |
| Pemalsuan catatan penghapusan | Log hapus/pulihkan hanya ditulis server; browser hanya boleh mencatat `import_kolom_tidak_dikenal` |
| Kiriman data raksasa tanpa login | Batas body 100 KB untuk pengunjung anonim (25 MB hanya untuk akun login) |
| Kebocoran hash password | Kolom tidak ada di whitelist; profil dikembalikan tanpa hash |
| Data pribadi ke publik | `/publik` hanya membaca `v_publik_rekap` (jumlah agregat) & judul jenis data |
| XSS / clickjacking, dll. | Header `helmet` di be; React meng-escape keluaran |
| Injeksi rumus Excel | Ekspor Excel menetralkan sel berawalan `=`, `+`, `-`, `@` |
| CORS | Hanya origin di `CORS_ORIGIN` yang diizinkan |

## Rekomendasi produksi

1. Gunakan **HTTPS** (token dikirim di header). Set `CORS_ORIGIN` ke domain resmi saja.
2. Buat pengguna MySQL khusus (hak hanya pada `Puslatkp1a`), jangan `root`.
3. `JWT_SECRET` acak ≥ 32 byte; simpan di env, jangan di Git (`.env` sudah di-`.gitignore`).
4. Ganti seluruh password bawaan; jadwalkan backup database.
5. Pasang be di belakang reverse proxy dan batasi akses port 4000 dari luar bila tidak perlu.

## Catatan yang perlu diketahui

* Pustaka `xlsx@0.18.5` (dipakai impor/ekspor Excel, sama seperti versi lama) memiliki advisori keamanan yang
  diketahui pada versi npm-nya. Risikonya ada saat membuka berkas Excel dari sumber tidak tepercaya; hanya
  impor berkas dari UPT yang dikenal.
* Berkas unggahan disimpan sebagai base64 di database. Nyaman untuk skala kecil-menengah; untuk volume besar
  pertimbangkan penyimpanan berkas terpisah.
