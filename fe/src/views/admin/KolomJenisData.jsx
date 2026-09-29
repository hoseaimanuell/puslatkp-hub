/**
 * views/admin/KolomJenisData.jsx
 * Bagian tampilan Kelola Jenis Data yang berdiri sendiri: pilihan jenis isian, preset opsi, judul bagian form,
 * dan kartu satu kolom (bisa diseret untuk mengurutkan).
 */
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AGREGASI_SHORT, agregasiOf } from '../../lib/agregasi'
import { PERAN_REKAP } from '../../lib/peranRekap'
import {
  Trash2, GripVertical, Eye, EyeOff, Edit,
  Hash, Type, AlignLeft, CalendarDays, ListChecks, Paperclip, Sigma, Lock
} from 'lucide-react'

export const TIPE_OPTIONS = [
  { value: 'angka', label: 'Angka', desc: 'Bilangan atau nilai Rupiah', icon: Hash },
  { value: 'teks', label: 'Teks singkat', desc: 'Nama, judul, satu baris', icon: Type },
  { value: 'teks_panjang', label: 'Teks panjang', desc: 'Narasi atau keterangan', icon: AlignLeft },
  { value: 'tanggal', label: 'Tanggal', desc: 'Dipilih dari kalender', icon: CalendarDays },
  { value: 'pilihan', label: 'Pilihan', desc: 'Dropdown dari daftar opsi', icon: ListChecks },
  { value: 'file', label: 'Berkas', desc: 'Unggah PDF/Word/Excel', icon: Paperclip },
]
export const TIPE_BY_VALUE = Object.fromEntries(TIPE_OPTIONS.map(t => [t.value, t]))

export function FormSection({ title, hint, children }) {
  return (
    <div>
      <p className="text-sm font-semibold text-[#0B1830]">{title}</p>
      <p className="text-xs text-gray-500 mt-0.5 mb-2">{hint}</p>
      {children}
    </div>
  )
}

export const QUICK_PRESETS = [
  { label: 'L/P', opsi: 'Laki-laki, Perempuan' },
  { label: 'Pendidikan', opsi: 'SD, SMP, SMA/SMK, D1, D2, D3, D4/S1, S2, S3' },
  { label: 'Metode Pelatihan', opsi: 'Luring, Blended, Full Online' },
  { label: 'Sumber Dana', opsi: 'RM, PNBP, BLU, SBSN' },
  { label: 'Status ASN', opsi: 'PNS, PPPK' },
  { label: 'E-Laut Bidang', opsi: 'Kepelautan, Penangkapan Ikan, Permesinan Kapal, Budidaya Perikanan, Pengolahan Hasil Perikanan, Konservasi Perairan' },
]

export function SortableField({ field, onToggle, onEdit, onDelete, tampilkanPeran }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
        field.aktif
          ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm'
          : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 opacity-60'
      }`}
    >
      <button {...attributes} {...listeners} className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing p-1">
        <GripVertical size={16} />
      </button>

      <div className="flex-1 min-w-0">
        {(() => {
          const tipe = TIPE_BY_VALUE[field.tipe]
          const TipeIcon = tipe?.icon || Type
          const peran = tampilkanPeran && field.peran_rekap ? PERAN_REKAP[field.peran_rekap] : null
          return (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-[#0B1830] dark:text-white">{field.label}</span>
                {field.wajib && <span className="text-[11px] font-semibold text-rose-600">Wajib diisi</span>}
                {!field.aktif && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">Disembunyikan dari form</span>}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  <TipeIcon size={11} /> {tipe?.label || field.tipe}
                </span>
                {peran && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700" title={peran.penjelasan}>
                    <Sigma size={11} /> Dihitung sebagai {peran.kolomRekap}
                  </span>
                )}
                {field.tipe === 'angka' && field.level === 'minggu' && (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-sky-50 text-sky-700" title="Cara menggabungkan angka mingguan menjadi bulanan/triwulan/tahunan">
                    Rekap: {AGREGASI_SHORT[agregasiOf(field)]}
                  </span>
                )}
                {field.is_identitas && (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700">
                    <Lock size={11} /> Data pribadi
                  </span>
                )}
                <span className="text-[10px] text-gray-400 font-mono" title="Kode kolom di database">kode: {field.field_key}</span>
              </div>
            </>
          )
        })()}
        {field.tipe === 'pilihan' && field.opsi_pilihan && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 truncate">
            Opsi: {field.opsi_pilihan.join(', ')}
          </p>
        )}
        {field.tipe === 'pilihan' && field.opsi_bersyarat && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 truncate">
            Opsi tergantung kolom "{field.opsi_bersyarat.depends_on}": {Object.entries(field.opsi_bersyarat.options || {}).map(([k, v]) => `${k} → ${(v || []).join('/')}`).join('; ')}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onEdit(field)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
          title="Edit kolom"
        >
          <Edit size={14} />
        </button>
        <button
          onClick={() => onToggle(field)}
          className={`p-1.5 rounded-lg transition-colors ${
            field.aktif
              ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
              : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title={field.aktif ? 'Sembunyikan kolom dari form (data lama tetap tersimpan)' : 'Tampilkan lagi kolom di form'}
        >
          {field.aktif ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          onClick={() => onDelete(field)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          title="Hapus kolom"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
