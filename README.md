# FinSight — Premium Bank Statement CSV Financial Analytics

**FinSight** is an original full-stack fintech web application that allows users to upload their bank statement CSV files and automatically analyze transaction data, categorize expenses, detect recurring payments, and track cash flow.

Built using **HTML5 + Tailwind CSS + Vanilla JavaScript** on the frontend, **Node.js + Express.js** on the backend, and **MySQL** for persistent relational storage.

---

## Key Features

- **Bank Statement CSV Ingestion**: Compatible with Chase, Bank of America, Wells Fargo, Citi, Capital One, Revolut, and standard CSV formats.
- **Rule-Based Categorization**: Normalizes merchants and classifies expenses into Housing, Food & Dining, Transportation, Utilities, Healthcare, Entertainment, Subscriptions, Travel, Education, Shopping, and Other.
- **Financial Intelligence**:
  - Total Income & Total Spending
  - Net Cash Flow (`income - spending`)
  - Savings Rate (`(netCashFlow / income) * 100`)
  - Average Monthly Spend
  - Highest single expense detection
  - Month-over-month trend changes
- **Recurring Payment Detection**: Flags likely recurring payments and subscriptions by analyzing merchant uniformity, amount consistency, and interval periodicity.
- **Interactive Visualizations**:
  - Monthly spending trajectory line chart
  - Cash flow income vs. spending bar chart
  - Category breakdown interactive donut chart
- **Transaction Explorer**: Live search, category filtering, inflow/outflow filters, sorting, and pagination.
- **Report Exporting**: Export structured reports and transaction ledgers to CSV.
- **Production-Minded Security**:
  - User email and bcrypt password hashes stored in MySQL. Plain text passwords are never stored.
  - HTTP-only authentication cookies and JWT session tokens.
  - Strict user data isolation: all financial queries enforce `WHERE user_id = ?`.
  - Zero bank credentials required (no third-party scraping).

---

## Technology Stack

- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript (ES Modules), Chart.js, Lucide Icons
- **Backend**: Node.js, Express.js (REST API architecture)
- **CSV Processing**: `csv-parse`
- **Authentication**: `bcryptjs`, `jsonwebtoken`, `cookie-parser`
- **Database**: MySQL with `mysql2` connection pool (prepared statements)

---

## Step-by-Step Setup Instructions

Follow these 10 steps to run FinSight locally on your machine:

### 1. Install Node.js Dependencies

Ensure you have Node.js (version 18+ or 20+ recommended) installed. Run:

```bash
npm install
```

### 2. Install and Configure MySQL

