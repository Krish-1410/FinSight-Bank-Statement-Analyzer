import { Router } from 'express';
import { getReportSummary, exportReportCSV } from '../controllers/reportController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/summary', requireAuth, getReportSummary);
router.get('/export/csv', requireAuth, exportReportCSV);

export default router;
