import { ElectronAPI } from '@electron-toolkit/preload'

interface User {
  id: string
  name: string
  created_at: string
  is_primary: number
}

interface Account {
  id: string
  user_id: string
  brokerage: 'KOREA_INV' | 'MIRAE' | 'SAMSUNG'
  account_type: 'PENSION' | 'IRP' | 'ISA' | 'OVERSEAS'
  account_number: string
  account_alias: string | null
  api_key: string | null
  api_secret: string | null
  created_at: string
}

interface Holding {
  id: string
  account_id: string
  stock_code: string
  stock_name: string
  quantity: number
  avg_cost: number
  current_price: number
  currency: string
  last_synced: string | null
}

interface HoldingWithAccount extends Holding {
  brokerage: string
  account_type: string
  account_alias: string | null
}

interface AggregatedHolding {
  stock_code: string
  stock_name: string
  currency: string
  total_quantity: number
  weighted_avg_cost: number
  total_value: number
  current_price: number
  account_count: number
}

interface Transaction {
  id: string
  account_id: string
  stock_code: string
  stock_name: string
  type: 'BUY' | 'SELL' | 'DIVIDEND'
  quantity: number
  price: number
  total_amount: number
  currency: string
  date: string
  is_manual: number
  source: 'API' | 'MANUAL'
  created_at: string
}

interface TransactionWithAccount extends Transaction {
  brokerage: string
  account_type: string
  account_alias: string | null
}

interface PortfolioSummary {
  totalMarketValue: number
  totalCostBasis: number
  totalReturn: number
  totalReturnPercent: number
  byCurrency: Array<{ currency: string; market_value: number; cost_basis: number }>
  byAccountType: Array<{ account_type: string; market_value: number; cost_basis: number }>
  byBrokerage: Array<{ brokerage: string; market_value: number; cost_basis: number }>
}

interface PortfolioReturns {
  dailyReturn: number
  dailyReturnPercent: number
  priceReturn: number
  priceReturnPercent: number
  totalDividends: number
  mtdDividends: number
  ytdDividends: number
  totalReturnWithDividends: number
  totalReturnWithDividendsPercent: number
  marketValue: number
  costBasis: number
}

interface ExchangeRate {
  id: string
  currency_pair: string
  rate: number
  fetched_at: string
}

interface ImportRow {
  date: string
  stockCode: string
  stockName: string
  type: 'BUY' | 'SELL' | 'DIVIDEND'
  quantity: number
  price: number
  currency: string
  isValid: boolean
  errors: string[]
}

interface ImportResult {
  success: boolean
  rows: ImportRow[]
  totalRows: number
  validRows: number
  invalidRows: number
  errors: string[]
  detectedBrokerage?: string
}

interface BrokerageOption {
  value: string
  label: string
}

interface ImportExecuteResult {
  success: boolean
  imported: number
  skipped: number
  batchId?: string
  error?: string
}

interface SyncLog {
  id: string
  account_id: string
  synced_at: string
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL'
  error_message: string | null
}

interface SyncResult {
  success: boolean
  synced: number
  error?: string
}

interface SyncTransactionsResult {
  success: boolean
  synced: number
  skipped: number
  error?: string
}

interface SyncAllResult {
  holdings: SyncResult
  transactions: SyncTransactionsResult
}

interface TestConnectionResult {
  success: boolean
  message: string
}

interface ExchangeRateResult {
  success: boolean
  pair: string
  rate: number
  timestamp: string
  error?: string
}

interface StockPriceResult {
  success: boolean
  stockCode: string
  stockName?: string
  currentPrice: number
  change?: number
  changePercent?: number
  currency: string
  timestamp: string
  error?: string
}

interface BulkPriceResult {
  success: boolean
  updated: number
  failed: number
  results: StockPriceResult[]
  exchangeRate?: ExchangeRateResult
}

interface SeedResult {
  success: boolean
  userId?: string
  userName?: string
  results?: Array<{ account: string; holdings: number; success: boolean }>
  error?: string
}

interface ParsedHolding {
  stockCode: string
  stockName: string
  quantity: number
  avgPrice: number
  currentPrice: number
  purchaseAmount: number
  evalAmount: number
  profitLoss: number
  returnRate: number
  currency: string
  market?: string
  isValid: boolean
  errors: string[]
}

interface HoldingsImportResult {
  success: boolean
  holdings: ParsedHolding[]
  totalRows: number
  validRows: number
  invalidRows: number
  detectedBrokerage: string
  errors: string[]
}

