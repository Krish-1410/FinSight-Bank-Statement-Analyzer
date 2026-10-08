-- ===================================================
-- FinSight MySQL Database Schema
-- Production-ready relational schema with indexes & foreign keys
-- ===================================================

CREATE DATABASE IF NOT EXISTS finsight;
USE finsight;

-- 1. Users table
-- Passwords are ALWAYS stored as secure bcrypt hashes, never plain text.
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bank Statements table
CREATE TABLE IF NOT EXISTS bank_statements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_size INT NOT NULL,
  transaction_count INT DEFAULT 0,
  date_from DATE NULL,
  date_to DATE NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_statements_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  statement_id INT NOT NULL,
  user_id INT NOT NULL,
  transaction_date DATE NOT NULL,
  description VARCHAR(500) NOT NULL,
  merchant VARCHAR(255) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  transaction_type ENUM('expense', 'income') NOT NULL DEFAULT 'expense',
  category VARCHAR(100) NOT NULL DEFAULT 'Other',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tx_user (user_id),
  INDEX idx_tx_statement (statement_id),
  INDEX idx_tx_date (transaction_date),
  INDEX idx_tx_category (category),
  INDEX idx_tx_user_date (user_id, transaction_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (statement_id) REFERENCES bank_statements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Recurring Payments table
CREATE TABLE IF NOT EXISTS recurring_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  merchant VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Subscriptions',
  average_amount DECIMAL(12, 2) NOT NULL,
  frequency VARCHAR(50) NOT NULL DEFAULT 'monthly',
  estimated_monthly_cost DECIMAL(12, 2) NOT NULL,
  last_transaction_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_recurring_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
