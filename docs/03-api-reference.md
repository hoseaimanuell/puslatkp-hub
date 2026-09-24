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
{ "status": "ok", "database": "Puslatkp1a", "trash": true, "features": { "multiBaris": true, "agregasi": true, "terlambat": true, "dashboard": true, "kumulatifBulanan": true, "dokumenResmi": true, "opsiBersyarat": true, "permintaanHapus": true, "periodeKirim": true, "arsip": true, "fieldFiles": true } }
```

`trash` dan `features` menunjukkan migrasi database yang sudah dijalankan (migrasi_02 / 03 / 04 / 05 / 06 / 07 / 08 / 09 / 10 / 11 / 12).
Bila belum, fiturnya nonaktif dan aplikasi tetap berjalan. `kumulatifBulanan` = kolom `jenis_data.kumulatif_bulanan`
(migrasi_07), `dokumenResmi` = tabel `dokumen_resmi` (migrasi_08), `opsiBersyarat` = kolom
`field_definitions.opsi_bersyarat` (migrasi_09), `permintaanHapus` = tabel `permintaan_hapus` (migrasi_10),
`periodeKirim` = tabel `periode_kirim` + kolom `permintaan_hapus.period_id` (migrasi_11) + kolom
`periode_kirim.status` (migrasi_12, alur draft→disetujui) — bila `false`, akun UPT tetap menghapus/mengedit data
secara langsung seperti sebelumnya (tidak diblokir diam-diam).

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

## `PATCH /api/auth/users/:id/password` *(Admin)*

Atur ulang password akun mana pun (dicocokkan lewat `profiles.id`, bukan email) — dipakai tombol **Reset Password**
di menu Kelola Akun UPT. Password lama tidak pernah dibaca kembali; endpoint ini hanya menimpanya dengan hash bcrypt
baru. Body:

```json
{ "password": "min8karakter" }
```

Validasi: password ≥ 8 karakter, akun harus ada (404 bila tidak). Respons: `{ "success": true }`.

## `POST /api/permintaan-hapus/:id/setujui` *(Admin)*

Menyetujui satu permintaan hapus (lihat tabel `permintaan_hapus` di [04-database.md](04-database.md)) — benar-benar
menjalankan penghapusannya (masuk Tempat Sampah seperti biasa, bisa dipulihkan 30 hari). Permintaan harus berstatus
`pending` (409 bila sudah diproses, 404 bila tidak ada). Respons: `{ "success": true, "dihapus": <jumlah baris> }`.

## `POST /api/permintaan-hapus/:id/tolak` *(Admin)*

Menolak satu permintaan hapus — data **tidak disentuh**. Body opsional:

```json
{ "catatan_admin": "alasan penolakan (opsional, terlihat oleh UPT)" }
```

Respons: `{ "success": true }`.

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

### Kolom bertipe Berkas (`/api/field-files`) — login diperlukan
Berkas yang dilampirkan pada SATU sel kolom bertipe `file` (field_definitions.tipe = `file`), mis. "Link Laporan
Pelatihan". Isi berkas disimpan di folder `STORAGE_DIR/field-files` (bukan di database). Butuh
`database/migrasi_06_kolom_berkas.sql` (bila belum, semua endpoint menjawab **409**).

| Endpoint | Fungsi |
| :-- | :-- |
| `POST /api/field-files?jenis_data_id=&field_key=&upt_key=&nama=` | Unggah. **Body = isi berkas mentah** (`application/octet-stream`, maks. **10 MB**). Hanya `pdf/doc/docx/xls/xlsx`, isi diperiksa (magic bytes). Kolom itu harus benar-benar bertipe `file`, kalau tidak → 400. UPT: `upt_key` dipaksa miliknya. Log: `berkas_kolom_unggah`. Respons: `{ id, file_name, file_ext, file_size }` — `id` inilah yang disimpan FE sebagai **nilai sel** (`rekap_nilai.value_text` atau `data_entries.data_json[field_key]`) |
| `GET /api/field-files/:id/file` | Unduh (butuh header `Authorization`); milik UPT lain → 404 |
| `DELETE /api/field-files/:id` | Hapus permanen (Admin: semua; UPT: miliknya). Log: `berkas_kolom_hapus`. FE memanggil ini saat sebuah berkas **diganti** (unggah baru dulu, baru buang yang lama) |

Metadata (nama/ukuran berkas, bukan isinya) juga bisa dibaca lewat `POST /api/db/query` (`table: "field_files"`, `scope: upt`)
untuk menampilkan nama berkas di tabel rekap tanpa mengunduhnya. Berkas yatim (mis. baris rekap ikut terhapus karena UPT
dihapus) disapu otomatis tiap 6 jam.

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
| `rekap_nilai`, `data_entries` | — | own | own (+ penanda terlambat); **ditolak (403)** bila periodenya sudah `disetujui` (butuh migrasi_12); **hapus own** → permintaan bila periode `disetujui`, bebas bila belum/`draft` (butuh migrasi_10; lihat di bawah) | semua |
| `daily_activity` | — | own | own | semua |
| `dokumen_upload` | — | own | own; sama seperti di atas — ditolak/digerbang mengikuti status `periode_kirim` | semua |
| `dashboard_widgets` | — | semua (baca) | — | baca/tulis (menu Kelola Dashboard; butuh migrasi_05) |
| `dokumen_resmi` | — | ✔ (lewat API; menu **disembunyikan** untuk UPT) | — | baca/tulis (menu Dokumen & Arsip; butuh migrasi_08) |
| `permintaan_hapus` | — | own (baca saja) | — (dibuat server saat UPT hapus data/buka kunci periode) | baca semua; setujui/tolak lewat `/api/permintaan-hapus/:id/...` (butuh migrasi_10) |
| `periode_kirim` | — | own (baca saja) | own (kirim = upsert, status dipaksa `draft`; **kirim ulang saat sudah `disetujui`** ditolak 403); **batalkan draft** → langsung; **buka kunci setelah `disetujui`** → permintaan (butuh migrasi_11+12; lihat di bawah) | own (`/api/periode-kirim/:id/setujui` = `draft`→`disetujui`) |
| `field_files` | — | own | — (lewat `/api/field-files`) | baca semua |
| `audit_log` | — | — | hanya aksi `import_kolom_tidak_dikenal` (kolom `oleh` dicap server) | baca + `import_kolom_tidak_dikenal`, `impor_historis` |
| `profiles` | — | self | — | baca, ubah, hapus (buat akun lewat `/auth/users`) |

> **Hapus akun UPT (migrasi_10).** Tombol Hapus/Kosongkan pada `rekap_nilai`, `data_entries`, `dokumen_upload` milik
> akun UPT tidak langsung menghapus — server membuat baris `permintaan_hapus`, dan data baru benar-benar terhapus
> setelah Admin menyetujuinya (menu **Permintaan**, bagian "Hapus & Buka Kunci"). Mengedit/mengosongkan isian biasa saat
> masih dalam sesi input (tanpa lewat tombol Hapus) tetap langsung tersimpan seperti biasa — lihat `spec.liveEdit`
> di `be/src/lib/query.js`. Tanpa migrasi_10, akun UPT kembali menghapus langsung seperti sebelumnya (tidak
> diblokir diam-diam — lihat `features.permintaanHapus` di atas).

> **Kirim Data — draft menunggu persetujuan (migrasi_11 + migrasi_12).** Akun UPT dapat menekan "Kirim" pada suatu
> periode (minggu/bulan) di Input Mingguan/Bulanan — ini membuat baris `periode_kirim` berstatus **`draft`** untuk
> **semua** jenis data periode itu sekaligus (bukan cuma satu jenis data). Selagi `draft`, data **masih bebas
> diedit/dihapus** oleh UPT — belum ada yang terkunci — dan UPT bisa membatalkannya sendiri kapan saja (delete
> langsung, tanpa persetujuan). Baru setelah Admin menekan **Setujui** (`POST /api/periode-kirim/:id/setujui`,
> admin-only) statusnya berubah jadi **`disetujui`**, dan barulah periode itu benar-benar terkunci: form input
> disembunyikan di UI, dan di server setiap insert/upsert/update pada `rekap_nilai`/`data_entries`/`dokumen_upload`
> untuk periode itu **ditolak (403)**, sementara hapus **digerbang jadi permintaan** (`permintaan_hapus`). Membuka
> kunci lagi memerlukan tombol "Ajukan Buka Kunci", yang membuat baris `permintaan_hapus` (`tabel: 'periode_kirim'`)
> dan baru benar-benar membuka kunci setelah Admin menyetujuinya. `forceOnWrite`/`periodLockCheck` di
> `be/src/schema.js` juga mencegah UPT "kirim ulang" (upsert) periode yang sudah `disetujui` untuk diam-diam
> menurunkan statusnya balik ke `draft`. Admin tidak pernah terkunci. Tanpa migrasi_11, tombol Kirim tidak muncul
> dan periode tidak pernah terkunci; tanpa migrasi_12 (kolom `status` belum ada), fitur ini nonaktif total dan
> semua baris `periode_kirim` lama diperlakukan seperti sebelum revisi ini (lihat `features.periodeKirim` di atas).

> **Pembatas menu vs pembatas server.** Sebagian besar tabel di atas dibatasi di **server** (`be/src/schema.js`/`query.js`) —
> itulah pembatas yang sesungguhnya. `dokumen_resmi` adalah pengecualian: server mengizinkan semua akun login
> **membaca**-nya, tapi menu **Dokumen & Arsip** disembunyikan dari sidebar untuk akun UPT dan rute `/dokumen-arsip`
> mengalihkan UPT ke Dashboard (`fe/src/components/AdminOnly.jsx`) — pembatas ini di **frontend**, bukan server.