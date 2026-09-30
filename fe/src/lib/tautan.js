/**
 * lib/tautan.js
 * Kolom bertipe Berkas bisa berisi salah satu dari dua: id berkas unggahan (field_files) ATAU link data dukung
 * (mis. folder Google Drive). Hanya alamat http/https yang dianggap link — bentuk lain (mis. "javascript:...") tidak
 * pernah dijadikan href, supaya isian tidak bisa dipakai untuk menjalankan skrip.
 */

export const isTautan = v => typeof v === 'string' && /^https?:\/\/[^\s<>"']+$/i.test(v.trim())

/** Nilai kolom Berkas untuk Excel: link ditulis apa adanya, berkas unggahan diberi keterangan. */
export const berkasUntukExcel = v => (isTautan(v) ? v.trim() : v ? '(berkas — unduh di web)' : '')
