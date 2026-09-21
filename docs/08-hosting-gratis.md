# 08 — Hosting gratis (tanpa komputer sendiri)

Rancangan: **satu layanan web** di Render (frontend + backend dalam satu kontainer, `Dockerfile` di akar proyek) + **database MySQL** gratis di Aiven.
Keduanya bisa dibuat tanpa kartu kredit (syarat dapat berubah; cek halaman resminya saat mendaftar). Cocok untuk demo/uji,
bukan untuk produksi jangka panjang.

## Batasan paket gratis (baca dulu)

| Hal | Akibat |
| :-- | :-- |
| Render gratis **tidur** setelah ±15 menit tanpa akses | Akses pertama setelah tidur lambat (sekitar 30–60 detik), lalu normal |
| Database Aiven gratis **dimatikan otomatis** bila lama tidak dipakai | Web error "database" sampai Anda menyalakannya lagi dari konsol Aiven (tombol *Power on*) |
| Disk Render gratis **tidak permanen** | Berkas **Arsip Data Historis** hilang saat layanan restart/deploy ulang. Data di database aman. Untuk arsip permanen perlu hosting kantor/disk berbayar |
| Aiven gratis 1 GB | Cukup untuk data isian; jangan mengandalkan unggahan berkas besar di database |

## Langkah

### 1. Simpan kode di GitHub (repositori **private**)
`database/puslatkp1a.sql` memuat hash password akun awal, jadi jangan dijadikan publik.
File `.env` sudah dikecualikan lewat `.gitignore`.

### 2. Buat database di Aiven
1. Daftar di aiven.io → *Create service* → **MySQL** → paket **Free**.
2. Setelah *Running*, catat **Host, Port, User (avnadmin), Password**.

### 3. Isi database (dari komputer Anda, sekali saja)
PowerShell di folder `be`:

```powershell
$env:DB_HOST="<host dari Aiven>"; $env:DB_PORT="<port>"; $env:DB_USER="avnadmin"
$env:DB_PASSWORD="<password>"; $env:DB_SSL="true"
npm run db:init
```

Lalu **ganti password semua akun bawaan** (sama, dengan variabel di atas masih aktif):

```powershell
npm run user:password -- admin@puslatkp.kkp.go.id PasswordBaruYangKuat1!
```

Ulangi untuk tiap akun UPT ([05-akun-dan-keamanan.md](05-akun-dan-keamanan.md)).

### 4. Buat layanan di Render
1. render.com → **New > Web Service** → hubungkan repositori GitHub → *Runtime*: **Docker**, *Instance type*: **Free**.
   (Atau **New > Blueprint** memakai `render.yaml`.)
2. *Environment variables*: `JWT_SECRET` (teks acak ≥ 16 karakter), `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=Puslatkp1a`, `DB_SSL=true`.
3. **Deploy**. Alamat: `https://<nama>.onrender.com`. Build pertama beberapa menit.
4. Uji: buka `https://<nama>.onrender.com/api/health` — harus `"status":"ok"`.

## Mematikan
Render: layanan → *Settings* → **Suspend** atau **Delete**. Aiven: **Power off** / **Delete service**.

## Pemecahan masalah
| Gejala | Penyebab |
| :-- | :-- |
| `/api/health` gagal / 500 | Database Aiven mati (nyalakan) atau variabel `DB_*` salah; `DB_SSL` harus `true` |
| Login "Tidak dapat terhubung" | Layanan Render sedang bangun dari tidur; tunggu lalu muat ulang |
| Build gagal di Render | Lihat log build; pastikan `Dockerfile`, `start.sh`, `fe/`, `be/`, `database/` ikut ter-push |
