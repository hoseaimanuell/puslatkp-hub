/**
 * Membuat periode (1 tahun + 4 triwulan + 12 bulan + 48 minggu) untuk satu tahun atau rentang tahun.
 *   npm run periods -- 2027               satu tahun
 *   npm run periods -- 2021 2025          rentang tahun (mis. data historis 5 tahun ke belakang)
 *   npm run periods -- 2027 --reset       kembalikan tanggal & deadline ke aturan bawaan (menimpa perubahan Admin)
 * Bawaan: periode yang sudah ada TIDAK ditimpa. Aman dijalankan berulang.
 * (Server juga membuat tahun berjalan & tahun depan secara otomatis.)
 */
import { pool } from '../src/db.js'
import { ensureYears } from '../src/lib/yearService.js'

const args = process.argv.slice(2)
const overwrite = args.includes('--reset')
const nums = args.filter(a => !a.startsWith('--')).map(Number)
const [dari, sampai = dari] = nums

if (![dari, sampai].every(Number.isInteger) || dari < 2000 || sampai > 2100 || dari > sampai || sampai - dari > 11) {
  console.error('Pemakaian: npm run periods -- <tahun> [<tahun-akhir>] [--reset]   contoh: npm run periods -- 2021 2025')
  process.exit(1)
}

const dibuat = await ensureYears(dari, sampai, { overwrite })
for (const [y, n] of Object.entries(dibuat)) console.log(`Tahun ${y}: ${n} periode ${overwrite ? 'dibuat/diperbarui' : 'baru dibuat'} (dari 65)`)
await pool.end()
