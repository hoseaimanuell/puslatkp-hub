/**
 * views/InputData/PilihJenisData.jsx
 * Dropdown pemilih 9 Jenis Data dengan penanda visual pasangan
 */
import { useState, useEffect } from 'react'
import { db } from '../../lib/db'
import PeriodeTabs, { isBulananJenisData } from './PeriodeTabs'
import { Database, ChevronDown, Loader2, Link2, ExternalLink, Calendar, Users } from 'lucide-react'

const MODE_BULANAN_LABEL = {
  rincian: 'Per nama (form / Excel)',
  upload_file: 'Unggah berkas (lama)',
  agregasi: 'Rekap angka saja (dari mingguan)',
}

export default function PilihJenisData({ onSaved, tipe = 'mingguan' } = {}) {
  const isBulanan = tipe === 'bulanan'
  const [jenisDataList, setJenisDataList] = useState([]) // sudah difilter sesuai tipe (mingguan / bulanan)
  const [allJenisData, setAllJenisData] = useState([]) // semua, untuk mencari pasangan
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadJenisData()
  }, [])

  async function loadJenisData() {
    setLoading(true)
    const { data } = await db
      .from('jenis_data')
      .select('*')
      .eq('aktif', true)
      .order('created_at')
    const all = data || []
    const list = all.filter(j => isBulananJenisData(j) === isBulanan)
    setAllJenisData(all)
    setJenisDataList(list)
    if (list.length > 0 && !selected) {
      setSelected(list[0])
    }
    setLoading(false)
  }

  // Cari jenis data pasangan
  function getPartner(jd) {
    if (!jd) return null
    if (jd.level_utama === 'bulan' && jd.pasangan_mingguan_id) {
      return allJenisData.find(j => j.id === jd.pasangan_mingguan_id) || null
    }
    if (jd.level_utama === 'minggu') {
      return allJenisData.find(j => j.pasangan_mingguan_id === jd.id) || null
    }
    return null
  }

  const partnerJd = getPartner(selected)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        Memuat jenis data...
      </div>
    )
  }

  if (jenisDataList.length === 0) {
    return (
      <div className="text-center py-16">
        <Database size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
        <h3 className="font-semibold text-gray-600 dark:text-gray-400 mb-1">Belum ada Jenis Data {isBulanan ? 'Bulanan' : 'Mingguan'}</h3>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Admin belum membuat Jenis Data. Hubungi administrator.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Jenis Data Selector */}
      <div
        className="card p-5"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-gray-500 dark:text-gray-400 text-sm font-medium whitespace-nowrap">Pilih Jenis Data {isBulanan ? 'Bulanan' : 'Mingguan'} ({jenisDataList.length} Data):</label>
          <div className="relative flex-1 min-w-[280px] max-w-md">
            <select
              value={selected?.id || ''}
              onChange={e => {
                const jd = jenisDataList.find(j => j.id === e.target.value)
                setSelected(jd || null)
              }}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-blue-400 pr-9"
            >
              {jenisDataList.map((jd, idx) => {
                const isBulan = isBulananJenisData(jd)
                const modeLabel = isBulan
                  ? `Bulan — ${MODE_BULANAN_LABEL[jd.mode_bulanan] || MODE_BULANAN_LABEL.rincian}`
                  : 'Minggu'
                return (
                  <option key={jd.id} value={jd.id} className="text-gray-900 bg-white">
                    {idx + 1}. {jd.judul} ({modeLabel})
                  </option>
                )
              })}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Visual Partner Indicator */}
        {partnerJd && (
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-300">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/30 text-blue-600 dark:text-blue-300">
                <Link2 size={12} />
              </span>
              <span>
                Terkait dengan pasangan: <strong className="text-gray-900 dark:text-white underline decoration-blue-400 underline-offset-2">{partnerJd.judul}</strong> ({partnerJd.level_utama === 'bulan' ? 'diisi di menu Input Bulanan' : 'diisi di menu Input Mingguan'})
              </span>
            </div>
          </div>
        )}

        {selected?.deskripsi && (
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-3 max-w-2xl leading-relaxed">{selected.deskripsi}</p>
        )}
      </div>

      {/* Period Tabs for selected Jenis Data */}
      {selected && (
        <PeriodeTabs key={selected.id} jenisData={selected} allJenisData={jenisDataList} onSaved={onSaved} />
      )}
    </div>
  )
}
