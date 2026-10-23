import { Router, Request, Response } from 'express'
import { requireAuth, requireAdmin } from '../../middleware/auth'
import { privateSuppliersService } from './private-suppliers.service'

const router = Router()
router.use(requireAuth, requireAdmin)

router.get('/', async (_req: Request, res: Response) => {
  const data = await privateSuppliersService.list()
  res.json({ data })
})

export { router as privateSuppliersRouter }
