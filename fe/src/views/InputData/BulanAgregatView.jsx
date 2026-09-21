/**
 * views/InputData/BulanAgregatView.jsx
 * Tampilan data bulanan yang dihitung otomatis dari gabungan Minggu 1–4.
 * Read-only — data diambil dari rekap_nilai pasangan mingguan.
 */
import { useState, useEffect } from 'react'
import { db } from '../../lib/db'
import { weekValues, applyAgregasi, agregasiOf } from '../../lib/agregasi'
import {
  formatPeriodLabel,
  weeksOfMonth,
} from '../../lib/periods'
import { exportAgregasiBreakdown } from '../../lib/excelExport'
import {
  Calculator, Download, Loader2, TrendingUp, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronRight
} from 'lucide-react'

export default function BulanAgregatView({
  jenisData,
  partnerJd,
  activePeriod,
  allPeriods,
  currentUptKey,
  currentUptLabel,
}) {
  const [fieldDefs, setFieldDefs] = useState([])
  const [weekRows, setWeekRows] = useState([])
  const [totals, setTotals] = useState({})
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const partnerId = partnerJd?.id || jenisData.pasangan_mingguan_id

  useEffect(() => {
    if (partnerId) loadFieldDefs()
  }, [partnerId])

  useEffect(() => {
    if (fieldDefs.length > 0 && activePeriod && currentUptKey) loadData()
  }, [fieldDefs.length, activePeriod?.id, currentUptKey])

  async function loadFieldDefs() {
    const { data } = await db
      .from('field_definitions')
      .select('*')
      .eq('jenis_data_id', partnerId)
      .eq('level', 'minggu')
      .eq('aktif', true)
      .order('urutan')
    setFieldDefs(data || [])
  }

  async function loadData() {
    if (!activePeriod || !currentUptKey || !partnerId) return
    setLoading(true)

    const weeks = weeksOfMonth(allPeriods, activePeriod.tahun, activePeriod.bulan)

    if (!weeks.length) {
      setWeekRows([])
      setTotals({})
      setLoading(false)
      return
    }

    const weekIds = weeks.map(w => w.id)
    const { data: rekapRows } = await db
      .from('rekap_nilai')
      .select('*')
      .eq('jenis_data_id', partnerId)
      .eq('upt_key', currentUptKey)
      .in('period_id', weekIds)

    const rows = rekapRows || []

    const builtRows = weeks.map(w => {
      const vals = weekValues(rows.filter(r => r.period_id === w.id))
      return { period: w, values: vals, hasData: Object.keys(vals).length > 0 }
    })

    const angkaFields = fieldDefs.filter(f => f.tipe === 'angka')
    const builtTotals = {}
    angkaFields.forEach(f => {
      builtTotals[f.field_key] = applyAgregasi(builtRows.map(br => br.values[f.field_key]), agregasiOf(f)) ?? 0
    })

    setWeekRows(builtRows)
    setTotals(builtTotals)
    setLoading(false)
  }

  const angkaFields = fieldDefs.filter(f => f.tipe === 'angka')
  const teksFields = fieldDefs.filter(f => f.tipe !== 'angka')

  const isRupiah = (key) =>
    key.includes('anggaran') || key.includes('belanja') ||
    key.includes('rm') || key.includes('pnbp') || key.includes('sbsn')

  const formatVal = (field, val) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-gray-300 dark:text-gray-600">—</span>
    }
    if (field.tipe === 'angka') {
      return isRupiah(field.field_key)
        ? `Rp ${Number(val).toLocaleString('id-ID')}`
        : Number(val).toLocaleString('id-ID')
    }
    return String(val)
  }

  const filledWeeks = weekRows.filter(r => r.hasData).length

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="card p-5 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                <Calculator size={16} />
              </span>
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                {jenisData.judul}
              </h3>
              <span className="badge-neutral text-[10px] uppercase">Rekap Bulanan</span>
              {currentUptLabel && (
                <span className="badge-blue text-[10px]">{currentUptLabel}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Dihitung otomatis dari data mingguan <strong>{partnerJd?.judul || 'pasangan'}</strong> — {formatPeriodLabel(activePeriod)}
            </p>
          </div>
          <button
            onClick={() => exportAgregasiBreakdown({
              jenisDataJudul: jenisData.judul,
              periodLabel: formatPeriodLabel(activePeriod),
              uptKey: currentUptKey,
              fieldDefs,
              totals,
              weekRows,
            })}
            className="btn-primary text-xs py-2 px-3"
          >
            <Download size={14} />
            Download Excel Bulanan
          </button>
        </div>

        {/* Status kelengkapan */}
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
          filledWeeks >= 4
            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
        }`}>
          {filledWeeks >= 4
            ? <CheckCircle2 size={14} />
            : <AlertTriangle size={14} />
          }
          <span>
            {filledWeeks >= 4
              ? `Semua 4 minggu sudah terisi — total akumulasi bulan ini tersedia`
              : `Baru ${filledWeeks} dari 4 minggu terisi — lengkapi data mingguan untuk rekap penuh`
            }
          </span>
        </div>
      </div>

      {/* Summary Total Cards */}
      {angkaFields.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 px-1">
            Total Akumulasi {formatPeriodLabel(activePeriod)}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {angkaFields.map(field => {
              const val = totals[field.field_key] ?? 0
              return (
                <div
                  key={field.field_key}
                  className="card p-4 border border-gray-100 dark:border-gray-800 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/60 dark:to-gray-900 shadow-sm"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">{field.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {isRupiah(field.field_key)
                      ? `Rp ${Number(val).toLocaleString('id-ID')}`
                      : Number(val).toLocaleString('id-ID')
                    }
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">dari 4 minggu</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Breakdown Per Minggu */}
      <div className="card shadow-sm border border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-500" />
            <span className="font-semibold text-sm text-gray-900 dark:text-white">
              Rincian Per Minggu
            </span>
          </div>
          {expanded
            ? <ChevronDown size={16} className="text-gray-400" />
            : <ChevronRight size={16} className="text-gray-400" />
          }
        </button>

        {expanded && (
          loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : weekRows.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-gray-500">
              <Calculator size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada data mingguan untuk bulan ini.</p>
              <p className="text-xs mt-1">
                Isi data pada jenis data <strong>{partnerJd?.judul}</strong> terlebih dahulu.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      Periode
                    </th>
                    {angkaFields.map(f => (
                      <th key={f.field_key} className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                    {teksFields.map(f => (
                      <th key={f.field_key} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {weekRows.map(row => (
                    <tr
                      key={row.period.id}
                      className={`transition-colors ${
                        row.hasData
                          ? 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                          : 'opacity-50'
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            row.hasData ? 'bg-emerald-400' : 'bg-gray-300 dark:bg-gray-600'
                          }`} />
                          {formatPeriodLabel(row.period)}
                        </div>
                      </td>
                      {angkaFields.map(f => (
                        <td key={f.field_key} className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                          {formatVal(f, row.values[f.field_key])}
                        </td>
                      ))}
                      {teksFields.map(f => (
                        <td key={f.field_key} className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                          {formatVal(f, row.values[f.field_key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {angkaFields.length > 0 && (
                  <tfoot>
                    <tr className="bg-blue-50 dark:bg-blue-950/30 border-t-2 border-blue-200 dark:border-blue-800">
                      <td className="px-4 py-3 font-bold text-blue-800 dark:text-blue-300 text-sm uppercase tracking-wide">
                        Total Bulan
                      </td>
                      {angkaFields.map(f => (
                        <td key={f.field_key} className="px-4 py-3 text-right font-bold text-blue-800 dark:text-blue-300 font-mono">
                          {isRupiah(f.field_key)
                            ? `Rp ${Number(totals[f.field_key] ?? 0).toLocaleString('id-ID')}`
                            : Number(totals[f.field_key] ?? 0).toLocaleString('id-ID')
                          }
                        </td>
                      ))}
                      {teksFields.map(f => (
                        <td key={f.field_key} className="px-4 py-3" />
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
