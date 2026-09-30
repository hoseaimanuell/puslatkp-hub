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
{ "status": "ok", "database": "Puslatkp1a", "trash": true, "features": { "multiBaris": true, "agregasi": true, "terlambat": true, "dashboard": true, "kumulatifBulanan": true, "dokumenResmi": true, "opsiBersyarat": true, "permintaanHapus": true, "persetujuanBaris": true, "tolakBaris": true, "permintaanEdit": true, "peranRekap": true, "arsip": true, "fieldFiles": true } }
```

`trash` dan `features` menunjukkan migrasi database yang sudah dijalankan (migrasi_02 / 03 / 04 / 05 / 06 / 07 / 08 / 09 / 10 / 13 / 14 / 15).
Bila belum, fiturnya nonaktif dan aplikasi tetap berjalan. `kumulatifBulanan` = kolom `jenis_data.kumulatif_bulanan`
(migrasi_07), `dokumenResmi` = tabel `dokumen_resmi` (migrasi_08), `opsiBersyarat` = kolom
`field_definitions.opsi_bersyarat` (migrasi_09), `permintaanHapus` = tabel `permintaan_hapus` (migrasi_10),
`persetujuanBaris` = kolom `rekap_nilai.status` dkk. (migrasi_13, alur draft→disetujui per baris — satu-satunya
lapisan persetujuan; migrasi_11/12 pernah menambahkan lapisan kedua per-periode lewat tabel `periode_kirim`, tapi
itu sudah dihapus total karena dua lapisan sekaligus membingungkan UPT — lihat
[04-database.md](04-database.md#permintaan_hapus--menu-permintaan-bagian-hapus-persetujuan-admin)), `tolakBaris` =
kolom `rekap_nilai.catatan_admin` dkk. (migrasi_14, tombol Tolak pada Persetujuan Baris Data — independen dari
`persetujuanBaris`: bisa punya migrasi_13 tanpa migrasi_14, Setujui tetap jalan), `permintaanEdit` = kolom
`permintaan_hapus.aksi`/`data_baru_json` (migrasi_15, tombol Edit pada baris yang sudah disetujui mengajukan nilai
baru ke Admin alih-alih harus dihapus dulu — lihat
[04-database.md](04-database.md#permintaan-edit-migrasi-15--melengkapi-permintaan_hapus-di-atas)) — bila `false`,
akun UPT tetap menghapus/mengedit data secara langsung seperti sebelumnya (tidak diblokir diam-diam).
`peranRekap` = kolom `field_definitions.peran_rekap` (migrasi_16, pilihan "Dihitung di rekap sebagai" di Kelola
Jenis Data) — bila `false`, pilihan itu disembunyikan dan rekap memakai aturan nama kolom lama.

## `POST /api/auth/login`

Body: `{ "email": "...", "password": "..." }` · dibatasi **30 percobaan / 15 menit / IP**.

Respons 200:

```json
{
  "token": "<JWT>",
  "user": { "id": "…", "email": "admin@puslatkp.kkp.go.id" },
  "profile": { "id": "…", "email": "…", "role": "admin", "upt_key": null, "upt_label": null, "nama_lengkap": "Admin PUSLATKP", "created_at": "…" }
}
```

Gagal: 401 `Invalid login credentials` (sengaja tidak membedakan email salah/password salah). Lebih dari 30 percobaan
**gagal** dalam 15 menit dari satu IP: 429 (login berhasil tidak dihitung). `profile.upt_label` = nama UPT untuk ditampilkan.

## `GET /api/auth/me`

Perlu login. Mengembalikan `{ user, profile }` terbaru dari database (dipakai untuk memulihkan sesi), termasuk `upt_label`.

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

Menyetujui satu permintaan hapus **atau edit** (lihat tabel `permintaan_hapus` di [04-database.md](04-database.md)),
dibedakan lewat kolom `aksi`. Untuk `aksi: 'hapus'`: benar-benar menjalankan penghapusannya (masuk Tempat Sampah
seperti biasa, bisa dipulihkan 30 hari). Untuk `aksi: 'edit'` (migrasi_15): menulis nilai baru yang diajukan UPT
(`data_baru_json`) — baris langsung kembali berstatus `disetujui`. Permintaan harus berstatus `pending` (409 bila
sudah diproses, 404 bila tidak ada). Respons: `{ "success": true, "dihapus": <jumlah baris/field yang ditulis> }`.

## `POST /api/permintaan-hapus/:id/tolak` *(Admin)*

Menolak satu permintaan hapus atau edit — data **tidak disentuh** (untuk `aksi: 'edit'`, nilai lama tetap berlaku).
Body opsional:

```json
{ "catatan_admin": "alasan penolakan (opsional, terlihat oleh UPT)" }
```

Respons: `{ "success": true }`.

## `POST /api/permintaan-edit/rekap-nilai` *(UPT)*

Mengajukan nilai baru untuk satu baris mingguan/bulanan (satu `baris_ke`) yang sudah berstatus `disetujui` — lihat
[04-database.md](04-database.md#permintaan-edit-migrasi-15--melengkapi-permintaan_hapus-di-atas). Butuh migrasi_15
(409 bila belum aktif); Admin ditolak (403, admin selalu menulis langsung); baris yang dituju harus benar-benar
`disetujui` (400 bila belum — pakai `/api/db/query` upsert biasa). `upt_key` diambil dari akun yang login, tidak
bisa dipilih lewat body.

```json
{
  "jenis_data_id": "...", "period_id": "...", "baris_ke": 1,
  "upserts": [{ "field_key": "nama_pelatihan", "value": null, "value_text": "..." }],
  "clearedFields": ["jumlah_peserta"],
  "alasan": "opsional"
}
```

Respons: `{ "success": true, "requestId": "..." }`.

## `POST /api/permintaan-edit/data-entries` *(UPT)*

Sama seperti di atas, untuk satu baris rincian (`data_entries`) yang sudah `disetujui`.

```json
{ "id": "...", "values": { "nama": "...", "nik": "...", "...field lain...": "..." }, "alasan": "opsional" }
```

Respons: `{ "success": true, "requestId": "..." }`.

## `POST /api/impor-rincian` *(login)*

Impor Excel "Data by Name" (`data_entries`) untuk satu jenis data + UPT + periode, dalam satu permintaan
(`be/src/routes/impor-rincian.js`). Setiap baris dicocokkan dengan data tersimpan (`be/src/lib/imporRincian.js`):
lewat NIK, atau nama bila NIK kosong. Baris **sama** dilewati, baris **berubah** yang belum disetujui diperbarui
(kembali `draft`), baris **baru** disimpan. Baris yang **sudah disetujui** tetapi isinya berubah tidak ditimpa: akun
UPT mengajukannya sebagai permintaan edit bila `ajukanPerubahan: true` (selain itu dilewati); Admin menimpanya
langsung. Semua tulisan lewat `runQuery()` (aturan akses, status, terlambat, tempat sampah sama dengan jalur lain).

```json
{ "jenis_data_id": "...", "period_id": "...", "upt_key": "hanya dipakai bila Admin",
  "rows": [{ "nama": "...", "nik": "... atau null", "data_json": { }, "data_ekstra": null }],
  "pratinjau": false, "ajukanPerubahan": false }
