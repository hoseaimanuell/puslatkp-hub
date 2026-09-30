/**
 * lib/bacaTabelExcel.js
 * Mengubah isi satu sheet Excel menjadi tabel { headers, rows } untuk impor, termasuk berkas buatan UPT yang
 * memakai sel gabungan (merge), yang sebelumnya terbaca kacau:
 *   - judul besar di atas tabel (mis. "REKAP PESERTA SEPTEMBER 2026" digabung A1:H1)  -> dilewati
 *   - judul kolom dua tingkat ("Jumlah Peserta" di atas "L" dan "P")                  -> "Jumlah Peserta L", "... P"
 *   - sel digabung ke bawah/ke samping di baris data (mis. nama UPT untuk 3 baris)      -> nilainya disalin ke semua sel
 *   - baris kosong dan baris JUMLAH/TOTAL di bawah tabel                                -> dilewati
 * Fungsi murni (masukan: array baris + daftar merge dari SheetJS), dites di fe/test/excel.test.mjs.
 */

const teks = v => (v === null || v === undefined ? '' : String(v).trim())
const adaIsi = v => teks(v) !== ''
const RE_TOTAL = /^(jumlah|total|grand\s*total|sub\s*total)\b/i

/**
 * @param aoa    baris-baris sheet (XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true }))
 * @param merges ws['!merges'] (boleh kosong)
 * @returns {{ headers: string[], rows: object[], barisJudul: number }} barisJudul = nomor baris Excel judul kolom (1-based)
 */
export function bacaTabel(aoa = [], merges = []) {
  const lebar = Math.max(0, ...aoa.map(r => (r ? r.length : 0)))
  const grid = aoa.map(r => Array.from({ length: lebar }, (_, c) => (r && r[c] !== undefined ? r[c] : null)))

  // 1. Baris judul kolom (dihitung SEBELUM sel gabungan diisi): baris pertama di 20 baris teratas yang jumlah sel
  //    teksnya minimal 60% dari baris terpadat. Judul besar yang digabung hanya 1 sel teks, jadi terlewati; baris
  //    data di bawah judul kolom biasanya tidak lebih padat teks daripada judulnya, jadi judul yang terpilih.
  const jumlahTeks = grid.slice(0, 20).map(r => r.filter(v => typeof v === 'string' && adaIsi(v)).length)
  const maks = Math.max(0, ...jumlahTeks)
  const h = maks >= 2 ? jumlahTeks.findIndex(n => n >= 2 && n >= maks * 0.6) : -1
  if (h < 0) return { headers: [], rows: [], barisJudul: 0 }

  // 2. Isi sel gabungan dengan nilai sel kiri-atasnya
  for (const m of merges || []) {
    const v = grid[m.s.r]?.[m.s.c] ?? null
    for (let r = m.s.r; r <= m.e.r && r < grid.length; r++) {
      for (let c = m.s.c; c <= m.e.c && c < lebar; c++) grid[r][c] = v
    }
  }

  // 3. Judul dua tingkat: ada judul di baris h yang digabung melebar, dan baris h+1 berisi teks di bawahnya
  const gabungMelebar = (merges || []).filter(m => m.s.r <= h && m.e.r >= h && m.e.c > m.s.c)
  const sub = grid[h + 1] || []
  const duaTingkat = gabungMelebar.some(m => {
    for (let c = m.s.c; c <= m.e.c; c++) if (typeof sub[c] === 'string' && adaIsi(sub[c]) && teks(sub[c]) !== teks(grid[h][c])) return true
    return false
  })

  const dipakai = new Map()
  const headers = grid[h].map((v, c) => {
    const atas = teks(v)
    const bawah = duaTingkat ? teks(sub[c]) : ''
    let nama = atas && bawah && bawah !== atas ? `${atas} ${bawah}` : atas || bawah
    if (!nama) nama = `Kolom ${c + 1}`
    const n = (dipakai.get(nama) || 0) + 1
    dipakai.set(nama, n)
    return n > 1 ? `${nama} (${n})` : nama
  })
  // Kolom tanpa judul di ujung kanan yang juga tanpa data tidak perlu ditampilkan
  const mulai = h + (duaTingkat ? 2 : 1)
  let kolomTerakhir = headers.length - 1
  while (kolomTerakhir >= 0 && !adaIsi(grid[h][kolomTerakhir]) && !(duaTingkat && adaIsi(sub[kolomTerakhir])) && !grid.slice(mulai).some(r => adaIsi(r[kolomTerakhir]))) kolomTerakhir--
  const hdr = headers.slice(0, kolomTerakhir + 1)

  // 4. Baris data: lewati baris kosong dan baris ringkasan JUMLAH/TOTAL
  const rows = []
  for (let r = mulai; r < grid.length; r++) {
    const baris = grid[r].slice(0, hdr.length)
    const isi = baris.filter(adaIsi)
    if (!isi.length) continue
    if (RE_TOTAL.test(teks(isi[0]))) continue
    rows.push(Object.fromEntries(hdr.map((k, c) => [k, baris[c] ?? null])))
  }
  return { headers: hdr, rows, barisJudul: h + 1 }
}
