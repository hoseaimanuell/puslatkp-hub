/**
 * Pengujian blackbox lewat HTTP: hanya masukan -> keluaran, seperti yang dialami pengguna (lihat
 * docs/09-pengujian-blackbox.md). Backend harus sedang berjalan. Memakai 2 UPT uji sementara yang dibuat di awal
 * dan dihapus lagi di akhir (termasuk berkas unggahan), jadi data asli tidak tersentuh.
 *
 *   UJI_ADMIN_EMAIL=... UJI_ADMIN_PASSWORD=... npm run uji:blackbox
 *   (opsional) UJI_API_URL=http://localhost:4000/api   --laporan hasil.json
 *
 * Satu kali jalan memakai ±12 percobaan login (batas 30 per 15 menit per alamat IP).
 */
import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import mysql from 'mysql2/promise'
import { sslDari } from '../src/lib/dbSsl.js'

const B = (process.env.UJI_API_URL || 'http://localhost:4000/api').replace(/\/$/, '')
const ADMIN = { email: process.env.UJI_ADMIN_EMAIL, password: process.env.UJI_ADMIN_PASSWORD }
if (!ADMIN.email || !ADMIN.password) {
  console.error('Isi UJI_ADMIN_EMAIL dan UJI_ADMIN_PASSWORD (akun Admin) sebelum menjalankan.')
  process.exit(1)
}
const iLaporan = process.argv.indexOf('--laporan')
const fileLaporan = iLaporan > 0 ? process.argv[iLaporan + 1] : null

const hasil = []
const catat = (id, modul, skenario, masukan, diharapkan, aktual, lulus) => {
  hasil.push({ id, modul, skenario, masukan, diharapkan, aktual: String(aktual), lulus: !!lulus })
  console.log(`${lulus ? 'LULUS' : 'GAGAL'}  ${id.padEnd(5)} ${skenario}  ->  ${aktual}`)
}
async function req(method, path, { body, token, raw, headers = {} } = {}) {
  const r = await fetch(B + path, {
    method,
    headers: { ...(raw ? { 'Content-Type': 'application/octet-stream' } : body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  })
  let json = null
  try { json = await r.json() } catch {}
  return { status: r.status, json, headers: r.headers }
}
const post = (p, body, token) => req('POST', p, { body, token })
const q = (spec, token) => post('/db/query', spec, token)
const pw = () => 'Uji-' + randomBytes(9).toString('base64url')
const pesan = r => `${r.status}${r.json?.error?.message ? ' "' + r.json.error.message + '"' : ''}`

const U1 = 'upt_uji_blackbox_1', U2 = 'upt_uji_blackbox_2'

/** Hapus semua data uji: berkas lewat API (ikut menghapus file di disk), sisanya lewat SQL (hapus UPT = cascade). */
async function bersihkan(adm) {
  for (const u of [U1, U2]) {
    for (const a of (await req('GET', `/arsip?upt_key=${u}`, { token: adm })).json?.data || []) await req('DELETE', `/arsip/${a.id}`, { token: adm })
    for (const f of (await q({ table: 'field_files', op: 'select', filters: [{ col: 'upt_key', op: 'eq', val: u }] }, adm)).json?.data || []) await req('DELETE', `/field-files/${f.id}`, { token: adm })
  }
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT) || 3306, user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'Puslatkp1a', ...sslDari(),
  })
  await conn.query('DELETE FROM permintaan_hapus WHERE upt_key IN (?)', [[U1, U2]])
  await conn.query("DELETE FROM jenis_data WHERE `key` = 'uji_blackbox_jd'")
  await conn.query('DELETE FROM upt_list WHERE `key` IN (?)', [[U1, U2]])
  await conn.end()
}

// ================= AUTENTIKASI =================
let r = await post('/auth/login', ADMIN)
const adm = r.json?.token
catat('A01', 'Autentikasi', 'Login Admin dengan email & password benar', 'email & password Admin', '200 + token', `${r.status}${adm ? ' + token' : ''}`, r.status === 200 && adm)
catat('A02', 'Autentikasi', 'Batas percobaan login aktif', 'header RateLimit', 'batas 30 per 15 menit', `RateLimit-Limit: ${r.headers.get('ratelimit-limit') || r.headers.get('ratelimit-policy')}`, (r.headers.get('ratelimit-limit') || r.headers.get('ratelimit-policy') || '').includes('30'))
r = await post('/auth/login', { email: ADMIN.email, password: 'salah-password' })
catat('A03', 'Autentikasi', 'Login dengan password salah', 'email Admin + password salah', '401 ditolak', pesan(r), r.status === 401)
r = await post('/auth/login', { email: 'tidakada@kkp.go.id', password: 'apapun123' })
catat('A04', 'Autentikasi', 'Login dengan email tidak terdaftar', 'email acak', '401, pesan sama dengan password salah', pesan(r), r.status === 401 && r.json?.error?.message === 'Invalid login credentials')
r = await post('/auth/login', {})
catat('A05', 'Autentikasi', 'Login tanpa isian', 'body kosong', '401 ditolak', pesan(r), r.status === 401)
r = await post('/auth/login', { email: "' OR '1'='1", password: "' OR '1'='1" })
catat('A06', 'Autentikasi', 'Login dengan SQL injection', "' OR '1'='1", '401 ditolak', pesan(r), r.status === 401)
r = await req('GET', '/auth/me', { token: adm })
catat('A07', 'Autentikasi', 'Lihat profil sendiri dengan token sah', 'token Admin', '200, tanpa password_hash', `${r.status}, role=${r.json?.profile?.role}, password_hash ${JSON.stringify(r.json).includes('password_hash') ? 'ADA' : 'tidak ada'}`, r.status === 200 && !JSON.stringify(r.json).includes('password_hash'))
r = await req('GET', '/auth/me', { token: 'token.palsu.xyz' })
catat('A08', 'Autentikasi', 'Akses dengan token palsu', 'token acak', '401', pesan(r), r.status === 401)

