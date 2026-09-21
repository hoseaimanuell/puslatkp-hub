# 02 — Instalasi & Menjalankan

## Prasyarat

| Kebutuhan | Versi |
| :-- | :-- |
| Node.js | 20.9 atau lebih baru (Laragon menyertakan Node 22) |
| MySQL | 8.0+ (Laragon) – MariaDB 10.5+ umumnya juga bisa |
| phpMyAdmin | bawaan Laragon |
| Docker (opsional) | Docker Desktop + Compose v2 |

---

## A. Lokal di Windows (Laragon + phpMyAdmin) — direkomendasikan

### 1. Siapkan database `Puslatkp1a`

1. Nyalakan **Laragon → Start All** (MySQL harus aktif).
2. Buka phpMyAdmin (`http://localhost/phpmyadmin`, login `root`, password kosong bila default).
3. Klik **New** → *Database name*: `Puslatkp1a`, *Collation*: `utf8mb4_unicode_ci` → **Create**.
4. Pilih database `Puslatkp1a` → tab **Import** → *Choose file* → `database/puslatkp1a.sql` → **Go**.
   Hasilnya: 10 tabel + 1 view, 10 UPT, 9 Jenis Data beserta 87 definisi kolom, 65 periode 2026, dan 11 akun.
5. *(Opsional, untuk demo)* Import juga `database/puslatkp1a_contoh_data.sql` (500 data peserta contoh + rekap
   mingguan September 2026 + 2 daily activity).

> Bila import gagal karena batas ukuran berkas, naikkan `upload_max_filesize` & `post_max_size` di `php.ini`
> Laragon, atau gunakan **cara tanpa phpMyAdmin** di bawah.

Alternatif tanpa phpMyAdmin (dari terminal, MySQL harus aktif):

```bash
cd be
npm install
npm run db:init          # skema + master + akun
npm run db:init:sample   # sama, ditambah data contoh
```

### 2. Konfigurasi backend

```bash
cd be
copy .env.example .env
```

Isi `be/.env`:

```env
PORT=4000
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=<string-acak-minimal-16-karakter>
JWT_EXPIRES_IN=12h
TRASH_RETENTION_DAYS=30
# STORAGE_DIR=            # opsional: folder berkas Arsip Historis (bawaan be/storage) — wajib di-backup
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=Puslatkp1a
```

Membuat `JWT_SECRET` acak:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Konfigurasi frontend (opsional)

Bila `NEXT_PUBLIC_API_URL` tidak diisi, frontend memakai **host halaman + port 4000** secara otomatis. Jadi membuka
web dari komputer lain (mis. `http://192.168.1.10:3000`) tetap memanggil API di `http://192.168.1.10:4000`. Untuk itu
tambahkan origin tersebut ke `CORS_ORIGIN` di `be/.env` (pisahkan dengan koma) dan pastikan firewall membuka port 3000 & 4000.
Bila API berada di alamat lain, buat `fe/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### 4. Jalankan

**Cara termudah:** klik dua kali `run.bat` di folder utama. Skrip ini menginstal dependensi (bila belum), lalu
membuka dua jendela: `be` (http://localhost:4000) dan `fe` (http://localhost:3000).

**Cara manual** (dua terminal):

```bash
# Terminal 1 – backend
cd be
npm install
npm run dev

# Terminal 2 – frontend
cd fe
npm install
npm run dev
```

Buka **http://localhost:3000**. Cek kesehatan backend: `http://localhost:4000/api/health` →
`{"status":"ok","database":"Puslatkp1a"}`.

---

## B. Docker Compose (servis `fe` dan `be`)

`docker-compose.yml` menjalankan **dua servis**: `be` (Express) dan `fe` (Next.js). MySQL **tidak** ikut
dikontainerkan – servis `be` terhubung ke MySQL/phpMyAdmin di komputer host.

```bash
copy .env.example .env         # lalu isi JWT_SECRET (dan DB_* bila perlu)
docker compose up -d --build
docker compose logs -f be
```

* FE: http://localhost:3000 · BE: http://localhost:4000
* Dari dalam kontainer, MySQL host dijangkau lewat `host.docker.internal` (sudah menjadi default `DB_HOST`).
* MySQL harus **menerima koneksi dari luar 127.0.0.1**. Pada Laragon: buka `my.ini` MySQL, ubah
  `bind-address = 127.0.0.1` menjadi `bind-address = 0.0.0.0`, restart MySQL, lalu buat pengguna khusus
  (disarankan, jangan pakai `root` tanpa password):

  ```sql
  CREATE USER 'puslatkp'@'%' IDENTIFIED BY 'PasswordKuat!';
  GRANT ALL PRIVILEGES ON Puslatkp1a.* TO 'puslatkp'@'%';
  FLUSH PRIVILEGES;
  ```

  lalu isi `DB_USER=puslatkp` dan `DB_PASSWORD=PasswordKuat!` di `.env`.
