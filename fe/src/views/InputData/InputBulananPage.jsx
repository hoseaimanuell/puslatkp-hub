/**
 * views/InputData/InputBulananPage.jsx
 * Halaman "Input Bulanan": dua tab
 *  - Input Bulanan : pilih Jenis Data bulanan (rincian nama / unggah berkas) lalu input/upload
 *  - Rekap Bulanan : akumulasi 4 minggu & data by name (dipindahkan dari menu Rekap Bulanan)
 * Akun UPT hanya melihat data UPT-nya sendiri.
 */
import { useState } from 'react'
import PilihJenisData from './PilihJenisData'
import RekapBulanan from '../RekapBulanan'
import { Database, Layers } from 'lucide-react'

const TABS = [
  ['input', Database, 'Input Bulanan'],
  ['rekap', Layers, 'Rekap Bulanan'],
]

export default function InputBulananPage() {
  const [tab, setTab] = useState('input')

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-bold text-2xl font-display text-gray-900 dark:text-white">Input Bulanan</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Input data bulanan dan rekap bulanan (akumulasi data mingguan) dalam satu tempat.
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-3">
        {TABS.map(([key, Icon, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${
              tab === key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {tab === 'input' ? <PilihJenisData tipe="bulanan" /> : <RekapBulanan />}
    </div>
  )
}
