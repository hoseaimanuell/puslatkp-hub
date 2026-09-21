/**
 * views/admin/RekapEksporSemuaUPT.jsx
 * Admin: Rekap & Ekspor Gabungan Semua UPT (Multi-Sheet Excel)
 * Adaptif terhadap 9 Jenis Data (Level Utama Minggu / Bulan)
 */
import { useState, useEffect } from 'react'
import { db } from '../../lib/db'
import InfoCard from '../../components/InfoCard'
import Badge from '../../components/Badge'
import { exportGabunganSemuaUPT } from '../../lib/excelExport'
import { formatPeriodLabel } from '../../lib/periods'
import AdminPeriodRecap from '../../components/AdminPeriodRecap'
import {
  Download, FileSpreadsheet, Loader2, Filter,
  CheckCircle2, AlertTriangle, Building2, Calendar, Link2
} from 'lucide-react'

export default function RekapEksporSemuaUPT() {
  const [jenisDataList, setJenisDataList] = useState([])
  const [selectedJdId, setSelectedJdId] = useState('')
  const [uptList, setUptList] = useState([])
  const [tahun, setTahun] = useState(2026)
  const [rekapStatus, setRekapStatus] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (selectedJdId) {
      loadRekapSummary()
    }
  }, [selectedJdId, tahun])

  async function loadInitialData() {
    setLoading(true)
    const [{ data: jds }, { data: upts }] = await Promise.all([
      db.from('jenis_data').select('*').eq('aktif', true).order('created_at'),
      db.from('upt_list').select('*').eq('aktif', true).order('label'),
    ])
    const allJds = jds || []
    setJenisDataList(allJds)
    setUptList(upts || [])
    if (allJds.length > 0) {
      setSelectedJdId(allJds[0].id)
    }
    setLoading(false)
  }

  async function loadRekapSummary() {
    setLoading(true)
    const selectedJd = jenisDataList.find(j => j.id === selectedJdId)
    if (!selectedJd) {
      setLoading(false)
      return
    }

    // Ambil periods tahun terpilih
    const { data: periods } = await db
      .from('periods')
      .select('id, level, bulan, label')
      .eq('tahun', tahun)

    const periodIds = (periods || []).map(p => p.id)

    const [{ data: entries }, { data: rekaps }] = await Promise.all([
      db
        .from('data_entries')
        .select('id, upt_key, period_id')
        .eq('jenis_data_id', selectedJdId)
        .in('period_id', periodIds),
      db
        .from('rekap_nilai')
        .select('id, upt_key, period_id, value, value_text')
        .eq('jenis_data_id', selectedJdId)
        .in('period_id', periodIds),
    ])

    const allEntries = entries || []
    const allRekaps = rekaps || []

    const summary = uptList.map(upt => {
      const uptEntries = allEntries.filter(e => e.upt_key === upt.key)
      const uptRekaps = allRekaps.filter(r => r.upt_key === upt.key)
      const totalNilaiRekap = uptRekaps.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)
      const filledWeeksCount = new Set(uptRekaps.map(r => r.period_id)).size

      const isMengisi = selectedJd.level_utama === 'bulan'
        ? uptEntries.length > 0
        : filledWeeksCount > 0

      return {
        upt_key: upt.key,
        upt_label: upt.label,
        total_entri_bulan: uptEntries.length,
        filled_weeks: filledWeeksCount,
        total_nilai_rekap: totalNilaiRekap,
        status: isMengisi ? 'Mengisi' : 'Belum Ada Data',
      }
    })

    setRekapStatus(summary)
    setLoading(false)
  }

  async function handleExportGabungan() {
    const selectedJd = jenisDataList.find(j => j.id === selectedJdId)
    if (!selectedJd) return
    setExporting(true)

    try {
      // 1. Ambil periods tahun terpilih
      const { data: periodsData } = await db
        .from('periods')
        .select('*')
        .eq('tahun', tahun)
      const periodsMap = {}
      ;(periodsData || []).forEach(p => { periodsMap[p.id] = p })
      const periodIds = Object.keys(periodsMap)

      // 2. Ambil data entries level bulan
      const { data: rawEntries } = await db
        .from('data_entries')
        .select('*')
        .eq('jenis_data_id', selectedJdId)
        .in('period_id', periodIds)

      // 3. Ambil rekap_nilai
      const { data: rawRekap } = await db
        .from('rekap_nilai')
        .select('*')
        .eq('jenis_data_id', selectedJdId)
        .in('period_id', periodIds)

      // 4. Pisahkan rekap per level
      const tahunRows = []
      const triwulanRows = []
      const mingguRows = []

      ;(rawRekap || []).forEach(r => {
        const p = periodsMap[r.period_id]
        if (!p) return
        const row = {
          UPT: r.upt_key,
          Periode: formatPeriodLabel(p),
          Field: r.field_key,
          Nilai: r.value !== null ? r.value : r.value_text,
          Diupdate: r.updated_at ? new Date(r.updated_at).toLocaleDateString('id-ID') : '',
          _tahun: p.tahun || 0,
          _bulan: p.bulan || 0,
          _minggu: p.minggu_ke || 0,
        }
        if (p.level === 'tahun') tahunRows.push(row)
        else if (p.level === 'triwulan') triwulanRows.push(row)
        else if (p.level === 'minggu') mingguRows.push(row)
      })

      mingguRows.sort((a, b) => a._tahun - b._tahun || a._bulan - b._bulan || a._minggu - b._minggu)
      mingguRows.forEach(r => { delete r._tahun; delete r._bulan; delete r._minggu })
      tahunRows.forEach(r => { delete r._tahun; delete r._bulan; delete r._minggu })
      triwulanRows.forEach(r => { delete r._tahun; delete r._bulan; delete r._minggu })

      // Bulan rows
      const bulanRows = (rawEntries || []).map(e => {
        const p = periodsMap[e.period_id]
        return {
          UPT: e.upt_key,
          Periode: p ? formatPeriodLabel(p) : '',
          Nama: e.nama || '',
          NIK: e.nik || '',
          ...(e.data_json || {}),
        }
      })

      // Sheet Validasi (khusus jika ada pasangan mingguan)
      let validasiRows = []
      if (selectedJd.pasangan_mingguan_id) {
        // Ambil rekap dari pasangan mingguan
        const { data: partnerRekap } = await db
          .from('rekap_nilai')
          .select('*')
          .eq('jenis_data_id', selectedJd.pasangan_mingguan_id)
          .in('period_id', periodIds)

        validasiRows = uptList.map(upt => {
          const countBulan = (rawEntries || []).filter(e => e.upt_key === upt.key).length
          const countMinggu = (partnerRekap || [])
            .filter(r => r.upt_key === upt.key && periodsMap[r.period_id]?.level === 'minggu' && (r.field_key.includes('jumlah') || r.field_key === 'jumlah_peserta'))
            .reduce((acc, c) => acc + (Number(c.value) || 0), 0)

          return {
            UPT: upt.label,
            'Total Baris Rincian Bulan': countBulan,
            'Total Mingguan Pasangan': countMinggu,
            Selisih: countBulan - countMinggu,
            Status: countBulan === countMinggu ? '✓ Sesuai' : '⚠ Ada Selisih',
          }
        })
      }

      // Sheet Kolom Belum Dikenal
      const kolomTidakDikenal = []
      ;(rawEntries || []).forEach(e => {
        if (e.data_ekstra && Object.keys(e.data_ekstra).length > 0) {
          kolomTidakDikenal.push({
            UPT: e.upt_key,
            Periode: periodsMap[e.period_id] ? formatPeriodLabel(periodsMap[e.period_id]) : '',
            Nama: e.nama || '',
            DataEkstra: JSON.stringify(e.data_ekstra),
          })
        }
      })

      // Jalankan export multi-sheet
      exportGabunganSemuaUPT({
        data: {
          tahun: tahunRows,
          triwulan: triwulanRows,
          bulan: bulanRows,
          minggu: mingguRows,
          validasi: validasiRows,
          kolomTidakDikenal,
        },
        jenisDataJudul: selectedJd.judul,
        tahun,
      })
    } catch (err) {
      alert('Gagal mengekspor file: ' + err.message)
    }

    setExporting(false)
  }

  const selectedJd = jenisDataList.find(j => j.id === selectedJdId)
  const isMonth = selectedJd?.level_utama === 'bulan'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div
        className="rounded-2xl px-6 py-5 text-white shadow-xl"
        style={{ background: 'var(--color-brand-blue)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-300 mb-1">Administrasi & Rekap</p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-2xl font-display">Rekap & Ekspor Semua UPT</h1>
            <p className="text-white/60 text-xs mt-1 max-w-xl">
              Unduh kompilasi data 10 UPT dalam satu file Excel multi-sheet untuk <strong>{selectedJd?.judul || ''}</strong>.
            </p>
          </div>
          <button
            onClick={handleExportGabungan}
            disabled={exporting || !selectedJdId}
            className="btn-primary whitespace-nowrap self-start sm:self-auto"
          >
            {exporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Mengekspor...
              </>
            ) : (
              <>
                <FileSpreadsheet size={16} />
                Download Excel Gabungan
              </>
            )}
          </button>
        </div>
      </div>

      <AdminPeriodRecap compact />
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <span className="text-xs font-semibold uppercase text-gray-500">Filter Data:</span>
        </div>

        <div className="flex-1 min-w-[240px] max-w-md">
          <select
            value={selectedJdId}
            onChange={e => setSelectedJdId(e.target.value)}
            className="form-select text-sm w-full font-medium"
          >
            {jenisDataList.map((jd, idx) => (
              <option key={jd.id} value={jd.id}>
                {idx + 1}. {jd.judul} ({jd.level_utama === 'bulan' ? 'Bulan - Rincian' : 'Minggu'})
              </option>
            ))}
          </select>
        </div>

        <div className="w-36">
          <select
            value={tahun}
            onChange={e => setTahun(Number(e.target.value))}
            className="form-select text-sm w-full font-medium"
          >
            <option value={2026}>Tahun 2026</option>
            <option value={2025}>Tahun 2025</option>
          </select>
        </div>
      </div>

      {/* Summary Table */}
      <InfoCard
        title={`Status Pengisian Seluruh UPT: ${selectedJd?.judul || ''} (${tahun})`}
        subtitle={isMonth ? 'Menampilkan jumlah baris rincian data per-orang yang telah diinput UPT' : 'Menampilkan jumlah minggu terisi dan total akumulasi nilai per UPT'}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-gray-400" />
          </div>
        ) : rekapStatus.length === 0 ? (
          <p className="text-center py-8 text-sm text-gray-400">Tidak ada data UPT aktif.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500">UPT</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {isMonth ? 'Total Baris Rincian' : 'Minggu Terisi'}
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {isMonth ? 'Status Data' : 'Total Nilai Rekap'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rekapStatus.map(item => (
                  <tr key={item.upt_key} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <Building2 size={15} className="text-blue-500 flex-shrink-0" />
                        <span>{item.upt_label}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={item.status === 'Mengisi' ? 'success' : 'neutral'}>
                        {item.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-gray-800 dark:text-gray-200">
                      {isMonth
                        ? `${item.total_entri_bulan.toLocaleString('id-ID')} baris`
                        : `${item.filled_weeks} minggu`
                      }
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-gray-800 dark:text-gray-200">
                      {isMonth
                        ? (item.total_entri_bulan > 0 ? '✓ Aktif mengisi' : 'Belum isi')
                        : item.total_nilai_rekap.toLocaleString('id-ID')
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </InfoCard>
    </div>
  )
}
