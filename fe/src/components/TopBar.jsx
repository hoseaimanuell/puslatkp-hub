/**
 * components/TopBar.jsx
 * Header bar: status koneksi backend/database + user info + sign out
 */
import { useEffect, useState } from 'react'
import { LogOut, Globe, Database, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { api } from '../lib/db'

export default function TopBar({ pageTitle, onNavigate, onToggleSidebar }) {
  const { profile, signOut } = useAuth()
  const [showDbInfo, setShowDbInfo] = useState(false)
  const [online, setOnline] = useState(null) // null = memeriksa; true/false = hasil health check
  const [dbName, setDbName] = useState('Puslatkp1a')

  useEffect(() => {
    let alive = true
    api('/health', { method: 'GET' }).then(({ data, error }) => {
      if (!alive) return
      setOnline(!error)
      if (data?.database) setDbName(data.database)
    })
    return () => { alive = false }
  }, [])
  const isOffline = online === false

  return (
    <header className="sticky top-0 z-20 h-14 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Buka/Tutup Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Status koneksi: hanya tampil bila server terputus */}
        {isOffline && (
          <button
            onClick={() => setShowDbInfo(true)}
            className="px-2.5 py-1 rounded-full text-xs font-medium border bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
            title="Detail koneksi"
          >
            Server terputus
          </button>
        )}

        {/* Public view link */}
        <button
          onClick={() => onNavigate?.('publik')}
          className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Tampilan Publik"
        >
          <Globe size={14} />
          <span>Publik</span>
        </button>

        {/* User + logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700">
          <div className="hidden sm:block text-right">
            <div className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">
              {profile?.nama_lengkap || 'Pengguna'}
            </div>
            <div className="text-[10px] text-gray-400 capitalize">
              {profile?.role} {profile?.upt_key ? `• ${profile.upt_key}` : ''}
            </div>
          </div>
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {(profile?.nama_lengkap || 'P')[0].toUpperCase()}
          </div>
          <button
            onClick={signOut}
            className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            title="Keluar"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* Modal Status Koneksi Database */}
      {showDbInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${isOffline ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'}`}>
                  {isOffline ? <AlertTriangle size={20} /> : <Database size={20} />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">
                    Status Koneksi Database
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {`MySQL • ${dbName}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDbInfo(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/70 dark:border-gray-700/70 text-xs space-y-2">
              <div className={`flex items-center gap-2 font-semibold ${isOffline ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {isOffline ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                <span>{isOffline ? 'Backend / Database Tidak Terjangkau' : 'Koneksi Aktif & Berfungsi Normal'}</span>
              </div>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {isOffline
                  ? 'Frontend tidak dapat menghubungi layanan backend (be). Pastikan backend berjalan dan MySQL (phpMyAdmin/Laragon) aktif, lalu muat ulang halaman.'
                  : 'Aplikasi terhubung ke layanan backend Express yang menyimpan seluruh data di database MySQL. Perubahan langsung tersimpan dan terlihat oleh semua pengguna.'}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowDbInfo(false)}
                className="btn-primary text-xs px-4 py-2"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
