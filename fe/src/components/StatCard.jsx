/**
 * components/StatCard.jsx
 * Kartu statistik berwarna — dipakai di Dashboard & Daily Activity
 */

export default function StatCard({ icon: Icon, color, label, value, note, className = '' }) {
  // color = Tailwind bg class string, mis. 'bg-blue-600', 'bg-emerald-500'
  return (
    <div className={`stat-card ${color} ${className}`}>
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className="p-2 bg-white/20 rounded-lg">
            <Icon size={20} />
          </div>
        )}
      </div>
      <div className="tabular-nums font-bold text-2xl leading-none mb-1">
        {value ?? 0}
      </div>
      <div className="text-sm font-medium text-white/80">{label}</div>
      {note && (
        <div className="text-xs text-white/60 mt-1">{note}</div>
      )}
    </div>
  )
}
