import { Router } from 'express'
import { requireAdmin } from '../auth.js'
import { HttpError } from '../lib/query.js'
import { ensureYears } from '../lib/yearService.js'
import { logAudit } from '../lib/audit.js'

const router = Router()
router.use(requireAdmin)

// POST /api/periods/generate { dari, sampai }  — buat periode untuk rentang tahun (Admin)
// Periode yang sudah ada tidak ditimpa. Maks. 12 tahun per permintaan.
router.post('/generate', async (req, res) => {
  const dari = Number(req.body?.dari)
  const sampai = Number(req.body?.sampai ?? req.body?.dari)
  if (![dari, sampai].every(Number.isInteger) || dari < 2000 || sampai > 2100 || dari > sampai) {
    throw new HttpError(400, 'Rentang tahun tidak valid (2000–2100, dari ≤ sampai).')
  }
  if (sampai - dari > 11) throw new HttpError(400, 'Maksimal 12 tahun per permintaan.')

  const dibuat = await ensureYears(dari, sampai)
  const jumlah = Object.values(dibuat).reduce((a, b) => a + b, 0)
  await logAudit(req.user, 'buat_periode', { dari, sampai, tahun: dibuat, jumlah })
  res.json({ success: true, dibuat, jumlah })
})

export default router
