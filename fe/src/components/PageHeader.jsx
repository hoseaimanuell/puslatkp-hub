/**
 * components/PageHeader.jsx
 * Judul halaman standar: judul, satu kalimat penjelasan, dan (opsional) tombol aksi di kanan.
 */
export default function PageHeader({ title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>
        {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-3xl">{description}</p>}
      </div>
      {action}
    </div>
  )
}
