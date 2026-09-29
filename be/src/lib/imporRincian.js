/**
 * Pencocokan baris Excel "Data by Name" dengan data yang sudah tersimpan (satu jenis data + UPT + periode).
 * Fungsi murni (tanpa database) supaya bisa dites — dipakai be/src/routes/impor-rincian.js.
 *
 * Aturan pencocokan:
 *   - Ber-NIK: dicocokkan dengan baris ber-NIK yang sama. Bila tidak ada, dengan baris TANPA NIK yang namanya sama
 *     (unggahan pertama tanpa NIK, unggahan berikutnya melengkapi NIK) — bukan dengan NIK lain (itu orang lain).
 *   - Tanpa NIK: dicocokkan dengan baris tanpa NIK yang namanya sama (satu lawan satu, berurutan; dua "Budi" di
 *     berkas = dua "Budi" di database). Bila tidak ada, dengan baris ber-NIK bernama sama asalkan hanya ada satu.
 *   - NIK ganda di dalam satu berkas: baris terakhir yang dipakai (sama seperti upsert sebelumnya).
 * Hasil per baris: baru, diubah (isi berbeda), atau sama (dilewati). Baris yang sudah DISETUJUI dipisah karena
 * tidak boleh ditimpa langsung oleh UPT.
 */

/** JSON dengan urutan kunci tetap; objek kosong dianggap sama dengan null. */
export function stabil(v) {
  if (v === undefined || v === '') v = null
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const keys = Object.keys(v).filter(k => v[k] !== undefined && v[k] !== null && v[k] !== '').sort()
    if (!keys.length) return 'null'
    return '{' + keys.map(k => JSON.stringify(k) + ':' + stabil(v[k])).join(',') + '}'
  }
  if (Array.isArray(v)) return '[' + v.map(stabil).join(',') + ']'
  return JSON.stringify(v)
}

export const kunciNama = nama => String(nama ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
const nikDari = v => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim())

/** Isi yang dibandingkan untuk menentukan "berubah atau tidak". */
const sidik = r => stabil({ nama: r.nama ?? null, nik: nikDari(r.nik), data_json: r.data_json ?? null, data_ekstra: r.data_ekstra ?? null })

/**
 * @param existing baris data_entries yang tersimpan: {id, nama, nik, data_json, data_ekstra, status}
 * @param rows     baris dari Excel: {nama, nik, data_json, data_ekstra}
 * @returns {{ baru: object[], ubah: {id, row}[], sama: number, disetujuiSama: number, disetujuiBerubah: {id, row}[] }}
 */
export function klasifikasiImpor(existing = [], rows = []) {
  // NIK ganda di berkas: pakai yang terakhir
  const terakhirPerNik = new Map()
  rows.forEach((r, i) => { const nik = nikDari(r.nik); if (nik) terakhirPerNik.set(nik, i) })
  const bersih = rows
    .map((r, i) => ({ ...r, nik: nikDari(r.nik), _i: i }))
    .filter(r => !r.nik || terakhirPerNik.get(r.nik) === r._i)

  const perNik = new Map()
  const tanpaNikPerNama = new Map()
  const berNikPerNama = new Map()
  for (const e of existing) {
    const nik = nikDari(e.nik)
    if (nik) {
      perNik.set(nik, e)
      const k = kunciNama(e.nama)
      if (!berNikPerNama.has(k)) berNikPerNama.set(k, [])
      berNikPerNama.get(k).push(e)
    } else {
      const k = kunciNama(e.nama)
      if (!tanpaNikPerNama.has(k)) tanpaNikPerNama.set(k, [])
      tanpaNikPerNama.get(k).push(e)
    }
  }

  const dipakai = new Set()
  const ambilTanpaNik = nama => {
    const antre = tanpaNikPerNama.get(kunciNama(nama)) || []
    const e = antre.find(x => !dipakai.has(x.id))
    return e || null
  }

  const hasil = { baru: [], ubah: [], sama: 0, disetujuiSama: 0, disetujuiBerubah: [] }
  for (const { _i, ...row } of bersih) {
    let target = null
    if (row.nik) {
      target = perNik.get(row.nik) || null
      if (target && dipakai.has(target.id)) target = null
      if (!target && kunciNama(row.nama)) target = ambilTanpaNik(row.nama)
    } else if (kunciNama(row.nama)) {
      target = ambilTanpaNik(row.nama)
      if (!target) {
        const calon = (berNikPerNama.get(kunciNama(row.nama)) || []).filter(x => !dipakai.has(x.id))
        if (calon.length === 1) target = calon[0]
      }
    }

    if (!target) { hasil.baru.push(row); continue }
    dipakai.add(target.id)
    // Berkas tanpa kolom NIK tidak menghapus NIK yang sudah tersimpan
    const barisAkhir = { ...row, nik: row.nik ?? nikDari(target.nik) }
    const sama = sidik(barisAkhir) === sidik(target)
    if (target.status === 'disetujui') {
      if (sama) hasil.disetujuiSama++
      else hasil.disetujuiBerubah.push({ id: target.id, row: barisAkhir })
    } else if (sama) {
      hasil.sama++
    } else {
      hasil.ubah.push({ id: target.id, row: barisAkhir })
    }
  }
  return hasil
}
