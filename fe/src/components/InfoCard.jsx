/**
 * components/InfoCard.jsx
 * Wrapper kartu netral — bg-white border rounded-xl shadow-sm
 */

export default function InfoCard({ children, className = '', title, action }) {
  return (
    <div className={`card p-6 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{title}</h3>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
