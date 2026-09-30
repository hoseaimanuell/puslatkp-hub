/**
 * lib/weeklyReport.js
 * Membaca "Form Weekly Report" UPT (formulir Excel: label di kiri, nilai di kanan) menjadi data per jenis data
 * mingguan (lihat be/scripts/seed-weekly-report.js untuk jenis data & kolomnya).
 *
 * Nilai dicari berdasarkan LABEL di dalam bagiannya (mis. "Pagu Belanja Pegawai AKTIF" di bawah "a). Belanja
 * Pegawai"), bukan nomor baris, sehingga tetap terbaca walau barisnya bergeser. Kolom formulir diasumsikan tetap
 * seperti template: label C/D dengan nilai di F (blok kiri), label J dengan nilai di L (blok kanan), tabel di F-J.
 * Fungsi murni (masukan: isi sheet sebagai array baris), dites di fe/test/weekly-report.test.mjs.
 */

const C = 2, D = 3, E = 4, F = 5, H = 7, J = 9, L = 11

const teks = v => (v === null || v === undefined ? '' : v instanceof Date ? '' : String(v).trim())
const norm = v => teks(v).toLowerCase().replace(/\s+/g, ' ')
const tanpaSatuan = s => teks(s).replace(/\((orang|rp)\)\s*$/i, '').trim()
const bukanCatatan = v => !(typeof v === 'string' && /^\s*\*/.test(v)) // "* Diisi link ..." = petunjuk, bukan nilai

