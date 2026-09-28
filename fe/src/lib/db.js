/**
 * lib/db.js
 * Klien API ke backend Express. Menyediakan query builder bergaya
 *   db.from('tabel').select('*').eq('kolom', nilai).order('kolom').limit(n).single()
 * yang dikirim sebagai satu permintaan JSON ke POST /api/db/query.
 * Hak akses & validasi sepenuhnya ditegakkan di backend (be/src/lib/query.js).
 */
/**
 * Alamat API. Bila NEXT_PUBLIC_API_URL tidak diisi, dipakai host halaman ini + port 4000
 * (jadi tetap jalan saat web dibuka dari komputer lain lewat IP, mis. http://192.168.1.10:3000).
 */
export function apiBase() {
  const env = process.env.NEXT_PUBLIC_API_URL
  if (env) return env.replace(/\/$/, '')
  if (typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}:4000/api`
  return 'http://localhost:4000/api'
}

const TOKEN_KEY = 'puslatkp_token'
export const UNAUTHORIZED_EVENT = 'puslatkp:unauthorized'

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
export const setToken = t => { try { localStorage.setItem(TOKEN_KEY, t) } catch {} }
export const clearToken = () => { try { localStorage.removeItem(TOKEN_KEY) } catch {} }

/** fetch JSON -> { data, error } (tidak pernah melempar). */
export async function api(path, { method = 'POST', body } = {}) {
  const token = getToken()
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (res.status === 401 && token && path !== '/auth/login') {
        clearToken()
        window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
      }
      return { data: null, error: { message: json?.error?.message || `Permintaan gagal (${res.status})`, status: res.status } }
    }
    return { data: json, error: null }
  } catch {
    return { data: null, error: { message: 'Tidak dapat terhubung ke server. Pastikan layanan backend (be) berjalan.' } }
  }
}

class QueryBuilder {
  constructor(table) {
    this.spec = { table, op: null, filters: [], order: [] }
  }

  select(columns = '*', options = {}) {
    if (!this.spec.op) this.spec.op = 'select'
    this.spec.columns = columns
    if (options.head) this.spec.head = true
    return this
  }
  insert(values) { this.spec.op = 'insert'; this.spec.values = values; return this }
  update(values) { this.spec.op = 'update'; this.spec.values = values; return this }
  upsert(values, options = {}) { this.spec.op = 'upsert'; this.spec.values = values; this.spec.onConflict = options.onConflict; return this }
  delete() { this.spec.op = 'delete'; return this }

  eq(col, val) { this.spec.filters.push({ col, op: 'eq', val }); return this }
  in(col, val) { this.spec.filters.push({ col, op: 'in', val }); return this }
  order(column, { ascending = true } = {}) { this.spec.order.push({ column, ascending }); return this }
  limit(n) { this.spec.limit = n; return this }
  single() { this.spec.single = true; return this }
  /** Tandai delete() ini sebagai bagian dari mengedit form (bukan aksi "Hapus" yang disengaja) — dieksekusi
   *  langsung seperti biasa, tidak dialihkan jadi permintaan hapus akun UPT. Lihat be/src/lib/query.js. */
  liveEdit() { this.spec.liveEdit = true; return this }
  /** Alasan opsional (akun UPT) saat delete() ini berubah menjadi permintaan hapus. */
  alasan(text) { this.spec.alasan = text; return this }

  // Membuat builder bisa di-`await`
  then(resolve, reject) {
    return api('/db/query', { body: this.spec })
      .then(({ data, error }) => (error
        ? { data: null, error, count: null }
        : { data: data.data ?? null, error: data.error ?? null, count: data.count ?? null, pending: data.pending, requestId: data.requestId }))
      .then(resolve, reject)
  }
}

/** Arsip Historis (berkas Excel/PDF apa adanya). */
export const arsip = {
  list: params => api('/arsip?' + new URLSearchParams(Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v))), { method: 'GET' }),
  remove: id => api('/arsip/' + id, { method: 'DELETE' }),
  /** Unggah isi berkas mentah; metadata lewat query string. */
  async upload(file, meta) {
    const token = getToken()
    const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(meta).filter(([, v]) => v)), nama: file.name })
    try {
      const res = await fetch(`${apiBase()}/arsip?${qs}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: file })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return { data: null, error: { message: json?.error?.message || `Unggah gagal (${res.status})` } }
      return { data: json.data, error: null }
    } catch {
      return { data: null, error: { message: 'Tidak dapat terhubung ke server.' } }
    }
  },
  /** Ambil isi berkas sebagai ArrayBuffer (butuh token, jadi tidak bisa lewat <a href>). */
  async fetchFile(id) {
    const token = getToken()
    const res = await fetch(`${apiBase()}/arsip/${id}/file`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json?.error?.message || `Gagal mengambil berkas (${res.status})`)
    }
    return res.arrayBuffer()
  },
}

