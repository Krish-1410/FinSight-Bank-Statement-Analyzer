import { Request, Response } from 'express';
import { query } from '../config/db.js';
import {
  calculateSummary,
  calculateCategoryBreakdown,
  calculateMonthlyBreakdown,
  detectRecurringPayments,
  generateFinancialInsights,
} from '../services/transactionAnalyzer.js';

export async function getInsights(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { statementId } = req.query;

  try {
    let targetStatementId: number | null = null;
    if (statementId && statementId !== 'all') {
      const parsed = parseInt(statementId as string, 10);
      if (!isNaN(parsed)) targetStatementId = parsed;
    } else if (statementId !== 'all') {
      // Default to the latest uploaded statement
      const [stmts] = await query('SELECT id FROM bank_statements WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
      if (stmts && stmts.length > 0) {
        targetStatementId = stmts[0].id;
      }
    }

    let sql = 'SELECT transaction_date, description, merchant, amount, transaction_type, category FROM transactions WHERE user_id = ?';
    const params: any[] = [userId];
    if (targetStatementId !== null) {
      sql += ' AND statement_id = ?';
      params.push(targetStatementId);
    }
    sql += ' ORDER BY transaction_date ASC';

    const [rows] = await query(sql, params);

    const summary = calculateSummary(rows);
    const categories = calculateCategoryBreakdown(rows);
    const monthly = calculateMonthlyBreakdown(rows);
    const recurring = detectRecurringPayments(rows);

    const insights = generateFinancialInsights(summary, categories, monthly, recurring);

    res.status(200).json({
      success: true,
      data: {
        insights,
        summary,
        topCategories: categories.slice(0, 5),
        recurringCount: recurring.length,
      },
    });
  } catch (err: any) {
    console.error('[Get Insights Error]', err);
    res.status(500).json({ success: false, message: 'Failed to generate financial insights.' });
  }
}

export async function getRecurringPayments(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  try {
    const [rows] = await query(
      'SELECT id, merchant, category, average_amount, frequency, estimated_monthly_cost, last_transaction_date FROM recurring_payments WHERE user_id = ? ORDER BY estimated_monthly_cost DESC',
      [userId]
    );

    const totalMonthlyCost = rows.reduce((acc: number, item: any) => acc + Number(item.estimated_monthly_cost), 0);

    res.status(200).json({
      success: true,
      data: {
        recurringPayments: rows,
        totalMonthlyCost: Math.round(totalMonthlyCost * 100) / 100,
        count: rows.length,
      },
    });
  } catch (err: any) {
    console.error('[Get Recurring Payments Error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve recurring payments.' });
  }
}
