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

  // Membuat builder bisa di-`await`
  then(resolve, reject) {
    return api('/db/query', { body: this.spec })
      .then(({ data, error }) => (error ? { data: null, error, count: null } : { data: data.data ?? null, error: data.error ?? null, count: data.count ?? null }))
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

let featuresPromise = null
/** Fitur yang aktif di backend/database (mis. beberapa pelatihan per minggu). Di-cache. */
export function getFeatures() {
  if (!featuresPromise) {
    featuresPromise = api('/health', { method: 'GET' }).then(({ data }) => {
      if (!data) featuresPromise = null
      return data?.features || { multiBaris: false, agregasi: false, terlambat: false, arsip: false, dashboard: false }
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
}