* `NEXT_PUBLIC_API_URL` ditanam **saat build** frontend. Jika alamat API berubah, jalankan
  `docker compose up -d --build fe`.

> Berkas Docker sudah disiapkan (build `standalone` Next.js sudah diuji), tetapi `docker compose` sendiri belum
> dijalankan pada lingkungan pengembangan ini karena Docker tidak terpasang di sana.

---

## C. Produksi (VPS / server sendiri)

Susunan yang disarankan: satu domain, Nginx sebagai *reverse proxy* + HTTPS.

```
https://hub.contoh.go.id        → fe  (127.0.0.1:3000)
https://hub.contoh.go.id/api    → be  (127.0.0.1:4000)
```

1. Siapkan MySQL & impor `database/puslatkp1a.sql` (jangan impor data contoh).
2. Buat pengguna MySQL khusus dengan hak hanya pada `Puslatkp1a`.
3. Atur env `be`: `JWT_SECRET` acak panjang, `CORS_ORIGIN=https://hub.contoh.go.id`, kredensial DB.
4. Build & jalankan (contoh dengan pm2, atau Docker Compose seperti di atas):

   ```bash
   cd be && npm ci --omit=dev && pm2 start src/server.js --name puslatkp-be
   cd fe && NEXT_PUBLIC_API_URL=https://hub.contoh.go.id/api npm ci && npm run build && pm2 start npm --name puslatkp-fe -- start
   ```
5. Nginx:

   ```nginx
   server {
       listen 443 ssl;
       server_name hub.contoh.go.id;
       client_max_body_size 25m;          # unggah berkas hingga 15 MB (base64 ± 20 MB)

       location /api/ { proxy_pass http://127.0.0.1:4000; proxy_set_header Host $host;
                        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
       location /     { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
   }
   ```
6. **Ganti semua password bawaan** (lihat [05-akun-dan-keamanan.md](05-akun-dan-keamanan.md)).

---

## Skrip yang tersedia

**`be/`**

| Perintah | Fungsi |
| :-- | :-- |
| `npm run dev` | Backend dengan auto-reload |
| `npm start` | Backend mode produksi |
| `npm run db:build` | Membangun ulang `database/*.sql` dari `scripts/ddl.sql` + data seed |
| `npm run db:init` / `db:init:sample` | Mengimpor SQL ke MySQL tanpa phpMyAdmin |
| `npm run periods -- 2021 2025` | Membuat periode satu tahun atau rentang tahun (65 periode/tahun; tidak menimpa yang ada; `--reset` mengembalikan ke aturan bawaan). Tahun berjalan & tahun depan dibuat otomatis oleh server |
| `npm run user:password -- email password` | Mengganti password akun |

**`fe/`**: `npm run dev`, `npm run build`, `npm start`.

---

## Pemecahan masalah

| Gejala | Penyebab & solusi |
| :-- | :-- |
| Backend langsung berhenti: *JWT_SECRET belum diisi* | Isi `JWT_SECRET` (≥ 16 karakter) di `be/.env` |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL Laragon belum nyala, atau port berbeda (cek `DB_PORT`) |
| `ER_BAD_DB_ERROR: Unknown database` | Database `Puslatkp1a` belum dibuat/diimpor |
| `ER_ACCESS_DENIED_ERROR` | `DB_USER`/`DB_PASSWORD` salah |
| Login "Tidak dapat terhubung ke server" | Backend tidak berjalan, atau `NEXT_PUBLIC_API_URL` salah |
| Console browser: *blocked by CORS* | Tambahkan origin frontend ke `CORS_ORIGIN` di be lalu restart |
| Pill di TopBar merah "Server Terputus" | Frontend tidak bisa menjangkau `/api/health` – cek be & MySQL |
| Login tidak bisa setelah beberapa kali salah | Pembatas: 30 percobaan/15 menit per IP; tunggu atau restart be |
| Kontainer `be` tak bisa konek MySQL host | Lihat bagian Docker: `bind-address`, pengguna `'%'`, `host.docker.internal` |
| Nama database beda huruf besar/kecil di Linux | Di Linux nama DB *case-sensitive*: gunakan persis `Puslatkp1a` |
