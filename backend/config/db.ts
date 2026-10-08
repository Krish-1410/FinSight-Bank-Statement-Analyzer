import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

let mysqlPool: mysql.Pool | null = null;
let sqliteDb: DatabaseSync | null = null;
let activeDatabaseType: 'mysql' | 'sqlite' = 'sqlite';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_NAME = process.env.DB_NAME || 'finsight';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

export async function initDatabase(): Promise<void> {
  // 1. Attempt to connect to MySQL
  try {
    const isCloudHost = DB_HOST.includes('aivencloud.com') || DB_HOST.includes('rds.') || DB_PORT !== 3306;
    const poolConfig: mysql.PoolOptions = {
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 5000,
    };

    if (isCloudHost || process.env.DB_SSL === 'true') {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    const tempPool = mysql.createPool(poolConfig);
    const conn = await Promise.race([
      tempPool.getConnection(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('MySQL connection timeout')), 4000)),
    ]);

    await conn.ping();
    conn.release();

    mysqlPool = tempPool;
    activeDatabaseType = 'mysql';
    console.log(`[Database] Connected to MySQL database '${DB_NAME}' on ${DB_HOST}:${DB_PORT}`);

    // Create tables in MySQL if not exist & seed demo data
    await createMySQLTables();
    await seedDemoDataMySQL();
    return;
  } catch (err: any) {
    console.warn(`[Database] Notice: MySQL not reachable at ${DB_HOST}:${DB_PORT} (${err.code || err.message}).`);
    console.log('[Database] Initializing integrated local relational SQL store (SQLite) for sandbox preview execution.');
    
    initSQLite();
  }
}

