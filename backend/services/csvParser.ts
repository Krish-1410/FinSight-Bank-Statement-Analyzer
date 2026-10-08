import { parse } from 'csv-parse/sync';
import { extractMerchant, categorizeTransaction, Category } from './categoryAnalyzer.js';

export interface ParsedTransaction {
  transaction_date: string; // YYYY-MM-DD
  description: string;
  merchant: string;
  amount: number; // always positive float
  transaction_type: 'expense' | 'income';
  category: Category;
}

export interface CSVParseResult {
  transactions: ParsedTransaction[];
  dateFrom: string | null;
  dateTo: string | null;
  totalParsed: number;
}

export function parseBankStatementCSV(csvContent: string): CSVParseResult {
  // Parse CSV records
  const records: Record<string, string>[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  if (!records || records.length === 0) {
    throw new Error('CSV file is empty or contains no readable rows.');
  }

  // Detect header keys
  const firstRow = records[0];
  const keys = Object.keys(firstRow);

  const dateKey = findKey(keys, ['date', 'transaction_date', 'posting_date', 'post_date', 'trans_date', 'activity_date']);
  const descKey = findKey(keys, ['description', 'payee', 'memo', 'merchant', 'transaction_description', 'name', 'details']);
  const amountKey = findKey(keys, ['amount', 'trans_amount', 'transaction_amount', 'total']);
  const debitKey = findKey(keys, ['debit', 'debit_amount', 'withdrawal', 'outflow', 'charge', 'spend']);
  const creditKey = findKey(keys, ['credit', 'credit_amount', 'deposit', 'inflow']);
  const typeKey = findKey(keys, ['type', 'transaction_type', 'record_type']);
  const categoryKey = findKey(keys, ['category', 'user_category']);

  if (!dateKey) {
    throw new Error('Could not identify a Date column in the CSV. Please ensure a "Date" or "Transaction Date" header exists.');
  }

  if (!descKey && !amountKey && !debitKey) {
    throw new Error('CSV does not have recognizable transaction columns (Description, Amount, Debit/Credit).');
  }

  const transactions: ParsedTransaction[] = [];
  let minDate: string | null = null;
  let maxDate: string | null = null;

  // Analyze if dataset contains mixed sign amounts (standard bank statement)
  let hasNegativeAmounts = false;
  let hasPositiveAmounts = false;
  for (const row of records) {
    if (amountKey) {
      const val = parseCurrency(row[amountKey]);
      if (val < 0) hasNegativeAmounts = true;
      if (val > 0) hasPositiveAmounts = true;
    }
  }
  const isMixedSignStatement = hasNegativeAmounts && hasPositiveAmounts;

  for (const row of records) {
    const rawDate = row[dateKey]?.trim();
    if (!rawDate) continue;

    const formattedDate = parseAndFormatDate(rawDate);
    if (!formattedDate) continue;

    const description = (descKey ? row[descKey] : 'Transaction') || 'Unknown Transaction';
    let amount = 0;
    let type: 'expense' | 'income' = 'expense';

    if (debitKey && creditKey) {
      const debitVal = Math.abs(parseCurrency(row[debitKey]));
      const creditVal = Math.abs(parseCurrency(row[creditKey]));

      if (creditVal > 0) {
        amount = creditVal;
        type = 'income';
      } else if (debitVal > 0) {
        amount = debitVal;
        type = 'expense';
      } else if (amountKey) {
        const amtVal = parseCurrency(row[amountKey]);
        amount = Math.abs(amtVal);
        type = amtVal >= 0 ? 'income' : 'expense';
      }
    } else if (amountKey) {
      const parsedAmount = parseCurrency(row[amountKey]);
      amount = Math.abs(parsedAmount);

      if (typeKey) {
        const rawType = (row[typeKey] || '').toLowerCase().trim();
        const isCredit = /credit|\bcr\b|deposit|income|inflow|payroll|settlement/i.test(rawType);
        const isDebit = /debit|\bdr\b|withdrawal|expense|outflow|charge/i.test(rawType);

        if (isCredit) {
          type = 'income';
        } else if (isDebit) {
          type = 'expense';
        } else {
          type = parsedAmount >= 0 ? 'income' : 'expense';
        }
      } else if (isMixedSignStatement) {
        // Standard checking statement: Positive = money in (income), Negative = money out (expense)
        type = parsedAmount > 0 ? 'income' : 'expense';
      } else {
        // All amounts same sign (e.g. credit card statement or positive-only ledger)
        const isIncomeKeyword = /payroll|salary|wage|bonus|direct dep|dividend|interest|credit|refund|reimbursement|deposit|inflow|received|wire in|stripe payout|settlement|sale/i.test(description);
        type = isIncomeKeyword ? 'income' : 'expense';
      }
    }

    if (amount <= 0) continue; // skip 0 amount rows

    const merchant = extractMerchant(description);
    
    // Check if category already provided in CSV
    let category: Category;
    const rawCat = categoryKey ? row[categoryKey]?.trim() : '';
    if (rawCat && rawCat.length > 2) {
      category = rawCat as Category;
    } else {
      category = categorizeTransaction(description, merchant, type);
    }

    transactions.push({
      transaction_date: formattedDate,
      description: description.substring(0, 500),
      merchant: merchant.substring(0, 255),
      amount: Math.round(amount * 100) / 100,
      transaction_type: type,
      category,
    });

    if (!minDate || formattedDate < minDate) minDate = formattedDate;
    if (!maxDate || formattedDate > maxDate) maxDate = formattedDate;
  }

  return {
    transactions,
    dateFrom: minDate,
    dateTo: maxDate,
    totalParsed: transactions.length,
  };
}

function findKey(keys: string[], aliases: string[]): string | undefined {
  const normalized = keys.map(k => ({
    original: k,
    clean: k.toLowerCase().replace(/[^a-z0-9]/g, '_'),
  }));

  for (const alias of aliases) {
    const match = normalized.find(k => k.clean === alias || k.clean.includes(alias));
    if (match) return match.original;
  }
  return undefined;
}

function parseCurrency(str: string | undefined): number {
  if (!str) return 0;
  let clean = str.trim();
  if (!clean) return 0;
  const isNegative = clean.includes('-') || (clean.startsWith('(') && clean.endsWith(')')) || clean.toLowerCase().includes('dr');
  clean = clean.replace(/(?:INR|RS\.?|₹|\$|\€|\£)/gi, '');
  clean = clean.replace(/[\,\(\)\-\s]/g, '').trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : num;
}

function parseAndFormatDate(raw: string): string | null {
  if (!raw) return null;
  const clean = raw.trim();

  // 1. ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    return clean.substring(0, 10);
  }

  // 2. Detect DD/MM/YYYY vs MM/DD/YYYY:
  // In India and UK, bank statements use DD/MM/YYYY or DD-MM-YYYY.
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmyMatch) {
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    const n1 = parseInt(dmyMatch[1], 10);
    const n2 = parseInt(dmyMatch[2], 10);

    let day = n1;
    let month = n2;

    // If first number > 12, it must be DD/MM/YYYY
    if (n1 > 12 && n2 <= 12) {
      day = n1;
      month = n2;
    } else if (n2 > 12 && n1 <= 12) {
      // MM/DD/YYYY
      month = n1;
      day = n2;
    } else {
      // Default to DD/MM/YYYY for Indian banking statements
      day = n1;
      month = n2;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // 3. Date object fallback
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}
