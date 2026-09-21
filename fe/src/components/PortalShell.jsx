'use client'
/**
 * components/PortalShell.jsx
 * Shell aplikasi (sidebar + topbar) untuk seluruh halaman portal. Menampilkan Login jika belum masuk.
 */
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '../AuthContext'
import { useNavigate } from '../lib/nav'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Splash from './Splash'
import Login from '../views/Login'

const PAGE_TITLES = {
  dashboard: 'Dashboard Tim Kerja',
  'input-mingguan': 'Input Data Mingguan',
  'input-bulanan': 'Input Data Bulanan & Rekap',
  'rekap-triwulan-tahun': 'Rekap Triwulan & Tahun',
  'kelola-upt': 'Administrasi UPT',
  'kelola-jenis-data': 'Kelola & Definisi Jenis Data',
  'kelola-periode': 'Kelola Periode & Deadline',
  'impor-historis': 'Impor Data Historis',
  'kelola-dashboard': 'Kelola Dashboard',
  'tempat-sampah': 'Tempat Sampah & Catatan Penghapusan',
  'dokumen-arsip': 'Dokumen & Arsip',
}

export default function PortalShell({ children }) {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const activePage = usePathname().split('/')[1] || 'dashboard'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Responsif mobile auto collapse
  useEffect(() => {
    const checkWidth = () => {
      if (window.innerWidth < 768) setSidebarCollapsed(true)
    }
    checkWidth()
    window.addEventListener('resize', checkWidth)
    return () => window.removeEventListener('resize', checkWidth)
  }, [])

  if (loading) return <Splash />
  if (!session) return <Login />

  return (
    <div className="min-h-screen bg-[#EFF2F7] dark:bg-[#0B0F1A] text-gray-900 dark:text-gray-100 flex flex-col transition-colors duration-200">
      {/* Mobile Backdrop saat sidebar dibuka di layar kecil */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-25 md:hidden transition-opacity"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {/* Sidebar navigation */}
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => {
          navigate(page)
          if (window.innerWidth < 768) setSidebarCollapsed(true)
        }}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(prev => !prev)}
      />

      {/* Main Container */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? 'md:ml-16 ml-0' : 'md:ml-64 ml-0'
        }`}
      >
        <TopBar
          pageTitle={PAGE_TITLES[activePage] || 'PUSLATKP Management Hub'}
          onNavigate={navigate}
          onToggleSidebar={() => setSidebarCollapsed(prev => !prev)}
        />

        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