interface HoldingsSaveResult {
  success: boolean
  imported: number
  updated?: number
  error?: string
}

interface HoldingWithChange extends HoldingWithAccount {
  prev_close: number
  day_change_percent: number
}

interface AggregatedHoldingWithChange extends AggregatedHolding {
  prev_close: number
  users: string
}

interface TradingStrategy {
  id: string
  user_id: string
  stock_code: string | null
  name: string
  sell_trigger_percent: number
  buy_trigger_percent: number
  sell_quantity_percent: number
  buy_amount: number | null
  buy_quantity_multiplier: number
  is_active: number
  created_at: string
}

interface StrategySignal {
  id: string
  strategy_id: string
  holding_id: string
  stock_code: string
  stock_name: string
  account_id: string
  signal_type: 'BUY' | 'SELL'
  trigger_price: number
  avg_cost: number
  trigger_percent: number
  current_quantity: number
  suggested_quantity: number
  status: 'PENDING' | 'EXECUTED' | 'DISMISSED'
  executed_transaction_id: string | null
  executed_at: string | null
  dismissed_at: string | null
  created_at: string
}

interface StrategySignalWithDetails extends StrategySignal {
  strategy_name: string
  brokerage: string
  account_type: string
  account_alias: string | null
  currency: string
  latest_price: number
}

interface CheckSignalsResult {
  signals: number
  checked: number
}

interface ExecuteSignalResult {
  success: boolean
  transaction_id: string
  type: 'BUY' | 'SELL'
  quantity: number
  price: number
}

interface StockSearchResult {
  stock_code: string
  stock_name: string
  currency: string
  current_price: number
}

interface MonthlyDividendStat {
  month: string
  amount: number
  count: number
}

interface StockDividendStat {
  stock_code: string
  stock_name: string
  currency: string
  total_dividends: number
  dividend_count: number
  first_dividend: string
  last_dividend: string
  current_quantity: number | null
  avg_cost: number | null
  current_price: number | null
  dividend_yield: number
}

interface YearlyDividendStat {
  year: string
  amount: number
  count: number
}

interface TickerMapping {
  id: string
  stock_name: string
  ticker: string
  market: string
  created_at: string
}

interface FailedStock {
  stock_code: string
  stock_name: string
  currency: string
  current_price: number
  last_synced: string | null
}

