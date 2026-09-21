// Salinan generator sampel FE, dengan PRNG bersifat deterministik agar file SQL selalu sama.
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }}
const rnd = mulberry32(2026)

/**
 * lib/sampleDataGenerator.js
 * Generator 500 data sampel realistis untuk Data Masyarakat (Bulanan Rincian Nama)
 * Terdistribusi di 10 UPT (50 data per UPT) pada Bulan September 2026 (p-m-9).
 */

const DEPT_NAMES = [
  'BPPP Jakarta', 'BPPP Medan', 'BPPP Banyuwangi', 'BPPP Tegal', 'BPPP Bitung',
  'BPPP Ambon', 'BPPP Padang', 'BPPP Pontianak', 'BPPP Makassar', 'BPPP Sorong'
]

const FIRST_NAMES = [
  'Ahmad', 'Siti', 'Budi', 'Dewi', 'Eko', 'Rina', 'Hendra', 'Agus', 'Nur', 'Tri',
  'Bambang', 'Dian', 'Joko', 'Sri', 'Muhammad', 'Anita', 'Rizky', 'Maya', 'Yudi', 'Indah',
  'Dedi', 'Megawati', 'Rudi', 'Wahyu', 'Bayu', 'Kusuma', 'Irwan', 'Tari', 'Doni', 'Ratna',
  'Faisal', 'Endang', 'Taufik', 'Yuli', 'Aditya', 'Putri', 'Herman', 'Kartika', 'Firman', 'Lestari',
  'Arif', 'Wulandari', 'Hadi', 'Ningsih', 'Surya', 'Fitri', 'Andi', 'Rahma', 'Agung', 'Sari'
]

const LAST_NAMES = [
  'Susanto', 'Nurhaliza', 'Pratama', 'Wibowo', 'Saputra', 'Kusuma', 'Wijaya', 'Hidayat',
  'Utami', 'Rahayu', 'Setiawan', 'Kurniawan', 'Ramadhan', 'Firmansyah', 'Lestari', 'Handayani',
  'Hartono', 'Purwanto', 'Prasetyo', 'Nugroho', 'Santoso', 'Hasanah', 'Subagyo', 'Anggraini',
  'Suryadi', 'Budiman', 'Suherman', 'Fitriani', 'Wahyudi', 'Purnomo'
]

const CITIES = [
  'Jakarta Utara', 'Surabaya', 'Medan', 'Bandung', 'Semarang', 'Banyuwangi', 'Tegal',
  'Bitung', 'Ambon', 'Padang', 'Pontianak', 'Makassar', 'Sorong', 'Manado', 'Cirebon',
  'Pekalongan', 'Cilacap', 'Batam', 'Balikpapan', 'Palembang'
]

const COURSES = [
  { nama: 'Pelatihan Navigasi & Operasi Kapal Perikanan 30 GT', bidang: 'Kepelautan & Penangkapan' },
  { nama: 'Pelatihan Keamanan Pangan Olahan Ikan (HACCP)', bidang: 'Pengolahan & Mutu' },
  { nama: 'Pelatihan Budidaya Ikan Nila Sistem Bioflok', bidang: 'Budidaya Perikanan' },
  { nama: 'Pelatihan Pembuatan Pakan Mandiri Ikan Air Tawar', bidang: 'Budidaya Perikanan' },
  { nama: 'Pelatihan Perawatan & Perbaikan Mesin Penggerak Kapal', bidang: 'Permesinan Kapal' },
  { nama: 'Pelatihan Diversifikasi Olahan Rumput Laut', bidang: 'Pengolahan & Mutu' },
  { nama: 'Pelatihan Pemasaran Digital Produk Hasil Perikanan', bidang: 'Wirausaha Perikanan' },
  { nama: 'Pelatihan Pembenihan Udang Vaname Ramah Lingkungan', bidang: 'Budidaya Perikanan' },
  { nama: 'Pelatihan Konservasi & Pemantauan Terumbu Karang', bidang: 'Konservasi Perairan' },
  { nama: 'Pelatihan Penanganan Hasil Tangkapan (Cooling System)', bidang: 'Kepelautan & Penangkapan' },
]

const UPT_KEYS = [
  'upt_jakarta', 'upt_medan', 'upt_banyuwangi', 'upt_tegal', 'upt_bitung',
  'upt_ambon', 'upt_padang', 'upt_pontianak', 'upt_makassar', 'upt_sorong'
]

const JD_MASYARAKAT_BULAN_ID = '11111111-0002-0000-0000-000000000002'
const JD_MASYARAKAT_MINGGU_ID = '11111111-0001-0000-0000-000000000001'

