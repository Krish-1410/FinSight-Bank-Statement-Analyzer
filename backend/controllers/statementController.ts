import { Request, Response } from 'express';
import { query } from '../config/db.js';
import { parseBankStatementCSV } from '../services/csvParser.js';
import { detectRecurringPayments, calculateSummary, calculateCategoryBreakdown } from '../services/transactionAnalyzer.js';

export async function uploadStatement(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  if (!req.file) {
    res.status(400).json({ success: false, message: 'No CSV file was uploaded.' });
    return;
  }

  const originalName = req.file.originalname;
  const fileSize = req.file.size;

  if (!originalName.toLowerCase().endsWith('.csv') && req.file.mimetype !== 'text/csv' && req.file.mimetype !== 'application/vnd.ms-excel') {
    res.status(400).json({ success: false, message: 'Invalid file format. Please upload a valid .csv file.' });
    return;
  }

  try {
    const csvString = req.file.buffer.toString('utf-8');
    const parsed = parseBankStatementCSV(csvString);

    if (parsed.transactions.length === 0) {
      res.status(400).json({ success: false, message: 'No valid transactions found in the CSV file.' });
      return;
    }

    // Optional or default: if user wants to analyze ONLY this uploaded statement without mixing old ones
    const { clearPrevious } = req.body;
    if (clearPrevious === 'true' || clearPrevious === true || clearPrevious === '1') {
      await query('DELETE FROM transactions WHERE user_id = ?', [userId]);
      await query('DELETE FROM bank_statements WHERE user_id = ?', [userId]);
      await query('DELETE FROM recurring_payments WHERE user_id = ?', [userId]);
    }

    // 1. Insert bank statement record
    const [statementResult] = await query(
      `INSERT INTO bank_statements (user_id, original_filename, file_size, transaction_count, date_from, date_to)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, originalName, fileSize, parsed.transactions.length, parsed.dateFrom, parsed.dateTo]
    );

    const statementId = (statementResult as any)?.insertId || (statementResult as any)?.lastInsertRowid || 1;

    // 2. Insert transactions into database
    for (const tx of parsed.transactions) {
      await query(
        `INSERT INTO transactions (statement_id, user_id, transaction_date, description, merchant, amount, transaction_type, category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [statementId, userId, tx.transaction_date, tx.description, tx.merchant, tx.amount, tx.transaction_type, tx.category]
      );
    }

    // 3. Re-calculate and update recurring payments for user
    await updateRecurringPaymentsForUser(userId);

    const summary = calculateSummary(parsed.transactions);
    const categories = calculateCategoryBreakdown(parsed.transactions);

    res.status(201).json({
      success: true,
      message: 'Bank statement analyzed and imported successfully.',
      data: {
        statement: {
          id: statementId,
          filename: originalName,
          transactionCount: parsed.transactions.length,
          dateFrom: parsed.dateFrom,
          dateTo: parsed.dateTo,
          fileSize,
        },
        summary,
        topCategories: categories.slice(0, 3),
      },
    });
  } catch (err: any) {
    console.error('[Statement Upload Error]', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Unable to parse and process the uploaded CSV file.',
    });
  }
}

