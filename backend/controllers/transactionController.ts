import { Request, Response } from 'express';
import { query } from '../config/db.js';

export async function getTransactions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const {
    search,
    category,
    type,
    startDate,
    endDate,
    sort = 'date_desc',
    page = '1',
    limit = '25',
  } = req.query;

  try {
    let whereClause = 'WHERE user_id = ?';
    const params: any[] = [userId];

    if (search && typeof search === 'string' && search.trim()) {
      whereClause += ' AND (description LIKE ? OR merchant LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    if (category && typeof category === 'string' && category !== 'All') {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    if (type && typeof type === 'string' && (type === 'expense' || type === 'income')) {
      whereClause += ' AND transaction_type = ?';
      params.push(type);
    }

    if (startDate && typeof startDate === 'string') {
      whereClause += ' AND transaction_date >= ?';
      params.push(startDate);
    }

    if (endDate && typeof endDate === 'string') {
      whereClause += ' AND transaction_date <= ?';
      params.push(endDate);
    }

    // Statement scoping: analyze ONLY the uploaded/selected statement
    const { statementId } = req.query;
    if (statementId && statementId !== 'all') {
      const sId = parseInt(statementId as string, 10);
      if (!isNaN(sId)) {
        whereClause += ' AND statement_id = ?';
        params.push(sId);
      }
    } else if (statementId !== 'all') {
      // By default: focus strictly on the latest uploaded statement
      const [stmts] = await query('SELECT id FROM bank_statements WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
      if (stmts && stmts.length > 0) {
        whereClause += ' AND statement_id = ?';
        params.push(stmts[0].id);
      }
    }

    // Count total matching
    const countSql = `SELECT COUNT(*) as count FROM transactions ${whereClause}`;
    const [countRows] = await query(countSql, params);
    const totalCount = countRows[0]?.count || 0;

    // Sorting
    let orderBy = 'ORDER BY transaction_date DESC, id DESC';
    switch (sort) {
      case 'date_asc':
        orderBy = 'ORDER BY transaction_date ASC, id ASC';
        break;
      case 'amount_desc':
        orderBy = 'ORDER BY amount DESC';
        break;
      case 'amount_asc':
        orderBy = 'ORDER BY amount ASC';
        break;
      default:
        orderBy = 'ORDER BY transaction_date DESC, id DESC';
    }

    // Pagination
    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 25, 5), 100);
    const offset = (pageNum - 1) * limitNum;

    const dataSql = `
      SELECT id, statement_id, transaction_date, description, merchant, amount, transaction_type, category, created_at
      FROM transactions
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limitNum, offset];
    const [rows] = await query(dataSql, dataParams);

    res.status(200).json({
      success: true,
      data: {
        transactions: rows,
        pagination: {
          totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
          currentPage: pageNum,
          limit: limitNum,
        },
      },
    });
  } catch (err: any) {
    console.error('[Get Transactions Error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve transactions.' });
  }
}

export async function getTransactionById(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const txId = parseInt(req.params.id, 10);

  if (isNaN(txId)) {
    res.status(400).json({ success: false, message: 'Invalid transaction ID.' });
    return;
  }

  try {
    const [rows] = await query(
      'SELECT id, statement_id, transaction_date, description, merchant, amount, transaction_type, category, created_at FROM transactions WHERE id = ? AND user_id = ?',
      [txId, userId]
    );

    if (!rows || rows.length === 0) {
      res.status(404).json({ success: false, message: 'Transaction not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        transaction: rows[0],
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve transaction details.' });
  }
}

export async function createTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { transaction_date, description, merchant, amount, transaction_type, category } = req.body;

  if (!description || !amount || isNaN(parseFloat(amount))) {
    res.status(400).json({ success: false, message: 'Description and a valid amount in ₹ are required.' });
    return;
  }

  const amt = Math.abs(parseFloat(amount));
  const type = transaction_type === 'income' ? 'income' : 'expense';
  const merch = (merchant && merchant.trim()) ? merchant.trim() : description.trim();
  const dateStr = transaction_date || new Date().toISOString().substring(0, 10);
  const cat = category || (type === 'income' ? 'Income' : 'Other');

  try {
    // Get or create statement ID for manually added transactions
    let statementId = 1;
    const [stmts] = await query('SELECT id FROM bank_statements WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
    if (stmts && stmts.length > 0) {
      statementId = stmts[0].id;
    } else {
      const [newStmt]: any = await query(
        'INSERT INTO bank_statements (user_id, original_filename, file_size, transaction_count, date_from, date_to) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, 'Manual_Ledger_INR.csv', 1024, 1, dateStr, dateStr]
      );
      statementId = newStmt?.insertId || newStmt?.lastInsertRowid || 1;
    }

    const [insertRes]: any = await query(
      `INSERT INTO transactions (statement_id, user_id, transaction_date, description, merchant, amount, transaction_type, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [statementId, userId, dateStr, description.trim(), merch, amt, type, cat]
    );

    const newId = insertRes?.insertId || insertRes?.lastInsertRowid;

    // Update statement count
    await query('UPDATE bank_statements SET transaction_count = transaction_count + 1 WHERE id = ?', [statementId]);

    res.status(201).json({
      success: true,
      message: `Transaction of ₹${amt.toLocaleString('en-IN')} recorded successfully.`,
      data: {
        id: newId,
        transaction_date: dateStr,
        description,
        merchant: merch,
        amount: amt,
        transaction_type: type,
        category: cat,
      },
    });
  } catch (err: any) {
    console.error('[Create Transaction Error]', err);
    res.status(500).json({ success: false, message: 'Failed to record transaction.' });
  }
}

