import { Router } from 'express';
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  resetDemoTransactions,
} from '../controllers/transactionController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', requireAuth, getTransactions);
router.post('/', requireAuth, createTransaction);
router.post('/reset-demo', requireAuth, resetDemoTransactions);
router.get('/:id', requireAuth, getTransactionById);
router.put('/:id', requireAuth, updateTransaction);
router.delete('/:id', requireAuth, deleteTransaction);

export default router;
