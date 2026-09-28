/**
 * Whitelist tabel + aturan akses (pengganti Row Level Security Supabase).
 * read/write: 'public' | 'auth' | 'admin'
 * scope: 'upt'  -> non-admin hanya boleh menyentuh baris dengan upt_key miliknya
 * late:  true   -> data yang ditulis akun UPT SETELAH deadline periode tetap diterima tetapi ditandai `terlambat` (dicap server)
 * soft:  true   -> tempat sampah: delete hanya menyembunyikan baris (deleted_at), dipulihkan Admin, dibuang otomatis
 * ctx:   kolom konteks yang dicatat di log penghapusan; unique: kunci unik (untuk membersihkan bentrok dengan tempat sampah)
 */
const AUTO = new Set(['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'dibuat_oleh', 'terlambat'])

function table(def) {
  return { pk: 'id', json: [], bool: [], read: 'auth', write: 'admin', ...def, writable: def.cols.filter(c => !AUTO.has(c)) }
}

export const TABLES = {
  upt_list: table({
    pk: 'key',
    cols: ['key', 'label', 'aktif'],
    bool: ['aktif'],
    scope: 'key', // akun UPT hanya menerima baris UPT-nya sendiri
  }),
  periods: table({
    cols: ['id', 'level', 'tahun', 'triwulan_ke', 'bulan', 'minggu_ke', 'tanggal_mulai', 'tanggal_selesai', 'deadline', 'label'],
  }),
  jenis_data: table({
    cols: ['id', 'key', 'judul', 'deskripsi', 'level_utama', 'mode_bulanan', 'butuh_input_bulanan', 'pasangan_mingguan_id', 'publik_boleh_lihat', 'multi_baris', 'kumulatif_bulanan', 'aktif', 'dibuat_oleh', 'created_at'],
    bool: ['butuh_input_bulanan', 'publik_boleh_lihat', 'multi_baris', 'kumulatif_bulanan', 'aktif'],
    read: 'public',
    // Pengunjung publik hanya boleh melihat jenis data publik & aktif, dengan kolom terbatas.
    anon: { cols: ['id', 'key', 'judul', 'deskripsi'], force: { publik_boleh_lihat: 1, aktif: 1 } },
    stamp: { dibuat_oleh: 'id' },
  }),
  field_definitions: table({
    cols: ['id', 'jenis_data_id', 'level', 'field_key', 'label', 'tipe', 'opsi_pilihan', 'opsi_bersyarat', 'agregasi', 'wajib', 'is_identitas', 'urutan', 'aktif', 'dibuat_oleh', 'created_at'],
    json: ['opsi_pilihan', 'opsi_bersyarat'],
    bool: ['wajib', 'is_identitas', 'aktif'],
    stamp: { dibuat_oleh: 'id' },
  }),
  rekap_nilai: table({
    cols: ['id', 'jenis_data_id', 'upt_key', 'period_id', 'baris_ke', 'field_key', 'value', 'value_text', 'updated_at', 'updated_by', 'terlambat', 'status', 'disetujui_at', 'disetujui_by', 'disetujui_by_label', 'catatan_admin'],
    bool: ['terlambat'],
    scope: 'upt', late: true, write: 'auth',
    soft: true, ctx: ['upt_key', 'jenis_data_id', 'period_id'], unique: ['jenis_data_id', 'upt_key', 'period_id', 'baris_ke', 'field_key'],
    stamp: { updated_by: 'id' },
    // Gerbang bersyarat: hapus/ubah bebas selagi periode belum 'disetujui' (draft/belum dikirim), digerbang jadi
    // permintaan (hapus) atau ditolak (ubah/simpan) begitu periode itu sudah disetujui Admin & terkunci.
    deleteRequiresApproval: true,
    periodLockCheck: true,
    // Lapisan kedua, per baris (baris_ke), terpisah dari periodLockCheck di atas: setiap Simpan dipaksa jadi
    // 'draft' ("menunggu persetujuan") -- lihat forceOnWrite di query.js -- dan `catatan_admin` (catatan
    // penolakan lama, bila ada) ikut dikosongkan karena sudah diperbaiki UPT. Begitu Admin menyetujui satu baris
    // (endpoint khusus, bukan lewat sini), rowApprovalGate menolak tulis langsung & menggerbang hapusnya.
    forceOnWrite: { status: 'draft', catatan_admin: null, disetujui_at: null, disetujui_by: null, disetujui_by_label: null },
    rowApprovalGate: { column: 'status', values: ['disetujui'], groupBy: ['jenis_data_id', 'upt_key', 'period_id', 'baris_ke'] },
  }),
  data_entries: table({
    cols: ['id', 'jenis_data_id', 'upt_key', 'period_id', 'nama', 'nik', 'data_json', 'data_ekstra', 'created_at', 'created_by', 'terlambat', 'status', 'disetujui_at', 'disetujui_by', 'disetujui_by_label', 'catatan_admin'],
    json: ['data_json', 'data_ekstra'], bool: ['terlambat'],
    scope: 'upt', late: true, write: 'auth',
    soft: true, ctx: ['upt_key', 'jenis_data_id', 'period_id'], unique: ['jenis_data_id', 'upt_key', 'period_id', 'nik'],
    stamp: { created_by: 'id' },
    deleteRequiresApproval: true,
    periodLockCheck: true,
    forceOnWrite: { status: 'draft', catatan_admin: null, disetujui_at: null, disetujui_by: null, disetujui_by_label: null },
    rowApprovalGate: { column: 'status', values: ['disetujui'] },
  }),
  daily_activity: table({
    cols: ['id', 'upt_key', 'tanggal', 'status', 'uraian', 'pic', 'deskripsi', 'lingkup', 'output', 'foto_url', 'dokumen_url', 'hambatan', 'hambatan_keterangan', 'interaksi', 'feedback', 'created_at', 'updated_at'],
    json: ['pic'], bool: ['hambatan'],
    scope: 'upt', write: 'auth',
    soft: true, ctx: ['upt_key', 'tanggal'],
  }),
  dokumen_upload: table({
    cols: ['id', 'jenis_data_id', 'period_id', 'upt_key', 'judul', 'file_name', 'file_size', 'file_ext', 'file_type', 'file_data', 'catatan', 'uploaded_by', 'created_at', 'terlambat', 'status', 'disetujui_at', 'disetujui_by', 'disetujui_by_label', 'catatan_admin'],
    bool: ['terlambat'],
    scope: 'upt', late: true, write: 'auth',
    soft: true, ctx: ['upt_key', 'jenis_data_id', 'period_id'],
    deleteRequiresApproval: true,
    periodLockCheck: true,
    forceOnWrite: { status: 'draft', catatan_admin: null, disetujui_at: null, disetujui_by: null, disetujui_by_label: null },
    rowApprovalGate: { column: 'status', values: ['disetujui'] },
  }),
  permintaan_hapus: table({
    // Dibuat otomatis oleh server saat akun UPT menekan hapus/kosongkan pada tabel ber-`deleteRequiresApproval`
    // (lihat be/src/lib/query.js: createDeleteRequest). Disetujui/ditolak lewat POST /api/permintaan-hapus/:id/...
    // (bukan endpoint generik ini) karena menyetujui berarti benar-benar menjalankan penghapusan aslinya.
    cols: [
      'id', 'tabel', 'upt_key', 'period_id', 'jenis_data_id', 'filter_json', 'ringkasan', 'jumlah_baris', 'alasan',
      'status', 'catatan_admin', 'requested_by', 'requested_by_label', 'reviewed_by', 'reviewed_by_label',
      'reviewed_at', 'created_at',
    ],
    json: ['filter_json'],
    scope: 'upt', // UPT hanya melihat permintaan miliknya sendiri; Admin melihat semua
    read: 'auth', write: 'none',
  }),
  periode_kirim: table({
    // "Kirim & Kunci Data": UPT menekan "Kirim" pada satu periode (minggu/bulan) -> baris di sini dibuat dengan
    // status 'draft' (dipaksa server, lihat forceOnWrite — klien tidak bisa mengatur status sendiri). Status
    // 'draft' BELUM mengunci apa pun (UPT masih bebas edit/hapus/batal kirim). Admin meninjau lalu menyetujui
    // lewat POST /api/periode-kirim/:id/setujui -> status 'disetujui' -> BARU SEMUA jenis data periode itu
    // terkunci. Selagi 'disetujui', UPT membuka kunci lewat delete() seperti biasa — approvalGate memastikan ini
    // hanya digerbang (jadi permintaan di `permintaan_hapus`) bila statusnya sudah 'disetujui'; membatalkan draft
    // yang belum disetujui tetap bebas tanpa persetujuan Admin.
    cols: ['id', 'upt_key', 'period_id', 'status', 'terkirim_at', 'terkirim_by', 'terkirim_by_label', 'disetujui_at', 'disetujui_by', 'disetujui_by_label'],
    scope: 'upt', write: 'auth',
    soft: true, ctx: ['upt_key', 'period_id'], unique: ['upt_key', 'period_id'],
    stamp: { terkirim_by: 'id', terkirim_by_label: 'email' },
    forceOnWrite: { status: 'draft' },
    deleteRequiresApproval: true,
    approvalGate: { column: 'status', values: ['disetujui'] },
    // Juga cegah UPT "kirim ulang" (upsert) periode yang sudah 'disetujui' agar diam-diam turun jadi 'draft' lagi
    // lewat ON DUPLICATE KEY UPDATE — begitu terkunci, satu-satunya jalan adalah ajukan buka kunci (delete di atas).
    periodLockCheck: true,
  }),
  dashboard_widgets: table({
    cols: ['id', 'tipe', 'judul', 'grup', 'gaya', 'ikon', 'warna', 'satuan', 'konfigurasi', 'urutan', 'aktif', 'created_at'],
    json: ['konfigurasi'], bool: ['aktif'],
    read: 'auth', // semua akun login membaca; hanya Admin yang menulis
  }),
  field_files: table({
    // Metadata berkas kolom bertipe 'file' (isi berkas di disk, lewat /api/field-files — bukan endpoint ini).
    // Hanya untuk membaca nama berkas dsb.; menulis tetap lewat /api/field-files (validasi ekstensi & isi berkas).
    cols: ['id', 'upt_key', 'jenis_data_id', 'field_key', 'file_name', 'file_ext', 'file_size', 'uploaded_by_label', 'created_at'],
    scope: 'upt', // non-admin hanya melihat berkas UPT-nya sendiri
  }),
  dokumen_resmi: table({
    // Repositori "Dokumen & Panduan": semua akun login membaca, hanya Admin menulis/menghapus.
    cols: ['id', 'judul', 'deskripsi', 'kategori', 'format', 'isi', 'file_name', 'mime', 'created_by', 'created_by_label', 'created_at'],
    read: 'auth',
    stamp: { created_by: 'id', created_by_label: 'email' },
  }),
  audit_log: table({
    cols: ['id', 'actor_id', 'actor_upt_key', 'action', 'detail', 'created_at'],
    json: ['detail'], read: 'admin', write: 'auth', insertOnly: true,
    stamp: { actor_id: 'id', actor_upt_key: 'upt_key' },
  }),
  profiles: table({
    cols: ['id', 'email', 'role', 'upt_key', 'nama_lengkap', 'created_at'],
    scope: 'self', noInsert: true,
  }),
  v_publik_rekap: table({
    cols: ['jenis_data_id', 'jenis_data_judul', 'period_id', 'period_label', 'level', 'tahun', 'bulan', 'total_baris'],
    read: 'public', write: 'none', view: true,
  }),
}
