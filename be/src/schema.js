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
    cols: ['id', 'key', 'judul', 'deskripsi', 'level_utama', 'mode_bulanan', 'butuh_input_bulanan', 'pasangan_mingguan_id', 'publik_boleh_lihat', 'multi_baris', 'aktif', 'dibuat_oleh', 'created_at'],
    bool: ['butuh_input_bulanan', 'publik_boleh_lihat', 'multi_baris', 'aktif'],
    read: 'public',
    // Pengunjung publik hanya boleh melihat jenis data publik & aktif, dengan kolom terbatas.
    anon: { cols: ['id', 'key', 'judul', 'deskripsi'], force: { publik_boleh_lihat: 1, aktif: 1 } },
    stamp: { dibuat_oleh: 'id' },
  }),
  field_definitions: table({
    cols: ['id', 'jenis_data_id', 'level', 'field_key', 'label', 'tipe', 'opsi_pilihan', 'agregasi', 'wajib', 'is_identitas', 'urutan', 'aktif', 'dibuat_oleh', 'created_at'],
    json: ['opsi_pilihan'],
    bool: ['wajib', 'is_identitas', 'aktif'],
    stamp: { dibuat_oleh: 'id' },
  }),
  rekap_nilai: table({
    cols: ['id', 'jenis_data_id', 'upt_key', 'period_id', 'baris_ke', 'field_key', 'value', 'value_text', 'updated_at', 'updated_by', 'terlambat'],
    bool: ['terlambat'],
    scope: 'upt', late: true, write: 'auth',
    soft: true, ctx: ['upt_key', 'jenis_data_id', 'period_id'], unique: ['jenis_data_id', 'upt_key', 'period_id', 'baris_ke', 'field_key'],
    stamp: { updated_by: 'id' },
  }),
  data_entries: table({
    cols: ['id', 'jenis_data_id', 'upt_key', 'period_id', 'nama', 'nik', 'data_json', 'data_ekstra', 'created_at', 'created_by', 'terlambat'],
    json: ['data_json', 'data_ekstra'], bool: ['terlambat'],
    scope: 'upt', late: true, write: 'auth',
    soft: true, ctx: ['upt_key', 'jenis_data_id', 'period_id'], unique: ['jenis_data_id', 'upt_key', 'period_id', 'nik'],
    stamp: { created_by: 'id' },
  }),
  daily_activity: table({
    cols: ['id', 'upt_key', 'tanggal', 'status', 'uraian', 'pic', 'deskripsi', 'lingkup', 'output', 'foto_url', 'dokumen_url', 'hambatan', 'hambatan_keterangan', 'interaksi', 'feedback', 'created_at', 'updated_at'],
    json: ['pic'], bool: ['hambatan'],
    scope: 'upt', write: 'auth',
    soft: true, ctx: ['upt_key', 'tanggal'],
  }),
  dokumen_upload: table({
    cols: ['id', 'jenis_data_id', 'period_id', 'upt_key', 'judul', 'file_name', 'file_size', 'file_ext', 'file_type', 'file_data', 'catatan', 'uploaded_by', 'created_at', 'terlambat'],
    bool: ['terlambat'],
    scope: 'upt', late: true, write: 'auth',
    soft: true, ctx: ['upt_key', 'jenis_data_id', 'period_id'],
  }),
  dashboard_widgets: table({
    cols: ['id', 'tipe', 'judul', 'grup', 'gaya', 'ikon', 'warna', 'satuan', 'konfigurasi', 'urutan', 'aktif', 'created_at'],
    json: ['konfigurasi'], bool: ['aktif'],
    read: 'auth', // semua akun login membaca; hanya Admin yang menulis
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
