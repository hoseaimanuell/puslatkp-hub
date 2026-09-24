# 04 — Database `Puslatkp1a`

* Mesin: MySQL 8 (InnoDB), karakter `utf8mb4`, collation `utf8mb4_unicode_ci`.
* Sumber kebenaran skema: `be/scripts/ddl.sql`. Berkas siap-impor `database/puslatkp1a.sql` dihasilkan dengan
  `cd be && npm run db:build` (skema + data master + akun awal).
* Semua ID berupa `CHAR(36)` (UUID). Zona waktu koneksi diset UTC; kolom `DATE` dikirim ke klien sebagai
  `YYYY-MM-DD`, `DATETIME` sebagai ISO 8601.

## ERD

```mermaid
erDiagram
  upt_list ||--o{ profiles : "upt_key"
  upt_list ||--o{ rekap_nilai : "upt_key"
  upt_list ||--o{ data_entries : "upt_key"
  upt_list ||--o{ daily_activity : "upt_key"
  upt_list ||--o{ dokumen_upload : "upt_key"
  jenis_data ||--o{ field_definitions : "jenis_data_id"
  jenis_data ||--o{ rekap_nilai : "jenis_data_id"
  jenis_data ||--o{ data_entries : "jenis_data_id"
  jenis_data ||--o{ dokumen_upload : "jenis_data_id"
  jenis_data |o--o| jenis_data : "pasangan_mingguan_id"
  periods ||--o{ rekap_nilai : "period_id"
  periods ||--o{ data_entries : "period_id"
  periods ||--o{ dokumen_upload : "period_id"
  profiles ||--o{ audit_log : "actor_id"
  profiles ||--o{ dokumen_resmi : "created_by"
```

## Tabel

### `upt_list` — Unit Pelaksana Teknis
> **Hapus UPT = hapus datanya.** Semua tabel yang memuat `upt_key` (`profiles`, `rekap_nilai`, `data_entries`,
> `dokumen_upload`, `daily_activity`) memakai `ON DELETE CASCADE`: menghapus satu baris UPT otomatis menghapus akun,
> rekap, data rincian, berkas, dan aktivitasnya. Dashboard/grafik/rekap tidak lagi memuat UPT tersebut.
> Database yang diimpor dari versi lama perlu menjalankan `database/migrasi_01_hapus_upt_cascade.sql` sekali.

| Kolom | Tipe | Keterangan |
| :-- | :-- | :-- |
| `key` (PK) | VARCHAR(64) | Mis. `upt_jakarta` |
| `label` | VARCHAR(150) | Nama tampilan, mis. `BPPP Jakarta` |
| `aktif` | TINYINT(1) | Hanya UPT aktif yang muncul di pilihan |

### `profiles` — Akun pengguna
| Kolom | Tipe | Keterangan |
| :-- | :-- | :-- |
| `id` (PK) | CHAR(36) | |
| `email` | VARCHAR(190), **unik** | Huruf kecil |
| `password_hash` | VARCHAR(100) | bcrypt (cost 10). Tidak pernah dikirim ke klien |
| `role` | ENUM(`admin`,`upt`) | |
| `upt_key` | VARCHAR(64) → `upt_list.key` | `NULL` untuk admin. `ON DELETE CASCADE` (akun ikut terhapus bersama UPT-nya) |
| `nama_lengkap`, `created_at` | | |

