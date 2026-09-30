# Serah Terima untuk Pengelola Hosting

Ringkasan untuk orang yang akan memasang PUSLATKP Management Hub di server. Rincian lengkap ada di
[02-instalasi-dan-menjalankan.md](02-instalasi-dan-menjalankan.md) bagian **C. Produksi**.

## Yang diterima

Kode sumber lengkap (repositori Git atau berkas zip hasil `git archive`), berisi:

| Folder | Isi |
| :-- | :-- |
| `be/` | Backend Node.js (Express) — API, login, hak akses |
| `fe/` | Frontend Next.js — tampilan web |
| `database/` | `puslatkp1a.sql` (skema + data awal, sudah memuat semua migrasi), `migrasi_*.sql`, `buat_user_aplikasi.sql` |
| `docs/` | Dokumentasi lengkap |
| `Dockerfile`, `docker-compose.yml`, `ecosystem.config.cjs`, `render.yaml` | Pilihan cara menjalankan |

**Tidak ikut dan memang tidak boleh dikirim:** `be/.env` (password database & kunci login lokal), `backup/` (salinan
database), `be/storage/` (berkas unggahan), `node_modules/`, `.next/`. Semua dibuat ulang di server.

## Kebutuhan server

* Node.js **22** (minimal 20.9), MySQL **8** (yang dipakai saat pengembangan & pengujian; MariaDB belum diuji), ±1 GB RAM, ruang disk untuk berkas unggahan.
* Domain + HTTPS (mis. Nginx + Let's Encrypt). Aplikasi berisi data pribadi (NIK), jangan dibuka tanpa HTTPS.
* Disk yang **permanen** untuk folder berkas (`STORAGE_DIR`). Hosting gratis seperti Render menghapus berkas saat restart.

## Langkah singkat (VPS/server kantor, disarankan)

1. Buat database: impor `database/puslatkp1a.sql`, lalu buat user MySQL khusus dengan
   `database/buat_user_aplikasi.sql` (ganti password di dalamnya). Jangan pakai `root`.
2. Salin `be/.env.example` → `be/.env`, isi:
   * `JWT_SECRET` — acak panjang: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   * `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=Puslatkp1a`
   * `CORS_ORIGIN=https://domain-anda` dan `STORAGE_DIR=/lokasi/permanen/berkas`
   * `TRUST_PROXY` — biarkan bawaan (`loopback`) bila Nginx di server yang sama; isi jumlah proxy bila ada load
     balancer di depan (mis. `2`).
3. `cd be && npm ci --omit=dev && npm run migrate` (memastikan skema terbaru; aman diulang).
4. `cd fe && npm ci && NEXT_PUBLIC_API_URL=https://domain-anda/api npm run build`
5. Jalankan dengan PM2: `pm2 start ecosystem.config.cjs && pm2 save && pm2 startup`
6. Nginx + HTTPS: contoh konfigurasi di docs 02 bagian C (`/api/` → port 4000, sisanya → port 3000).
7. Periksa `https://domain-anda/api/health` → `"status":"ok"` dan semua `features` bernilai `true`.

Alternatif: Docker (`docker compose up -d --build`, isi `.env` di folder utama) — lihat docs 02 bagian B.

## Wajib setelah terpasang

- [ ] **Ganti semua password akun bawaan** (daftarnya di [05-akun-dan-keamanan.md](05-akun-dan-keamanan.md)); password
      bawaan tercantum di dokumentasi, jadi dianggap sudah diketahui umum.
- [ ] Jadwalkan **backup harian** `npm run backup` dan salin hasilnya ke luar server
      ([07-pemeliharaan.md](07-pemeliharaan.md#backup-otomatis)).
- [ ] Pasang pemantau uptime ke `/api/health`.
- [ ] Jalankan uji fungsional: `UJI_ADMIN_EMAIL=... UJI_ADMIN_PASSWORD=... npm run uji:blackbox` di folder `be`
      (79 kasus; membuat & menghapus sendiri UPT uji — lihat [09-pengujian-blackbox.md](09-pengujian-blackbox.md)).
- [ ] Pastikan penggunaan **logo resmi KKP** (`fe/public/logo-kkp.jpg`) sudah disetujui instansi sebelum situs
      dibuka untuk umum.

## Data

* **Mulai bersih** (disarankan untuk peluncuran): cukup `puslatkp1a.sql`. Berisi data master (UPT, jenis data,
  kolom, periode 2026, dokumen bawaan) dan akun awal, tanpa data contoh.
* **Membawa data yang sudah ada**: buat backup di komputer lama (`npm run backup` di folder `be`), kirim
  `database.sql.gz` + folder `storage/` lewat saluran yang aman (berisi data pribadi), lalu di server:
  `gunzip -c database.sql.gz | mysql -u root -p`, salin `storage/` ke `STORAGE_DIR`, dan jalankan `npm run migrate`.
* Jangan impor `puslatkp1a_contoh_data.sql` di server produksi (data contoh untuk latihan).

## Memperbarui aplikasi nanti

`npm run backup` → ambil kode baru (`git pull`) → `cd be && npm ci --omit=dev && npm run migrate` →
`cd fe && npm ci && npm run build` → `pm2 restart ecosystem.config.cjs`.