export async function getStatements(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  try {
    const [rows] = await query(
      `SELECT id, original_filename, file_size, transaction_count, date_from, date_to, uploaded_at
       FROM bank_statements
       WHERE user_id = ?
       ORDER BY uploaded_at DESC`,
      [userId]
    );

    res.status(200).json({
      success: true,
      data: {
        statements: rows,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve bank statements.' });
  }
}

export async function deleteStatement(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const statementId = parseInt(req.params.id, 10);

  if (isNaN(statementId)) {
    res.status(400).json({ success: false, message: 'Invalid statement ID.' });
    return;
  }

  try {
    // Delete associated transactions first
    await query('DELETE FROM transactions WHERE statement_id = ? AND user_id = ?', [statementId, userId]);
    // Delete statement
    await query('DELETE FROM bank_statements WHERE id = ? AND user_id = ?', [statementId, userId]);

    // Check if any statements remain for user; if none, ensure all transactions and recurring are cleared
    const [remaining] = await query('SELECT count(*) as count FROM bank_statements WHERE user_id = ?', [userId]);
    const remCount = (remaining && remaining[0]?.count) || 0;
    if (remCount === 0) {
      await query('DELETE FROM transactions WHERE user_id = ?', [userId]);
      await query('DELETE FROM recurring_payments WHERE user_id = ?', [userId]);
    } else {
      // Refresh recurring payments
      await updateRecurringPaymentsForUser(userId);
    }

    res.status(200).json({
      success: true,
      message: 'Statement and its transactions deleted successfully.',
    });
  } catch (err: any) {
    console.error('[Delete Statement Error]', err);
    res.status(500).json({ success: false, message: 'Failed to delete statement.' });
  }
}

export async function clearAllStatements(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  try {
    await query('DELETE FROM transactions WHERE user_id = ?', [userId]);
    await query('DELETE FROM bank_statements WHERE user_id = ?', [userId]);
    await query('DELETE FROM recurring_payments WHERE user_id = ?', [userId]);

    res.status(200).json({
      success: true,
      message: 'All previous statements and transactions cleared successfully.',
    });
  } catch (err: any) {
    console.error('[Clear All Statements Error]', err);
    res.status(500).json({ success: false, message: 'Failed to clear all statements.' });
  }
}

export async function loadDemoStatement(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  try {
    const demoCSV = getSampleCSVContent();
    const parsed = parseBankStatementCSV(demoCSV);

    const [statementResult] = await query(
      `INSERT INTO bank_statements (user_id, original_filename, file_size, transaction_count, date_from, date_to)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, 'FinSight_Sample_Bank_Statement.csv', demoCSV.length, parsed.transactions.length, parsed.dateFrom, parsed.dateTo]
    );

    const statementId = (statementResult as any)?.insertId || (statementResult as any)?.lastInsertRowid || 1;

    for (const tx of parsed.transactions) {
      await query(
        `INSERT INTO transactions (statement_id, user_id, transaction_date, description, merchant, amount, transaction_type, category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [statementId, userId, tx.transaction_date, tx.description, tx.merchant, tx.amount, tx.transaction_type, tx.category]
      );
    }

    await updateRecurringPaymentsForUser(userId);

    res.status(201).json({
      success: true,
      message: 'Demo bank statement imported successfully! View your dashboard to explore insights.',
      data: {
        statementId,
        count: parsed.transactions.length,
      },
    });
  } catch (err: any) {
    console.error('[Demo Load Error]', err);
    res.status(500).json({ success: false, message: 'Failed to load demo data.' });
  }
}

export function downloadSampleCSV(req: Request, res: Response): void {
  const csvContent = getSampleCSVContent();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="FinSight_Sample_Statement.csv"');
  res.send(csvContent);
}

async function updateRecurringPaymentsForUser(userId: number) {
  const [allUserTx] = await query(
    'SELECT transaction_date, description, merchant, amount, transaction_type, category FROM transactions WHERE user_id = ?',
    [userId]
  );

  const detected = detectRecurringPayments(allUserTx);

  // Clear existing recurring payments for this user
  await query('DELETE FROM recurring_payments WHERE user_id = ?', [userId]);

  // Insert detected patterns
  for (const item of detected) {
    await query(
      `INSERT INTO recurring_payments (user_id, merchant, category, average_amount, frequency, estimated_monthly_cost, last_transaction_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, item.merchant, item.category, item.average_amount, item.frequency, item.estimated_monthly_cost, item.last_transaction_date]
    );
  }
}

function getSampleCSVContent(): string {
  return `Date,Description,Amount,Type
2026-08-01,TCS Monthly Technology Salary Credit,95000.00,Credit
2026-08-02,Prestige Lakeside Habitat Apartment Rent,24000.00,Debit
2026-08-03,Blinkit Instant Groceries & Daily Needs,2850.00,Debit
2026-08-05,Indian Oil Corporation Fuel Refill,2400.00,Debit
2026-08-07,Netflix India 4K Family Subscription,649.00,Debit
2026-08-08,Spotify India Music Premium,299.00,Debit
2026-08-10,Nature's Basket Organic Supermarket,3450.00,Debit
2026-08-12,Amazon Retail India Electronics Order,4890.00,Debit
2026-08-14,Zerodha Broking Coin Mutual Fund SIP,15000.00,Debit
2026-08-15,Upwork Global Freelance Design Milestone,38500.00,Credit
2026-08-16,Tata Power Mumbai Electricity Bill,2480.00,Debit
2026-08-18,Third Wave Coffee Roasters Reserve,450.00,Debit
2026-08-20,Apollo Pharmacy Healthcare & Wellness,850.00,Debit
2026-08-22,Uber India Airport Cab Ride,780.00,Debit
2026-08-24,Swiggy Food Gourmet Dinner Order,1250.00,Debit
2026-08-26,Groww Flexi Cap Equity Mutual Fund SIP,10000.00,Debit
2026-08-28,Airtel Xstream Fiber Broadband Plan,1179.00,Debit
2026-08-29,Flipkart Fashion Clothing Purchase,3250.00,Debit
2026-09-01,TCS Monthly Technology Salary Credit,95000.00,Credit
2026-09-02,Prestige Lakeside Habitat Apartment Rent,24000.00,Debit
2026-09-04,Nature's Basket Supermarket Groceries,3120.00,Debit
2026-09-06,Bharat Petroleum Petrol Fuel,2200.00,Debit
2026-09-07,Netflix India 4K Family Subscription,649.00,Debit
2026-09-08,Spotify India Music Premium,299.00,Debit
2026-09-10,ICICI Bank Dividend Yield Payout,4850.00,Credit
2026-09-12,MakeMyTrip Bangalore Indigo Flight,4950.00,Debit
2026-09-14,Zerodha Broking Coin Mutual Fund SIP,15000.00,Debit
2026-09-16,Tata Power Mumbai Electricity Bill,2390.00,Debit
2026-09-19,Amazon India Prime Household Essentials,3780.00,Debit
2026-09-21,Zomato Restaurant Weekend Dinner,1820.00,Debit
2026-09-24,Cult.fit Fitness Center Pass,1999.00,Debit
2026-09-27,Airtel Xstream Fiber Broadband Plan,1179.00,Debit`;
}