### `jenis_data` — Jenis Data (mingguan / bulanan)
| Kolom | Tipe | Keterangan |
| :-- | :-- | :-- |
| `id` (PK), `key` (unik), `judul`, `deskripsi` | | |
| `level_utama` | ENUM(`minggu`,`bulan`) | Level tempat data diinput |
| `mode_bulanan` | ENUM(`rincian`,`agregasi`,`upload_file`) NULL | Level bulan: `rincian` = per nama, `agregasi` = rekap angka saja (dijumlah dari mingguan). `upload_file` hanya warisan lama (tidak ditawarkan lagi di UI) |
| `butuh_input_bulanan` | TINYINT(1) | |
| `pasangan_mingguan_id` | → `jenis_data.id` | Jenis data mingguan pasangan (validasi silang) |
| `publik_boleh_lihat` | TINYINT(1) | Tampil di `/publik` (agregat saja) |
| `multi_baris` | TINYINT(1) | Mingguan: boleh >1 pelatihan (baris) per minggu — tombol "Tambah pelatihan lain". Bawaan aktif untuk Masyarakat, Aparatur, Data Belanja Modal, Data Instruktur dan WI (mingguan) |
| `kumulatif_bulanan` | TINYINT(1) | **Migrasi 07.** Hanya untuk bulanan `rincian` (Per nama): bulan terbaru dianggap **menggantikan** bulan sebelumnya (UPT mengunggah roster lengkap tiap bulan), bukan dataset bulanan terpisah-pisah. Saat aktif, tampilan **Data by Name** otomatis meloncat ke bulan terakhir yang sudah ada datanya bila bulan yang dipilih masih kosong |
| `aktif`, `dibuat_oleh`, `created_at` | | |

Sembilan jenis data bawaan (berpasangan) dari instalasi awal:

| Mingguan | Bulanan (`mode_bulanan`) |
| :-- | :-- |
| Masyarakat | Data Masyarakat (`rincian`) |
| Aparatur | Data Aparatur (`rincian`) |
| Data Instruktur dan WI | Data Instruktur dan Widyaiswara (`upload_file`) |
| Data Belanja Modal · Capaian Anggaran per Jenis Belanja · Capaian Anggaran per Sumber Dana | (mingguan saja, tidak dipublikasikan) |