// ================= SIAPKAN DATA UJI =================
if (!adm) { console.error('Login Admin gagal — periksa UJI_ADMIN_EMAIL/UJI_ADMIN_PASSWORD dan backend.'); process.exit(1) }
await bersihkan(adm) // sisa jalan sebelumnya yang terhenti di tengah
const cari = async (table, filters) => (await q({ table, op: 'select', filters }, adm)).json?.data || []
const tahunIni = new Date().getFullYear()
const hariIni = new Date().toISOString().slice(0, 10)
const JD_MINGGU = (await cari('jenis_data', [{ col: 'key', op: 'eq', val: 'masyarakat' }]))[0]?.id        // mingguan, multi baris
const JD_BULAN = (await cari('jenis_data', [{ col: 'key', op: 'eq', val: 'data_masyarakat' }]))[0]?.id    // bulanan, per nama
const mingguDepan = await cari('periods', [{ col: 'level', op: 'eq', val: 'minggu' }, { col: 'tahun', op: 'eq', val: tahunIni + 1 }])
const P_NOV = mingguDepan.find(p => p.bulan === 11 && p.minggu_ke === 2)?.id                             // belum lewat deadline
const P_JAN = [...await cari('periods', [{ col: 'level', op: 'eq', val: 'minggu' }, { col: 'tahun', op: 'in', val: [tahunIni - 1, tahunIni] }])]
  .filter(p => p.deadline < hariIni).sort((a, b) => (a.deadline < b.deadline ? -1 : 1))[0]?.id           // sudah lewat deadline
const P_BLN = (await cari('periods', [{ col: 'level', op: 'eq', val: 'bulan' }, { col: 'tahun', op: 'eq', val: tahunIni + 1 }, { col: 'bulan', op: 'eq', val: 11 }]))[0]?.id
if (![JD_MINGGU, JD_BULAN, P_NOV, P_JAN, P_BLN].every(Boolean)) { console.error('Jenis data bawaan (masyarakat/data_masyarakat) atau periodenya tidak ditemukan.'); process.exit(1) }

