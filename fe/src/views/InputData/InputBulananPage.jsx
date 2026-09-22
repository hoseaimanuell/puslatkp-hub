/**
 * views/InputData/InputBulananPage.jsx
 * Halaman "Input Bulanan": tabel rekap bulanan (akumulasi 4 minggu / data by name unggahan UPT)
 * + tombol "+ Input Bulanan" yang membuka popup form input/upload. Sama polanya dengan Input Mingguan.
 * Hanya Jenis Data bulanan yang tampil. Akun UPT hanya melihat data UPT-nya sendiri.
 */
import { useState } from 'react'
import Modal from '../../components/Modal'
import PilihJenisData from './PilihJenisData'
import RekapBulanan from '../RekapBulanan'
import { Plus } from 'lucide-react'

export default function InputBulananPage() {
  const [modalOpen, setModalOpen] = useState(false)
  // Berubah setiap popup ditutup (baik karena disimpan maupun ditutup manual)
  // supaya RekapBulanan remount dan menarik data terbaru dari database.
  const [refreshKey, setRefreshKey] = useState(0)

  function closeAndRefresh() {
    setModalOpen(false)
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-2xl font-display text-gray-900 dark:text-white">Input Bulanan</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Rekap data bulanan (akumulasi 4 minggu, atau data by name yang diunggah UPT) berdasarkan periode yang dipilih.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="btn-primary text-sm"
        >
          <Plus size={16} />
          Input Bulanan
        </button>
      </div>

      <RekapBulanan key={refreshKey} />

      <Modal
        open={modalOpen}
        onClose={closeAndRefresh}
        title="Input Bulanan"
        maxWidth="max-w-5xl"
      >
        <PilihJenisData tipe="bulanan" onSaved={closeAndRefresh} />
      </Modal>
    </div>
  )
}
