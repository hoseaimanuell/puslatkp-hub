/**
 * components/DataTable.jsx
 * Tabel Daily Activity — sengaja dibuat lebar untuk tampilan log kegiatan
 */
import { useState } from 'react'
import Badge from './Badge'
import { Eye, Edit, Trash2, Search } from 'lucide-react'

const STATUS_BADGE = {
  draft: 'draft',
  proses: 'warning',
  selesai: 'success',
}

const STATUS_LABEL = {
  draft: 'Draft',
  proses: 'Proses',
  selesai: 'Selesai',
}

const LINGKUP_LABEL = {
  internal_puslat: 'Internal Puslat',
  internal_kkp: 'Internal KKP',
  internal_eksternal: 'Internal & Eksternal',
  eksternal: 'Eksternal',
}

export default function DataTable({ data = [], onView, onEdit, onDelete, isAdmin }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('semua')

  const filtered = data.filter(row => {
    const matchSearch = !search ||
      row.uraian?.toLowerCase().includes(search.toLowerCase()) ||
      row.pic?.some(p => p.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = statusFilter === 'semua' || row.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari uraian atau PIC..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input pl-8 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="form-select text-sm w-auto"
        >
          <option value="semua">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="proses">Proses</option>
          <option value="selesai">Selesai</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 whitespace-nowrap">Tanggal</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Uraian Kegiatan</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 whitespace-nowrap">PIC</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 whitespace-nowrap">Lingkup</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                  Tidak ada data aktivitas
                </td>
              </tr>
            ) : filtered.map(row => (
              <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                <td className="px-4 py-3 text-gray-700 dark:text-gray-400 whitespace-nowrap font-mono text-xs">
                  {new Date(row.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-gray-900 dark:text-gray-100 max-w-xs">
                  <div className="line-clamp-2">{row.uraian || '-'}</div>
                  {row.hambatan && (
                    <span className="text-xs text-rose-500 font-medium">Ada hambatan</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  <div className="flex flex-wrap gap-1">
                    {(row.pic || []).slice(0, 2).map((p, i) => (
                      <span key={i} className="badge-neutral">{p}</span>
                    ))}
                    {(row.pic || []).length > 2 && (
                      <span className="badge-neutral">+{row.pic.length - 2}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {row.lingkup ? (
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      row.lingkup === 'internal_puslat' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' :
                      row.lingkup === 'internal_kkp' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' :
                      row.lingkup === 'internal_eksternal' ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400' :
                      'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                    }`}>
                      {LINGKUP_LABEL[row.lingkup] || row.lingkup}
                    </span>
                  ) : '-'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_BADGE[row.status] || 'neutral'}>
                    {STATUS_LABEL[row.status] || row.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {onView && (
                      <button
                        onClick={() => onView(row)}
                        className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                        title="Lihat detail"
                      >
                        <Eye size={14} />
                      </button>
                    )}
                    {onEdit && (
                      <button
                        onClick={() => onEdit(row)}
                        className="p-1.5 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                        title="Edit"
                      >
                        <Edit size={14} />
                      </button>
                    )}
                    {onDelete && (isAdmin) && (
                      <button
                        onClick={() => onDelete(row)}
                        className="p-1.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Hapus"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Menampilkan {filtered.length} dari {data.length} aktivitas
        </p>
      )}
    </div>
  )
}
