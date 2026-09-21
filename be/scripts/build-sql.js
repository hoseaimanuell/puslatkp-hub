/**
 * Membangun berkas SQL siap-impor phpMyAdmin:
 *   database/puslatkp1a.sql              -> skema + data master + akun awal
 *   database/puslatkp1a_contoh_data.sql  -> data contoh (opsional)
 * Jalankan: npm run db:build
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import mysql from 'mysql2'
import bcrypt from 'bcryptjs'
import { uid, periodId } from '../src/lib/ids.js'
import { generatePeriods } from '../src/lib/periods.js'
import * as seed from './seed-data.js'
import { EXTRA_ENTRIES, EXTRA_REKAP } from './seed-sample-extra.js'
import { generate500Entries, generate500RekapNilai } from './sample-generator.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(here, '../../database')
mkdirSync(outDir, { recursive: true })

// ---------- helper SQL ----------
const esc = v => {
  if (v === undefined || v === null) return 'NULL'
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (typeof v === 'object') return mysql.escape(JSON.stringify(v))
  return mysql.escape(v)
}

const dt = iso => (iso ? new Date(iso).toISOString().slice(0, 19).replace('T', ' ') : null)

function insert(table, cols, rows, { mode = 'ignore', update = [] } = {}) {
  const out = []
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const head = `INSERT ${mode === 'ignore' ? 'IGNORE ' : ''}INTO \`${table}\` (${cols.map(c => `\`${c}\``).join(', ')}) VALUES\n`
    const body = chunk.map(r => '  (' + cols.map(c => esc(r[c])).join(', ') + ')').join(',\n')
    const tail = mode === 'update' ? `\nON DUPLICATE KEY UPDATE ${update.map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ')}` : ''
    out.push(head + body + tail + ';')
  }
  return out.join('\n\n') + '\n'
}

const section = title => `\n-- ==========================================================\n-- ${title}\n-- ==========================================================\n`

// Peta ID mode demo lama (p-m-9, p-w-9-1, ...) -> ID periode deterministik.
function mapPeriod(oldId) {
  let m
  if ((m = /^p-yr-(\d+)$/.exec(oldId))) return periodId({ level: 'tahun', tahun: +m[1] })
  if ((m = /^p-q-(\d)$/.exec(oldId))) return periodId({ level: 'triwulan', tahun: 2026, triwulan_ke: +m[1] })
  if ((m = /^p-m-(\d+)$/.exec(oldId))) return periodId({ level: 'bulan', tahun: 2026, triwulan_ke: Math.ceil(+m[1] / 3), bulan: +m[1] })
  if ((m = /^p-w-(\d+)-(\d)$/.exec(oldId))) return periodId({ level: 'minggu', tahun: 2026, triwulan_ke: Math.ceil(+m[1] / 3), bulan: +m[1], minggu_ke: +m[2] })
  throw new Error('ID periode tidak dikenal: ' + oldId)
}

// ---------- 1. SKEMA + DATA MASTER ----------
const ddl = readFileSync(path.join(here, 'ddl.sql'), 'utf8')
let master = ddl

master += section('DATA MASTER — UPT')
master += insert('upt_list', ['key', 'label', 'aktif'], seed.DEFAULT_UPTS, { mode: 'update', update: ['label', 'aktif'] })

// Akun alias lama ('admin'/'upt' berpassword lemah) sengaja TIDAK dimasukkan.
const users = seed.DEFAULT_PROFILES.filter(p => !/@kp\.go\.id$/.test(p.email)).map(p => ({
  id: uid(p.id),
  email: p.email.toLowerCase(),
  password_hash: bcrypt.hashSync(p.password, 10),
  role: p.role,
  upt_key: p.upt_key,
  nama_lengkap: p.nama_lengkap,
  created_at: dt(p.created_at),
}))
master += section('AKUN AWAL (password di-hash bcrypt; lihat docs/05-akun-dan-keamanan.md)')
master += insert('profiles', ['id', 'email', 'password_hash', 'role', 'upt_key', 'nama_lengkap', 'created_at'], users)

// Jenis data mingguan bertipe daftar pelatihan: boleh lebih dari 1 baris per minggu
const MULTI_BARIS = new Set(['masyarakat', 'aparatur', 'data_belanja_modal'])

// Pagu/realisasi/jumlah SDM bersifat KUMULATIF (stok) -> rekap memakai nilai terakhir, bukan dijumlahkan
const agregasiDefault = f =>
  f.level === 'minggu' && f.tipe === 'angka' &&
  (/^(pagu|realisasi)/.test(f.field_key) || ['jumlah_instruktur_wi', 'instruktur_berdasarkan_keahlian', 'widyaiswara_berdasarkan_keahlian', 'volume'].includes(f.field_key))
    ? 'last'
    : 'sum'

const jenisData = [...seed.DEFAULT_JENIS_DATA]
  .sort((a, b) => (a.pasangan_mingguan_id ? 1 : 0) - (b.pasangan_mingguan_id ? 1 : 0)) // induk dulu, agar FK terpenuhi
  .map(j => ({ ...j, mode_bulanan: j.mode_bulanan ?? null, multi_baris: MULTI_BARIS.has(j.key) }))
master += section('DATA MASTER — 9 JENIS DATA')
master += insert('jenis_data',
  ['id', 'key', 'judul', 'deskripsi', 'level_utama', 'mode_bulanan', 'butuh_input_bulanan', 'pasangan_mingguan_id', 'publik_boleh_lihat', 'multi_baris', 'aktif'],
  jenisData)

const fields = seed.DEFAULT_FIELDS.map(f => ({
  ...f,
  id: uid(f.id),
  opsi_pilihan: f.opsi_pilihan ?? null,
  wajib: !!f.wajib,
  is_identitas: !!f.is_identitas,
  agregasi: agregasiDefault(f),
}))
master += section('DATA MASTER — DEFINISI KOLOM (FORM BUILDER)')
master += insert('field_definitions',
  ['id', 'jenis_data_id', 'level', 'field_key', 'label', 'tipe', 'opsi_pilihan', 'agregasi', 'wajib', 'is_identitas', 'urutan', 'aktif'],
  fields)

const periods = generatePeriods(2026, { idFor: periodId })
master += section('DATA MASTER — PERIODE 2026 (1 tahun + 4 triwulan + 12 bulan + 48 minggu)')
master += insert('periods',
  ['id', 'level', 'tahun', 'triwulan_ke', 'bulan', 'minggu_ke', 'tanggal_mulai', 'tanggal_selesai', 'deadline', 'label'],
  periods, { mode: 'update', update: ['tanggal_mulai', 'tanggal_selesai', 'deadline', 'label'] })

writeFileSync(path.join(outDir, 'puslatkp1a.sql'), master)

// ---------- 2. DATA CONTOH ----------
const conv = (r, extra = {}) => ({ ...r, id: uid(r.id), period_id: r.period_id ? mapPeriod(r.period_id) : undefined, ...extra })

const entries = [...generate500Entries(), ...EXTRA_ENTRIES].map(e => conv(e, { created_at: dt(e.created_at) }))
const rekap = [...generate500RekapNilai(), ...EXTRA_REKAP].map(r => conv(r, { value: r.value ?? null, value_text: r.value_text ?? null }))
const daily = seed.DEFAULT_ACTIVITIES.map(a => ({ ...a, id: uid(a.id), hambatan: !!a.hambatan }))

let sample = `-- Data contoh (500 baris Data Masyarakat + rekap mingguan September 2026 + 2 daily activity).\n-- Import SETELAH puslatkp1a.sql. Opsional: hanya untuk demo/uji coba.\nUSE \`Puslatkp1a\`;\nSET NAMES utf8mb4;\n`
sample += section('DAILY ACTIVITY CONTOH')
sample += insert('daily_activity', ['id', 'upt_key', 'tanggal', 'status', 'uraian', 'pic', 'lingkup', 'output', 'hambatan', 'interaksi', 'feedback'], daily)
sample += section('DATA ENTRIES CONTOH')
sample += insert('data_entries', ['id', 'jenis_data_id', 'upt_key', 'period_id', 'nama', 'nik', 'data_json', 'data_ekstra', 'created_at'], entries)
sample += section('REKAP NILAI CONTOH')
sample += insert('rekap_nilai', ['id', 'jenis_data_id', 'upt_key', 'period_id', 'field_key', 'value', 'value_text'], rekap)

writeFileSync(path.join(outDir, 'puslatkp1a_contoh_data.sql'), sample)

console.log(`OK -> ${path.join(outDir, 'puslatkp1a.sql')}`)
console.log(`OK -> ${path.join(outDir, 'puslatkp1a_contoh_data.sql')}`)
console.log(`   akun: ${users.length}, jenis data: ${jenisData.length}, kolom: ${fields.length}, periode: ${periods.length}, entries contoh: ${entries.length}, rekap contoh: ${rekap.length}`)