export async function updateTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const txId = parseInt(req.params.id, 10);

  if (isNaN(txId)) {
    res.status(400).json({ success: false, message: 'Invalid transaction ID.' });
    return;
  }

  const { transaction_date, description, merchant, amount, transaction_type, category } = req.body;

  try {
    const [existing] = await query('SELECT id FROM transactions WHERE id = ? AND user_id = ?', [txId, userId]);
    if (!existing || existing.length === 0) {
      res.status(404).json({ success: false, message: 'Transaction not found.' });
      return;
    }

    const amt = amount !== undefined ? Math.abs(parseFloat(amount)) : undefined;

    await query(
      `UPDATE transactions SET
         transaction_date = COALESCE(?, transaction_date),
         description = COALESCE(?, description),
         merchant = COALESCE(?, merchant),
         amount = COALESCE(?, amount),
         transaction_type = COALESCE(?, transaction_type),
         category = COALESCE(?, category)
       WHERE id = ? AND user_id = ?`,
      [
        transaction_date || null,
        description || null,
        merchant || null,
        amt !== undefined ? amt : null,
        transaction_type || null,
        category || null,
        txId,
        userId,
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Transaction updated successfully.',
    });
  } catch (err: any) {
    console.error('[Update Transaction Error]', err);
    res.status(500).json({ success: false, message: 'Failed to update transaction.' });
  }
}

export async function deleteTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const txId = parseInt(req.params.id, 10);

  if (isNaN(txId)) {
    res.status(400).json({ success: false, message: 'Invalid transaction ID.' });
    return;
  }

  try {
    const [existing] = await query('SELECT id, statement_id FROM transactions WHERE id = ? AND user_id = ?', [txId, userId]);
    if (!existing || existing.length === 0) {
      res.status(404).json({ success: false, message: 'Transaction not found.' });
      return;
    }

    await query('DELETE FROM transactions WHERE id = ? AND user_id = ?', [txId, userId]);

    // Update statement count
    if (existing[0]?.statement_id) {
      await query('UPDATE bank_statements SET transaction_count = MAX(transaction_count - 1, 0) WHERE id = ?', [existing[0].statement_id]);
    }

    res.status(200).json({
      success: true,
      message: 'Transaction deleted successfully.',
    });
  } catch (err: any) {
    console.error('[Delete Transaction Error]', err);
    res.status(500).json({ success: false, message: 'Failed to delete transaction.' });
  }
}

