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

**Akun alias lama tidak disertakan.** Versi sebelumnya punya `admin@kp.go.id` (password `admin`) dan
`upt@kp.go.id` (password `upt`). Karena password-nya mudah ditebak, keduanya sengaja tidak dimasukkan ke database.
Bila tetap dibutuhkan untuk uji coba lokal, buat lewat menu *Kelola Akun UPT* (UPT) atau `INSERT` manual.

## Peran & hak akses

| | Admin | UPT | Publik |
| :-- | :-- | :-- | :-- |
| Melihat data | Semua UPT | Hanya UPT sendiri | Agregat jenis data publik |
| Input/ubah data | Semua UPT, kapan saja | UPT sendiri, **sebelum deadline** periode | — |
| Kelola akun UPT & daftar UPT | ✔ | — | — |
| Kelola Jenis Data & kolom | ✔ | — | — |
| Rekap & ekspor semua UPT | ✔ | — | — |

Detail per tabel: [03-api-reference.md](03-api-reference.md#matriks-hak-akses-per-tabel).

## Mengelola akun

**Membuat akun UPT** – login sebagai Admin → menu **Kelola Akun UPT** → *Buat Akun Baru*: isi email, password (min. 8
karakter), nama lengkap, dan UPT. Akun langsung aktif.

**Menghapus akun** – tombol tempat sampah pada daftar akun (akun sendiri tidak dapat dihapus).

**Mengganti password** (belum ada menu di UI) – dari folder `be/`:

```bash
npm run user:password -- bppp.jakarta@kkp.go.id PasswordBaruYangKuat1!
```

Perintah ini langsung menulis hash bcrypt baru ke tabel `profiles`.

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
