# 03 — API Reference

Base URL: `http://localhost:4000/api` (ubah lewat `NEXT_PUBLIC_API_URL` di frontend).

* Format: JSON (`Content-Type: application/json`), batas ukuran body **25 MB**.
* Autentikasi: header `Authorization: Bearer <token>` (token didapat dari `/auth/login`).
* Kesalahan selalu berbentuk `{ "error": { "message": "..." } }` dengan kode HTTP yang sesuai.

| Kode | Arti |
| :-- | :-- |
| 200 / 201 | Berhasil |
| 400 | Permintaan tidak valid (kolom/operator tak dikenal, filter kosong pada update/delete, dll.) |
| 401 | Belum login / token tidak valid atau kedaluwarsa |
| 403 | Peran tidak berhak |
| 404 | Endpoint tidak ada |
| 409 | Konflik data (nilai unik dobel, data masih dipakai relasi lain) |
| 413 | Body terlalu besar |
| 500 | Kesalahan server (detail hanya di log be) |

---

## `GET /api/health`

Cek server & koneksi database. Tanpa autentikasi.

```json
{ "status": "ok", "database": "Puslatkp1a", "trash": true, "features": { "multiBaris": true, "agregasi": true, "terlambat": true, "arsip": true, "dashboard": true } }
```

`trash` dan `features` menunjukkan migrasi database yang sudah dijalankan (migrasi_02 / 03 / 04 / 05). Bila belum,
fiturnya nonaktif dan aplikasi tetap berjalan.

## `POST /api/auth/login`

Body: `{ "email": "...", "password": "..." }` · dibatasi **30 percobaan / 15 menit / IP**.

Respons 200:

```json
{
  "token": "<JWT>",
  "user": { "id": "…", "email": "admin@puslatkp.kkp.go.id" },
  "profile": { "id": "…", "email": "…", "role": "admin", "upt_key": null, "nama_lengkap": "Admin PUSLATKP", "created_at": "…" }
}
```

Gagal: 401 `Invalid login credentials` (sengaja tidak membedakan email salah/password salah).

## `GET /api/auth/me`

Perlu login. Mengembalikan `{ user, profile }` terbaru dari database (dipakai untuk memulihkan sesi).

## `POST /api/auth/users` *(Admin)*

Membuat akun UPT. Body:

```json
{ "email": "petugas@kkp.go.id", "password": "min8karakter", "nama_lengkap": "Petugas BPPP Tegal", "upt_key": "upt_tegal" }
```

Validasi: format email, password ≥ 8 karakter, nama wajib, `upt_key` harus ada & aktif, email belum terdaftar
(409). Respons 201: `{ "success": true, "user": { … } }`.

## `POST /api/db/query`

Endpoint data tunggal. Klien tidak menulis SQL – ia mengirim **spesifikasi** yang divalidasi server.
Di frontend dipakai lewat `db.from(...)` (`fe/src/lib/db.js`).

### Spesifikasi

| Field | Tipe | Keterangan |
| :-- | :-- | :-- |
| `table` | string | Salah satu tabel pada matriks di bawah |
| `op` | `select` \| `insert` \| `upsert` \| `update` \| `delete` | |
| `columns` | string | `select`: `"*"` atau daftar kolom `"id, label"` |
| `filters` | `[{col, op, val}]` | `op`: `eq` (mendukung `null` → `IS NULL`) atau `in` (array). Digabung dengan AND |
| `order` | `[{column, ascending}]` | Boleh beberapa kolom |
| `limit` | number | Maks. 10.000 |
| `single` | bool | Hasil satu baris; jika bukan tepat satu baris → `error.code = "PGRST116"` |
| `head` | bool | Hanya menghitung (`count`), `data: null` |
| `values` | object \| array | `insert` / `upsert` / `update` |
| `onConflict` | string | `upsert`: kolom kunci dipisah koma, mis. `"jenis_data_id,upt_key,period_id,field_key"` |

### Respons