export async function resetDemoTransactions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  try {
    // Delete existing transactions and statements
    await query('DELETE FROM transactions WHERE user_id = ?', [userId]);
    await query('DELETE FROM bank_statements WHERE user_id = ?', [userId]);
    await query('DELETE FROM recurring_payments WHERE user_id = ?', [userId]);

    // Create fresh Indian banking statement
    const [stmtRes]: any = await query(
      `INSERT INTO bank_statements (user_id, original_filename, file_size, transaction_count, date_from, date_to)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, 'HDFC_Smart_Checking_INR_2026.csv', 18450, 16, '2026-06-01', '2026-06-30']
    );

    const statementId = stmtRes?.insertId || stmtRes?.lastInsertRowid || 1;

    // Authentic Indian Rupee transactions with proper amounts & categories
    const sampleTx = [
      { date: '2026-06-28', desc: 'TCS Monthly Technology Salary Credit', merchant: 'Tata Consultancy Services', amount: 95000.00, type: 'income', cat: 'Income' },
      { date: '2026-06-25', desc: 'Freelance UI/UX Mobile App Milestone', merchant: 'Upwork Global Wire', amount: 38500.00, type: 'income', cat: 'Income' },
      { date: '2026-06-24', desc: 'Apartment Monthly Rent HDFC NetBanking', merchant: 'Prestige Lakeside Habitat', amount: 24000.00, type: 'expense', cat: 'Housing' },
      { date: '2026-06-22', desc: 'Zerodha Coin Nifty 50 Index SIP', merchant: 'Zerodha Broking Ltd', amount: 15000.00, type: 'expense', cat: 'Investments' },
      { date: '2026-06-20', desc: 'Blinkit Instant Groceries & Essentials', merchant: 'Blinkit Commerce', amount: 3420.00, type: 'expense', cat: 'Food & Dining' },
      { date: '2026-06-18', desc: 'Amazon India Electronics Order', merchant: 'Amazon Retail India', amount: 5690.00, type: 'expense', cat: 'Shopping' },
      { date: '2026-06-16', desc: 'Tata Power Electricity Bill Payment', merchant: 'Tata Power Mumbai', amount: 2480.00, type: 'expense', cat: 'Utilities' },
      { date: '2026-06-15', desc: 'Groww Parag Parikh Flexi Cap SIP', merchant: 'Groww Mutual Funds', amount: 10000.00, type: 'expense', cat: 'Investments' },
      { date: '2026-06-14', desc: 'Swiggy Gourmet Dinner & Delivery', merchant: 'Swiggy Food Order', amount: 1250.00, type: 'expense', cat: 'Food & Dining' },
      { date: '2026-06-12', desc: 'Airtel Xstream Fiber Broadband Plan', merchant: 'Bharti Airtel Broadband', amount: 1179.00, type: 'expense', cat: 'Utilities' },
      { date: '2026-06-10', desc: 'Dividend Payout ICICI Bank Shares', merchant: 'ICICI Securities Payout', amount: 4850.00, type: 'income', cat: 'Income' },
      { date: '2026-06-08', desc: 'MakeMyTrip Flight Tickets Bangalore', merchant: 'MakeMyTrip India', amount: 4950.00, type: 'expense', cat: 'Travel' },
      { date: '2026-06-06', desc: 'Zomato Dining & Restaurant Bill', merchant: 'Zomato Dining Out', amount: 1820.00, type: 'expense', cat: 'Food & Dining' },
      { date: '2026-06-05', desc: 'Netflix India 4K Family Subscription', merchant: 'Netflix Services India', amount: 649.00, type: 'expense', cat: 'Subscriptions' },
      { date: '2026-06-03', desc: 'Cult.fit Fitness Center Annual Membership', merchant: 'Cult.fit Healthcare', amount: 1999.00, type: 'expense', cat: 'Healthcare' },
      { date: '2026-06-01', desc: 'Spotify Premium Individual Annual', merchant: 'Spotify India Music', amount: 299.00, type: 'expense', cat: 'Subscriptions' },
    ];

    for (const t of sampleTx) {
      await query(
        `INSERT INTO transactions (statement_id, user_id, transaction_date, description, merchant, amount, transaction_type, category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [statementId, userId, t.date, t.desc, t.merchant, t.amount, t.type, t.cat]
      );
    }

    // Seed recurring
    const recurring = [
      { merchant: 'Prestige Lakeside Habitat', cat: 'Housing', avg: 24000.00, cost: 24000.00, date: '2026-06-24' },
      { merchant: 'Zerodha Broking Ltd', cat: 'Investments', avg: 15000.00, cost: 15000.00, date: '2026-06-22' },
      { merchant: 'Groww Mutual Funds', cat: 'Investments', avg: 10000.00, cost: 10000.00, date: '2026-06-15' },
      { merchant: 'Netflix Services India', cat: 'Subscriptions', avg: 649.00, cost: 649.00, date: '2026-06-05' },
      { merchant: 'Bharti Airtel Broadband', cat: 'Utilities', avg: 1179.00, cost: 1179.00, date: '2026-06-12' },
    ];

    for (const r of recurring) {
      await query(
        `INSERT INTO recurring_payments (user_id, merchant, category, average_amount, frequency, estimated_monthly_cost, last_transaction_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, r.merchant, r.cat, r.avg, 'monthly', r.cost, r.date]
      );
    }

    res.status(200).json({
      success: true,
      message: 'Reset successfully! 16 verified Indian Rupee (₹) transactions loaded.',
      count: sampleTx.length,
    });
  } catch (err: any) {
    console.error('[Reset Demo Transactions Error]', err);
    res.status(500).json({ success: false, message: 'Failed to reset demo transactions.' });
  }
}
