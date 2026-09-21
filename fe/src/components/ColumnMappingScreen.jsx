/**
 * components/ColumnMappingScreen.jsx
 * Layar cocokkan kolom Excel ke field_definitions sebelum import
 */
import { useState } from 'react'
import { ArrowRight, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react'

export default function ColumnMappingScreen({ excelHeaders, fieldDefs, initialMapping, onConfirm, onCancel }) {
  const [mapping, setMapping] = useState(initialMapping)

  const usedFieldKeys = Object.values(mapping)
    .filter(Boolean)
    .map(fd => fd.field_key)

  const unmappedCount = excelHeaders.filter(h => !mapping[h]).length

  function handleFieldSelect(header, fieldKey) {
    const fd = fieldDefs.find(f => f.field_key === fieldKey) || null
    setMapping(prev => ({ ...prev, [header]: fd }))
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
        <strong>Cocokkan kolom Excel ke field sistem.</strong> Kolom yang tidak dicocokkan akan disimpan sebagai data cadangan dan bisa dijadikan field resmi oleh Admin.
      </div>

      {/* Header info */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 pb-2">
        <span>{excelHeaders.length} kolom ditemukan di file</span>
        {unmappedCount > 0 && (
          <span className="text-amber-600 dark:text-amber-400">{unmappedCount} belum dicocokkan</span>
        )}
      </div>

      {/* Mapping rows */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {excelHeaders.map(header => {
          const matched = mapping[header]
          return (
            <div key={header} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              {/* Excel column */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {header}
                </div>
              </div>

              <ArrowRight size={16} className="text-gray-400 flex-shrink-0" />

              {/* Field selector */}
              <div className="flex-1 min-w-0">
                <select
                  value={matched?.field_key || ''}
                  onChange={(e) => handleFieldSelect(header, e.target.value)}
                  className="form-select text-sm w-full"
                >
                  <option value="">- Belum Dikenal -</option>
                  {fieldDefs
                    .filter(fd => fd.aktif && (fd.field_key === matched?.field_key || !usedFieldKeys.includes(fd.field_key)))
                    .map(fd => (
                      <option key={fd.field_key} value={fd.field_key}>
                        {fd.label}
                        {fd.is_identitas ? ' (identitas)' : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Status icon */}
              <div className="flex-shrink-0">
                {matched ? (
                  <CheckCircle size={16} className="text-emerald-500" />
                ) : (
                  <HelpCircle size={16} className="text-amber-400" />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Unmapped warning */}
      {unmappedCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg">
          <AlertCircle size={14} />
          {unmappedCount} kolom tidak dicocokkan akan masuk ke data cadangan
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="btn-secondary flex-1">
          Batal
        </button>
        <button
          onClick={() => onConfirm(mapping)}
          className="btn-primary flex-1"
        >
          Import Data
        </button>
      </div>
    </div>
  )
}