If you don't already have MySQL installed, install MySQL Server:
- **macOS**: `brew install mysql && brew services start mysql`
- **Ubuntu/Debian**: `sudo apt update && sudo apt install mysql-server && sudo systemctl start mysql`
- **Windows**: Download and install the MySQL Community Server from [mysql.com](https://dev.mysql.com/downloads/mysql/).

Log in to MySQL as root:

```bash
mysql -u root -p
```

### 3. Create the `finsight` Database

In the MySQL terminal:

```sql
CREATE DATABASE IF NOT EXISTS finsight CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Run `database/schema.sql`

Execute the schema file to initialize the `users`, `bank_statements`, `transactions`, and `recurring_payments` tables:

```bash
mysql -u root -p finsight < database/schema.sql
```

*(Optional)* If you wish to seed demo data (Alex Morgan, sample transactions, and recurring subscriptions):

```bash
mysql -u root -p finsight < database/seed.sql
```

### 5. Configure `.env`

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update your `.env` with your MySQL credentials:

```env
PORT=3000
NODE_ENV=development

# MySQL Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=finsight
DB_USER=root
DB_PASSWORD=your_mysql_password

# Authentication & Session Security
SESSION_SECRET=your_long_random_session_secret_change_in_production
JWT_EXPIRES_IN=7d
```

> **Zero-Config Sandbox Mode**: If MySQL is not running on `localhost:3306` when starting the server, FinSight will automatically fall back to an integrated local relational SQLite engine with the exact same SQL queries and schema so you can test and explore immediately without configuration!

### 6. Start the Node.js Server

Start the development server:

```bash
npm run dev
```

Or for production:

```bash
npm run build
npm start
```

### 7. Open the Frontend

Open your browser and navigate to:

```text
http://localhost:3000
```

### 8. Register an Account

1. Click **Analyze My Statement** or **Sign In** -> **Create one**.
2. Enter your Name, Email, Password, and Password Confirmation.
3. Click **Create Account**. Your password is salted and hashed using bcrypt and stored securely in the `users` table.

*(Or sign in using the demo account: `demo@finsight.app` / `password123`)*

### 9. Upload a Bank Statement CSV

1. Click **Upload Statement** in the sidebar.
2. Drag and drop your `.csv` statement file (or click **Download Sample CSV** if you need a test file).
3. Click **Analyze Transactions**.
4. FinSight parses columns, normalizes dates and amounts, classifies expenses by merchant rules, and records everything to MySQL.

### 10. View the Analysis

- **Dashboard**: View your Total Income, Total Spending, Net Cash Flow, Savings Rate, Spending Over Time graph, and Category Donut chart.
- **Transactions Explorer**: Filter transactions by category or inflow/outflow, search by merchant or memo, sort by date/amount, and paginate through records.
- **Insights & Subscriptions**: View key observations, recurring payment patterns, and estimated monthly subscription totals.
- **Export Report**: Click **Export CSV** to download a comprehensive financial summary and transaction ledger.

---

## Database Architecture

```text
users
├── id (INT AUTO_INCREMENT PRIMARY KEY)
├── name (VARCHAR)
├── email (VARCHAR UNIQUE, INDEX)
├── password_hash (VARCHAR - bcrypt hash only)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

bank_statements
├── id (INT AUTO_INCREMENT PRIMARY KEY)
├── user_id (INT, FK -> users.id)
├── original_filename (VARCHAR)
├── file_size (INT)
├── transaction_count (INT)
├── date_from (DATE)
├── date_to (DATE)
└── uploaded_at (TIMESTAMP)

transactions
├── id (INT AUTO_INCREMENT PRIMARY KEY)
├── statement_id (INT, FK -> bank_statements.id)
├── user_id (INT, FK -> users.id)
├── transaction_date (DATE, INDEX)
├── description (VARCHAR)
├── merchant (VARCHAR)
├── amount (DECIMAL(12,2))
├── transaction_type ('expense' | 'income')
├── category (VARCHAR, INDEX)
└── created_at (TIMESTAMP)

recurring_payments
├── id (INT AUTO_INCREMENT PRIMARY KEY)
├── user_id (INT, FK -> users.id)
├── merchant (VARCHAR)
├── category (VARCHAR)
├── average_amount (DECIMAL(12,2))
├── frequency (VARCHAR)
├── estimated_monthly_cost (DECIMAL(12,2))
├── last_transaction_date (DATE)
└── created_at (TIMESTAMP)
```

---

## API Documentation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new account with bcrypt hashing |
| `POST` | `/api/auth/login` | Sign in and receive HTTP-only session cookie |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `GET` | `/api/auth/me` | Fetch authenticated user profile |
| `POST` | `/api/auth/change-password` | Update account password |
| `POST` | `/api/statements/upload` | Upload and analyze `.csv` bank statement |
| `GET` | `/api/statements` | List statements uploaded by authenticated user |
| `DELETE`| `/api/statements/:id` | Delete statement and associated transactions |
| `POST` | `/api/statements/demo` | Import sample checking statement |
| `GET` | `/api/statements/sample-csv` | Download sample CSV template |
| `GET` | `/api/dashboard/summary` | Get income, spending, net flow, and savings rate |
| `GET` | `/api/dashboard/categories` | Get category expense breakdown and percentages |
| `GET` | `/api/dashboard/monthly` | Get monthly income vs. spending time series |
| `GET` | `/api/transactions` | Query transactions with search, category, type, and pagination |
| `GET` | `/api/transactions/:id` | Get details of a single transaction |
| `GET` | `/api/insights` | Get rule-based observations from transaction data |
| `GET` | `/api/recurring-payments`| Get detected recurring payments and monthly costs |
| `GET` | `/api/reports/summary` | Get structured financial summary report |
| `GET` | `/api/reports/export/csv` | Download comprehensive CSV report |

---

## License

MIT License. Built for **FinSight**.