interface API {
  stock: {
    search: (userId: string, query: string) => Promise<StockSearchResult[]>
  }
  dividend: {
    getMonthlyStats: (userId: string, year: number) => Promise<MonthlyDividendStat[]>
    getByStock: (userId: string) => Promise<StockDividendStat[]>
    getYearlyStats: (userId: string) => Promise<YearlyDividendStat[]>
  }
  tickerMapping: {
    getAll: () => Promise<TickerMapping[]>
    create: (data: { stock_name: string; ticker: string; market: string }) => Promise<{ success: boolean; id: string }>
    update: (id: string, data: { ticker: string; market: string }) => Promise<{ success: boolean }>
    delete: (id: string) => Promise<{ success: boolean }>
    getFailedStocks: (userId: string) => Promise<FailedStock[]>
  }
  user: {
    getAll: () => Promise<User[]>
    create: (data: { name: string; is_primary?: boolean }) => Promise<User>
    update: (id: string, data: { name: string }) => Promise<User>
    delete: (id: string) => Promise<{ success: boolean }>
  }
  account: {
    getAll: (userId?: string) => Promise<Account[]>
    create: (data: {
      user_id: string
      brokerage: string
      account_type: string
      account_number: string
      account_alias?: string
      api_key?: string
      api_secret?: string
    }) => Promise<Account>
    update: (
      id: string,
      data: { account_alias?: string; api_key?: string; api_secret?: string }
    ) => Promise<Account>
    delete: (id: string) => Promise<{ success: boolean }>
  }
  holding: {
    getByAccount: (accountId: string) => Promise<Holding[]>
    getByUser: (userId: string) => Promise<HoldingWithAccount[]>
    getByUserWithChange: (userId: string) => Promise<HoldingWithChange[]>
    getAggregated: (userId: string) => Promise<AggregatedHolding[]>
    getAllAggregated: () => Promise<AggregatedHoldingWithChange[]>
    upsert: (data: {
      account_id: string
      stock_code: string
      stock_name: string
      quantity: number
      avg_cost: number
      current_price: number
      currency?: string
    }) => Promise<Holding>
  }
  transaction: {
    getByAccount: (accountId: string, limit?: number) => Promise<Transaction[]>
    getByUser: (userId: string, limit?: number) => Promise<TransactionWithAccount[]>
    create: (data: {
      account_id: string
      stock_code: string
      stock_name: string
      type: 'BUY' | 'SELL' | 'DIVIDEND'
      quantity: number
      price: number
      currency?: string
      date: string
      is_manual?: boolean
    }) => Promise<Transaction>
    delete: (id: string) => Promise<{ success: boolean }>
    update: (id: string, data: {
      account_id: string
      stock_code: string
      stock_name: string
      type: 'BUY' | 'SELL' | 'DIVIDEND'
      quantity: number
      price: number
      currency: string
      date: string
    }) => Promise<Transaction>
  }
  portfolio: {
    getSummary: (userId: string) => Promise<PortfolioSummary>
    getReturns: (userId: string) => Promise<PortfolioReturns>
  }
  exchangeRate: {
    get: (currencyPair: string) => Promise<ExchangeRate | null>
    update: (currencyPair: string, rate: number) => Promise<{ success: boolean; rate: number }>
  }
  onTriggerSync: (callback: () => void) => () => void
  requestRefresh: () => void
  import: {
    selectFile: () => Promise<{ success: boolean; canceled?: boolean; filePath?: string }>
    selectMultipleFiles: () => Promise<{ success: boolean; canceled?: boolean; filePaths: string[] }>
    parseFile: (filePath: string) => Promise<ImportResult>
    execute: (accountId: string, rows: ImportRow[], overwrite?: boolean) => Promise<ImportExecuteResult>
    getTemplate: () => Promise<{
      columns: string[]
      sampleData: (string | number)[][]
    }>
    getBrokerageList: () => Promise<BrokerageOption[]>
    parseHoldings: (filePath: string) => Promise<HoldingsImportResult>
    saveHoldings: (accountId: string, holdings: ParsedHolding[]) => Promise<HoldingsSaveResult>
    replaceHoldings: (accountId: string, holdings: ParsedHolding[]) => Promise<HoldingsSaveResult>
  }
  seed: {
    importDemoData: () => Promise<SeedResult>
  }
  sync: {
    testConnection: (appKey: string, appSecret: string) => Promise<TestConnectionResult>
    holdings: (accountId: string) => Promise<SyncResult>
    transactions: (accountId: string, startDate?: string, endDate?: string) => Promise<SyncTransactionsResult>
    all: (accountId: string) => Promise<SyncAllResult>
    getLogs: (accountId: string, limit?: number) => Promise<SyncLog[]>
    getLastSync: (accountId: string) => Promise<SyncLog | null>
  }
  marketData: {
    getExchangeRate: (from: string, to: string, forceRefresh?: boolean) => Promise<ExchangeRateResult>
    getStockPrice: (stockCode: string) => Promise<StockPriceResult>
    updateStockPrice: (stockCode: string) => Promise<StockPriceResult>
    refreshAll: (userId: string) => Promise<BulkPriceResult>
    clearCache: () => Promise<{ success: boolean }>
  }
  strategy: {
    getAll: (userId: string) => Promise<TradingStrategy[]>
    getActive: (userId: string) => Promise<TradingStrategy[]>
    create: (data: {
      user_id: string
      name: string
      stock_code?: string
      sell_trigger_percent?: number
      buy_trigger_percent?: number
      sell_quantity_percent?: number
      buy_amount?: number
      buy_quantity_multiplier?: number
    }) => Promise<TradingStrategy>
    update: (id: string, data: Partial<{
      name: string
      stock_code: string | null
      sell_trigger_percent: number
      buy_trigger_percent: number
      sell_quantity_percent: number
      buy_amount: number | null
      buy_quantity_multiplier: number
      is_active: number
    }>) => Promise<TradingStrategy>
    delete: (id: string) => Promise<{ success: boolean }>
    checkSignals: (userId: string) => Promise<CheckSignalsResult>
    getSignals: (userId: string, status?: 'PENDING' | 'EXECUTED' | 'DISMISSED') => Promise<StrategySignalWithDetails[]>
    executeSignal: (signalId: string) => Promise<ExecuteSignalResult>
    dismissSignal: (signalId: string) => Promise<{ success: boolean }>
    getSignalHistory: (userId: string, limit?: number) => Promise<StrategySignalWithDetails[]>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
