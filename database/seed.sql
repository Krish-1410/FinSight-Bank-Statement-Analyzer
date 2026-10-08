-- ===================================================
-- FinSight Database Seed Data (Optional Development Data)
-- Demo user: demo@finsight.app / password123
-- Password hash generated with bcrypt (10 rounds):
-- $2b$10$WpCcfwO0uF1y87p0Z/02UOKiC/Z67Yg4G15J2P1L6c9Z1A1C3O5A2
-- ===================================================

USE finsight;

-- Insert demo user if not exists
INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
VALUES (
  1,
  'Alex Morgan',
  'demo@finsight.app',
  '$2b$10$Ag1pu38UgBNtkEYgq2gy5eBN5TETE5HFJ1j5eQBIBayLDaHYodfaK',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash);

-- Insert demo bank statement
INSERT INTO bank_statements (id, user_id, original_filename, file_size, transaction_count, date_from, date_to, uploaded_at)
VALUES (
  1,
  1,
  'Chase_Checking_September_2026.csv',
  14280,
  14,
  '2026-09-01',
  '2026-09-30',
  NOW()
) ON DUPLICATE KEY UPDATE original_filename=original_filename;

-- Insert demo transactions
INSERT INTO transactions (id, statement_id, user_id, transaction_date, description, merchant, amount, transaction_type, category) VALUES
(1, 1, 1, '2026-09-01', 'Direct Deposit Payroll Acme Corp', 'Acme Corp', 4250.00, 'income', 'Income'),
(2, 1, 1, '2026-09-02', 'Avalon Bay Communities Rent', 'Avalon Bay', 1850.00, 'expense', 'Housing'),
(3, 1, 1, '2026-09-04', 'Whole Foods Market Austin', 'Whole Foods Market', 142.60, 'expense', 'Food & Dining'),
(4, 1, 1, '2026-09-06', 'Chevron Gas Station 4210', 'Chevron', 54.20, 'expense', 'Transportation'),
(5, 1, 1, '2026-09-08', 'Netflix Monthly Subscription', 'Netflix', 19.99, 'expense', 'Subscriptions'),
(6, 1, 1, '2026-09-10', 'Amazon.com Electronics Order', 'Amazon', 129.50, 'expense', 'Shopping'),
(7, 1, 1, '2026-09-12', 'Starbucks Coffee Reserve', 'Starbucks', 14.75, 'expense', 'Food & Dining'),
(8, 1, 1, '2026-09-15', 'Direct Deposit Payroll Acme Corp', 'Acme Corp', 4250.00, 'income', 'Income'),
(9, 1, 1, '2026-09-16', 'City Water & Power Electric', 'City Power & Light', 115.40, 'expense', 'Utilities'),
(10, 1, 1, '2026-09-18', 'Spotify Premium Family', 'Spotify', 16.99, 'expense', 'Subscriptions'),
(11, 1, 1, '2026-09-20', 'Trader Joe Market Groceries', 'Trader Joe', 88.30, 'expense', 'Food & Dining'),
(12, 1, 1, '2026-09-22', 'CVS Pharmacy Prescription', 'CVS Pharmacy', 34.50, 'expense', 'Healthcare'),
(13, 1, 1, '2026-09-25', 'Uber Ride Downtown Metro', 'Uber', 28.40, 'expense', 'Transportation'),
(14, 1, 1, '2026-09-28', 'Equinox Fitness Club Gym', 'Equinox Fitness', 180.00, 'expense', 'Subscriptions')
ON DUPLICATE KEY UPDATE description=description;

-- Insert detected recurring payments
INSERT INTO recurring_payments (id, user_id, merchant, category, average_amount, frequency, estimated_monthly_cost, last_transaction_date) VALUES
(1, 1, 'Netflix', 'Subscriptions', 19.99, 'monthly', 19.99, '2026-09-08'),
(2, 1, 'Spotify', 'Subscriptions', 16.99, 'monthly', 16.99, '2026-09-18'),
(3, 1, 'Equinox Fitness', 'Subscriptions', 180.00, 'monthly', 180.00, '2026-09-28'),
(4, 1, 'Avalon Bay', 'Housing', 1850.00, 'monthly', 1850.00, '2026-09-02')
ON DUPLICATE KEY UPDATE merchant=merchant;
