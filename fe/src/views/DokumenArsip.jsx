/**
 * views/DokumenArsip.jsx
 * Satu menu untuk berkas: tab "Dokumen & Panduan" (pedoman, SOP, template) dan tab "Arsip Data Historis".
 */
import { useState, useEffect } from 'react'
import Documents from './Documents'
import ArsipHistoris from './ArsipHistoris'
import { FileText, Archive } from 'lucide-react'

const TABS = [['dokumen', FileText, 'Dokumen & Panduan'], ['arsip', Archive, 'Arsip Data Historis']]

export default function DokumenArsip() {
  const [tab, setTab] = useState('dokumen')
  useEffect(() => {
    try { if (new URLSearchParams(window.location.search).get('tab') === 'arsip') setTab('arsip') } catch { /* abaikan */ }
  }, [])
  const pick = t => {
    setTab(t)
    try { window.history.replaceState(null, '', t === 'arsip' ? '?tab=arsip' : window.location.pathname) } catch { /* abaikan */ }
  }
  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
        {TABS.map(([id, Icon, label]) => (
          <button
            key={id}
            onClick={() => pick(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === id ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {tab === 'dokumen' ? <Documents /> : <ArsipHistoris />}
    </div>
  )
}
