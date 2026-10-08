import { Router } from 'express';
import {
  getDashboardSummary,
  getDashboardCategories,
  getDashboardMonthly,
  getDashboardDivisions,
} from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/summary', requireAuth, getDashboardSummary);
router.get('/categories', requireAuth, getDashboardCategories);
router.get('/monthly', requireAuth, getDashboardMonthly);
router.get('/divisions', requireAuth, getDashboardDivisions);

export default router;
