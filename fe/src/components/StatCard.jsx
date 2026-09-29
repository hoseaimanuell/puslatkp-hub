/**
 * components/StatCard.jsx
 * Kartu statistik berwarna — dipakai di Dashboard & Daily Activity
 */

// Warna disimpan di data widget sebagai nama kelas Tailwind (lihat COLORS di lib/dashboardWidgets.js).
// Di sini dipetakan ke gradasi yang selaras identitas KKP & tetap kontras untuk teks putih.
const TONES = {
  'bg-blue-600': 'from-[#0F52A6] to-[#0B3A73]',
  'bg-emerald-500': 'from-[#0E8C7A] to-[#0A6558]',
  'bg-amber-500': 'from-[#C98A00] to-[#9C6A00]',
  'bg-rose-500': 'from-[#C8354F] to-[#98243B]',
  'bg-purple-600': 'from-[#5B3FA8] to-[#432D80]',
  'bg-sky-500': 'from-[#1F84C2] to-[#15648F]',
  'bg-slate-600': 'from-[#475569] to-[#334155]',
}

export default function StatCard({ icon: Icon, color, label, value, note, className = '' }) {
  const tone = TONES[color]
  return (
    <div className={`stat-card relative overflow-hidden ${tone ? `bg-gradient-to-br ${tone}` : color} ${className}`}>
      <svg className="absolute -right-6 -bottom-6 w-40 h-24 text-white/[0.08] pointer-events-none" viewBox="0 0 200 100" fill="none">
        <path d="M0 60 Q50 30 100 60 T200 60 V100 H0 Z" fill="currentColor" />
        <path d="M0 80 Q50 50 100 80 T200 80 V100 H0 Z" fill="currentColor" />
      </svg>
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          {Icon && (
            <div className="p-2 bg-white/15 ring-1 ring-white/20 rounded-lg">
              <Icon size={20} />
            </div>
          )}
        </div>
        <div className="tabular-nums font-bold font-display text-3xl leading-none mb-1.5">
          {value ?? 0}
        </div>
        <div className="text-sm font-semibold text-white/90">{label}</div>
        {note && (
          <div className="text-xs text-white/70 mt-1">{note}</div>
        )}
      </div>
    </div>
  )
}
