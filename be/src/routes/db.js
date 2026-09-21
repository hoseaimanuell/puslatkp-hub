import { Router } from 'express'
import { runQuery } from '../lib/query.js'

const router = Router()

// POST /api/db/query  — lihat docs/03-api-reference.md untuk format `spec`
router.post('/query', async (req, res) => {
  const result = await runQuery(req.body, req.user)
  res.json(result)
})

export default router
