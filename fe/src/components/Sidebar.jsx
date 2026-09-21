/**
 * components/Sidebar.jsx
 * Sidebar collapsible: 256px (terbuka) / 64px (tertutup)
 * Role-aware: menu Admin hanya untuk Admin
 */
import { useState } from 'react'
import {
  LayoutDashboard, Zap, ClipboardList, Database,
  Users, Settings, BarChart2, FileText,
  ChevronRight, ChevronLeft, ChevronDown,
  Building2, Globe, CalendarDays, Trash2, CalendarRange, Upload, LayoutGrid, SlidersHorizontal
} from 'lucide-react'
import { useAuth } from '../AuthContext'

const LOGO_MARK = 'P'

export default function Sidebar({ activePage, onNavigate, collapsed, onToggle }) {
  const { isAdmin, profile } = useAuth()
  const [advOpen, setAdvOpen] = useState(false)
  const ADVANCED = [[CalendarRange, 'Kelola Periode', 'kelola-periode'], [Upload, 'Impor Data Historis', 'impor-historis'], [Trash2, 'Tempat Sampah', 'tempat-sampah']]
  // Terbuka otomatis bila halaman aktif ada di dalamnya
  const advOpenEffective = advOpen || ADVANCED.some(([, , page]) => page === activePage)

  const NavItem = ({ icon: Icon, label, page, badge }) => {
    const active = activePage === page
    return (
      <button
        onClick={() => onNavigate(page)}
        className={`sidebar-nav-item w-full ${active ? 'active' : ''}`}
        title={collapsed ? label : undefined}
      >
        <Icon size={18} className="flex-shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{label}</span>
            {badge && <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
          </>
        )}
      </button>
    )
  }

  const SectionLabel = ({ label }) => {
    if (collapsed) return <div className="my-2 border-t border-white/10" />
    return (
      <div className="px-3 pt-5 pb-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">{label}</span>
      </div>
    )
  }

  return (
    <aside
      className={`fixed top-0 left-0 h-screen z-30 flex flex-col transition-all duration-300 ease-in-out
        bg-[#0B1830] border-r border-white/10
        ${collapsed ? 'w-16 -translate-x-full md:translate-x-0' : 'w-64'}`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-lg flex-shrink-0">
          {LOGO_MARK}
        </div>
        {!collapsed && (
          <div>
            <div className="text-white font-bold text-sm leading-tight">PUSLATKP</div>
            <div className="text-white/40 text-[10px] leading-tight">Management Hub</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-0.5">
        <SectionLabel label="Team Portal" />
        <NavItem icon={LayoutDashboard} label="Dashboard" page="dashboard" />

        <SectionLabel label="Data & Pelaporan" />
        <NavItem icon={Database} label="Input Mingguan" page="input-mingguan" />
        <NavItem icon={CalendarDays} label="Input Bulanan" page="input-bulanan" />
        <NavItem icon={BarChart2} label="Rekap Triwulan & Tahun" page="rekap-triwulan-tahun" />
        <NavItem icon={FileText} label="Dokumen & Arsip" page="dokumen-arsip" />

        {/* ADMIN SECTION */}
        {isAdmin && (
          <>
            <SectionLabel label="Administrasi" />
            <NavItem icon={Users} label="Kelola Akun UPT" page="kelola-upt" />
            <NavItem icon={Settings} label="Kelola Jenis Data" page="kelola-jenis-data" />
            <NavItem icon={LayoutGrid} label="Kelola Dashboard" page="kelola-dashboard" />

            {/* Jarang dipakai (tahunan / sekali waktu) dilipat agar menu harian tetap pendek */}
            {!collapsed && (
              <button
                onClick={() => setAdvOpen(o => !o)}
                className="sidebar-nav-item w-full"
                aria-expanded={advOpenEffective}
              >
                <SlidersHorizontal size={18} className="flex-shrink-0" />
                <span className="flex-1 text-left">Pengaturan Lanjutan</span>
                <ChevronDown size={14} className={`transition-transform ${advOpenEffective ? 'rotate-180' : ''}`} />
              </button>
            )}
            {(collapsed || advOpenEffective) && (
              <div className={collapsed ? 'space-y-0.5' : 'space-y-0.5 pl-3 border-l border-white/10 ml-4'}>
                {ADVANCED.map(([icon, label, page]) => <NavItem key={page} icon={icon} label={label} page={page} />)}
              </div>
            )}
          </>
        )}
      </nav>

      {/* Footer: User info + collapse toggle */}
      <div className="border-t border-white/10 px-2 py-3 space-y-2">
        {!collapsed && (
          <div className="px-3 py-2 rounded-lg bg-white/5">
            <div className="text-white text-xs font-semibold truncate">
              {profile?.nama_lengkap || 'Pengguna'}
            </div>
            <div className="text-white/50 text-[10px] capitalize">
              {profile?.role || '-'} {profile?.upt_key ? `• ${profile.upt_key}` : ''}
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="sidebar-nav-item w-full justify-center"
          title={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span className="text-xs">Tutup sidebar</span>}
        </button>
      </div>
    </aside>
  )
}