try {
await q({ table: 'upt_list', op: 'insert', values: [{ key: U1, label: 'UPT Uji Blackbox 1', aktif: true }, { key: U2, label: 'UPT Uji Blackbox 2', aktif: true }] }, adm)

// ================= KELOLA AKUN =================
const pw1 = pw(), pw2 = pw()
const email1 = 'uji.blackbox1@kkp.go.id', email2 = 'uji.blackbox2@kkp.go.id'
r = await post('/auth/users', { email: email1, password: pw1, nama_lengkap: 'Penguji Satu', upt_key: U1 }, adm)
catat('K01', 'Kelola Akun', 'Admin membuat akun UPT baru', 'email, password 8+ karakter, nama, UPT', '201 akun dibuat', pesan(r), r.status === 201)
const idAkun1 = r.json?.user?.id
await post('/auth/users', { email: email2, password: pw2, nama_lengkap: 'Penguji Dua', upt_key: U2 }, adm)
r = await post('/auth/users', { email: email1, password: pw(), nama_lengkap: 'Ganda', upt_key: U1 }, adm)
catat('K02', 'Kelola Akun', 'Membuat akun dengan email yang sudah dipakai', 'email sama', '409 ditolak', pesan(r), r.status === 409)
r = await post('/auth/users', { email: 'bukan-email', password: pw(), nama_lengkap: 'X', upt_key: U1 }, adm)
catat('K03', 'Kelola Akun', 'Format email tidak valid', '"bukan-email"', '400 ditolak', pesan(r), r.status === 400)
r = await post('/auth/users', { email: 'pendek@kkp.go.id', password: '1234567', nama_lengkap: 'X', upt_key: U1 }, adm)
catat('K04', 'Kelola Akun', 'Password 7 karakter (batas bawah - 1)', '"1234567"', '400 minimal 8 karakter', pesan(r), r.status === 400)
r = await post('/auth/users', { email: 'upttidakada@kkp.go.id', password: pw(), nama_lengkap: 'X', upt_key: 'upt_tidak_ada' }, adm)
catat('K05', 'Kelola Akun', 'UPT tidak terdaftar', 'upt_key acak', '400 ditolak', pesan(r), r.status === 400)
r = await post('/auth/users', { email: 'x@kkp.go.id', password: pw(), nama_lengkap: '   ', upt_key: U1 }, adm)
catat('K06', 'Kelola Akun', 'Nama lengkap hanya spasi', '"   "', '400 wajib diisi', pesan(r), r.status === 400)

let t1 = (await post('/auth/login', { email: email1, password: pw1 })).json?.token
const t2 = (await post('/auth/login', { email: email2, password: pw2 })).json?.token
catat('K07', 'Kelola Akun', 'Login dengan akun UPT yang baru dibuat', 'email & password akun baru', '200 + token', t1 ? '200 + token' : 'gagal', !!t1)
r = await req('GET', '/auth/me', { token: t1 })
catat('K07b', 'Kelola Akun', 'Profil UPT memuat nama UPT (bukan kode)', 'token UPT', 'upt_label = "UPT Uji Blackbox 1"', `upt_label "${r.json?.profile?.upt_label}"`, r.json?.profile?.upt_label === 'UPT Uji Blackbox 1')
r = await post('/auth/users', { email: 'olehupt@kkp.go.id', password: pw(), nama_lengkap: 'X', upt_key: U1 }, t1)
catat('K08', 'Kelola Akun', 'Akun UPT mencoba membuat akun', 'token UPT', '403 ditolak', pesan(r), r.status === 403)
const pwBaru = pw()
r = await req('PATCH', `/auth/users/${idAkun1}/password`, { body: { password: pwBaru }, token: adm })
const loginLama = await post('/auth/login', { email: email1, password: pw1 })
const loginBaru = await post('/auth/login', { email: email1, password: pwBaru })
catat('K09', 'Kelola Akun', 'Admin mengatur ulang password', 'password baru 8+ karakter', 'password lama ditolak, baru diterima', `reset ${r.status}; lama ${loginLama.status}; baru ${loginBaru.status}`, r.status === 200 && loginLama.status === 401 && loginBaru.status === 200)
t1 = loginBaru.json?.token
r = await req('PATCH', `/auth/users/${idAkun1}/password`, { body: { password: 'pendek' }, token: adm })
catat('K10', 'Kelola Akun', 'Atur ulang password terlalu pendek', '"pendek"', '400 ditolak', pesan(r), r.status === 400)

// ================= HAK AKSES =================
r = await q({ table: 'rekap_nilai', op: 'select' }, null)
catat('H01', 'Hak Akses', 'Pengunjung tanpa login membaca data rekap', 'tanpa token', '401', pesan(r), r.status === 401)
r = await q({ table: 'rekap_nilai', op: 'select', filters: [{ col: 'upt_key', op: 'eq', val: 'upt_bda_sukamandi' }] }, t1)
catat('H02', 'Hak Akses', 'UPT membaca data UPT lain', 'filter upt_key UPT lain', '0 baris', `${r.status}, ${r.json?.data?.length} baris`, r.status === 200 && r.json?.data?.length === 0)
r = await q({ table: 'profiles', op: 'select' }, t1)
catat('H03', 'Hak Akses', 'UPT membaca daftar akun', 'select profiles', 'hanya akunnya sendiri', `${r.json?.data?.length} akun: ${r.json?.data?.map(x => x.email).join(', ')}`, r.json?.data?.length === 1 && r.json.data[0].email === email1)
r = await q({ table: 'jenis_data', op: 'update', values: { judul: 'diretas' }, filters: [{ col: 'id', op: 'eq', val: JD_MINGGU }] }, t1)
catat('H04', 'Hak Akses', 'UPT mengubah Jenis Data', 'update jenis_data', '403', pesan(r), r.status === 403)
r = await q({ table: 'audit_log', op: 'select' }, t1)
catat('H05', 'Hak Akses', 'UPT membaca log audit', 'select audit_log', '403', pesan(r), r.status === 403)
r = await q({ table: 'profiles', op: 'select', columns: 'email,password_hash' }, adm)
catat('H06', 'Hak Akses', 'Meminta kolom password_hash (bahkan Admin)', 'columns password_hash', '400 ditolak', pesan(r), r.status === 400)
r = await q({ table: 'mysql.user', op: 'select' }, adm)
catat('H07', 'Hak Akses', 'Tabel di luar daftar izin', 'mysql.user', '400 ditolak', pesan(r), r.status === 400)
r = await q({ table: 'rekap_nilai', op: 'delete' }, adm)
catat('H08', 'Hak Akses', 'Hapus tanpa filter (seluruh tabel)', 'delete tanpa filter', '400 ditolak', pesan(r), r.status === 400)
r = await q({ table: 'jenis_data', op: 'select' }, null)
const kolomPublik = Object.keys(r.json?.data?.[0] || {}).sort().join(',')
catat('H09', 'Hak Akses', 'Pengunjung membaca daftar jenis data', 'tanpa token', 'hanya kolom publik (id,judul,deskripsi,key)', `${r.status}, kolom: ${kolomPublik}`, r.status === 200 && kolomPublik === 'deskripsi,id,judul,key')
r = await req('POST', '/db/query', { body: { table: 'jenis_data', op: 'select', pad: 'x'.repeat(150 * 1024) } })
catat('H10', 'Hak Akses', 'Kiriman besar dari pengunjung anonim', 'body 150 KB tanpa token', '413 terlalu besar', pesan(r), r.status === 413)

// ================= INPUT MINGGUAN =================
const baris = (period_id, baris_ke, peserta, extra = {}) => [
  { jenis_data_id: JD_MINGGU, upt_key: U1, period_id, baris_ke, field_key: 'nama_pelatihan', value_text: 'Pelatihan Uji ' + baris_ke, ...extra },
  { jenis_data_id: JD_MINGGU, upt_key: U1, period_id, baris_ke, field_key: 'jumlah_peserta', value: peserta, ...extra },
]
const onConf = 'jenis_data_id,upt_key,period_id,baris_ke,field_key'
const ambil = async (period_id, token = adm, upt = U1) => (await q({ table: 'rekap_nilai', op: 'select', filters: [{ col: 'upt_key', op: 'eq', val: upt }, { col: 'period_id', op: 'eq', val: period_id }] }, token)).json?.data || []
r = await q({ table: 'rekap_nilai', op: 'upsert', values: baris(P_NOV, 1, 20), onConflict: onConf }, t1)
let rows = await ambil(P_NOV)
catat('M01', 'Input Mingguan', 'UPT menyimpan data mingguan sebelum deadline', 'nama pelatihan + 20 peserta', 'tersimpan, status draft, tidak terlambat', `${r.status}; status ${[...new Set(rows.map(x => x.status))]}; terlambat ${[...new Set(rows.map(x => x.terlambat))]}`, r.status === 200 && rows.length === 2 && rows.every(x => x.status === 'draft' && !x.terlambat))
r = await q({ table: 'rekap_nilai', op: 'upsert', values: baris(P_JAN, 1, 5), onConflict: onConf }, t1)
rows = await ambil(P_JAN)
catat('M02', 'Input Mingguan', 'UPT menyimpan data setelah deadline', 'periode yang deadline-nya sudah lewat', 'tetap tersimpan, ditandai terlambat', `${r.status}; terlambat ${[...new Set(rows.map(x => x.terlambat))]}`, r.status === 200 && rows.every(x => x.terlambat === true))
r = await q({ table: 'rekap_nilai', op: 'upsert', values: baris(P_NOV, 2, 7, { status: 'disetujui' }), onConflict: onConf }, t1)
rows = (await ambil(P_NOV)).filter(x => x.baris_ke === 2)
catat('M03', 'Input Mingguan', 'UPT mengirim status "disetujui" sendiri', 'status: disetujui', 'status tetap draft', `status ${[...new Set(rows.map(x => x.status))]}`, rows.length && rows.every(x => x.status === 'draft'))
r = await q({ table: 'rekap_nilai', op: 'upsert', values: baris(P_NOV, 3, 1).map(x => ({ ...x, upt_key: U2 })), onConflict: onConf }, t1)
const diU2 = await ambil(P_NOV, adm, U2)
catat('M04', 'Input Mingguan', 'UPT menulis atas nama UPT lain', 'upt_key UPT lain', 'data tercatat milik UPT sendiri', `baris di UPT lain: ${diU2.length}`, diU2.length === 0)
r = await post('/persetujuan-baris/rekap-nilai/setujui', { jenis_data_id: JD_MINGGU, upt_key: U1, period_id: P_NOV, baris_ke: 1 }, adm)
rows = (await ambil(P_NOV)).filter(x => x.baris_ke === 1)
catat('M05', 'Input Mingguan', 'Admin menyetujui satu baris', 'baris #1', 'status disetujui', `${r.status}; status ${[...new Set(rows.map(x => x.status))]}`, r.status === 200 && rows.every(x => x.status === 'disetujui'))
r = await post('/persetujuan-baris/rekap-nilai/setujui', { jenis_data_id: JD_MINGGU, upt_key: U1, period_id: P_NOV, baris_ke: 1 }, t1)
catat('M06', 'Input Mingguan', 'UPT mencoba menyetujui barisnya sendiri', 'endpoint persetujuan, token UPT', '403', pesan(r), r.status === 403)
r = await q({ table: 'rekap_nilai', op: 'upsert', values: baris(P_NOV, 1, 99), onConflict: onConf }, t1)
catat('M07', 'Input Mingguan', 'UPT menimpa baris yang sudah disetujui', 'baris #1 dengan 99 peserta', '403, diarahkan ke tombol Edit', pesan(r), r.status === 403 && /Edit/.test(r.json?.error?.message || ''))
r = await post('/permintaan-edit/rekap-nilai', { jenis_data_id: JD_MINGGU, period_id: P_NOV, baris_ke: 1, upserts: [{ field_key: 'jumlah_peserta', value: 25 }], alasan: 'salah ketik' }, t1)
const idEdit = r.json?.requestId
let nilai = (await ambil(P_NOV)).find(x => x.baris_ke === 1 && x.field_key === 'jumlah_peserta')?.value
catat('M08', 'Input Mingguan', 'UPT mengajukan edit baris disetujui', 'peserta 20 -> 25', 'permintaan terkirim, nilai lama tetap', `${r.status}; nilai sekarang ${nilai}`, r.status === 200 && idEdit && Number(nilai) === 20)
r = await post(`/permintaan-hapus/${idEdit}/setujui`, {}, adm)
rows = (await ambil(P_NOV)).filter(x => x.baris_ke === 1)
nilai = rows.find(x => x.field_key === 'jumlah_peserta')?.value
catat('M09', 'Input Mingguan', 'Admin menyetujui permintaan edit', 'setujui permintaan', 'nilai 25, tetap disetujui', `${r.status}; nilai ${nilai}; status ${[...new Set(rows.map(x => x.status))]}`, r.status === 200 && Number(nilai) === 25 && rows.every(x => x.status === 'disetujui'))
r = await post(`/permintaan-hapus/${idEdit}/setujui`, {}, adm)
catat('M10', 'Input Mingguan', 'Menyetujui permintaan yang sama dua kali', 'setujui ulang', '409 sudah diproses', pesan(r), r.status === 409)
r = await q({ table: 'rekap_nilai', op: 'delete', filters: [{ col: 'period_id', op: 'eq', val: P_NOV }, { col: 'baris_ke', op: 'eq', val: 2 }] }, t1)
rows = (await ambil(P_NOV)).filter(x => x.baris_ke === 2)
catat('M11', 'Input Mingguan', 'UPT menghapus baris draft', 'hapus baris #2 (draft)', 'langsung terhapus', `${r.status}; pending=${!!r.json?.pending}; sisa ${rows.length}`, r.status === 200 && !r.json?.pending && rows.length === 0)
r = await q({ table: 'rekap_nilai', op: 'delete', filters: [{ col: 'period_id', op: 'eq', val: P_NOV }, { col: 'baris_ke', op: 'eq', val: 1 }] }, t1)
const idHapus = r.json?.requestId
rows = (await ambil(P_NOV)).filter(x => x.baris_ke === 1)
catat('M12', 'Input Mingguan', 'UPT menghapus baris disetujui', 'hapus baris #1', 'jadi permintaan, data belum hilang', `${r.status}; pending=${!!r.json?.pending}; sisa ${rows.length}`, r.status === 200 && r.json?.pending && rows.length === 2)
r = await post(`/permintaan-hapus/${idHapus}/tolak`, { catatan_admin: 'data masih dipakai' }, adm)
rows = (await ambil(P_NOV)).filter(x => x.baris_ke === 1)
catat('M13', 'Input Mingguan', 'Admin menolak permintaan hapus', 'tolak + catatan', 'data tetap ada', `${r.status}; sisa ${rows.length}`, r.status === 200 && rows.length === 2)
await q({ table: 'rekap_nilai', op: 'upsert', values: baris(P_NOV, 4, 3), onConflict: onConf }, t1)
r = await post('/persetujuan-baris/rekap-nilai/tolak', { jenis_data_id: JD_MINGGU, upt_key: U1, period_id: P_NOV, baris_ke: 4, catatan_admin: 'peserta kurang' }, adm)
let b4 = (await ambil(P_NOV, t1)).filter(x => x.baris_ke === 4)
catat('M14', 'Input Mingguan', 'Admin menolak baris + catatan, UPT melihatnya', 'tolak baris #4', 'status ditolak, catatan terlihat UPT', `${r.status}; ${b4[0]?.status}; "${b4[0]?.catatan_admin}"`, r.status === 200 && b4.every(x => x.status === 'ditolak' && x.catatan_admin === 'peserta kurang'))
await q({ table: 'rekap_nilai', op: 'upsert', values: baris(P_NOV, 4, 30), onConflict: onConf }, t1)
b4 = (await ambil(P_NOV)).filter(x => x.baris_ke === 4)
catat('M15', 'Input Mingguan', 'UPT memperbaiki baris yang ditolak', 'simpan ulang baris #4', 'kembali draft, catatan dikosongkan', `${b4[0]?.status}; catatan ${b4[0]?.catatan_admin}`, b4.every(x => x.status === 'draft' && x.catatan_admin === null))

// ================= INPUT BULANAN / IMPOR EXCEL =================
const orang = [
  { nama: 'Uji Satu', nik: '3500000000000001', data_json: { nama: 'Uji Satu', usia: 30 } },
  { nama: 'Uji Dua', nik: null, data_json: { nama: 'Uji Dua', usia: 25 } },
]
const imp = (rows2, token, extra = {}) => post('/impor-rincian', { jenis_data_id: JD_BULAN, period_id: P_BLN, upt_key: U1, rows: rows2, ...extra }, token)
r = await imp(orang, t1)
catat('B01', 'Input Bulanan', 'Impor Excel pertama kali', '2 baris (1 tanpa NIK)', '2 baru, menunggu persetujuan', JSON.stringify({ baru: r.json?.baru, sama: r.json?.sama }), r.status === 200 && r.json?.baru === 2)
r = await imp(orang, t1)
catat('B02', 'Input Bulanan', 'Unggah ulang berkas yang sama', 'berkas identik', '0 baru, 2 dilewati (tidak dobel)', JSON.stringify({ baru: r.json?.baru, sama: r.json?.sama }), r.json?.baru === 0 && r.json?.sama === 2)
const ent = async (token = adm) => (await q({ table: 'data_entries', op: 'select', filters: [{ col: 'upt_key', op: 'eq', val: U1 }, { col: 'period_id', op: 'eq', val: P_BLN }] }, token)).json?.data || []
let e = await ent()
r = await post('/persetujuan-baris/data-entries/setujui-massal', { ids: e.map(x => x.id) }, adm)
catat('B03', 'Input Bulanan', 'Admin "Setujui Semua" data per nama', '2 id sekaligus', '2 disetujui dalam 1 permintaan', `${r.status}; jumlah ${r.json?.jumlah}`, r.status === 200 && r.json?.jumlah === 2)
r = await imp([{ ...orang[0], data_json: { nama: 'Uji Satu', usia: 31 } }, orang[1]], t1, { pratinjau: true })
catat('B04', 'Input Bulanan', 'Unggah ulang: baris disetujui berubah', 'usia 30 -> 31', 'terdeteksi 1 baris disetujui berubah', JSON.stringify({ disetujuiBerubah: r.json?.disetujuiBerubah, sama: r.json?.sama }), r.json?.disetujuiBerubah === 1 && r.json?.sama === 1)
r = await imp([{ ...orang[0], data_json: { nama: 'Uji Satu', usia: 31 } }, orang[1]], t1, { ajukanPerubahan: false })
e = await ent()
catat('B05', 'Input Bulanan', 'Pilih "Lewati" untuk perubahan baris disetujui', 'ajukanPerubahan: false', 'data disetujui tidak berubah', `dilewati ${r.json?.dilewatiDisetujui}; usia ${e.find(x => x.nik === orang[0].nik)?.data_json?.usia}`, r.json?.dilewatiDisetujui === 1 && e.find(x => x.nik === orang[0].nik)?.data_json?.usia === 30)
const dua = e.find(x => x.nama === 'Uji Dua')
r = await q({ table: 'data_entries', op: 'update', values: { nama: 'Uji Dua', status: 'disetujui' }, filters: [{ col: 'id', op: 'eq', val: dua.id }] }, t1)
catat('B06', 'Input Bulanan', 'UPT mengubah baris yang sudah disetujui langsung', 'update baris disetujui', '403 ditolak', pesan(r), r.status === 403)
r = await imp([{ nama: 'Uji Tiga', nik: '3500000000000003', data_json: { nama: 'Uji Tiga' } }], t1)
const tiga = (await ent()).find(x => x.nama === 'Uji Tiga')
r = await q({ table: 'data_entries', op: 'update', values: { nama: 'Uji Tiga', status: 'disetujui' }, filters: [{ col: 'id', op: 'eq', val: tiga.id }] }, t1)
const tigaSetelah = (await ent()).find(x => x.id === tiga.id)
catat('B07', 'Input Bulanan', 'UPT menyetujui sendiri lewat update', 'status: disetujui pada baris draft', 'status tetap draft', `${r.status}; status ${tigaSetelah?.status}`, tigaSetelah?.status === 'draft')
r = await q({ table: 'data_entries', op: 'select', filters: [{ col: 'upt_key', op: 'eq', val: U1 }] }, t2)
catat('B08', 'Input Bulanan', 'UPT lain membaca data per nama UPT ini', 'token UPT 2', '0 baris', `${r.json?.data?.length} baris`, r.json?.data?.length === 0)
r = await imp(Array.from({ length: 5001 }, (_, i) => ({ nama: 'X' + i })), t1, { pratinjau: true })
catat('B09', 'Input Bulanan', 'Impor lebih dari 5000 baris', '5001 baris', '400 ditolak', pesan(r), r.status === 400)

// ================= TEMPAT SAMPAH =================
await q({ table: 'rekap_nilai', op: 'upsert', values: baris(P_NOV, 5, 4), onConflict: onConf }, t1)
const batchSebelum = new Set(((await req('GET', '/trash', { token: adm })).json?.items || []).map(i => i.batch))
await q({ table: 'rekap_nilai', op: 'delete', filters: [{ col: 'period_id', op: 'eq', val: P_NOV }, { col: 'baris_ke', op: 'eq', val: 5 }] }, t1)
r = await req('GET', '/trash', { token: adm })
const item = r.json?.items?.find(i => !batchSebelum.has(i.batch) && i.upt === 'UPT Uji Blackbox 1' && i.tabel === 'rekap_nilai')
catat('T01', 'Tempat Sampah', 'Data yang dihapus masuk tempat sampah', 'hapus baris #5', 'terlihat di daftar, sisa hari 30', `${r.status}; ${item ? `${item.jumlah} baris, sisa ${item.sisa_hari} hari` : 'tidak ada'}`, item && item.sisa_hari === 30)
r = await post('/trash/restore', { batch: item?.batch }, adm)
rows = (await ambil(P_NOV)).filter(x => x.baris_ke === 5)
catat('T02', 'Tempat Sampah', 'Admin memulihkan data', 'pulihkan batch', 'data kembali', `${r.status}; ${rows.length} baris kembali`, r.status === 200 && rows.length === 2)
r = await req('GET', '/trash', { token: t1 })
catat('T03', 'Tempat Sampah', 'UPT membuka tempat sampah', 'token UPT', '403', pesan(r), r.status === 403)

// ================= PERIODE =================
r = await post('/periods/generate', { dari: 2030, sampai: 2020 }, adm)
catat('P01', 'Periode', 'Buat periode dengan rentang terbalik', 'dari 2030 sampai 2020', '400 ditolak', pesan(r), r.status === 400)
r = await post('/periods/generate', { dari: 2030, sampai: 2045 }, adm)
catat('P02', 'Periode', 'Buat periode lebih dari 12 tahun', '2030-2045', '400 ditolak', pesan(r), r.status === 400)
r = await post('/periods/generate', { dari: tahunIni, sampai: tahunIni }, t1)
catat('P03', 'Periode', 'UPT membuat periode', 'token UPT', '403', pesan(r), r.status === 403)
r = await post('/periods/generate', { dari: tahunIni, sampai: tahunIni }, adm)
catat('P04', 'Periode', 'Buat ulang periode tahun yang sudah ada', 'tahun berjalan', 'tidak menggandakan (0 dibuat)', `${r.status}; dibuat ${r.json?.jumlah}`, r.status === 200 && r.json?.jumlah === 0)

// ================= ARSIP HISTORIS =================
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')
r = await req('POST', `/arsip?nama=laporan-uji.pdf&tahun=2024&judul=Uji`, { raw: pdf, token: t1 })
const idArsip = r.json?.data?.id
catat('R01', 'Arsip Historis', 'UPT mengunggah PDF', 'berkas PDF sah', '201 tersimpan', pesan(r), r.status === 201)
r = await req('POST', `/arsip?nama=virus.exe&tahun=2024`, { raw: Buffer.from('MZ....'), token: t1 })
catat('R02', 'Arsip Historis', 'Unggah berkas .exe', 'virus.exe', '400 format tidak didukung', pesan(r), r.status === 400)
r = await req('POST', `/arsip?nama=palsu.pdf&tahun=2024`, { raw: Buffer.from('bukan pdf sama sekali'), token: t1 })
catat('R03', 'Arsip Historis', 'Berkas bernama .pdf tapi isinya bukan PDF', 'palsu.pdf', '400 isi tidak sesuai', pesan(r), r.status === 400)
r = await req('POST', `/arsip?nama=laporan.pdf&tahun=1999`, { raw: pdf, token: t1 })
catat('R04', 'Arsip Historis', 'Tahun di luar batas (1999)', 'tahun 1999', '400 ditolak', pesan(r), r.status === 400)
r = await req('GET', `/arsip/${idArsip}/file`, { token: t2 })
catat('R05', 'Arsip Historis', 'UPT lain mengunduh arsip UPT ini', 'token UPT 2', '404 (tidak terlihat)', pesan(r), r.status === 404)
r = await req('GET', `/arsip/${idArsip}/file`, { token: t1 })
catat('R06', 'Arsip Historis', 'Pemilik mengunduh arsipnya', 'token UPT 1', '200', `${r.status}`, r.status === 200)

// ================= KOLOM BERKAS =================
r = await req('POST', `/field-files?nama=lap.pdf&jenis_data_id=${JD_MINGGU}&field_key=jumlah_peserta`, { raw: pdf, token: t1 })
catat('F01', 'Kolom Berkas', 'Unggah berkas ke kolom yang bukan bertipe Berkas', 'field jumlah_peserta', '400 ditolak', pesan(r), r.status === 400)
r = await req('POST', `/field-files?nama=lap.pdf&jenis_data_id=${JD_MINGGU}&field_key=link_laporan_pelatihan`, { raw: pdf, token: t1 })
const idFF = r.json?.data?.id
catat('F02', 'Kolom Berkas', 'Unggah PDF ke kolom Berkas', 'link_laporan_pelatihan', '201 tersimpan', pesan(r), r.status === 201)
r = await req('GET', `/field-files/${idFF}/file`, { token: t2 })
catat('F03', 'Kolom Berkas', 'UPT lain mengunduh berkas ini', 'token UPT 2', 'ditolak (403/404)', pesan(r), r.status === 403 || r.status === 404)

// ================= KELOLA JENIS DATA =================
r = await q({ table: 'jenis_data', op: 'insert', values: { key: 'uji_blackbox_jd', judul: 'Uji Blackbox', level_utama: 'minggu', aktif: true } }, adm)
const idJd = r.json?.data?.id
catat('J01', 'Kelola Jenis Data', 'Admin membuat jenis data baru', 'judul + level minggu', 'tersimpan', `${r.status}${idJd ? ' id ada' : ''}`, r.status === 200 && idJd)
r = await q({ table: 'field_definitions', op: 'insert', values: { jenis_data_id: idJd, level: 'minggu', field_key: 'banyak_lulusan', label: 'Banyak Lulusan', tipe: 'angka', peran_rekap: 'peserta', urutan: 1, aktif: true } }, adm)
catat('J02', 'Kelola Jenis Data', 'Admin menambah kolom dengan peran rekap', 'kolom angka, peran peserta', 'tersimpan', pesan(r), r.status === 200)
r = await q({ table: 'field_definitions', op: 'insert', values: { jenis_data_id: idJd, level: 'minggu', field_key: 'banyak_lulusan', label: 'Ganda', tipe: 'angka', urutan: 2, aktif: true } }, adm)
catat('J03', 'Kelola Jenis Data', 'Kode kolom ganda dalam satu jenis data', 'field_key sama', '409 duplikat', pesan(r), r.status === 409)
r = await q({ table: 'jenis_data', op: 'insert', values: { key: 'uji_oleh_upt', judul: 'X', level_utama: 'minggu' } }, t1)
catat('J04', 'Kelola Jenis Data', 'UPT membuat jenis data', 'token UPT', '403', pesan(r), r.status === 403)
r = await q({ table: 'jenis_data', op: 'insert', values: { key: 'uji_blackbox_jd', judul: 'Ganda', level_utama: 'minggu' } }, adm)
catat('J05', 'Kelola Jenis Data', 'Kunci jenis data ganda', 'key sama', '409 duplikat', pesan(r), r.status === 409)

// ================= DOKUMEN, DASHBOARD, PUBLIK =================
r = await q({ table: 'dokumen_resmi', op: 'select', columns: 'id,judul' }, t1)
catat('D01', 'Dokumen & Panduan', 'UPT membaca dokumen & panduan', 'token UPT', '200', `${r.status}; ${r.json?.data?.length} dokumen`, r.status === 200)
r = await q({ table: 'dokumen_resmi', op: 'insert', values: { judul: 'X' } }, t1)
catat('D02', 'Dokumen & Panduan', 'UPT menambah dokumen', 'token UPT', '403', pesan(r), r.status === 403)
r = await q({ table: 'dashboard_widgets', op: 'insert', values: { tipe: 'kartu', judul: 'X' } }, t1)
catat('D03', 'Kelola Dashboard', 'UPT mengubah pengaturan dashboard', 'token UPT', '403', pesan(r), r.status === 403)
r = await q({ table: 'v_publik_rekap', op: 'select' }, null)
catat('U01', 'Tampilan Publik', 'Pengunjung membaca rekap publik', 'tanpa token', '200, tanpa data pribadi', `${r.status}; kolom ${Object.keys(r.json?.data?.[0] || {}).join(',') || '(kosong)'}`, r.status === 200 && !JSON.stringify(r.json).match(/nik|nama"/))
r = await q({ table: 'v_publik_rekap', op: 'delete', filters: [{ col: 'tahun', op: 'eq', val: 2026 }] }, adm)
catat('U02', 'Tampilan Publik', 'Menghapus data tampilan publik', 'token Admin', '403 (hanya-baca)', pesan(r), r.status === 403)

} finally {
  await bersihkan(adm)
}

if (fileLaporan) writeFileSync(fileLaporan, JSON.stringify({ waktu: new Date().toISOString(), hasil }, null, 1))
const lulus = hasil.filter(h => h.lulus).length
console.log(`\n${lulus}/${hasil.length} lulus. Data uji sudah dibersihkan.`)
process.exit(lulus === hasil.length ? 0 : 1)
