/**
 * lib/dashboardWidgets.js
 * Pengaturan isi Dashboard. Widget disimpan di tabel dashboard_widgets (menu Admin "Kelola Dashboard").
 * Selama tabel kosong/belum ada, dipakai DEFAULT_WIDGETS di bawah (sama dengan tampilan bawaan sebelumnya).
 *
 * Bentuk widget:
 *   { tipe: 'kartu', judul, grup, gaya: 'berwarna'|'putih', ikon, warna, satuan: 'angka'|'rupiah', urutan, aktif,
 *     konfigurasi: { items: [{jd, field}], pembanding?: [{jd, field}], pembandingLabel?, sorot? } }
 *   { tipe: 'grafik', judul, grup, satuan, urutan, aktif,
 *     konfigurasi: { series: [{ label, warna, items: [{jd, field}] }] } }
 * `jd` = kunci jenis data (jenis_data.key), `field` = field_key. Nilai = jumlah seluruh baris rekap minggu terpilih.
 */
import { Users, Landmark, GraduationCap, Activity, BarChart3, Database, FileText, ClipboardList, Calendar, Clock } from 'lucide-react'

export const ICONS = { Users, Landmark, GraduationCap, Activity, BarChart3, Database, FileText, ClipboardList, Calendar, Clock }
export const ICON_NAMES = Object.keys(ICONS)

export const COLORS = [
  ['bg-blue-600', 'Biru'], ['bg-emerald-500', 'Hijau'], ['bg-amber-500', 'Kuning'], ['bg-rose-500', 'Merah'],
  ['bg-purple-600', 'Ungu'], ['bg-sky-500', 'Biru muda'], ['bg-slate-600', 'Abu-abu'],
]
export const CHART_COLORS = ['#1B5FA8', '#2F9E6E', '#94a3b8', '#0ea5e9', '#f59e0b', '#e11d48', '#7c3aed']

const JD_MASYARAKAT = 'masyarakat'
const JD_APARATUR = 'aparatur'
const JD_INSTRUKTUR = 'data_instruktur_dan_wi'
const JD_DANA = 'data_capaian_anggaran_per_sumber_dana'
const dana = f => [{ jd: JD_DANA, field: f }]

export const DEFAULT_WIDGETS = [
  { tipe: 'kartu', judul: 'Masyarakat Dilatih', grup: 'Progress & Status', gaya: 'berwarna', ikon: 'Users', warna: 'bg-blue-600', satuan: 'angka', konfigurasi: { items: [{ jd: JD_MASYARAKAT, field: 'jumlah_peserta' }] } },
  { tipe: 'kartu', judul: 'Aparatur Dilatih', grup: 'Progress & Status', gaya: 'berwarna', ikon: 'Landmark', warna: 'bg-emerald-500', satuan: 'angka', konfigurasi: { items: [{ jd: JD_APARATUR, field: 'jumlah_peserta' }] } },
  { tipe: 'kartu', judul: 'SDM Pelatih (Instruktur & Widyaiswara)', grup: 'Progress & Status', gaya: 'berwarna', ikon: 'GraduationCap', warna: 'bg-amber-500', satuan: 'angka', konfigurasi: { items: [{ jd: JD_INSTRUKTUR, field: 'jumlah_instruktur_wi' }] } },
  { tipe: 'kartu', judul: 'RM', grup: 'Realisasi Anggaran per Sumber Dana', gaya: 'putih', satuan: 'rupiah', konfigurasi: { items: dana('realisasi_rm'), pembanding: dana('pagu_rm'), pembandingLabel: 'Pagu' } },
  { tipe: 'kartu', judul: 'PNBP/BLU', grup: 'Realisasi Anggaran per Sumber Dana', gaya: 'putih', satuan: 'rupiah', konfigurasi: { items: dana('realisasi_pnbp_blu'), pembanding: dana('pagu_pnbp_blu'), pembandingLabel: 'Pagu' } },
  { tipe: 'kartu', judul: 'SBSN', grup: 'Realisasi Anggaran per Sumber Dana', gaya: 'putih', satuan: 'rupiah', konfigurasi: { items: dana('realisasi_sbsn'), pembanding: dana('pagu_sbsn'), pembandingLabel: 'Pagu' } },
  {
    tipe: 'kartu', judul: 'Total Realisasi Anggaran', grup: 'Realisasi Anggaran per Sumber Dana', gaya: 'putih', satuan: 'rupiah',
    konfigurasi: {
      sorot: true, pembandingLabel: 'Pagu',
      items: [...dana('realisasi_rm'), ...dana('realisasi_pnbp_blu'), ...dana('realisasi_sbsn')],
      pembanding: [...dana('pagu_rm'), ...dana('pagu_pnbp_blu'), ...dana('pagu_sbsn')],
    },
  },
  {
    tipe: 'grafik', judul: 'Peserta Dilatih', grup: 'Grafik', satuan: 'angka',
    konfigurasi: { series: [{ label: 'Masyarakat', warna: '#1B5FA8', items: [{ jd: JD_MASYARAKAT, field: 'jumlah_peserta' }] }, { label: 'Aparatur', warna: '#2F9E6E', items: [{ jd: JD_APARATUR, field: 'jumlah_peserta' }] }] },
  },
  {
    tipe: 'grafik', judul: 'Pagu vs Realisasi', grup: 'Grafik', satuan: 'rupiah',
    konfigurasi: {
      series: [
        { label: 'Pagu', warna: '#94a3b8', items: [...dana('pagu_rm'), ...dana('pagu_pnbp_blu'), ...dana('pagu_sbsn')] },
        { label: 'Realisasi', warna: '#0ea5e9', items: [...dana('realisasi_rm'), ...dana('realisasi_pnbp_blu'), ...dana('realisasi_sbsn')] },
      ],
    },
  },
].map((w, i) => ({ id: `bawaan-${i}`, urutan: (i + 1) * 10, aktif: true, ikon: null, warna: null, ...w }))

/** Widget aktif berurutan, dikelompokkan menurut `grup` (urutan grup = kemunculan pertama). */
export function groupWidgets(widgets) {
  const list = [...widgets].filter(w => w.aktif !== false).sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0))
  const groups = []
  for (const w of list) {
    let g = groups.find(x => x.nama === w.grup)
    if (!g) groups.push((g = { nama: w.grup, widgets: [] }))
    g.widgets.push(w)
  }
  return groups
}

/** Bentuk untuk disimpan ke database (tanpa id bawaan/kolom otomatis). */
export const toRow = w => ({
  tipe: w.tipe, judul: w.judul, grup: w.grup, gaya: w.gaya || 'berwarna', ikon: w.ikon || null, warna: w.warna || null,
  satuan: w.satuan || 'angka', konfigurasi: w.konfigurasi || {}, urutan: w.urutan ?? 0, aktif: w.aktif !== false,
})
