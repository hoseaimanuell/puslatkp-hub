/**
 * components/HapusMassalDialog.jsx
 * Konfirmasi penghapusan massal: pengguna wajib mengetik "HAPUS". Data tidak hilang permanen —
 * masuk Tempat Sampah selama beberapa hari dan hanya Admin yang dapat memulihkannya.
 */
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, Loader2, AlertTriangle } from 'lucide-react'
import Modal from './Modal'

export default function HapusMassalDialog({ open, onClose, onConfirm, title, count, details = [], isAdmin }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) { setText(''); setError(''); setBusy(false) }
  }, [open])

  async function handleConfirm() {
    setBusy(true)
    setError('')
    const { error: err } = (await onConfirm()) || {}
    setBusy(false)
    if (err) setError(err.message || 'Gagal menghapus data')
  }

  const ready = text.trim().toUpperCase() === 'HAPUS' && count > 0 && !busy

  // Portal ke <body>: dialog ini sering dibuka dari dalam popup lain yang ber-transform (fixed jadi relatif ke popup itu)
  return createPortal(
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary text-sm">Batal</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!ready}
            className="btn-primary text-sm !bg-rose-600 hover:!bg-rose-700 disabled:opacity-40"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Hapus {count} Data
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex gap-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <p>
            Akan menghapus <strong>{count} data</strong>. Data dipindahkan ke <strong>Tempat Sampah</strong> selama 30 hari
            {isAdmin ? ' dan dapat Anda pulihkan dari menu Tempat Sampah.' : '; hanya Admin yang dapat memulihkannya.'}
            {' '}Penghapusan ini dicatat di log.
          </p>
        </div>

        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-xs">
          {details.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
              <dd className="font-semibold text-gray-900 dark:text-white">{v}</dd>
            </div>
          ))}
        </dl>

        <div>
          <label className="form-label text-xs">Ketik <strong>HAPUS</strong> untuk melanjutkan</label>
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            className="form-input w-full"
            placeholder="HAPUS"
            autoFocus
          />
        </div>

        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    </Modal>,
    document.body,
  )
}