/** Angka dari sel: angka asli, atau teks seperti "Rp45,077,545,000", "Rp.4.004.381.308", "6,835", "-" */
export function angka(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = teks(v).replace(/^rp\.?/i, '').replace(/\s/g, '')
  if (!s || /^-+$/.test(s) || !bukanCatatan(v)) return null
  if (s.endsWith('%')) return null // persentase dihitung ulang oleh aplikasi
  const titik = s.lastIndexOf('.'), koma = s.lastIndexOf(',')
  if (titik >= 0 && koma >= 0) s = titik > koma ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.')
  else if (koma >= 0) s = /,\d{3}(,|$)/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.')
  else if (titik >= 0 && /\.\d{3}(\.|$)/.test(s) && (s.match(/\./g).length > 1 || s.length > 4)) s = s.replace(/\./g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember']
/** Tanggal laporan: sel tanggal Excel, atau teks "24 September 2026". Hasil 'YYYY-MM-DD' atau null. */
export function tanggalLaporan(v) {
  if (v instanceof Date && !isNaN(v)) {
    // SheetJS bisa memberi tengah malam UTC atau tengah malam waktu lokal; ambil tanggal kalender yang dimaksud
    const utc = v.getUTCHours() === 0 && v.getUTCMinutes() === 0
    const [y, m, d] = utc ? [v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()] : [v.getFullYear(), v.getMonth(), v.getDate()]
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  const m = /(\d{1,2})\s+([a-z]+)\s+(\d{4})/i.exec(teks(v))
  const b = m ? BULAN.indexOf(m[2].toLowerCase()) : -1
  return b >= 0 ? `${m[3]}-${String(b + 1).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}` : null
}

/** Cocokkan label formulir ke salah satu opsi (awalan sama setelah dinormalisasi). */
function cocokOpsi(label, opsi) {
  const l = norm(tanpaSatuan(label)).replace(/[^a-z0-9]/g, '')
  return opsi.find(o => { const k = norm(o).replace(/[^a-z0-9]/g, ''); return l === k || l.startsWith(k) || k.startsWith(l) }) || null
}

export const OPSI = {
  program: ['Konservasi Laut', 'Penangkapan Ikan Terukur Berbasis Kuota', 'Pengembangan Budidaya Air Laut, Tawar, Payau yang Berkelanjutan', 'Pengelolaan dan Pengawasan Pesisir dan Pulau-Pulau Kecil', 'Penanganan Sampah Plastik/BCL', 'Lainnya (Pengolahan, Garam, Pemasaran, Manajemen, dll)'],
  bidang: ['Sistem Jaminan Mutu', 'Pembentukan Keahlian Awak Kapal Perikanan (AKP)', 'Budidaya', 'Pengolahan dan Pemasaran', 'Konservasi dan Kemitigasian', 'Kelautan dan Kemaritiman', 'Pengawasan dan Kepelabuhan', 'Permesinan dan Mekanisasi', 'Peningkatan Keahlian Awak Kapal Perikanan (AKP)', 'Penangkapan dan Alat Tangkap', 'Teknis Lainnya'],
  pembiayaan: ['Aspirasi', 'Reguler', 'PNBP / BLU'],
  metodeMasyarakat: ['Online', 'Luring', 'Blended'],
  metodeAparatur: ['Blended', 'Reguler', 'Full Online'],
}

/**
 * @param aoa isi sheet (XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true }), sel tanggal = Date)
 * @returns {{ upt: string, tanggal: string|null, kelompok: {key: string, baris: object[]}[], peringatan: string[] }}
 */
export function bacaWeeklyReport(aoa = []) {
  const g = aoa.map(r => r || [])
  const sel = (r, c) => (g[r] ? g[r][c] ?? null : null)
  const peringatan = []
  const cari = (re, cols, dari = 0, sampai = g.length) => {
    for (let r = Math.max(0, dari); r < Math.min(sampai, g.length); r++) for (const c of cols) if (re.test(teks(sel(r, c)))) return r
    return -1
  }

  // Batas bagian: 1 (anggaran balai), 2 (sumber anggaran), 3 (capaian pelatihan)
  const b1 = cari(/^1\.\s*REALISASI ANGGARAN/i, [1, 2])
  const b2 = cari(/^2\.\s*REALISASI ANGGARAN/i, [1, 2])
  const b3 = cari(/^3\.\s*CAPAIAN/i, [1, 2])
  if (b1 < 0 && b2 < 0 && b3 < 0) throw new Error('Berkas ini bukan Form Weekly Report (bagian "1. REALISASI ANGGARAN" dan "3. CAPAIAN KEGIATAN" tidak ditemukan).')

  const rUpt = cari(/^UPT$/i, [1, 2])
  const rTgl = cari(/WEEKLY REPORT/i, [1, 2])
  const upt = rUpt >= 0 ? teks(sel(rUpt, F)) : ''
  const tanggal = rTgl >= 0 ? tanggalLaporan(sel(rTgl, F)) : null

  /** Ambil nilai label dalam satu blok baris: aturan = [[regexLabel, field_key]]. Label yang muncul dua kali -> peringatan. */
  function blok(dari, sampai, kolLabel, kolNilai, aturan, namaBlok, ambil = angka) {
    const out = {}
    for (let r = dari; r < sampai && r < g.length; r++) {
      const label = teks(sel(r, kolLabel))
      if (!label) continue
      const cocok = aturan.find(([re]) => re.test(label))
      if (!cocok) continue
      const nilai = ambil(sel(r, kolNilai))
      if (cocok[1] in out) {
        if (nilai !== null && nilai !== out[cocok[1]]) peringatan.push(`${namaBlok}: "${label}" muncul lagi di baris ${r + 1} (${nilai.toLocaleString?.('id-ID') ?? nilai}); yang dipakai nilai pertama.`)
        continue
      }
      out[cocok[1]] = nilai
    }
    return out
  }
  const isi = o => Object.values(o).some(v => v !== null && v !== '')
  const bersih = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== ''))
  const kelompok = []
  const tambah = (key, baris) => { const b = baris.map(bersih).filter(x => Object.keys(x).length); if (b.length) kelompok.push({ key, baris: b }) }

  // ---- 1a-c. Anggaran per jenis belanja
  const akhir1 = b2 > 0 ? b2 : g.length
  const belanja = {}
  for (const [nama, k] of [['Pegawai', 'pegawai'], ['Barang', 'barang'], ['Modal', 'modal']]) {
    const r0 = cari(new RegExp(`^[a-z]\\)\\.?\\s*Belanja ${nama}`, 'i'), [C], b1, akhir1)
    if (r0 < 0) continue
    Object.assign(belanja, blok(r0 + 1, r0 + 6, D, F, [
      [/AWAL/i, `pagu_awal_belanja_${k}`], [/AKTIF/i, `pagu_belanja_${k}`], [/^Realisasi/i, `realisasi_belanja_${k}`],
    ], `Belanja ${nama}`))
  }
  if (isi(belanja)) tambah('data_capaian_anggaran_per_jenis_belanja', [belanja])

  // ---- 1. PNBP & MP PNBP (blok kanan)
  const pnbp = {}
  const rPnbp = cari(/Target dan Realisasi (PNBP|PNPB)/i, [H], b1, akhir1)
  if (rPnbp >= 0) Object.assign(pnbp, blok(rPnbp + 1, rPnbp + 6, J, L, [[/Target Penerimaan/i, 'target_penerimaan_pnbp'], [/^Realisasi PNBP/i, 'realisasi_pnbp']], 'PNBP'))
  if (rPnbp >= 0) Object.assign(pnbp, blok(rPnbp + 1, rPnbp + 6, J, L, [[/Data Dukung/i, 'link_data_dukung_pnbp']], 'PNBP', v => (bukanCatatan(v) ? teks(v) || null : null)))
  const rMp = cari(/Realisasi MP (PNBP|PNPB)/i, [H], b1, akhir1)
  if (rMp >= 0) Object.assign(pnbp, blok(rMp + 1, rMp + 6, J, L, [[/Pagu Total MP/i, 'pagu_total_mp_pnbp'], [/Pagu MP I\b/i, 'pagu_mp1_pnbp'], [/Realisasi MP/i, 'realisasi_mp_pnbp']], 'MP PNBP'))
  if (isi(pnbp)) tambah('pnbp_dan_mp_pnbp', [pnbp])

  // ---- 2a-c. Anggaran per sumber dana
  const akhir2 = b3 > 0 ? b3 : g.length
  const dana = {}
  for (const [re, k, nama] of [[/Rupiah Murni|\(RM\)/i, 'rm', 'RM'], [/PNBP\s*\/\s*BLU/i, 'pnbp_blu', 'PNBP/BLU'], [/SBSN/i, 'sbsn', 'SBSN']]) {
    const r0 = cari(new RegExp(`^[a-z]\\)\\.?.*(${re.source})`, 'i'), [C], b2, akhir2)
    if (r0 < 0) continue
    Object.assign(dana, blok(r0 + 1, r0 + 6, D, F, [[/AWAL/i, `pagu_awal_${k}`], [/AKTIF/i, `pagu_${k}`], [/^Realisasi/i, `realisasi_${k}`]], `Sumber dana ${nama}`))
  }
  if (isi(dana)) tambah('data_capaian_anggaran_per_sumber_dana', [dana])

  // Tabel kategori (program prioritas / bidang usaha): baris judul kolom tepat di bawah judul tabel
  function tabelKategori(reJudul, opsi, kolomRe, namaTabel) {
    const r0 = cari(reJudul, [D], b3)
    if (r0 < 0) return { rows: {}, jumlah: {} }
    const kol = {}
    for (let c = E; c <= J + 1; c++) for (const [re, key] of kolomRe) if (!(key in kol) && re.test(teks(sel(r0 + 1, c)))) kol[key] = c
    const rows = {}
    let jumlah = {}
    for (let r = r0 + 2; r < Math.min(r0 + 25, g.length); r++) {
      const label = teks(sel(r, D))
      if (!label) continue
      const nilai = Object.fromEntries(Object.entries(kol).map(([key, c]) => [key, key === 'link_bukti_dukung' ? (bukanCatatan(sel(r, c)) ? teks(sel(r, c)) || null : null) : angka(sel(r, c))]))
      if (/^Jumlah/i.test(label)) { jumlah = nilai; break }
      const kat = cocokOpsi(label, opsi)
      if (!kat) { peringatan.push(`${namaTabel}: kategori "${label}" (baris ${r + 1}) tidak dikenal, dilewati.`); continue }
      rows[kat] = nilai
    }
    return { rows, jumlah }
  }
  const cekJumlah = (namaTabel, rows, jumlah, key) => {
    const total = Object.values(rows).reduce((a, r) => a + (r[key] || 0), 0)
    if (jumlah[key] !== null && jumlah[key] !== undefined && total !== jumlah[key]) peringatan.push(`${namaTabel}: baris "Jumlah" (${jumlah[key].toLocaleString('id-ID')}) tidak sama dengan penjumlahan rinciannya (${total.toLocaleString('id-ID')}).`)
    return total
  }

  // ---- 3.1 Masyarakat per program prioritas (fisik + anggaran digabung per program)
  const fisik = tabelKategori(/Detail Capaian Pelatihan Bagi Masyarakat Per Program/i, OPSI.program,
    [[/Target Output DIPA/i, 'target_dipa_awal'], [/Anggaran Efektif/i, 'target_efektif'], [/^Realisasi$/i, 'realisasi_orang'], [/Link/i, 'link_bukti_dukung']], 'Program prioritas (orang)')
  const ang = tabelKategori(/Detail Anggaran Pelatihan Bagi Masyarakat Per Program/i, OPSI.program,
    [[/Anggaran DIPA/i, 'anggaran_dipa_awal'], [/Anggaran Efektif/i, 'anggaran_efektif'], [/^Realisasi$/i, 'realisasi_anggaran']], 'Program prioritas (Rp)')
  const totalProgram = cekJumlah('Program prioritas (orang)', fisik.rows, fisik.jumlah, 'realisasi_orang')
  cekJumlah('Program prioritas (Rp)', ang.rows, ang.jumlah, 'realisasi_anggaran')
  tambah('capaian_masyarakat_per_program', OPSI.program.map(p => ({ program_prioritas: p, ...fisik.rows[p], ...ang.rows[p] })).filter(r => isi({ ...r, program_prioritas: null })))

  // ---- 3.1 Masyarakat per bidang usaha
  const bid = tabelKategori(/Detail Pelatihan Bagi Masyarakat Per Bidang/i, OPSI.bidang, [[/Realisasi Fisik/i, 'realisasi_fisik'], [/Realisasi Anggaran/i, 'realisasi_anggaran']], 'Bidang usaha')
  const totalBidang = cekJumlah('Bidang usaha', bid.rows, bid.jumlah, 'realisasi_fisik')
  cekJumlah('Bidang usaha', bid.rows, bid.jumlah, 'realisasi_anggaran')
  tambah('capaian_masyarakat_per_bidang', OPSI.bidang.map(b => ({ bidang_usaha: b, ...bid.rows[b] })).filter(r => isi({ ...r, bidang_usaha: null })))

  // Sub-bagian bertarget: "a). Aspirasi" / "1). Metode Blended" berisi Target/Realisasi (orang) di kiri, Pagu/Realisasi (Rp) di kanan
  function subBagian(reInduk, reSelesai, kolomKey, opsi, reSub, nama) {
    const r0 = cari(reInduk, [D], b3)
    if (r0 < 0) return []
    let r1 = reSelesai ? cari(reSelesai, [C, D], r0 + 1) : -1
    if (r1 < 0) r1 = g.length
    const awal = []
    for (let r = r0 + 1; r < r1; r++) {
      const m = reSub.exec(teks(sel(r, D)))
      const kat = m ? cocokOpsi(m[1], opsi) : null
      if (kat) awal.push([r, kat])
    }
    return awal.map(([r, kat], i) => {
      const s = i + 1 < awal.length ? awal[i + 1][0] : r1
      const kiri = blok(r + 1, s, D, F, [[/^Target/i, 'target_orang'], [/^Realisasi \(Orang\)/i, 'realisasi_orang']], `${nama} ${kat}`)
      const kanan = blok(r + 1, s, J, L, [[/Pagu Awal/i, 'pagu_awal'], [/Pagu Aktif/i, 'pagu_aktif'], [/^Realisasi \(Rp\)/i, 'realisasi_anggaran']], `${nama} ${kat}`)
      return { [kolomKey]: kat, ...kiri, ...kanan }
    }).filter(r => isi({ ...r, [kolomKey]: null }))
  }
  const pembiayaan = subBagian(/Berdasarkan Pembiayaan/i, /Berdasarkan Metode/i, 'jenis_pembiayaan', OPSI.pembiayaan, /^[a-z]\)\.?\s*(.+)$/i, 'Pembiayaan')
  tambah('capaian_masyarakat_per_pembiayaan', pembiayaan)
  const metode = subBagian(/Masyarakat Dilatih Berdasarkan Metode/i, /^\d\)\.?$|Layanan Manajemen SDM/i, 'metode', OPSI.metodeMasyarakat, /^[a-z]\)\.?\s*(.+)$/i, 'Metode')
  tambah('capaian_masyarakat_per_metode', metode)
  const aparatur = subBagian(/Diklat Aparatur Berdasarkan Metode/i, /Lulusan DUDIKA/i, 'metode', OPSI.metodeAparatur, /^\d\)\.?\s*Metode\s+(.+)$/i, 'Aparatur')
  tambah('capaian_aparatur_per_metode', aparatur)

  // ---- 3.3 Lulusan DUDIKA
  const rDudika = cari(/Lulusan DUDIKA/i, [D], b3)
  if (rDudika >= 0) {
    const dudika = blok(rDudika + 1, rDudika + 10, D, F, [[/Target DUDIKA/i, 'target_dudika'], [/Capaian Pelatihan/i, 'capaian_pelatihan'], [/Realisasi DUDIKA/i, 'realisasi_dudika']], 'DUDIKA')
    if (isi(dudika)) tambah('lulusan_dudika', [dudika])
  }

  // ---- 3.4 Pelatihan Non-APBN (tabel bebas, berhenti setelah 3 baris kosong berturut-turut)
  const rNon = cari(/Non-?APBN/i, [D], b3)
  if (rNon >= 0) {
    const rJudul = cari(/Nama Pelatihan/i, [D], rNon, rNon + 5)
    if (rJudul >= 0) {
      const kol = { nama_pelatihan: D }
      for (let c = D + 1; c <= J; c++) {
        const h = teks(sel(rJudul, c))
        if (/Jumlah Peserta/i.test(h)) kol.jumlah_peserta = c
        else if (/Sasaran/i.test(h)) kol.sasaran = c
        else if (/Keterangan/i.test(h)) kol.keterangan = c
      }
      const baris = []
      for (let r = rJudul + 1, kosong = 0; r < g.length && kosong < 3; r++) {
        const nama = teks(sel(r, D))
        if (!nama) { kosong++; continue }
        kosong = 0
        baris.push({ nama_pelatihan: nama, jumlah_peserta: kol.jumlah_peserta !== undefined ? angka(sel(r, kol.jumlah_peserta)) : null, sasaran: kol.sasaran !== undefined ? teks(sel(r, kol.sasaran)) || null : null, keterangan: kol.keterangan !== undefined ? teks(sel(r, kol.keterangan)) || null : null })
      }
      tambah('pelatihan_non_apbn', baris)
    }
  }

  // ---- Pemeriksaan silang
  const jumlah = (o, keys) => keys.reduce((a, k) => a + (o[k] || 0), 0)
  const rp = n => `Rp${n.toLocaleString('id-ID')}`
  const paguBelanja = jumlah(belanja, ['pagu_belanja_pegawai', 'pagu_belanja_barang', 'pagu_belanja_modal'])
  const paguDana = jumlah(dana, ['pagu_rm', 'pagu_pnbp_blu', 'pagu_sbsn'])
  if (paguBelanja && paguDana && paguBelanja !== paguDana) peringatan.push(`Pagu AKTIF per jenis belanja (${rp(paguBelanja)}) tidak sama dengan per sumber dana (${rp(paguDana)}), selisih ${rp(Math.abs(paguBelanja - paguDana))}.`)
  const realBelanja = jumlah(belanja, ['realisasi_belanja_pegawai', 'realisasi_belanja_barang', 'realisasi_belanja_modal'])
  const realDana = jumlah(dana, ['realisasi_rm', 'realisasi_pnbp_blu', 'realisasi_sbsn'])
  if (realBelanja && realDana && realBelanja !== realDana) peringatan.push(`Realisasi per jenis belanja (${rp(realBelanja)}) tidak sama dengan per sumber dana (${rp(realDana)}), selisih ${rp(Math.abs(realBelanja - realDana))}.`)
  const totalPembiayaan = pembiayaan.reduce((a, r) => a + (r.realisasi_orang || 0), 0)
  const totalMetode = metode.reduce((a, r) => a + (r.realisasi_orang || 0), 0)
  const totalMasy = [['per program', totalProgram], ['per bidang', totalBidang], ['per pembiayaan', totalPembiayaan], ['per metode', totalMetode]].filter(([, n]) => n)
  if (new Set(totalMasy.map(([, n]) => n)).size > 1) peringatan.push(`Jumlah masyarakat dilatih berbeda antar rincian: ${totalMasy.map(([k, n]) => `${k} ${n.toLocaleString('id-ID')}`).join(', ')}.`)

  return { upt, tanggal, kelompok, peringatan }
}
