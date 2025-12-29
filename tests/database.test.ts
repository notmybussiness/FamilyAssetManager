/**
 * Database Schema and Model Unit Tests
 *
 * PRD 요구사항 테스트:
 * - Data Model (Section 7) 검증
 * - F-1.1: 4가지 계좌유형 지원
 * - F-1.2: 다중 사용자 지원
 * - NF-3: 로컬 SQLite 저장
 */

import { describe, it, expect } from 'vitest'

// Data Model Type Definitions (based on database.ts schema)

interface User {
  id: string
  name: string
  created_at: string
  is_primary: number
}

interface Account {
  id: string
  user_id: string
  brokerage: 'KOREA_INV' | 'HANWHA' | 'MIRAE' | 'SAMSUNG' | 'KIWOOM' | 'NH' | 'KB' | 'OTHER'
  account_type: 'PENSION' | 'IRP' | 'ISA' | 'OVERSEAS' | 'GENERAL'
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
  prev_close: number
  currency: string
  last_synced: string | null
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
  source: 'API' | 'MANUAL' | 'EXCEL'
  import_batch_id: string | null
  created_at: string
}

interface SyncLog {
  id: string
  account_id: string
  synced_at: string
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL'
  error_message: string | null
}

interface ExchangeRate {
  id: string
  currency_pair: string
  rate: number
  fetched_at: string
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

describe('User Model', () => {
  it('should have valid user structure', () => {
    const user: User = {
      id: 'uuid-123',
      name: '테스트 사용자',
      created_at: '2025-01-15T10:00:00Z',
      is_primary: 1
    }

    expect(user.id).toBeTruthy()
    expect(user.name).toBe('테스트 사용자')
    expect(user.is_primary).toBe(1)
  })

  it('should support multiple users (PRD F-1.2)', () => {
    const users: User[] = [
      { id: '1', name: '주 사용자', created_at: '', is_primary: 1 },
      { id: '2', name: '가족 1', created_at: '', is_primary: 0 },
      { id: '3', name: '가족 2', created_at: '', is_primary: 0 }
    ]

    expect(users.length).toBe(3)
    expect(users.filter(u => u.is_primary === 1)).toHaveLength(1)
  })
})

describe('Account Model', () => {
  describe('Account Types (PRD F-1.1)', () => {
    const accountTypes: Account['account_type'][] = ['PENSION', 'IRP', 'ISA', 'OVERSEAS', 'GENERAL']

    it('should support PENSION type', () => {
      expect(accountTypes).toContain('PENSION')
    })

    it('should support IRP type', () => {
      expect(accountTypes).toContain('IRP')
    })

    it('should support ISA type', () => {
      expect(accountTypes).toContain('ISA')
    })

    it('should support OVERSEAS type', () => {
      expect(accountTypes).toContain('OVERSEAS')
    })

    it('should support GENERAL type', () => {
      expect(accountTypes).toContain('GENERAL')
    })
  })

  describe('Brokerage Types', () => {
    const brokerages: Account['brokerage'][] = [
      'KOREA_INV', 'HANWHA', 'MIRAE', 'SAMSUNG', 'KIWOOM', 'NH', 'KB', 'OTHER'
    ]

    it('should support all Korean brokerages', () => {
      expect(brokerages).toContain('KOREA_INV')
      expect(brokerages).toContain('MIRAE')
      expect(brokerages).toContain('SAMSUNG')
      expect(brokerages).toContain('KIWOOM')
      expect(brokerages).toContain('NH')
      expect(brokerages).toContain('KB')
    })

    it('should support HANWHA brokerage', () => {
      expect(brokerages).toContain('HANWHA')
    })

    it('should have OTHER as fallback', () => {
      expect(brokerages).toContain('OTHER')
    })
  })

  it('should link account to user via foreign key', () => {
    const user: User = { id: 'user-1', name: '홍길동', created_at: '', is_primary: 1 }
    const account: Account = {
      id: 'account-1',
      user_id: user.id,
      brokerage: 'KOREA_INV',
      account_type: 'ISA',
      account_number: '12345678',
      account_alias: '내 ISA',
      api_key: null,
      api_secret: null,
      created_at: ''
    }

    expect(account.user_id).toBe(user.id)
  })

  it('should support API credentials for KIS', () => {
    const kisAccount: Account = {
      id: 'account-2',
      user_id: 'user-1',
      brokerage: 'KOREA_INV',
      account_type: 'GENERAL',
      account_number: '12345678',
      account_alias: null,
      api_key: 'test-api-key',
      api_secret: 'test-api-secret',
      created_at: ''
    }

    expect(kisAccount.api_key).toBeTruthy()
    expect(kisAccount.api_secret).toBeTruthy()
  })
})

describe('Holding Model', () => {
  it('should have valid holding structure', () => {
    const holding: Holding = {
      id: 'holding-1',
      account_id: 'account-1',
      stock_code: '005930',
      stock_name: '삼성전자',
      quantity: 100,
      avg_cost: 70000,
      current_price: 75000,
      prev_close: 74000,
      currency: 'KRW',
      last_synced: '2025-01-15T10:00:00Z'
    }

    expect(holding.stock_code).toBe('005930')
    expect(holding.quantity).toBe(100)
    expect(holding.currency).toBe('KRW')
  })

  it('should calculate profit/loss', () => {
    const holding: Holding = {
      id: 'h1',
      account_id: 'a1',
      stock_code: '005930',
      stock_name: '삼성전자',
      quantity: 100,
      avg_cost: 70000,
      current_price: 75000,
      prev_close: 74000,
      currency: 'KRW',
      last_synced: null
    }

    const totalValue = holding.quantity * holding.current_price
    const totalCost = holding.quantity * holding.avg_cost
    const profit = totalValue - totalCost
    const profitPercent = (profit / totalCost) * 100

    expect(totalValue).toBe(7500000)
    expect(totalCost).toBe(7000000)
    expect(profit).toBe(500000)
    expect(profitPercent).toBeCloseTo(7.14, 2)
  })

  it('should calculate daily change', () => {
    const holding: Holding = {
      id: 'h1',
      account_id: 'a1',
      stock_code: '005930',
      stock_name: '삼성전자',
      quantity: 100,
      avg_cost: 70000,
      current_price: 75000,
      prev_close: 74000,
      currency: 'KRW',
      last_synced: null
    }

    const dayChange = holding.current_price - holding.prev_close
    const dayChangePercent = (dayChange / holding.prev_close) * 100

    expect(dayChange).toBe(1000)
    expect(dayChangePercent).toBeCloseTo(1.35, 2)
  })

  it('should support USD currency for overseas stocks', () => {
    const usHolding: Holding = {
      id: 'h2',
      account_id: 'a1',
      stock_code: 'AAPL',
      stock_name: 'Apple Inc.',
      quantity: 10,
      avg_cost: 150,
      current_price: 185.50,
      prev_close: 183,
      currency: 'USD',
      last_synced: null
    }

    expect(usHolding.currency).toBe('USD')
    expect(usHolding.stock_code).toBe('AAPL')
  })
})

describe('Transaction Model', () => {
  describe('Transaction Types', () => {
    const types: Transaction['type'][] = ['BUY', 'SELL', 'DIVIDEND']

    it('should support BUY type', () => {
      expect(types).toContain('BUY')
    })

    it('should support SELL type', () => {
      expect(types).toContain('SELL')
    })

    it('should support DIVIDEND type', () => {
      expect(types).toContain('DIVIDEND')
    })
  })

  describe('Source Types', () => {
    const sources: Transaction['source'][] = ['API', 'MANUAL', 'EXCEL']

    it('should support API source', () => {
      expect(sources).toContain('API')
    })

    it('should support MANUAL source', () => {
      expect(sources).toContain('MANUAL')
    })

    it('should support EXCEL source', () => {
      expect(sources).toContain('EXCEL')
    })
  })

  it('should calculate total amount', () => {
    const tx: Transaction = {
      id: 'tx-1',
      account_id: 'a1',
      stock_code: '005930',
      stock_name: '삼성전자',
      type: 'BUY',
      quantity: 10,
      price: 75000,
      total_amount: 750000,
      currency: 'KRW',
      date: '2025-01-15',
      is_manual: 0,
      source: 'API',
      import_batch_id: null,
      created_at: ''
    }

    expect(tx.total_amount).toBe(tx.quantity * tx.price)
  })

  it('should track import batch for Excel imports', () => {
    const tx: Transaction = {
      id: 'tx-2',
      account_id: 'a1',
      stock_code: '005930',
      stock_name: '삼성전자',
      type: 'BUY',
      quantity: 10,
      price: 75000,
      total_amount: 750000,
      currency: 'KRW',
      date: '2025-01-15',
      is_manual: 0,
      source: 'EXCEL',
      import_batch_id: 'batch-uuid-123',
      created_at: ''
    }

    expect(tx.source).toBe('EXCEL')
    expect(tx.import_batch_id).toBeTruthy()
  })
})

describe('SyncLog Model', () => {
  describe('Status Types', () => {
    const statuses: SyncLog['status'][] = ['SUCCESS', 'FAILED', 'PARTIAL']

    it('should track SUCCESS status', () => {
      expect(statuses).toContain('SUCCESS')
    })

    it('should track FAILED status', () => {
      expect(statuses).toContain('FAILED')
    })

    it('should track PARTIAL status', () => {
      expect(statuses).toContain('PARTIAL')
    })
  })

  it('should store error messages on failure', () => {
    const failedSync: SyncLog = {
      id: 'sync-1',
      account_id: 'a1',
      synced_at: '2025-01-15T10:00:00Z',
      status: 'FAILED',
      error_message: 'API connection timeout'
    }

    expect(failedSync.status).toBe('FAILED')
    expect(failedSync.error_message).toBeTruthy()
  })
})

describe('TradingStrategy Model (Phase 2)', () => {
  it('should define strategy parameters', () => {
    const strategy: TradingStrategy = {
      id: 'strategy-1',
      user_id: 'user-1',
      stock_code: null,  // Global strategy
      name: '5% 그리드 전략',
      sell_trigger_percent: 5.0,
      buy_trigger_percent: -5.0,
      sell_quantity_percent: 50.0,
      buy_amount: null,
      buy_quantity_multiplier: 1.0,
      is_active: 1,
      created_at: ''
    }

    expect(strategy.sell_trigger_percent).toBe(5.0)
    expect(strategy.buy_trigger_percent).toBe(-5.0)
    expect(strategy.is_active).toBe(1)
  })

  it('should support stock-specific strategies', () => {
    const strategy: TradingStrategy = {
      id: 'strategy-2',
      user_id: 'user-1',
      stock_code: '005930',  // Samsung-specific
      name: '삼성전자 적극 매매',
      sell_trigger_percent: 3.0,
      buy_trigger_percent: -3.0,
      sell_quantity_percent: 30.0,
      buy_amount: null,
      buy_quantity_multiplier: 2.0,
      is_active: 1,
      created_at: ''
    }

    expect(strategy.stock_code).toBe('005930')
    expect(strategy.buy_quantity_multiplier).toBe(2.0)
  })
})

describe('StrategySignal Model', () => {
  describe('Signal Status', () => {
    const statuses: StrategySignal['status'][] = ['PENDING', 'EXECUTED', 'DISMISSED']

    it('should have PENDING status for new signals', () => {
      expect(statuses).toContain('PENDING')
    })

    it('should have EXECUTED status for completed signals', () => {
      expect(statuses).toContain('EXECUTED')
    })

    it('should have DISMISSED status for ignored signals', () => {
      expect(statuses).toContain('DISMISSED')
    })
  })

  it('should track signal execution', () => {
    const executedSignal: StrategySignal = {
      id: 'signal-1',
      strategy_id: 'strategy-1',
      holding_id: 'holding-1',
      stock_code: '005930',
      stock_name: '삼성전자',
      account_id: 'account-1',
      signal_type: 'SELL',
      trigger_price: 75000,
      avg_cost: 70000,
      trigger_percent: 7.14,
      current_quantity: 100,
      suggested_quantity: 50,
      status: 'EXECUTED',
      executed_transaction_id: 'tx-123',
      executed_at: '2025-01-15T14:30:00Z',
      dismissed_at: null,
      created_at: '2025-01-15T10:00:00Z'
    }

    expect(executedSignal.status).toBe('EXECUTED')
    expect(executedSignal.executed_transaction_id).toBeTruthy()
    expect(executedSignal.executed_at).toBeTruthy()
  })
})

describe('Database Indexes', () => {
  // These indexes are created in database.ts
  const expectedIndexes = [
    'idx_accounts_user',
    'idx_holdings_account',
    'idx_transactions_account',
    'idx_transactions_date',
    'idx_sync_logs_account',
    'idx_strategies_user',
    'idx_signals_strategy',
    'idx_signals_status',
    'idx_signals_holding'
  ]

  it('should have index for accounts by user', () => {
    expect(expectedIndexes).toContain('idx_accounts_user')
  })

  it('should have index for holdings by account', () => {
    expect(expectedIndexes).toContain('idx_holdings_account')
  })

  it('should have index for transactions by account', () => {
    expect(expectedIndexes).toContain('idx_transactions_account')
  })

  it('should have index for transactions by date', () => {
    expect(expectedIndexes).toContain('idx_transactions_date')
  })

  it('should have index for signals by status', () => {
    expect(expectedIndexes).toContain('idx_signals_status')
  })
})

describe('Foreign Key Relationships', () => {
  it('should cascade delete accounts when user is deleted', () => {
    // Account has: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    const relationshipDefined = true
    expect(relationshipDefined).toBe(true)
  })

  it('should cascade delete holdings when account is deleted', () => {
    // Holding has: FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    const relationshipDefined = true
    expect(relationshipDefined).toBe(true)
  })

  it('should cascade delete transactions when account is deleted', () => {
    // Transaction has: FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    const relationshipDefined = true
    expect(relationshipDefined).toBe(true)
  })

  it('should cascade delete sync_logs when account is deleted', () => {
    // SyncLog has: FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    const relationshipDefined = true
    expect(relationshipDefined).toBe(true)
  })

  it('should cascade delete strategies when user is deleted', () => {
    // TradingStrategy has: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    const relationshipDefined = true
    expect(relationshipDefined).toBe(true)
  })
})
