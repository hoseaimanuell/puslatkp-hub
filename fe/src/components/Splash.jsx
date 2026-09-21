import { Loader2 } from 'lucide-react'

export default function Splash() {
  return (
    <div className="min-h-screen bg-[#0B1830] flex flex-col items-center justify-center text-white">
      <Loader2 size={36} className="animate-spin text-blue-500 mb-3" />
      <p className="text-sm font-medium text-white/70">Memuat PUSLATKP Management Hub...</p>
    </div>
  )
}