```json
{ "data": [ … ], "count": 12 }              // select
{ "data": { … } }                           // insert (baris yang tersimpan, lengkap dengan id)
{ "data": null, "count": 1 }                // update / delete (jumlah baris terpengaruh)
{ "data": null }                            // upsert
{ "data": null, "error": { "message": "…", "code": "PGRST116" } }   // single tidak ketemu
```

### Contoh

```bash
# Pilih jenis data aktif, urut created_at
curl -X POST http://localhost:4000/api/db/query -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
  "table": "jenis_data", "op": "select", "columns": "*",
  "filters": [{ "col": "aktif", "op": "eq", "val": true }],
  "order": [{ "column": "created_at", "ascending": true }]
}'

# Simpan nilai rekap (upsert idempoten)
curl -X POST http://localhost:4000/api/db/query -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
  "table": "rekap_nilai", "op": "upsert",
  "onConflict": "jenis_data_id,upt_key,period_id,field_key",
  "values": { "jenis_data_id": "…", "upt_key": "upt_jakarta", "period_id": "…", "field_key": "jumlah_peserta", "value": 12, "value_text": "12" }
}'
```

### Aturan yang ditegakkan server

* **Whitelist**: tabel/kolom/operator di luar daftar → 400. `password_hash` tidak pernah dapat dibaca.
* **Nilai** selalu dikirim ke MySQL sebagai parameter; kolom JSON/boolean dikonversi otomatis.
* **Kolom otomatis** – `id` (UUID), `created_at`, `updated_at`, `created_by`, `updated_by`, `dibuat_oleh`,
  `actor_id`, `actor_upt_key` diisi server; nilai kiriman klien untuk kolom ini diabaikan.
* **Cakupan UPT** – untuk tabel bercakupan UPT, akun UPT: `SELECT/UPDATE/DELETE` otomatis dibatasi ke `upt_key`
  miliknya, dan `INSERT/UPSERT` memaksa `upt_key` miliknya (nilai kiriman diabaikan).
* **Deadline bukan kunci, hanya penanda** – pada `rekap_nilai`, `data_entries`, dan `dokumen_upload`, akun UPT tetap boleh
  menulis setelah `periods.deadline` (zona Asia/Jakarta); server mengisi kolom `terlambat = 1` (tidak dapat dipalsukan klien,
  dan bersifat *menempel*: menyimpan ulang tidak menghapus penanda). Tulisan Admin tidak ditandai.
* `UPDATE`/`DELETE` tanpa filter → 400.
* **Ukuran body**: akun login maks. **25 MB** (unggah berkas); pengunjung **tanpa login** maks. **100 KB** → 413.
* **`audit_log` tidak bisa dipalsukan**: browser hanya boleh mencatat aksi `import_kolom_tidak_dikenal`; aksi hapus/pulihkan
  ditulis server. Nilai `oleh` selalu diisi server dari akun yang login.
* **Simpan massal**: `values` boleh berupa **array** (mis. seluruh isian form mingguan, atau 100 baris impor Excel) dan diproses
  dalam **satu transaksi** — jauh lebih cepat daripada satu permintaan per baris.
* Akun tidak dapat menghapus dirinya sendiri (`profiles`).

### Penghapusan (`op: "delete"`)

* Pada tabel **`rekap_nilai`, `data_entries`, `dokumen_upload`, `daily_activity`** penghapusan adalah **soft delete**: baris
  disembunyikan (`deleted_at`), semua query otomatis mengabaikannya, dan satu aksi hapus mendapat satu `batch`.
  Respons: `{ "data": null, "count": <jumlah baris disembunyikan> }`.
* Setiap penghapusan ditulis ke `audit_log` oleh **server** (bukan klien): aksi `hapus`, `hapus_massal`, `hapus_upt`.
* Menyimpan ulang (`upsert`) baris yang ada di tempat sampah **memulihkannya**; `insert` dengan kunci unik yang sama
  membuang salinan lama di tempat sampah.
* Sebelum `migrasi_02_tempat_sampah.sql` dijalankan, penghapusan bersifat permanen (tetap dicatat di log).

### Periode (`/api/periods`) — khusus Admin

