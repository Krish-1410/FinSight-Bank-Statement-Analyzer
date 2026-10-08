import { Router } from 'express';
import multer from 'multer';
import {
  uploadStatement,
  getStatements,
  deleteStatement,
  clearAllStatements,
  loadDemoStatement,
  downloadSampleCSV,
} from '../controllers/statementController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

router.post('/upload', requireAuth, upload.single('statement'), uploadStatement);
router.get('/', requireAuth, getStatements);
router.delete('/clear-all', requireAuth, clearAllStatements);
router.delete('/:id', requireAuth, deleteStatement);
router.post('/demo', requireAuth, loadDemoStatement);
router.get('/sample-csv', downloadSampleCSV);

export default router;
