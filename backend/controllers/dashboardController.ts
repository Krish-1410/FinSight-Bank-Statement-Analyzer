import { Request, Response } from 'express';
import { query } from '../config/db.js';
import {
  calculateSummary,
  calculateCategoryBreakdown,
  calculateMonthlyBreakdown,
  calculateFinancialDivisions,
} from '../services/transactionAnalyzer.js';

/**
 * Resolves the target statement ID for scoped analysis.
 * Defaults to the user's latest uploaded statement so old statements/demo data
 * do not mix with the newly uploaded file!
 */
async function resolveTargetStatementId(userId: number, statementIdParam: any): Promise<number | null> {
  if (statementIdParam === 'all') {
    return null; // Explicitly requested all statements
  }
  if (statementIdParam && statementIdParam !== 'latest') {
    const parsed = parseInt(statementIdParam, 10);
    if (!isNaN(parsed)) return parsed;
  }
  // By default: focus strictly on the latest uploaded statement
  const [stmts] = await query('SELECT id FROM bank_statements WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
  if (stmts && stmts.length > 0) {
    return stmts[0].id;
  }
  return null;
}

export async function getDashboardSummary(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { startDate, endDate, statementId } = req.query;

  try {
    const targetStatementId = await resolveTargetStatementId(userId, statementId);

    let sql = 'SELECT transaction_date, description, merchant, amount, transaction_type, category FROM transactions WHERE user_id = ?';
    const params: any[] = [userId];

    if (targetStatementId !== null) {
      sql += ' AND statement_id = ?';
      params.push(targetStatementId);
    }

    if (startDate && typeof startDate === 'string') {
      sql += ' AND transaction_date >= ?';
      params.push(startDate);
    }
    if (endDate && typeof endDate === 'string') {
      sql += ' AND transaction_date <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY transaction_date DESC';

    const [rows] = await query(sql, params);
    const summary = calculateSummary(rows);

    // Also get active statement info and statement list for frontend selector
    const [allStatements] = await query(
      'SELECT id, original_filename, transaction_count, date_from, date_to, uploaded_at FROM bank_statements WHERE user_id = ? ORDER BY id DESC',
      [userId]
    );

    let activeStatement = null;
    if (targetStatementId !== null) {
      activeStatement = allStatements.find((s: any) => s.id === targetStatementId) || null;
    }

    res.status(200).json({
      success: true,
      data: {
        ...summary,
        activeStatement,
        allStatements,
        isScopedToStatement: targetStatementId !== null,
      },
    });
  } catch (err: any) {
    console.error('[Dashboard Summary Error]', err);
    res.status(500).json({ success: false, message: 'Failed to calculate financial summary.' });
  }
}

export async function getDashboardCategories(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { startDate, endDate, statementId } = req.query;

  try {
    const targetStatementId = await resolveTargetStatementId(userId, statementId);

    let sql = 'SELECT transaction_date, description, merchant, amount, transaction_type, category FROM transactions WHERE user_id = ?';
    const params: any[] = [userId];

    if (targetStatementId !== null) {
      sql += ' AND statement_id = ?';
      params.push(targetStatementId);
    }

    if (startDate && typeof startDate === 'string') {
      sql += ' AND transaction_date >= ?';
      params.push(startDate);
    }
    if (endDate && typeof endDate === 'string') {
      sql += ' AND transaction_date <= ?';
      params.push(endDate);
    }

    const [rows] = await query(sql, params);
    const categories = calculateCategoryBreakdown(rows);

    res.status(200).json({
      success: true,
      data: {
        categories,
      },
    });
  } catch (err: any) {
    console.error('[Dashboard Categories Error]', err);
    res.status(500).json({ success: false, message: 'Failed to compute category breakdown.' });
  }
}

export async function getDashboardMonthly(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { statementId } = req.query;

  try {
    const targetStatementId = await resolveTargetStatementId(userId, statementId);

    let sql = 'SELECT transaction_date, description, merchant, amount, transaction_type, category FROM transactions WHERE user_id = ?';
    const params: any[] = [userId];

    if (targetStatementId !== null) {
      sql += ' AND statement_id = ?';
      params.push(targetStatementId);
    }

    sql += ' ORDER BY transaction_date ASC';

    const [rows] = await query(sql, params);
    const monthly = calculateMonthlyBreakdown(rows);

    res.status(200).json({
      success: true,
      data: {
        monthly,
      },
    });
  } catch (err: any) {
    console.error('[Dashboard Monthly Error]', err);
    res.status(500).json({ success: false, message: 'Failed to compute monthly spending trends.' });
  }
}

export async function getDashboardDivisions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { statementId } = req.query;

  try {
    const targetStatementId = await resolveTargetStatementId(userId, statementId);

    let sql = 'SELECT transaction_date, description, merchant, amount, transaction_type, category FROM transactions WHERE user_id = ?';
    const params: any[] = [userId];

    if (targetStatementId !== null) {
      sql += ' AND statement_id = ?';
      params.push(targetStatementId);
    }

    sql += ' ORDER BY transaction_date DESC';

    const [rows] = await query(sql, params);
    const summary = calculateSummary(rows);
    const divisions = calculateFinancialDivisions(rows, summary);

    res.status(200).json({
      success: true,
      data: divisions,
    });
  } catch (err: any) {
    console.error('[Dashboard Divisions Error]', err);
    res.status(500).json({ success: false, message: 'Failed to compute financial divisions.' });
  }
}