export function generate500Entries() {
  const entries = []
  let globalCount = 1

  UPT_KEYS.forEach((uptKey, uptIdx) => {
    const uptLabel = DEPT_NAMES[uptIdx] || uptKey

    // 50 data per UPT
    for (let i = 1; i <= 50; i++) {
      const fName = FIRST_NAMES[Math.floor(rnd() * FIRST_NAMES.length)]
      const lName = LAST_NAMES[Math.floor(rnd() * LAST_NAMES.length)]
      const fullName = `${fName} ${lName}`

      const nikPrefix = (3100 + uptIdx * 10).toString()
      const nikMid = String(1000 + i).padStart(4, '0')
      const nikSuffix = String(Math.floor(100000 + rnd() * 900000))
      const nik = `${nikPrefix}${nikMid}${nikSuffix}`.slice(0, 16)

      const courseObj = COURSES[i % COURSES.length]
      const city = CITIES[i % CITIES.length]
      const isMale = i % 2 === 1
      const day = String((i % 28) + 1).padStart(2, '0')

      const entry = {
        id: `ent-500sample-${globalCount}`,
        jenis_data_id: JD_MASYARAKAT_BULAN_ID,
        upt_key: uptKey,
        period_id: 'p-m-9',
        nama: fullName,
        nik: nik,
        data_json: {
          no_urut: String(i),
          penyelenggara_pelatihan: uptLabel,
          nama: fullName,
          nik: nik,
          tempat_lahir: city,
          tanggal_lahir: `19${80 + (i % 20)}-0${(i % 9) + 1}-${day}`,
          jenis_kelamin: isMale ? 'Laki-laki' : 'Perempuan',
          pendidikan_terakhir: i % 3 === 0 ? 'D4/S1' : i % 2 === 0 ? 'SMA/SMK' : 'SMP',
          no_telepon: `0812${String(Math.floor(10000000 + rnd() * 90000000))}`,
          alamat: `Jl. Bahari No. ${i * 2}, ${city}`,
          provinsi: 'Indonesia',
          kab_kota: city,
          bidang_pelatihan: courseObj.bidang,
          nama_pelatihan: courseObj.nama,
          tanggal_pelatihan: `2026-09-${day}`,
          no_sertifikat_pelatihan: `KP-2026-09-${String(globalCount).padStart(4, '0')}`,
          link_sertifikat_pelatihan_by_name: `https://elaut.kkp.go.id/cert/${globalCount}`,
          no_kusuka: `KSK-317101-${String(globalCount).padStart(4, '0')}`,
          jenis_pelatihan: i % 4 === 0 ? 'Aspirasi' : 'Reguler',
        },
        data_ekstra: {},
        created_at: new Date(`2026-09-${day}T08:00:00.000Z`).toISOString(),
      }

      entries.push(entry)
      globalCount++
    }
  })

  return entries
}

export function generate500RekapNilai() {
  const rekaps = []
  let rCount = 1000

  // Untuk 10 UPT pada 4 Minggu (September M1-M4)
  UPT_KEYS.forEach((uptKey) => {
    ['p-w-9-1', 'p-w-9-2', 'p-w-9-3', 'p-w-9-4'].forEach((wPeriodId, wIdx) => {
      const pesertaCount = wIdx % 2 === 0 ? 12 : 13 // 12 + 13 + 12 + 13 = 50 total per UPT
      const pagu = (pesertaCount * 1200000)
      const realisasi = Math.round(pagu * 0.94)

      rekaps.push({ id: `rn-sample-${rCount++}`, jenis_data_id: JD_MASYARAKAT_MINGGU_ID, upt_key: uptKey, period_id: wPeriodId, field_key: 'nama_pelatihan', value_text: 'Pelatihan Sektor Kelautan & Perikanan' })
      rekaps.push({ id: `rn-sample-${rCount++}`, jenis_data_id: JD_MASYARAKAT_MINGGU_ID, upt_key: uptKey, period_id: wPeriodId, field_key: 'jumlah_peserta', value: pesertaCount })
      rekaps.push({ id: `rn-sample-${rCount++}`, jenis_data_id: JD_MASYARAKAT_MINGGU_ID, upt_key: uptKey, period_id: wPeriodId, field_key: 'pagu_anggaran', value: pagu })
      rekaps.push({ id: `rn-sample-${rCount++}`, jenis_data_id: JD_MASYARAKAT_MINGGU_ID, upt_key: uptKey, period_id: wPeriodId, field_key: 'realisasi_anggaran', value: realisasi })
      rekaps.push({ id: `rn-sample-${rCount++}`, jenis_data_id: JD_MASYARAKAT_MINGGU_ID, upt_key: uptKey, period_id: wPeriodId, field_key: 'sumber_dana', value_text: 'PNBP' })
      rekaps.push({ id: `rn-sample-${rCount++}`, jenis_data_id: JD_MASYARAKAT_MINGGU_ID, upt_key: uptKey, period_id: wPeriodId, field_key: 'metode_pelatihan', value_text: 'Blended / Luring' })
    })
  })

  return rekaps
}
