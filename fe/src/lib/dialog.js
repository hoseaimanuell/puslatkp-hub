/**
 * lib/dialog.js
 * Pengganti alert/confirm/prompt bawaan browser dengan dialog & notifikasi bergaya aplikasi.
 * Tampilannya dirender oleh <DialogHost /> (dipasang sekali di Providers); modul ini hanya meneruskan
 * permintaan ke host itu. Bila host belum terpasang (mis. saat splash), jatuh ke dialog bawaan browser.
 *
 * Pesan boleh memuat paragraf dipisah "\n\n": paragraf pertama jadi judul, sisanya jadi isi.
 */
let host = null

export function registerDialogHost(h) {
  host = h
  return () => { if (host === h) host = null }
}

const ERROR_PATTERN = /^(gagal|impor berhenti)|tidak tersedia|tidak dapat|error/i

/** Notifikasi singkat di pojok layar. type: 'success' | 'error' | 'info' (ditebak dari isi bila kosong). */
export function notify(message, type) {
  const t = type || (ERROR_PATTERN.test(message) ? 'error' : 'success')
  if (host) host.notify(String(message), t)
  else window.alert(message)
}

const DANGER_PATTERN = /hapus|kosongkan|buang|permanen/i

/**
 * Dialog konfirmasi. Mengembalikan Promise<boolean>.
 * opts: { confirmLabel, cancelLabel, danger } — danger ditebak dari judul bila tidak diisi.
 */
export function confirmDialog(message, opts = {}) {
  if (!host) return Promise.resolve(window.confirm(message))
  const [title] = String(message).split('\n\n')
  return host.open({ kind: 'confirm', message: String(message), ...opts, danger: opts.danger ?? DANGER_PATTERN.test(title) })
}

/**
 * Dialog isian. Satu kolom (bawaan) -> Promise<string | null>; opts.fields = [{ name, label, placeholder }]
 * -> Promise<{ [name]: string } | null>. null = dibatalkan.
 */
export function promptDialog(message, opts = {}) {
  if (!host) {
    if (!opts.fields) return Promise.resolve(window.prompt(message, opts.defaultValue ?? ''))
    const out = {}
    for (const f of opts.fields) {
      const v = window.prompt(f.label || message, '')
      if (v === null) return Promise.resolve(null)
      out[f.name] = v
    }
    return Promise.resolve(out)
  }
  return host.open({ kind: 'prompt', message: String(message), ...opts })
}
