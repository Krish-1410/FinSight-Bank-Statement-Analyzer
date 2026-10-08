import { Request, Response } from 'express';
import { query } from '../config/db.js';
import {
  calculateSummary,
  calculateCategoryBreakdown,
  calculateMonthlyBreakdown,
  detectRecurringPayments,
} from '../services/transactionAnalyzer.js';

export async function getReportSummary(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const userName = req.user!.name;
  const { statementId } = req.query;

  try {
    let targetStatementId: number | null = null;
    if (statementId && statementId !== 'all') {
      const parsed = parseInt(statementId as string, 10);
      if (!isNaN(parsed)) targetStatementId = parsed;
    } else if (statementId !== 'all') {
      // Default to latest uploaded statement
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

    // Calculate top merchants
    const merchantTotals: Record<string, number> = {};
    for (const tx of rows) {
      if (tx.transaction_type === 'income') continue;
      merchantTotals[tx.merchant] = (merchantTotals[tx.merchant] || 0) + Number(tx.amount);
    }
    const topMerchants = Object.entries(merchantTotals)
      .map(([merchant, amount]) => ({ merchant, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        userName,
        generatedAt: new Date().toISOString(),
        summary,
        categories,
        monthly,
        recurring,
        topMerchants,
      },
    });
  } catch (err: any) {
    console.error('[Get Report Error]', err);
    res.status(500).json({ success: false, message: 'Failed to generate financial report.' });
  }
}

export async function exportReportCSV(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const userName = req.user!.name;
  const { statementId } = req.query;

  try {
    let targetStatementId: number | null = null;
    if (statementId && statementId !== 'all') {
      const parsed = parseInt(statementId as string, 10);
      if (!isNaN(parsed)) targetStatementId = parsed;
    } else if (statementId !== 'all') {
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
    sql += ' ORDER BY transaction_date DESC';

    const [rows] = await query(sql, params);

    const summary = calculateSummary(rows);
    const categories = calculateCategoryBreakdown(rows);

    // Construct comprehensive financial export CSV
    let csv = `FinSight Financial Report (INR) - ${userName}\n`;
    csv += `Generated On,${new Date().toLocaleDateString('en-IN')}\n`;
    csv += `Statement Period,${summary.dateRange.from || 'N/A'} to ${summary.dateRange.to || 'N/A'}\n\n`;

    csv += `FINANCIAL OVERVIEW (INR)\n`;
    csv += `Metric,Value (INR)\n`;
    csv += `Total Income,₹${summary.totalIncome.toFixed(2)}\n`;
    csv += `Total Spending,₹${summary.totalSpending.toFixed(2)}\n`;
    csv += `Net Cash Flow,₹${summary.netCashFlow.toFixed(2)}\n`;
    csv += `Savings Rate,${summary.savingsRate}%\n`;
    csv += `Total Transactions,${summary.transactionCount}\n`;
    csv += `Average Monthly Spend,₹${summary.averageMonthlySpend.toFixed(2)}\n\n`;

    csv += `SPENDING BY CATEGORY\n`;
    csv += `Category,Amount (INR),Percentage\n`;
    for (const cat of categories) {
      csv += `"${cat.category}",₹${cat.amount.toFixed(2)},${cat.percentage}%\n`;
    }
    csv += `\n`;

    csv += `TRANSACTION LEDGER (INR)\n`;
    csv += `Date,Merchant,Description,Category,Type,Amount (INR)\n`;
    for (const tx of rows) {
      const desc = (tx.description || '').replace(/"/g, '""');
      const merch = (tx.merchant || '').replace(/"/g, '""');
      csv += `${tx.transaction_date},"${merch}","${desc}","${tx.category}",${tx.transaction_type},₹${Number(tx.amount).toFixed(2)}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="FinSight_Financial_Report_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err: any) {
    console.error('[Export CSV Error]', err);
    res.status(500).json({ success: false, message: 'Failed to export CSV report.' });
  }
}
