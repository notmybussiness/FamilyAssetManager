import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

export async function initDatabase(): Promise<void> {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  // Ensure data directory exists
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = join(dbDir, 'family-assets.db')
  console.log('Database path:', dbPath)

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Create tables
  createTables()

  // Run migrations
  runMigrations()
}

function createTables(): void {
  const database = getDatabase()

  // Users table
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_primary INTEGER NOT NULL DEFAULT 0
    )
  `)

  // Accounts table (HANWHA 추가)
  database.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      brokerage TEXT NOT NULL,
      account_type TEXT NOT NULL,
      account_number TEXT NOT NULL,
      account_alias TEXT,
      api_key TEXT,
      api_secret TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Holdings table (prev_close 추가)
  database.exec(`
    CREATE TABLE IF NOT EXISTS holdings (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      stock_code TEXT NOT NULL,
      stock_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      avg_cost REAL NOT NULL DEFAULT 0,
      current_price REAL NOT NULL DEFAULT 0,
      prev_close REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'KRW',
      last_synced TEXT,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      UNIQUE(account_id, stock_code)
    )
  `)

  // Transactions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      stock_code TEXT NOT NULL,
      stock_name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL', 'DIVIDEND')),
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      total_amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'KRW',
      date TEXT NOT NULL,
      is_manual INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL CHECK (source IN ('API', 'MANUAL', 'EXCEL')),
      import_batch_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `)

  // Sync log table
  database.exec(`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PARTIAL')),
      error_message TEXT,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `)

  // Exchange rates table
  database.exec(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id TEXT PRIMARY KEY,
      currency_pair TEXT NOT NULL,
      rate REAL NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Trading strategies table
  database.exec(`
    CREATE TABLE IF NOT EXISTS trading_strategies (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      stock_code TEXT,
      name TEXT NOT NULL,
      sell_trigger_percent REAL NOT NULL DEFAULT 5.0,
      buy_trigger_percent REAL NOT NULL DEFAULT -5.0,
      sell_quantity_percent REAL NOT NULL DEFAULT 50.0,
      buy_amount REAL,
      buy_quantity_multiplier REAL DEFAULT 1.0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Strategy signals table (triggered signals log)
  database.exec(`
    CREATE TABLE IF NOT EXISTS strategy_signals (
      id TEXT PRIMARY KEY,
      strategy_id TEXT NOT NULL,
      holding_id TEXT NOT NULL,
      stock_code TEXT NOT NULL,
      stock_name TEXT NOT NULL,
      account_id TEXT NOT NULL,
      signal_type TEXT NOT NULL CHECK (signal_type IN ('BUY', 'SELL')),
      trigger_price REAL NOT NULL,
      avg_cost REAL NOT NULL,
      trigger_percent REAL NOT NULL,
      current_quantity REAL NOT NULL,
      suggested_quantity REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'EXECUTED', 'DISMISSED')),
      executed_transaction_id TEXT,
      executed_at TEXT,
      dismissed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (strategy_id) REFERENCES trading_strategies(id) ON DELETE CASCADE,
      FOREIGN KEY (holding_id) REFERENCES holdings(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `)

  // Ticker mappings table (수동 티커 매핑)
  database.exec(`
    CREATE TABLE IF NOT EXISTS ticker_mappings (
      id TEXT PRIMARY KEY,
      stock_name TEXT NOT NULL UNIQUE,
      ticker TEXT NOT NULL,
      market TEXT NOT NULL DEFAULT 'US',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Create indexes
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_holdings_account ON holdings(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_sync_logs_account ON sync_logs(account_id);
    CREATE INDEX IF NOT EXISTS idx_strategies_user ON trading_strategies(user_id);
    CREATE INDEX IF NOT EXISTS idx_signals_strategy ON strategy_signals(strategy_id);
    CREATE INDEX IF NOT EXISTS idx_signals_status ON strategy_signals(status);
    CREATE INDEX IF NOT EXISTS idx_signals_holding ON strategy_signals(holding_id);
    CREATE INDEX IF NOT EXISTS idx_ticker_mappings_name ON ticker_mappings(stock_name);
  `)

  console.log('Database tables created successfully')
}

function runMigrations(): void {
  const database = getDatabase()

  // prev_close 컬럼 추가 마이그레이션
  try {
    const columns = database.prepare("PRAGMA table_info(holdings)").all() as Array<{ name: string }>
    const hasPrevClose = columns.some(col => col.name === 'prev_close')
    if (!hasPrevClose) {
      database.exec('ALTER TABLE holdings ADD COLUMN prev_close REAL NOT NULL DEFAULT 0')
      console.log('Migration: Added prev_close column to holdings')
    }
  } catch (error) {
    console.error('Migration error:', error)
  }

  // 기본 티커 매핑 추가
  try {
    const defaultMappings = [
      { name: 'Vanguard S&P 500 ETF', ticker: 'VOO', market: 'US' },
      { name: 'SPDR S&P 500 ETF Trust', ticker: 'SPY', market: 'US' },
      { name: 'Invesco QQQ Trust', ticker: 'QQQ', market: 'US' },
      { name: 'iShares Core S&P 500 ETF', ticker: 'IVV', market: 'US' },
      { name: 'Vanguard Total Stock Market ETF', ticker: 'VTI', market: 'US' }
    ]

    const insertStmt = database.prepare(`
      INSERT OR IGNORE INTO ticker_mappings (id, stock_name, ticker, market)
      VALUES (?, ?, ?, ?)
    `)

    for (const mapping of defaultMappings) {
      const id = `default-${mapping.ticker.toLowerCase()}`
      insertStmt.run(id, mapping.name, mapping.ticker, mapping.market)
    }
    console.log('Migration: Default ticker mappings added')
  } catch (error) {
    console.error('Ticker mapping migration error:', error)
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
