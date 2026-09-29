/**
 * components/DialogHost.jsx
 * Merender dialog konfirmasi/isian & notifikasi dari lib/dialog.js. Dipasang sekali di Providers.
 */
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, HelpCircle, Info, X, XCircle } from 'lucide-react'
import { registerDialogHost } from '../lib/dialog'

let nextId = 1

const TOAST_STYLE = {
  success: ['bg-white border-emerald-200 text-emerald-800', CheckCircle2, 'text-emerald-600'],
  error: ['bg-white border-rose-200 text-rose-800', XCircle, 'text-rose-600'],
  info: ['bg-white border-blue-200 text-[#0B1830]', Info, 'text-blue-600'],
}

export default function DialogHost() {
  const [queue, setQueue] = useState([]) // dialog yang menunggu; yang pertama sedang tampil
  const [toasts, setToasts] = useState([])

  useEffect(() => registerDialogHost({
    open: spec => new Promise(resolve => setQueue(q => [...q, { ...spec, id: nextId++, resolve }])),
    notify: (message, type) => {
      const id = nextId++
      setToasts(t => [...t, { id, message, type }])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), type === 'error' ? 7000 : 4500)
    },
  }), [])

  const current = queue[0]
  const close = value => {
    current.resolve(value)
    setQueue(q => q.slice(1))
  }

  return (
    <>
      {current && <DialogBox key={current.id} spec={current} onClose={close} />}
      <div className="fixed bottom-5 right-5 z-[80] flex flex-col gap-2 w-[min(24rem,calc(100vw-2.5rem))]" aria-live="polite">
        {toasts.map(t => {
          const [cls, Icon, iconCls] = TOAST_STYLE[t.type] || TOAST_STYLE.info
          return (
            <div key={t.id} className={`flex items-start gap-3 rounded-xl border shadow-lg px-4 py-3 text-sm animate-scale-in ${cls}`}>
              <Icon size={18} className={`flex-shrink-0 mt-0.5 ${iconCls}`} />
              <p className="flex-1 whitespace-pre-line leading-snug">{t.message}</p>
              <button
                onClick={() => setToasts(x => x.filter(y => y.id !== t.id))}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                aria-label="Tutup notifikasi"
              >
                <X size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

function DialogBox({ spec, onClose }) {
  const isPrompt = spec.kind === 'prompt'
  const fields = spec.fields || (isPrompt ? [{ name: 'value', placeholder: spec.placeholder }] : [])
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(f => [f.name, f.name === 'value' ? (spec.defaultValue ?? '') : ''])))
  const firstInput = useRef(null)
  const confirmBtn = useRef(null)
  const cancelBtn = useRef(null)
  const [title, ...rest] = spec.message.split('\n\n')
  const body = rest.join('\n\n')

  const cancel = () => onClose(isPrompt ? null : false)
  const submit = () => onClose(isPrompt ? (spec.fields ? values : values.value) : true)

  useEffect(() => {
    // Fokus awal: kolom isian; untuk aksi berbahaya, tombol Batal (supaya Enter tidak langsung menghapus).
    const el = isPrompt ? firstInput.current : spec.danger ? cancelBtn.current : confirmBtn.current
    el?.focus()
    // Capture + stopImmediatePropagation: Escape menutup dialog ini saja, bukan Modal di belakangnya.
    const onKey = e => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); cancel() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const Icon = spec.danger ? AlertTriangle : HelpCircle
  const iconCls = spec.danger ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#0B1830]/50 animate-fade-in"
      onMouseDown={e => { if (e.target === e.currentTarget) cancel() }}
    >
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden"
        onSubmit={e => { e.preventDefault(); submit() }}
      >
        <div className="p-6 flex gap-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconCls}`}>
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="dialog-title" className="font-semibold text-[#0B1830] leading-snug">{title}</h2>
            {body && <p className="text-sm text-gray-600 mt-2 whitespace-pre-line leading-relaxed">{body}</p>}
            {fields.length > 0 && (
              <div className="mt-4 space-y-3">
                {fields.map((f, i) => (
                  <div key={f.name}>
                    {f.label && <label className="form-label" htmlFor={`dlg-${f.name}`}>{f.label}</label>}
                    <input
                      id={`dlg-${f.name}`}
                      ref={i === 0 ? firstInput : undefined}
                      className="form-input"
                      placeholder={f.placeholder}
                      value={values[f.name]}
                      onChange={e => setValues(v => ({ ...v, [f.name]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 bg-[#F5F7FA] border-t border-[#E3E8EF] flex justify-end gap-2">
          <button type="button" ref={cancelBtn} onClick={cancel} className="btn-secondary">
            {spec.cancelLabel || 'Batal'}
          </button>
          <button
            type="submit"
            ref={confirmBtn}
            className={spec.danger ? 'btn-danger' : 'btn-primary'}
          >
            {spec.confirmLabel || (spec.danger ? 'Ya, hapus' : isPrompt ? 'Kirim' : 'Ya, lanjutkan')}
          </button>
        </div>
      </form>
    </div>
  )
}