| Endpoint | Fungsi |
| :-- | :-- |
| `POST /api/periods/generate` `{ "dari": 2021, "sampai": 2025 }` | Membuat periode (65 per tahun) untuk rentang tahun 2000–2100, maks. 12 tahun. Periode yang sudah ada **tidak ditimpa**. Respons: `{ dibuat: { "2021": 65, … }, jumlah }`. Log: `buat_periode` |

Deadline diubah lewat `POST /api/db/query` (`table: "periods"`, `op: "update"`, hanya Admin; log: `ubah_periode`). Server juga membuat
periode tahun berjalan & tahun depan secara otomatis (log `buat_periode`, pelaku "sistem").

### Arsip Historis (`/api/arsip`) — login diperlukan
Berkas Excel/PDF data tahun lalu; isi berkas disimpan di folder `STORAGE_DIR/arsip` (bukan di database). Butuh
`database/migrasi_04_terlambat_dan_arsip.sql` (bila belum, semua endpoint menjawab **409**).

| Endpoint | Fungsi |
| :-- | :-- |
| `GET /api/arsip?tahun=&upt_key=&jenis_data_id=` | Daftar arsip. Admin: semua (`upt_key=_pusat` = arsip pusat); UPT: hanya miliknya |
| `POST /api/arsip?tahun=&nama=&judul=&catatan=&jenis_data_id=&upt_key=` | Unggah. **Body = isi berkas mentah** (`application/octet-stream`, maks. 30 MB). Hanya `pdf/xlsx/xls/csv`, isi diperiksa (magic bytes). UPT: `upt_key` dipaksa miliknya; Admin: kosong/`_pusat` = arsip pusat. Log: `arsip_unggah` |
| `GET /api/arsip/:id/file` | Isi berkas (butuh header `Authorization`); milik UPT lain → 404 |
| `DELETE /api/arsip/:id` | Hapus permanen (Admin: semua; UPT: miliknya). Log: `arsip_hapus` |

Berkas yatim (mis. arsip ikut terhapus karena UPT dihapus) disapu otomatis tiap 6 jam.

### Tempat Sampah (`/api/trash`) — khusus Admin

| Endpoint | Fungsi |
| :-- | :-- |
| `GET /api/trash` | `{ enabled, retentionDays, items: [{ batch, tabel, tabel_label, jumlah, upt, jenis_data, periode, dihapus_oleh, dihapus_pada, sisa_hari }] }` |
| `POST /api/trash/restore` `{ "batch": "…" }` | Memulihkan seluruh baris pada batch itu (log: `pulihkan`). 404 bila sudah tidak ada |
| `POST /api/trash/purge` `{ "batch": "…" }` | Membuang permanen batch itu (log: `hapus_permanen`) |

Server juga membuang otomatis data yang lebih dari `TRASH_RETENTION_DAYS` hari di tempat sampah (saat start dan tiap 6 jam;
log: `hapus_permanen_otomatis`). `GET /api/health` menyertakan `"trash": true|false`.

### Matriks hak akses per tabel

`—` = ditolak · **own** = hanya baris `upt_key` miliknya · **self** = hanya barisnya sendiri

| Tabel / view | Anonim | UPT baca | UPT tulis | Admin |
| :-- | :-- | :-- | :-- | :-- |
| `jenis_data` | hanya `publik_boleh_lihat=1` & `aktif=1`, kolom `id,key,judul,deskripsi` | semua | — | baca/tulis |
| `v_publik_rekap` (view) | ✔ baca | ✔ | — | ✔ |
| `periods`, `field_definitions` | — | semua | — | baca/tulis |
| `upt_list` | — | **own** (hanya UPT-nya) | — | baca/tulis (semua UPT) |
| `rekap_nilai`, `data_entries` | — | own | own (+ penanda terlambat) | semua |
| `daily_activity`, `dokumen_upload` | — | own | own | semua |
| `audit_log` | — | — | hanya aksi `import_kolom_tidak_dikenal` (kolom `oleh` dicap server) | baca + `import_kolom_tidak_dikenal`, `impor_historis` |
| `profiles` | — | self | — | baca, ubah, hapus (buat akun lewat `/auth/users`) |
