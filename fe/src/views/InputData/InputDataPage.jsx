/**
 * views/InputData/InputDataPage.jsx
 * Halaman "Input Mingguan": tabel rekap mingguan (filter tahun/triwulan/bulan/minggu/jenis data,
 * dan UPT khusus Admin) + tombol "+ Input Mingguan" yang membuka popup form input.
 * Hanya Jenis Data mingguan yang tampil. Akun UPT hanya melihat data UPT-nya sendiri.
 * Rekap triwulan & tahun otomatis dijumlahkan dari data mingguan (tidak ada input/upload).
 */
import { useState } from 'react'
import { useAuth } from '../../AuthContext'
import AdminPeriodRecap from '../../components/AdminPeriodRecap'
import Modal from '../../components/Modal'
import PilihJenisData from './PilihJenisData'
import { Plus } from 'lucide-react'

export default function InputMingguanPage() {
  const { isAdmin, uptKey } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  // Diisi saat modal dibuka lewat ikon Edit di tabel Rekap UPT/Balai, supaya popup langsung terbuka ke
  // Jenis Data + Periode + UPT baris itu (bukan pilihan bawaan). null = dibuka lewat tombol "+ Input Mingguan" biasa.
  const [editTarget, setEditTarget] = useState(null)
  // Berubah setiap popup ditutup (baik karena disimpan maupun ditutup manual)
  // supaya AdminPeriodRecap remount dan menarik data terbaru dari database.
  const [refreshKey, setRefreshKey] = useState(0)

  function openAdd() {
    setEditTarget(null)
    setModalOpen(true)
  }

  function openEditRow(target) {
    setEditTarget(target)
    setModalOpen(true)
  }

  function closeAndRefresh() {
    setModalOpen(false)
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-2xl font-display text-gray-900 dark:text-white">Input Mingguan</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isAdmin
              ? 'Rekap data mingguan seluruh UPT/Balai berdasarkan periode yang dipilih.'
              : 'Rekap data mingguan UPT Anda berdasarkan periode yang dipilih.'}
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="btn-primary text-sm"
        >
          <Plus size={16} />
          Input Mingguan
        </button>
      </div>

      <AdminPeriodRecap key={refreshKey} levelFilter="minggu" userUptKey={isAdmin ? null : uptKey} onEditRow={openEditRow} />

      <Modal
        open={modalOpen}
        onClose={closeAndRefresh}
        title="Input Mingguan"
        maxWidth="max-w-5xl"
      >
        <PilihJenisData
          tipe="mingguan"
          onSaved={closeAndRefresh}
          initialJenisDataId={editTarget?.jenisDataId}
          initialPeriodId={editTarget?.periodId}
          initialUptKey={editTarget?.uptKey}
        />
      </Modal>
    </div>
  )
}
