# 01 — Arsitektur

## Gambaran umum

```
┌──────────────┐   HTTPS/HTTP     ┌───────────────────────┐    SQL     ┌──────────────────┐
│  Browser     │ ───────────────▶ │  fe  (Next.js :3000)  │            │                  │
│  (pengguna)  │                  │  halaman & UI saja    │            │  MySQL           │
│              │ ── JSON + JWT ─▶ │                       │            │  DB "Puslatkp1a" │
└──────────────┘                  └───────────────────────┘            │  (phpMyAdmin)    │
        │                                                              │                  │
        │         POST /api/auth/*  ,  POST /api/db/query              │                  │
        └────────────────────────▶ ┌───────────────────────┐ ────────▶ │                  │
                                   │  be  (Express :4000)  │ ◀──────── │                  │
                                   │  auth · aturan akses  │            └──────────────────┘
                                   └───────────────────────┘
```

* **fe** hanya menyajikan antarmuka. Data selalu diambil dari **be** lewat `fetch` dari browser
  (`NEXT_PUBLIC_API_URL`, default `http://localhost:4000/api`).
* **be** adalah satu-satunya pihak yang berbicara dengan MySQL. Semua validasi, otorisasi, dan penguncian
  deadline dilakukan di sini – bukan di browser.
* **Database** dibuat dan dikelola lewat phpMyAdmin memakai `database/puslatkp1a.sql`.

## Stack

| Komponen | Versi | Catatan |
| :-- | :-- | :-- |
| Next.js | 16.x (App Router, Turbopack) | Semua halaman client-side (bergantung sesi di browser) |
| React | 19.x | |
| Tailwind CSS | 4.x | via `@tailwindcss/postcss`, token tema di `fe/src/app/globals.css` |
| Express | 5.x | handler `async` otomatis meneruskan error |
| mysql2 | 3.x | connection pool, query berparameter |
| jsonwebtoken / bcryptjs | – | token sesi & hash password |
| helmet, cors, express-rate-limit | – | header keamanan, CORS, pembatas percobaan login |

## Alur permintaan

1. **Login**: `POST /api/auth/login` → be memeriksa hash bcrypt → mengembalikan JWT. Token disimpan di
   `localStorage` (`puslatkp_token`) dan dikirim di header `Authorization: Bearer …`.
2. **Memuat halaman**: komponen memanggil `db.from('tabel')…` (lihat `fe/src/lib/db.js`). Query builder ini
   mengirim **satu spesifikasi JSON** ke `POST /api/db/query`.
3. **be** menerima spesifikasi itu, lalu (`be/src/lib/query.js`):
   1. memastikan tabel & kolom ada di *whitelist* (`be/src/schema.js`);
   2. memeriksa hak akses peran (Admin / UPT / anonim);
   3. menambahkan pembatas otomatis (mis. UPT hanya melihat `upt_key` miliknya; data yang disimpan setelah deadline ditandai `terlambat`; berkas Arsip Historis disimpan di folder `be/storage`);
   4. menjalankan SQL **berparameter** dan mengembalikan `{ data, error, count }`.

### Mengapa satu endpoint `/api/db/query`?

Aplikasi asli memiliki ±90 pemanggilan data dengan pola *query builder*. Menulis ulang semuanya menjadi ratusan
endpoint REST akan mengubah banyak sekali kode UI dan berisiko mengubah tampilan/perilaku. Dengan endpoint
generik yang **dibatasi ketat**, seluruh halaman UI tetap utuh, sementara keamanan setara *Row Level Security*
tetap ditegakkan di server:

* nama tabel/kolom hanya dari whitelist (tidak ada nama dinamis yang masuk SQL tanpa validasi);
* nilai selalu dikirim sebagai parameter (`?`) – kebal SQL injection;
* `UPDATE`/`DELETE` **wajib** memakai filter;
* kolom sensitif (`password_hash`) tidak ada di whitelist sehingga tidak dapat dibaca;
* `id`, `created_at`, `updated_by`, dsb. selalu diisi server, tidak bisa dipalsukan klien;
* pengguna anonim hanya dapat membaca data publik yang sudah disaring.