```

Respons: `{ baru, diperbarui, sama, disetujuiBerubah, bisaAjukan, diajukan, dilewatiDisetujui }`. Dengan
`pratinjau: true` hanya menghitung (tanpa menyimpan); dipakai browser untuk menanyakan apakah perubahan pada baris
yang sudah disetujui perlu diajukan ke Admin. Maks. 5000 baris per permintaan.

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
| `rekap_nilai`, `data_entries` | — | own | own (+ penanda terlambat), status dipaksa `draft`; **ditolak (403)** bila baris itu sendiri sudah `disetujui` (migrasi_13) — mengedit baris `disetujui` lewat `/api/permintaan-edit/...` (migrasi_15) mengajukan permintaan alih-alih 403; **hapus own** → permintaan bila `disetujui`, bebas bila belum/`draft`/`ditolak` (butuh migrasi_10; lihat di bawah) | semua (tulis langsung = otomatis `disetujui`) |
| `daily_activity` | — | own | own | semua |
| `dokumen_upload` | — | own | own, status dipaksa `draft`; sama seperti di atas — ditolak/digerbang mengikuti status baris itu sendiri | semua |
| `dashboard_widgets` | — | semua (baca) | — | baca/tulis (menu Kelola Dashboard; butuh migrasi_05) |
| `dokumen_resmi` | — | ✔ (lewat API; menu **disembunyikan** untuk UPT) | — | baca/tulis (menu Dokumen & Arsip; butuh migrasi_08) |
| `permintaan_hapus` | — | own (baca saja) | — (dibuat server saat UPT hapus data) | baca semua; setujui/tolak lewat `/api/permintaan-hapus/:id/...` (butuh migrasi_10) |
| `field_files` | — | own | — (lewat `/api/field-files`) | baca semua |
| `audit_log` | — | — | hanya aksi `import_kolom_tidak_dikenal` (kolom `oleh` dicap server) | baca + `import_kolom_tidak_dikenal`, `impor_historis` |
| `profiles` | — | self | — | baca, ubah, hapus (buat akun lewat `/auth/users`) |

> **Hapus akun UPT (migrasi_10).** Tombol Hapus/Kosongkan pada `rekap_nilai`, `data_entries`, `dokumen_upload` milik
> akun UPT tidak langsung menghapus — server membuat baris `permintaan_hapus`, dan data baru benar-benar terhapus
> setelah Admin menyetujuinya (menu **Permintaan**, bagian "Hapus"). Mengedit/mengosongkan isian biasa saat
> masih dalam sesi input (tanpa lewat tombol Hapus) tetap langsung tersimpan seperti biasa — lihat `spec.liveEdit`
> di `be/src/lib/query.js`. Tanpa migrasi_10, akun UPT kembali menghapus langsung seperti sebelumnya (tidak
> diblokir diam-diam — lihat `features.permintaanHapus` di atas).

> **Riwayat: Kirim Data / Kunci Periode (migrasi_11+12, dihapus).** Aplikasi sempat punya lapisan persetujuan KEDUA
> di level periode: UPT menekan "Kirim" untuk mengunci SEMUA jenis data satu periode sekaligus lewat tabel
> `periode_kirim`, berjalan berdampingan dengan Persetujuan Baris Data di bawah. Dua sistem persetujuan sekaligus
> ini membingungkan UPT, sehingga **dihapus total** — sekarang hanya Persetujuan Baris Data (migrasi_13/14) yang
> berlaku. Endpoint `/api/periode-kirim/*` sudah tidak ada.

> **Persetujuan Baris Data (migrasi_13) — satu-satunya lapisan persetujuan.** **Setiap kali UPT menyimpan data**
> (`rekap_nilai`, `data_entries`, `dokumen_upload`), baris itu langsung dipaksa berstatus `draft` ("menunggu
> persetujuan") lewat `forceOnWrite`. Satuan "satu baris": untuk `rekap_nilai` (disimpan per-field/EAV) adalah satu grup `baris_ke` — semua
> `field_key` grup itu selalu disimpan & disetujui bersamaan (`rowApprovalGate.groupBy` di `be/src/schema.js`);
> untuk `data_entries`/`dokumen_upload`, satu baris DB = satu satuan approval. Selagi `draft`, baris itu **bebas
> diedit/dihapus** oleh UPT (tidak digerbang), tapi **tidak dihitung** di rekap/dashboard/grafik/halaman publik
> resmi — hanya baris `disetujui` yang dihitung (lihat query-query yang menambahkan `.eq('status', 'disetujui')`
> di frontend, dan `v_publik_rekap` yang menambahkan `AND status = 'disetujui'`). Admin menyetujui satu per satu
> atau sekaligus lewat `POST /api/persetujuan-baris/{rekap-nilai|data-entries|dokumen-upload}/setujui`
> (+ `/rekap-nilai/setujui-massal` dengan `{ items: [...] }` dan `/data-entries/setujui-massal` dengan
> `{ ids: [...] }`, maks. 5000, untuk banyak baris sekaligus dalam satu permintaan) — lihat menu **Permintaan**,
> bagian "Persetujuan Baris Data". Status dipaksa server pada **insert, upsert, maupun update**
> (`kolomPaksaan()` di `be/src/lib/query.js`): UPT tidak bisa mengirim `status: 'disetujui'` sendiri, dan baris
> `ditolak` yang diperbaiki UPT otomatis kembali `draft` dengan catatan penolakan dikosongkan. Begitu
> `disetujui`, baris itu **tidak bisa diedit langsung lagi** (403, `ensureRowsNotApproved`/
> `ensureUpdateTargetNotApproved` di `be/src/lib/query.js`) — UPT mengajukan edit (`/api/permintaan-edit/...`)
> atau hapus (digerbang jadi `permintaan_hapus`, sama seperti alur di atas). **Tulisan langsung dari akun Admin selalu otomatis `disetujui`** (tidak ikut antre
> persetujuan sendiri — lihat cabang `user.role === 'admin'` di `prepareRow()`). Tanpa migrasi_13, seluruh
> mekanisme ini nonaktif total dan data langsung tersimpan resmi seperti sebelum revisi ini (lihat
> `features.persetujuanBaris` di atas).

> **Tolak baris (migrasi_14).** Selain Setujui, Admin juga bisa **Tolak** satu baris draft lewat
> `POST /api/persetujuan-baris/{rekap-nilai|data-entries|dokumen-upload}/tolak` (body sama seperti `setujui`,
> ditambah `catatan_admin` opsional). Ini **TIDAK menghapus atau mengubah isi baris** — hanya mengubah statusnya
> jadi `ditolak` dan mengisi `catatan_admin` (kolom baru, migrasi_14), terlihat UPT sebagai peringatan pada
> baris/entri/berkasnya. Baris `ditolak` tetap dihitung sama seperti `draft` (bebas diedit/dihapus UPT, tidak
> masuk total resmi). Begitu UPT menyimpan ulang, `forceOnWrite` mengembalikan status ke `draft` **dan**
> mengosongkan `catatan_admin` beserta `disetujui_at`/`disetujui_by`/`disetujui_by_label` (mencegah metadata
> persetujuan/penolakan lama nyangkut di baris yang sudah diperbarui) — baris itu lalu menunggu ditinjau lagi
> dari awal.

> **Pembatas menu vs pembatas server.** Sebagian besar tabel di atas dibatasi di **server** (`be/src/schema.js`/`query.js`) —
> itulah pembatas yang sesungguhnya. `dokumen_resmi` adalah pengecualian: server mengizinkan semua akun login
> **membaca**-nya, tapi menu **Dokumen & Arsip** disembunyikan dari sidebar untuk akun UPT dan rute `/dokumen-arsip`
> mengalihkan UPT ke Dashboard (`fe/src/components/AdminOnly.jsx`) — pembatas ini di **frontend**, bukan server.