/** Berkas kolom bertipe "Berkas" (field_definitions.tipe = 'file') — satu berkas per sel, mis. Link Laporan Pelatihan. */
export const fieldFiles = {
  remove: id => api('/field-files/' + id, { method: 'DELETE' }),
  /** Unggah isi berkas mentah; metadata (jenis_data_id, field_key, upt_key) lewat query string. Balikan: {id, file_name, file_ext, file_size}. */
  async upload(file, meta) {
    const token = getToken()
    const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(meta).filter(([, v]) => v)), nama: file.name })
    try {
      const res = await fetch(`${apiBase()}/field-files?${qs}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: file })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return { data: null, error: { message: json?.error?.message || `Unggah gagal (${res.status})` } }
      return { data: json.data, error: null }
    } catch {
      return { data: null, error: { message: 'Tidak dapat terhubung ke server.' } }
    }
  },
  /** Unduh langsung ke perangkat (nama berkas asli diambil dari header server). */
  async download(id) {
    const token = getToken()
    const res = await fetch(`${apiBase()}/field-files/${id}/file`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json?.error?.message || `Gagal mengambil berkas (${res.status})`)
    }
    const cd = res.headers.get('Content-Disposition') || ''
    const match = /filename\*=UTF-8''([^;]+)/.exec(cd)
    const filename = match ? decodeURIComponent(match[1]) : `berkas-${id}`
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  },
}

let featuresPromise = null
/** Fitur yang aktif di backend/database (mis. beberapa pelatihan per minggu). Di-cache. */
export function getFeatures() {
  if (!featuresPromise) {
    featuresPromise = api('/health', { method: 'GET' }).then(({ data }) => {
      if (!data) featuresPromise = null
      return data?.features || { multiBaris: false, agregasi: false, terlambat: false, arsip: false, dashboard: false, fieldFiles: false, kumulatifBulanan: false, dokumenResmi: false, opsiBersyarat: false, permintaanHapus: false, periodeKirim: false, persetujuanBaris: false, tolakBaris: false }
    })
  }
  return featuresPromise
}

export const db = {
  from: table => new QueryBuilder(table),
  functions: {
    /** Pengganti Edge Function Supabase. Saat ini hanya: 'create-upt-user' (Admin). */
    async invoke(name, { body } = {}) {
      const routes = { 'create-upt-user': '/auth/users' }
      if (!routes[name]) return { data: null, error: { message: `Fungsi ${name} tidak dikenal` } }
      return api(routes[name], { body })
    },
  },
  auth: {
    /** Admin: atur ulang password akun. Password lama tidak bisa dibaca kembali (hash satu arah). */
    resetPassword: (userId, password) => api(`/auth/users/${userId}/password`, { method: 'PATCH', body: { password } }),
  },
  permintaanHapus: {
    /** Admin: setujui (benar-benar menghapus, masuk Tempat Sampah) atau tolak permintaan hapus akun UPT. */
    setujui: id => api(`/permintaan-hapus/${id}/setujui`, { method: 'POST' }),
    tolak: (id, catatan_admin) => api(`/permintaan-hapus/${id}/tolak`, { method: 'POST', body: { catatan_admin } }),
  },
  periodeKirim: {
    /** Admin: setujui data yang UPT kirim (status draft -> disetujui) — baru saat ini periode terkunci bagi UPT. */
    setujui: id => api(`/periode-kirim/${id}/setujui`, { method: 'POST' }),
  },
  persetujuanBaris: {
    /** Admin: setujui satu baris rekap_nilai (semua field baris_ke itu sekaligus, status draft -> disetujui). */
    setujuiRekap: (jenis_data_id, upt_key, period_id, baris_ke) =>
      api('/persetujuan-baris/rekap-nilai/setujui', { body: { jenis_data_id, upt_key, period_id, baris_ke } }),
    /** Admin: setujui banyak baris rekap_nilai sekaligus (tombol "Setujui Semua" per grup). */
    setujuiRekapMassal: items => api('/persetujuan-baris/rekap-nilai/setujui-massal', { body: { items } }),
    /** Admin: setujui satu baris data_entries (satu orang/nik). */
    setujuiEntry: id => api('/persetujuan-baris/data-entries/setujui', { body: { id } }),
    /** Admin: setujui satu berkas dokumen_upload. */
    setujuiDokumen: id => api('/persetujuan-baris/dokumen-upload/setujui', { body: { id } }),
    /** Admin: tolak satu baris rekap_nilai (status draft -> ditolak + catatan; baris tidak dihapus/diubah). */
    tolakRekap: (jenis_data_id, upt_key, period_id, baris_ke, catatan_admin) =>
      api('/persetujuan-baris/rekap-nilai/tolak', { body: { jenis_data_id, upt_key, period_id, baris_ke, catatan_admin } }),
    /** Admin: tolak satu baris data_entries. */
    tolakEntry: (id, catatan_admin) => api('/persetujuan-baris/data-entries/tolak', { body: { id, catatan_admin } }),
    /** Admin: tolak satu berkas dokumen_upload. */
    tolakDokumen: (id, catatan_admin) => api('/persetujuan-baris/dokumen-upload/tolak', { body: { id, catatan_admin } }),
  },
}
