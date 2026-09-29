import { Waves } from 'lucide-react'

export default function Splash() {
  return (
    <div className="min-h-screen bg-kkp-ocean flex flex-col items-center justify-center">
      <div className="w-14 h-14 rounded-xl bg-[#0B1830] text-amber-300 flex items-center justify-center mb-4 animate-pulse">
        <Waves size={26} />
      </div>
      <p className="text-sm font-semibold text-[#0B1830]">PUSLATKP Management Hub</p>
      <p className="text-xs text-gray-500 mt-1">Memuat...</p>
    </div>
  )
}