function initSQLite() {
  activeDatabaseType = 'sqlite';
  const dbDir = path.resolve(process.cwd(), 'database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.resolve(dbDir, 'finsight.db');
  sqliteDb = new DatabaseSync(dbPath);

  // Enable foreign keys
  sqliteDb.exec('PRAGMA foreign_keys = ON;');

  // Create tables matching MySQL schema
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_statements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      original_filename TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      transaction_count INTEGER DEFAULT 0,
      date_from TEXT,
      date_to TEXT,
      uploaded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      statement_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      transaction_date TEXT NOT NULL,
      description TEXT NOT NULL,
      merchant TEXT NOT NULL,
      amount REAL NOT NULL,
      transaction_type TEXT NOT NULL DEFAULT 'expense',
      category TEXT NOT NULL DEFAULT 'Other',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (statement_id) REFERENCES bank_statements(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recurring_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      merchant TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Subscriptions',
      average_amount REAL NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'monthly',
      estimated_monthly_cost REAL NOT NULL,
      last_transaction_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category);
  `);

  seedDemoDataSQLite();
  console.log(`[Database] Relational SQL database ready at ${dbPath}`);
}

async function createMySQLTables() {
  if (!mysqlPool) return;
  const schemaPath = path.resolve(process.cwd(), 'database', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.toLowerCase().startsWith('create database') && !s.toLowerCase().startsWith('use '));

    for (const stmt of statements) {
      try {
        await mysqlPool.query(stmt);
      } catch (e: any) {
        // Ignore "already exists"
      }
    }
  }
}

const DEMO_BCRYPT_HASH = '$2b$10$Ag1pu38UgBNtkEYgq2gy5eBN5TETE5HFJ1j5eQBIBayLDaHYodfaK'; // password123

async function seedDemoDataMySQL() {
  if (!mysqlPool) return;
  try {
    const [existing] = await mysqlPool.query<any[]>('SELECT id FROM users WHERE email = ?', ['demo@finsight.app']);
    let userId = 1;

    if (!existing || existing.length === 0) {
      const [res]: any = await mysqlPool.query(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        ['Sujon Alex', 'demo@finsight.app', DEMO_BCRYPT_HASH]
      );
      userId = res.insertId;
      console.log(`[Database] Seeded demo user in MySQL: demo@finsight.app (id: ${userId})`);
    } else {
      userId = existing[0].id;
      await mysqlPool.query('UPDATE users SET password_hash = ? WHERE id = ?', [DEMO_BCRYPT_HASH, userId]);
    }

    // Check if user has statements
    const [stmts] = await mysqlPool.query<any[]>('SELECT id FROM bank_statements WHERE user_id = ?', [userId]);
    if (!stmts || stmts.length === 0) {
      await insertInitialSampleTransactions(userId, async (sql, p) => await mysqlPool!.query(sql, p));
      console.log(`[Database] Seeded rich transaction history for user ${userId} in MySQL`);
    }
  } catch (err: any) {
    console.error('[Database Seed MySQL Error]', err.message);
  }
}

function seedDemoDataSQLite() {
  if (!sqliteDb) return;
  try {
    let existing = sqliteDb.prepare('SELECT id FROM users WHERE email = ?').get('demo@finsight.app') as any;
    let userId = 1;
    if (!existing) {
      const res = sqliteDb.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('Sujon Alex', 'demo@finsight.app', DEMO_BCRYPT_HASH);
      userId = Number(res.lastInsertRowid);
      console.log(`[Database] Seeded demo user in SQLite: demo@finsight.app (id: ${userId})`);
    } else {
      userId = existing.id;
      sqliteDb.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(DEMO_BCRYPT_HASH, userId);
    }

    const stmts = sqliteDb.prepare('SELECT id FROM bank_statements WHERE user_id = ?').all(userId);
    if (!stmts || stmts.length === 0) {
      insertInitialSampleTransactions(userId, async (sql, p) => {
        sqliteDb!.prepare(sql).run(...p);
      });
      console.log(`[Database] Seeded rich transaction history for user ${userId} in SQLite`);
    }
  } catch (err: any) {
    console.error('[Database Seed SQLite Error]', err.message);
  }
}

export async function insertInitialSampleTransactions(userId: number, executor: (sql: string, params: any[]) => Promise<any>) {
  // 1. Insert statement
  const stmtRes = await executor(
    `INSERT INTO bank_statements (user_id, original_filename, file_size, transaction_count, date_from, date_to)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, 'HDFC_Salary_Checking_INR_2026.csv', 28450, 16, '2026-06-01', '2026-06-30']
  );

  const rawRes = Array.isArray(stmtRes) ? stmtRes[0] : stmtRes;
  const statementId = rawRes?.insertId || rawRes?.lastInsertRowid || 1;

  // 2. Insert sample transactions in Indian Rupees (₹)
  const transactions = [
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

  for (const t of transactions) {
    await executor(
      `INSERT INTO transactions (statement_id, user_id, transaction_date, description, merchant, amount, transaction_type, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [statementId, userId, t.date, t.desc, t.merchant, t.amount, t.type, t.cat]
    );
  }

  // 3. Recurring payments in INR (₹)
  const recurring = [
    { merchant: 'Prestige Lakeside Habitat', cat: 'Housing', avg: 24000.00, freq: 'monthly', cost: 24000.00, date: '2026-06-24' },
    { merchant: 'Zerodha Broking Ltd', cat: 'Investments', avg: 15000.00, freq: 'monthly', cost: 15000.00, date: '2026-06-22' },
    { merchant: 'Groww Mutual Funds', cat: 'Investments', avg: 10000.00, freq: 'monthly', cost: 10000.00, date: '2026-06-15' },
    { merchant: 'Tata Power Mumbai', cat: 'Utilities', avg: 2480.00, freq: 'monthly', cost: 2480.00, date: '2026-06-16' },
    { merchant: 'Bharti Airtel Broadband', cat: 'Utilities', avg: 1179.00, freq: 'monthly', cost: 1179.00, date: '2026-06-12' },
    { merchant: 'Netflix Services India', cat: 'Subscriptions', avg: 649.00, freq: 'monthly', cost: 649.00, date: '2026-06-05' },
  ];

  for (const r of recurring) {
    await executor(
      `INSERT INTO recurring_payments (user_id, merchant, category, average_amount, frequency, estimated_monthly_cost, last_transaction_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, r.merchant, r.cat, r.avg, r.freq, r.cost, r.date]
    );
  }
}

/**
 * Executes a parameterized SQL query.
 * Always returns [rows, fields] format matching mysql2/promise!
 */
export async function query(sql: string, params: any[] = []): Promise<[any, any]> {
  if (activeDatabaseType === 'mysql' && mysqlPool) {
    return await mysqlPool.execute(sql, params);
  }

  if (!sqliteDb) {
    initSQLite();
  }

  const trimmed = sql.trim();
  const isSelect = /^SELECT\b/i.test(trimmed);

  try {
    const stmt = sqliteDb!.prepare(sql);
    if (isSelect) {
      const rows = stmt.all(...params);
      return [rows, []];
    } else {
      const result = stmt.run(...params);
      return [
        {
          insertId: Number(result.lastInsertRowid),
          affectedRows: Number(result.changes),
        },
        [],
      ];
    }
  } catch (err: any) {
    console.error('[DB Query Error]', err.message, 'SQL:', sql, 'Params:', params);
    throw err;
  }
}

export function getDatabaseType(): 'mysql' | 'sqlite' {
  return activeDatabaseType;
}

export { mysqlPool };