> Admin bebas menambah/mengubah jenis data lewat **Kelola Jenis Data** (termasuk lewat wizard **Buat dari Excel**,
> lihat [06-panduan-pengguna.md](06-panduan-pengguna.md#kelola-jenis-data-form-builder)); daftar di atas hanya
> baseline instalasi. Di lingkungan pengembangan saat ini, misalnya, "Data Aparatur" dan "Data Instruktur dan WI"
> (bulanan) sudah direstrukturisasi ulang kolom-kolomnya lewat menu Admin — struktur kolom yang berlaku selalu
> yang ada di `field_definitions`, bukan tabel di atas.

### `periods` — Periode pelaporan
1 tahun = 1 periode `tahun` + 4 `triwulan` + 12 `bulan` + **48 `minggu`** (4 minggu per bulan: tanggal 1–7, 8–14,
15–21, 22–akhir bulan).

| Kolom | Keterangan |
| :-- | :-- |
| `id` | UUID **deterministik** dari (level, tahun, triwulan, bulan, minggu) → aman dijalankan ulang |
| `level` | `tahun` / `triwulan` / `bulan` / `minggu` |
| `tahun`, `triwulan_ke`, `bulan`, `minggu_ke` | Posisi periode (bisa `NULL` sesuai level) |
| `tanggal_mulai`, `tanggal_selesai` | Rentang periode |
| `deadline` | Batas akhir pengisian. Setelahnya UPT **tetap bisa mengisi**, tetapi datanya ditandai `terlambat` |
| `label` | Mis. `Minggu ke-2 September 2026` |

**Aturan deadline**: minggu → akhir minggu berikutnya (minggu ke-4 → tanggal 7 bulan berikutnya); bulan → akhir bulan
berikutnya; triwulan → akhir triwulan berikutnya; tahun → 30 Juni tahun berikutnya.
Data bawaan hanya mencakup **2026**; tahun lain dibuat dengan `npm run periods -- <tahun>`.

### `field_definitions` — Form Builder
Kolom-kolom form per Jenis Data per level.

| Kolom | Keterangan |
| :-- | :-- |
| `jenis_data_id`, `level`, `field_key` | Kunci unik gabungan |
| `label`, `urutan`, `aktif`, `wajib` | Tampilan & validasi |
| `tipe` | `angka` / `teks` / `teks_panjang` / `tanggal` / `pilihan` / `file` (unggah PDF/Word/Excel — lihat `field_files` di bawah) |
| `opsi_pilihan` | JSON array (untuk `pilihan`), dipakai bila `opsi_bersyarat` kosong |
| `opsi_bersyarat` | **Migrasi 09.** JSON, opsional, hanya untuk `pilihan`: `{ "depends_on": "<field_key kolom lain>", "options": { "<nilai 1>": [...], "<nilai 2>": [...] } }`. Opsi dropdown kolom ini lalu **berbeda tergantung nilai kolom `depends_on`** di baris yang sama (mis. "Jenjang Jabatan" beda opsinya untuk "Jenis" = Instruktur vs Widyaiswara pada jenis data *Data Instruktur dan WI*). Belum ada editor visual — dikonfigurasi lewat `POST /api/db/query` langsung. Mengubah kolom `depends_on` di form otomatis mengosongkan ulang kolom yang bergantung padanya (lihat `fe/src/components/DynamicForm.jsx`) |
| `is_identitas` | Data pribadi (NIK, telepon, alamat, NIP) – **tidak pernah ditampilkan ke publik** |
| `agregasi` | Cara rekap bulan/triwulan/tahun: `sum` (jumlahkan) / `last` (nilai terakhir, angka kumulatif) / `avg` / `max`. Bawaan: pagu*, realisasi*, jumlah instruktur/widyaiswara, volume = `last` |

### `field_files` — Berkas kolom bertipe `file`
Satu baris = satu berkas yang diunggah UPT untuk mengisi SATU sel bertipe `file` (mis. "Link Laporan Pelatihan" pada
Jenis Data *Masyarakat*, yang diganti dari teks link menjadi unggah berkas). Nilai sel itu sendiri, di `rekap_nilai.value_text`
(level minggu) atau `data_entries.data_json[field_key]` (level bulan), hanyalah **id baris ini** — isi berkas ada di disk
(`STORAGE_DIR/field-files/<id>.<ext>`), bukan di database. PDF/Word/Excel saja, maks. **10 MB**; isi berkas diperiksa
(magic bytes), bukan hanya ekstensinya. Baca: pemilik UPT + Admin (`scope: upt`); tulis/hapus lewat `/api/field-files`
(bukan `/api/db/query`) supaya validasi ekstensi & isi berkas tetap ditegakkan. Ikut terhapus (`ON DELETE CASCADE`) bila
UPT atau Jenis Data pemiliknya dihapus; berkas fisik disapu otomatis tiap 6 jam.

> Kolom bertipe `file` sengaja **dikecualikan** dari template Excel, impor Excel, dan Impor Data Historis — tidak ada
> cara mengisi berkas lewat sel Excel, jadi UPT mengisinya langsung di form web.

### Tempat sampah (soft delete)
Tabel `rekap_nilai`, `data_entries`, `dokumen_upload`, `daily_activity` memiliki kolom `deleted_at` (NULL = aktif),
`deleted_by` dan `deleted_batch` (satu aksi hapus = satu batch). Semua query aplikasi hanya membaca baris dengan
`deleted_at IS NULL`; view `v_publik_rekap` juga menyaringnya. Baris yang lebih dari 30 hari terhapus dibuang permanen
otomatis. Database yang diimpor sebelum fitur ini perlu menjalankan `database/migrasi_02_tempat_sampah.sql`.

> Saat memeriksa data langsung di phpMyAdmin, tambahkan `WHERE deleted_at IS NULL` agar tidak ikut melihat baris di tempat sampah.

### Kolom `terlambat`
`rekap_nilai`, `data_entries`, dan `dokumen_upload` punya `terlambat` (TINYINT, bawaan 0). Diisi **server** = 1 bila akun UPT menyimpan setelah
`periods.deadline`; menempel sampai Admin/UPT menghapus datanya. Baris sebelum migrasi_04 tidak ditandai (waktu isi aslinya tidak tercatat).

### `rekap_nilai` — Nilai rekap mingguan/agregat
Satu baris per (jenis_data, upt, periode, **`baris_ke`**, `field_key`) – **unik gabungan** sehingga simpan ulang =
perbarui. `baris_ke` (bawaan 1) membedakan beberapa pelatihan dalam satu minggu.
`value` (DECIMAL 24,4) untuk angka, `value_text` untuk teks. `updated_at` otomatis, `updated_by` diisi server.

### `data_entries` — Data rincian per baris (level bulan)
`nama`, `nik`, dan seluruh isian di `data_json` (JSON); kolom tak dikenal saat impor Excel disimpan di
`data_ekstra`. Unik gabungan (jenis_data, upt, periode, `nik`) → impor Excel ulang memperbarui, bukan menggandakan.
(MySQL mengizinkan banyak `NULL` pada kolom unik, jadi baris tanpa NIK tidak saling bentrok.)

### `dokumen_upload` — Berkas bulanan (mode `upload_file`)
Metadata + isi berkas sebagai *data URL* base64 di `file_data` (LONGTEXT), maks. 15 MB/berkas (dicek UI).

### `arsip_historis` — Arsip Data Historis
Metadata berkas Excel/PDF tahun lalu (`tahun`, `upt_key` NULL = arsip pusat, `jenis_data_id` opsional, `judul`, `file_name`, `file_ext`, `file_size`,
`storage_key`). **Isi berkas ada di disk** (`be/storage/arsip/<storage_key>`, atau `STORAGE_DIR`), bukan di MySQL. Ikut terhapus bila UPT dihapus
(`ON DELETE CASCADE`); berkasnya disapu otomatis.

### `dokumen_resmi` — Repositori Dokumen & Panduan
**Migrasi 08.** Daftar dokumen/pedoman/SOP yang tampil di tab **Dokumen & Panduan** (menu **Dokumen & Arsip**, khusus
Admin). `judul`, `deskripsi`, `kategori` (Pedoman/Template/Regulasi/SOP), `format` (label tampilan, mis. `TXT`),
`isi` (LONGTEXT, isi teks yang diunduh), `file_name`, `mime`, `created_by` → `profiles.id` (`ON DELETE SET NULL`),
`created_by_label` (email penulis, dicap server). Baca: semua akun login; tulis/hapus: Admin. **Sebelum migrasi ini**,
daftar dokumen tersimpan di `localStorage` **browser** — dokumen yang ditambahkan Admin hanya terlihat di browser
Admin sendiri, tidak pernah tersinkron ke akun/perangkat lain. Isi berkas 3 dokumen bawaan disemai otomatis oleh
migrasi ini.

### `permintaan_hapus` — Permintaan Hapus (persetujuan Admin)
**Migrasi 10.** Sejak migrasi ini, tombol Hapus/Kosongkan akun UPT pada `rekap_nilai`, `data_entries`, dan
`dokumen_upload` tidak langsung menghapus — server membuat satu baris di sini (`tabel`, `upt_key`, `filter_json`
berisi kondisi WHERE yang **sudah dilengkapi `upt_key` secara eksplisit** supaya aman dieksekusi ulang oleh Admin,
`ringkasan`, `jumlah_baris`, `alasan` opsional dari UPT, `status`: `pending`/`disetujui`/`ditolak`, `catatan_admin`,
`requested_by`/`reviewed_by` → `profiles.id`). Menyetujui (`POST /api/permintaan-hapus/:id/setujui`) menjalankan
penghapusan aslinya (masuk Tempat Sampah seperti biasa); menolak tidak menyentuh data. Mengedit/mengosongkan isian
biasa saat masih dalam sesi input **tidak** melalui jalur ini (ditandai `liveEdit` di request, dieksekusi langsung)
— hanya tombol Hapus/Kosongkan/Hapus Duplikat yang eksplisit yang digerbang. Baca: Admin semua, UPT hanya miliknya
sendiri; tulis lewat endpoint ini saja (bukan `/api/db/query` generik), karena menyetujui berarti benar-benar
menjalankan penghapusan.

### `dashboard_widgets` — Pengaturan Dashboard
Satu baris = satu kartu/grafik (`tipe`, `judul`, `grup`, `gaya`, `ikon`, `warna`, `satuan`, `urutan`, `aktif`). Sumber angka ada di kolom JSON
`konfigurasi` (`items`/`pembanding`/`series` berisi pasangan `{jd: kunci jenis data, field: field_key}`). Tabel kosong = tampilan bawaan
(`fe/src/lib/dashboardWidgets.js`). Baca: semua akun login; tulis: Admin.

### `daily_activity` — Aktivitas harian (tidak dipakai lagi)
> Menu Daily Activity & Highlights sudah dihapus dari aplikasi. Tabel dan datanya sengaja **dibiarkan** agar tidak ada data hilang; boleh di-`DROP` bila memang tidak diperlukan.

`tanggal`, `status` (`draft`/`proses`/`selesai`), `uraian`, `pic` (JSON array nama), `lingkup`
(`internal_puslat`/`internal_kkp`/`internal_eksternal`/`eksternal`), `output`, `hambatan` + `hambatan_keterangan`,
`interaksi`, `feedback`, `foto_url`, `dokumen_url`.

### `audit_log`
Catatan aksi (mis. `import_kolom_tidak_dikenal`) dengan `actor_id`, `actor_upt_key`, `detail` (JSON).

### `v_publik_rekap` (view)
Jumlah baris `data_entries` per jenis data & periode, **hanya** untuk jenis data `publik_boleh_lihat = 1` dan
`aktif = 1`. Tidak memuat data pribadi; inilah satu-satunya data yang dapat dibaca tanpa login.

## Data awal (seed)

| Isi | Jumlah |
| :-- | :-- |
| UPT (BPPP Jakarta, Medan, Banyuwangi, Tegal, Bitung, Ambon, Padang, Pontianak, Makassar, Sorong) | 10 |
| Akun (1 admin + 10 UPT) | 11 |
| Jenis Data | 9 |
| Definisi kolom | 87 |
| Periode 2026 | 65 |

> **Baseline instalasi baru saja** (isi `database/puslatkp1a.sql`, dari `be/scripts/seed-data.js` + `ddl.sql`).
> UPT/akun/Jenis Data/kolom baru yang ditambahkan lewat menu Admin (**Kelola Akun UPT**, **Kelola Jenis Data**,
> termasuk wizard **Buat dari Excel**) hanya tersimpan di database yang berjalan — **belum otomatis ikut ke dalam
> `puslatkp1a.sql`**. Bila instalasi ini sudah dipakai untuk kerja nyata, jumlah sebenarnya bisa lebih besar (lihat
> [05-akun-dan-keamanan.md](05-akun-dan-keamanan.md) untuk daftar UPT/akun yang sudah dibuat menyusul baseline).
> Untuk membuat `puslatkp1a.sql` ikut memuat penambahan itu, perbarui `be/scripts/seed-data.js`/`ddl.sql` lalu
> jalankan `npm run db:build` (lihat [07-pemeliharaan.md](07-pemeliharaan.md#mengubah-skema-database)).

## Backup & restore

```bash
# Backup
mysqldump -u root -p --routines --single-transaction Puslatkp1a > backup_puslatkp1a.sql
# Restore
mysql -u root -p Puslatkp1a < backup_puslatkp1a.sql
```

Atau lewat phpMyAdmin: **Export** (Quick, SQL) dan **Import**.

> **Penting:** `mysqldump`/phpMyAdmin **tidak mencakup berkas Arsip Historis**. Backup juga folder `be/storage` (atau `STORAGE_DIR`; pada Docker: volume `be-storage`)
> dan pulihkan bersama dump database yang sesuai.
