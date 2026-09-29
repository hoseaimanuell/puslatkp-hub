import LogoKKP from './LogoKKP'

export default function Splash() {
  return (
    <div className="min-h-screen bg-kkp-ocean flex flex-col items-center justify-center">
      <LogoKKP size={64} priority className="mb-4 shadow-sm animate-pulse" />
      <p className="text-sm font-semibold text-[#0B1830]">PUSLATKP Management Hub</p>
      <p className="text-xs text-gray-500 mt-1">Memuat...</p>
    </div>
  )
}