Endpoint khusus tetap dipakai untuk hal yang tidak cocok dengan pola CRUD (login, profil saya, buat akun).

## Peran

| Peran | Kemampuan |
| :-- | :-- |
| **Admin** | Semua data semua UPT; kelola akun UPT, jenis data & kolom; tidak ditandai terlambat |
| **UPT** | Hanya data milik UPT-nya; tidak dapat mengubah data pada periode yang lewat deadline |
| **Publik** | Tanpa login; hanya agregat jenis data yang ditandai "boleh dilihat publik" (`/publik`) |

Rincian ada di [05-akun-dan-keamanan.md](05-akun-dan-keamanan.md) dan matriks per tabel di
[03-api-reference.md](03-api-reference.md).

## Struktur kode

```
fe/src/
├─ app/                    Route Next.js (App Router)
│  ├─ layout.jsx           <html>, font, Providers
│  ├─ page.jsx             "/" → /dashboard (mendukung tautan lama ?page=publik)
│  ├─ publik/page.jsx      Tampilan publik (tanpa login)
│  └─ (portal)/            Grup route yang memakai sidebar + topbar (PortalShell)
│     └─ dashboard | dokumen-arsip | input-mingguan | input-bulanan | rekap-triwulan-tahun
│        | documents | kelola-upt | kelola-jenis-data
├─ components/             Sidebar, TopBar, PortalShell, DataTable, DynamicForm, Modal, ...
├─ views/                  Halaman (isi tiap route) – tampilan asli tidak berubah
├─ lib/                    db.js (klien API), periods.js, excelExport.js, deadline.js, ...
└─ AuthContext.jsx         Sesi & profil pengguna (JWT)

be/
├─ src/server.js           Aplikasi Express, middleware, penanganan error
├─ src/config.js           Membaca .env
├─ src/db.js               Pool MySQL (UTC, DATE→string, DECIMAL→number)
├─ src/auth.js             JWT, middleware attachUser/requireAdmin
├─ src/schema.js           Whitelist tabel + aturan akses
├─ src/lib/query.js        Mesin query (select/insert/upsert/update/delete)
├─ src/lib/periods.js      Generator periode 1 tahun
├─ src/routes/             auth.js, db.js
└─ scripts/                build-sql, init-db, generate-periods, set-password, data seed

database/                  SQL siap-impor (dibangun oleh `npm run db:build`)
```

## Perubahan dari versi lama (Vite + Supabase)

| Aspek | Sebelumnya | Sekarang |
| :-- | :-- | :-- |
| Frontend | React + Vite (SPA, routing `?page=`) | Next.js 16, route nyata (`/dashboard`, `/input-mingguan`, ...) |
| Backend | Supabase (PostgREST, RLS, Edge Function) | Express 5 (`be`) |
| Database | PostgreSQL Supabase / Local Storage (mode demo) | MySQL `Puslatkp1a` |
| Autentikasi | Supabase Auth | Email + password (bcrypt) + JWT |
| Hak akses | Row Level Security | `be/src/schema.js` + `be/src/lib/query.js` |
| Buat akun UPT | Edge Function `create-upt-user` | `POST /api/auth/users` |
| Fungsi `generate_periods` | SQL function | `npm run periods -- <tahun>` |
| Folder halaman | `src/pages` | `src/views` (agar tidak bentrok dengan Pages Router Next.js) |
| Mode demo | Data di Local Storage | Dihapus – semua data tersimpan di MySQL |

Perbaikan kecil yang ikut dilakukan: kegagalan hapus UPT/akun kini ditampilkan (sebelumnya selalu tampil
"berhasil"), penghapusan Jenis Data membersihkan tabel `dokumen_upload` (sebelumnya menunjuk tabel
`uploaded_documents` yang tidak pernah ada), dan kolom `mode_bulanan` (yang dipakai UI tetapi tidak ada di skema
Supabase lama) kini benar-benar ada di database.
