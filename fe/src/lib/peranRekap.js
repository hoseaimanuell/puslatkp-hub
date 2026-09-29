/**
 * lib/peranRekap.js
 * "Peran di rekap": cara sebuah kolom dihitung di tabel rekap (Rekap UPT/Balai & Rekap Bulanan).
 * Disimpan di field_definitions.peran_rekap (migrasi_16) dan dipilih Admin di Kelola Jenis Data, sehingga jenis
 * data buatan Admin dengan nama kolom bebas tetap terhitung — tidak lagi bergantung pada nama kolom tertentu.
 */

export const PERAN_REKAP = {
  judul: {
    label: 'Judul baris',
    kolomRekap: 'Pelatihan',
    penjelasan: 'Setiap baris yang kolom ini terisi dihitung sebagai 1 pelatihan/kegiatan.',
    contoh: 'Nama Pelatihan, Judul Kegiatan',
    tipe: ['teks', 'teks_panjang', 'pilihan'],
  },
  peserta: {
    label: 'Jumlah peserta',
    kolomRekap: 'Peserta',
    penjelasan: 'Nilainya dijumlahkan ke kolom Peserta.',
    contoh: 'Jumlah Peserta, Jumlah Lulusan',
    tipe: ['angka'],
  },
  pagu: {
    label: 'Pagu anggaran',
    kolomRekap: 'Pagu',
    penjelasan: 'Nilainya dijumlahkan ke kolom Pagu.',
    contoh: 'Pagu Anggaran, Pagu RM',
    tipe: ['angka'],
  },
  realisasi: {
    label: 'Realisasi anggaran',
    kolomRekap: 'Realisasi',
    penjelasan: 'Nilainya dijumlahkan ke kolom Realisasi.',
    contoh: 'Realisasi Anggaran',
    tipe: ['angka'],
  },
}

/** Peran yang boleh dipilih untuk suatu tipe kolom. */
export const peranUntukTipe = tipe => Object.keys(PERAN_REKAP).filter(p => PERAN_REKAP[p].tipe.includes(tipe))

/**
 * Aturan lama berbasis nama kolom — dipakai bila database belum menjalankan migrasi_16, atau untuk nilai
 * dari kolom yang definisinya sudah dihapus. Sama persis dengan isian awal migrasi_16.
 */
export function peranLama(fieldKey = '') {
  if (fieldKey === 'nama_pelatihan') return 'judul'
  if (fieldKey === 'jumlah_peserta') return 'peserta'
  if (fieldKey.includes('pagu')) return 'pagu'
  if (fieldKey.includes('realisasi_anggaran')) return 'realisasi'
  return null
}

/** Peta `${jenis_data_id}|${field_key}` -> peran, dari definisi kolom yang sudah dimuat. */
export function buatPetaPeran(fieldDefs = []) {
  const peta = new Map()
  for (const f of fieldDefs) {
    peta.set(`${f.jenis_data_id}|${f.field_key}`, 'peran_rekap' in f ? (f.peran_rekap || null) : peranLama(f.field_key))
  }
  return peta
}

/** Peran satu nilai rekap (baris rekap_nilai). Kolom tanpa definisi jatuh ke aturan nama lama. */
export function peranKolom(peta, jenisDataId, fieldKey) {
  const k = `${jenisDataId}|${fieldKey}`
  return peta.has(k) ? peta.get(k) : peranLama(fieldKey)
}

/** Tebakan awal saat Admin membuat kolom baru (tetap bisa diubah di form). */
export function tebakPeran(label = '', tipe = '') {
  const s = label.toLowerCase()
  if (tipe === 'angka') {
    if (/peserta|lulusan|dilatih/.test(s)) return 'peserta'
    if (/pagu/.test(s)) return 'pagu'
    if (/realisasi/.test(s) && !/fisik/.test(s)) return 'realisasi'
    return null
  }
  if (PERAN_REKAP.judul.tipe.includes(tipe) && /^(nama|judul) (pelatihan|kegiatan|diklat)/.test(s)) return 'judul'
  return null
}
