import { Router } from 'express';
import { getInsights, getRecurringPayments } from '../controllers/insightController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/insights', requireAuth, getInsights);
router.get('/recurring-payments', requireAuth, getRecurringPayments);

export default router;
