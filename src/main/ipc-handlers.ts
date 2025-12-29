import { ipcMain, dialog } from 'electron'
import { getDatabase } from './database'
import { v4 as uuidv4 } from 'uuid'
import { parseExcelFile, generateBatchId, ImportRow, getBrokerageList } from './excel-import'
import { syncHoldings, syncTransactions, testConnection } from './kis-api'
import { parseHoldingsFile, ParsedHolding } from './holdings-parser'
import {
  fetchExchangeRate,
  fetchStockPrice,
  updateAllHoldingPrices,
  updateHoldingPrice,
  clearMarketDataCache
} from './market-data-api'

export function registerIpcHandlers(): void {
  // ===== USER HANDLERS =====
  ipcMain.handle('user:getAll', () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM users ORDER BY is_primary DESC, name ASC').all()
  })

  ipcMain.handle('user:create', (_, data: { name: string; is_primary?: boolean }) => {
    const db = getDatabase()

    // Check for duplicate name
    const existing = db.prepare('SELECT id FROM users WHERE name = ?').get(data.name.trim())
    if (existing) {
      throw new Error('이미 존재하는 이름입니다')
    }

    const id = uuidv4()
    db.prepare('INSERT INTO users (id, name, is_primary) VALUES (?, ?, ?)').run(
      id,
      data.name.trim(),
      data.is_primary ? 1 : 0
    )
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  })

  ipcMain.handle('user:update', (_, id: string, data: { name: string }) => {
    const db = getDatabase()

    // Check for duplicate name (excluding current user)
    const existing = db.prepare('SELECT id FROM users WHERE name = ? AND id != ?').get(data.name.trim(), id)
    if (existing) {
      throw new Error('이미 존재하는 이름입니다')
    }

    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(data.name.trim(), id)
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  })

  ipcMain.handle('user:delete', (_, id: string) => {
    const db = getDatabase()
    db.prepare('DELETE FROM users WHERE id = ?').run(id)
    return { success: true }
  })

  // ===== ACCOUNT HANDLERS =====
  ipcMain.handle('account:getAll', (_, userId?: string) => {
    const db = getDatabase()
    if (userId) {
      return db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY account_type, brokerage').all(userId)
    }
    return db.prepare('SELECT * FROM accounts ORDER BY user_id, account_type, brokerage').all()
  })

  ipcMain.handle('account:create', (_, data: {
    user_id: string
    brokerage: string
    account_type: string
    account_number: string
    account_alias?: string
    api_key?: string
    api_secret?: string
  }) => {
    const db = getDatabase()
    const id = uuidv4()
    db.prepare(`
      INSERT INTO accounts (id, user_id, brokerage, account_type, account_number, account_alias, api_key, api_secret)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.user_id,
      data.brokerage,
      data.account_type,
      data.account_number,
      data.account_alias || null,
      data.api_key || null,
      data.api_secret || null
    )
    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)
  })

  ipcMain.handle('account:update', (_, id: string, data: Partial<{
    account_alias: string
    api_key: string
    api_secret: string
  }>) => {
    const db = getDatabase()
    const updates: string[] = []
    const values: (string | null)[] = []

    if (data.account_alias !== undefined) {
      updates.push('account_alias = ?')
      values.push(data.account_alias)
    }
    if (data.api_key !== undefined) {
      updates.push('api_key = ?')
      values.push(data.api_key)
    }
    if (data.api_secret !== undefined) {
      updates.push('api_secret = ?')
      values.push(data.api_secret)
    }

    if (updates.length > 0) {
      values.push(id)
      db.prepare(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    }

    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)
  })

  ipcMain.handle('account:delete', (_, id: string) => {
    const db = getDatabase()
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
    return { success: true }
  })

  // ===== HOLDING HANDLERS =====
  ipcMain.handle('holding:getByAccount', (_, accountId: string) => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM holdings WHERE account_id = ? ORDER BY stock_name').all(accountId)
  })

  ipcMain.handle('holding:getByUser', (_, userId: string) => {
    const db = getDatabase()
    return db.prepare(`
      SELECT h.*, a.brokerage, a.account_type, a.account_alias
      FROM holdings h
      JOIN accounts a ON h.account_id = a.id
      WHERE a.user_id = ?
      ORDER BY h.stock_name
    `).all(userId)
  })

  ipcMain.handle('holding:getAggregated', (_, userId: string) => {
    const db = getDatabase()
    return db.prepare(`
      SELECT
        stock_code,
        stock_name,
        currency,
        SUM(quantity) as total_quantity,
        SUM(quantity * avg_cost) / SUM(quantity) as weighted_avg_cost,
        SUM(quantity * current_price) as total_value,
        MAX(current_price) as current_price,
        COUNT(*) as account_count
      FROM holdings h
      JOIN accounts a ON h.account_id = a.id
      WHERE a.user_id = ?
      GROUP BY stock_code, stock_name, currency
      ORDER BY total_value DESC
    `).all(userId)
  })

  ipcMain.handle('holding:upsert', (_, data: {
    account_id: string
    stock_code: string
    stock_name: string
    quantity: number
    avg_cost: number
    current_price: number
    currency?: string
  }) => {
    const db = getDatabase()
    const existing = db.prepare('SELECT id FROM holdings WHERE account_id = ? AND stock_code = ?').get(data.account_id, data.stock_code) as { id: string } | undefined

    if (existing) {
      db.prepare(`
        UPDATE holdings SET
          stock_name = ?, quantity = ?, avg_cost = ?, current_price = ?, currency = ?, last_synced = datetime('now')
        WHERE id = ?
      `).run(data.stock_name, data.quantity, data.avg_cost, data.current_price, data.currency || 'KRW', existing.id)
      return db.prepare('SELECT * FROM holdings WHERE id = ?').get(existing.id)
    } else {
      const id = uuidv4()
      db.prepare(`
        INSERT INTO holdings (id, account_id, stock_code, stock_name, quantity, avg_cost, current_price, currency, last_synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(id, data.account_id, data.stock_code, data.stock_name, data.quantity, data.avg_cost, data.current_price, data.currency || 'KRW')
      return db.prepare('SELECT * FROM holdings WHERE id = ?').get(id)
    }
  })

  // ===== TRANSACTION HANDLERS =====
  ipcMain.handle('transaction:getByAccount', (_, accountId: string, limit?: number) => {
    const db = getDatabase()
    const sql = limit
      ? 'SELECT * FROM transactions WHERE account_id = ? ORDER BY date DESC LIMIT ?'
      : 'SELECT * FROM transactions WHERE account_id = ? ORDER BY date DESC'
    return limit
      ? db.prepare(sql).all(accountId, limit)
      : db.prepare(sql).all(accountId)
  })

  ipcMain.handle('transaction:getByUser', (_, userId: string, limit?: number) => {
    const db = getDatabase()
    const sql = limit
      ? `SELECT t.*, a.brokerage, a.account_type, a.account_alias
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         WHERE a.user_id = ?
         ORDER BY t.date DESC
         LIMIT ?`
      : `SELECT t.*, a.brokerage, a.account_type, a.account_alias
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         WHERE a.user_id = ?
         ORDER BY t.date DESC`
    return limit
      ? db.prepare(sql).all(userId, limit)
      : db.prepare(sql).all(userId)
  })

  ipcMain.handle('transaction:create', (_, data: {
    account_id: string
    stock_code: string
    stock_name: string
    type: 'BUY' | 'SELL' | 'DIVIDEND'
    quantity: number
    price: number
    currency?: string
    date: string
    is_manual?: boolean
  }) => {
    const db = getDatabase()
    const id = uuidv4()
    const total_amount = data.quantity * data.price

    db.prepare(`
      INSERT INTO transactions (id, account_id, stock_code, stock_name, type, quantity, price, total_amount, currency, date, is_manual, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.account_id,
      data.stock_code,
      data.stock_name,
      data.type,
      data.quantity,
      data.price,
      total_amount,
      data.currency || 'KRW',
      data.date,
      data.is_manual ? 1 : 0,
      data.is_manual ? 'MANUAL' : 'API'
    )

    // Update holdings with moving average
    updateHoldingsAfterTransaction(data)

    return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)
  })

  ipcMain.handle('transaction:delete', (_, id: string) => {
    const db = getDatabase()
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('transaction:update', (_, id: string, data: {
    account_id: string
    stock_code: string
    stock_name: string
    type: 'BUY' | 'SELL' | 'DIVIDEND'
    quantity: number
    price: number
    currency: string
    date: string
  }) => {
    const db = getDatabase()
    const totalAmount = data.quantity * data.price
    db.prepare(`
      UPDATE transactions SET
        account_id = ?, stock_code = ?, stock_name = ?, type = ?,
        quantity = ?, price = ?, total_amount = ?, currency = ?, date = ?
      WHERE id = ?
    `).run(data.account_id, data.stock_code, data.stock_name, data.type,
           data.quantity, data.price, totalAmount, data.currency, data.date, id)
    return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)
  })

  // ===== PORTFOLIO SUMMARY =====
  ipcMain.handle('portfolio:getSummary', (_, userId: string) => {
    const db = getDatabase()

    const holdings = db.prepare(`
      SELECT
        h.currency,
        SUM(h.quantity * h.current_price) as market_value,
        SUM(h.quantity * h.avg_cost) as cost_basis
      FROM holdings h
      JOIN accounts a ON h.account_id = a.id
      WHERE a.user_id = ?
      GROUP BY h.currency
    `).all(userId) as Array<{ currency: string; market_value: number; cost_basis: number }>

    const byAccountType = db.prepare(`
      SELECT
        a.account_type,
        SUM(h.quantity * h.current_price) as market_value,
        SUM(h.quantity * h.avg_cost) as cost_basis
      FROM holdings h
      JOIN accounts a ON h.account_id = a.id
      WHERE a.user_id = ?
      GROUP BY a.account_type
    `).all(userId)

    const byBrokerage = db.prepare(`
      SELECT
        a.brokerage,
        SUM(h.quantity * h.current_price) as market_value,
        SUM(h.quantity * h.avg_cost) as cost_basis
      FROM holdings h
      JOIN accounts a ON h.account_id = a.id
      WHERE a.user_id = ?
      GROUP BY a.brokerage
    `).all(userId)

    let totalMarketValue = 0
    let totalCostBasis = 0

    for (const h of holdings) {
      totalMarketValue += h.market_value
      totalCostBasis += h.cost_basis
    }

    return {
      totalMarketValue,
      totalCostBasis,
      totalReturn: totalMarketValue - totalCostBasis,
      totalReturnPercent: totalCostBasis > 0 ? ((totalMarketValue - totalCostBasis) / totalCostBasis) * 100 : 0,
      byCurrency: holdings,
      byAccountType,
      byBrokerage
    }
  })

  // ===== PORTFOLIO RETURNS =====
  ipcMain.handle('portfolio:getReturns', (_, userId: string) => {
    const db = getDatabase()

    // 1. Get daily change from prev_close
    const dailyChange = db.prepare(`
      SELECT
        SUM(h.quantity * h.current_price) as current_value,
        SUM(h.quantity * COALESCE(h.prev_close, h.current_price)) as prev_value
      FROM holdings h
      JOIN accounts a ON h.account_id = a.id
      WHERE a.user_id = ?
    `).get(userId) as { current_value: number; prev_value: number } | undefined

    const dailyReturn = dailyChange && dailyChange.prev_value > 0
      ? ((dailyChange.current_value - dailyChange.prev_value) / dailyChange.prev_value) * 100
      : 0
    const dailyReturnValue = dailyChange
      ? dailyChange.current_value - dailyChange.prev_value
      : 0

    // 2. Get total dividends received
    const dividends = db.prepare(`
      SELECT COALESCE(SUM(t.total_amount), 0) as total_dividends
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE a.user_id = ? AND t.type = 'DIVIDEND'
    `).get(userId) as { total_dividends: number }

    // 3. Get dividends this month (MTD)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const mtdDividends = db.prepare(`
      SELECT COALESCE(SUM(t.total_amount), 0) as mtd_dividends
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE a.user_id = ? AND t.type = 'DIVIDEND' AND t.date >= ?
    `).get(userId, startOfMonth.toISOString().split('T')[0]) as { mtd_dividends: number }

    // 4. Get dividends this year (YTD)
    const startOfYear = new Date()
    startOfYear.setMonth(0, 1)
    startOfYear.setHours(0, 0, 0, 0)
    const ytdDividends = db.prepare(`
      SELECT COALESCE(SUM(t.total_amount), 0) as ytd_dividends
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE a.user_id = ? AND t.type = 'DIVIDEND' AND t.date >= ?
    `).get(userId, startOfYear.toISOString().split('T')[0]) as { ytd_dividends: number }

    // 5. Get current portfolio value and cost basis
    const portfolio = db.prepare(`
      SELECT
        COALESCE(SUM(h.quantity * h.current_price), 0) as market_value,
        COALESCE(SUM(h.quantity * h.avg_cost), 0) as cost_basis
      FROM holdings h
      JOIN accounts a ON h.account_id = a.id
      WHERE a.user_id = ?
    `).get(userId) as { market_value: number; cost_basis: number }

    // Price return (unrealized)
    const priceReturn = portfolio.market_value - portfolio.cost_basis
    const priceReturnPercent = portfolio.cost_basis > 0
      ? (priceReturn / portfolio.cost_basis) * 100
      : 0

    // Total return = price return + dividends
    const totalReturnWithDividends = priceReturn + dividends.total_dividends
    const totalReturnWithDividendsPercent = portfolio.cost_basis > 0
      ? (totalReturnWithDividends / portfolio.cost_basis) * 100
      : 0

    return {
      // Daily change (from prev_close)
      dailyReturn: dailyReturnValue,
      dailyReturnPercent: dailyReturn,

      // Price-only return
      priceReturn,
      priceReturnPercent,

      // Dividend returns
      totalDividends: dividends.total_dividends,
      mtdDividends: mtdDividends.mtd_dividends,
      ytdDividends: ytdDividends.ytd_dividends,

      // Total return (price + dividends)
      totalReturnWithDividends,
      totalReturnWithDividendsPercent,

      // Portfolio values
      marketValue: portfolio.market_value,
      costBasis: portfolio.cost_basis
    }
  })

  // ===== EXCHANGE RATE HANDLERS =====
  ipcMain.handle('exchangeRate:get', (_, currencyPair: string) => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM exchange_rates WHERE currency_pair = ? ORDER BY fetched_at DESC LIMIT 1').get(currencyPair)
  })

  ipcMain.handle('exchangeRate:update', (_, currencyPair: string, rate: number) => {
    const db = getDatabase()
    const id = uuidv4()
    db.prepare('INSERT INTO exchange_rates (id, currency_pair, rate) VALUES (?, ?, ?)').run(id, currencyPair, rate)
    return { success: true, rate }
  })

  // ===== EXCEL IMPORT HANDLERS =====
  ipcMain.handle('import:selectFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Excel File to Import',
      filters: [
        { name: 'Excel Files', extensions: ['xlsx', 'xls', 'csv'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    return { success: true, filePath: result.filePaths[0] }
  })

  ipcMain.handle('import:parseFile', (_, filePath: string) => {
    return parseExcelFile(filePath)
  })

  ipcMain.handle('import:execute', (_, accountId: string, rows: ImportRow[]) => {
    const db = getDatabase()
    const batchId = generateBatchId()
    let imported = 0
    let skipped = 0

    const insertStmt = db.prepare(`
      INSERT INTO transactions (id, account_id, stock_code, stock_name, type, quantity, price, total_amount, currency, date, is_manual, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'EXCEL')
    `)

    const checkDuplicate = db.prepare(`
      SELECT id FROM transactions
      WHERE account_id = ? AND stock_code = ? AND date = ? AND type = ? AND quantity = ? AND price = ?
    `)

    const transaction = db.transaction(() => {
      for (const row of rows) {
        if (!row.isValid) {
          skipped++
          continue
        }

        // Check for duplicates
        const existing = checkDuplicate.get(
          accountId,
          row.stockCode,
          row.date,
          row.type,
          row.quantity,
          row.price
        )

        if (existing) {
          skipped++
          continue
        }

        const id = uuidv4()
        const totalAmount = row.quantity * row.price

        insertStmt.run(
          id,
          accountId,
          row.stockCode,
          row.stockName,
          row.type,
          row.quantity,
          row.price,
          totalAmount,
          row.currency,
          row.date
        )

        // Update holdings
        updateHoldingsAfterTransaction({
          account_id: accountId,
          stock_code: row.stockCode,
          stock_name: row.stockName,
          type: row.type,
          quantity: row.quantity,
          price: row.price,
          currency: row.currency
        })

        imported++
      }
    })

    try {
      transaction()
      return { success: true, imported, skipped, batchId }
    } catch (error) {
      return {
        success: false,
        imported: 0,
        skipped: rows.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  ipcMain.handle('import:getTemplate', () => {
    return {
      columns: ['거래일자', '종목코드', '종목명', '거래유형', '수량', '단가', '통화'],
      sampleData: [
        ['2025-01-15', '005930', '삼성전자', '매수', 10, 75000, 'KRW'],
        ['2025-01-16', 'AAPL', 'Apple Inc.', '매수', 5, 180.50, 'USD'],
        ['2025-01-17', '005930', '삼성전자', '매도', 5, 76000, 'KRW']
      ]
    }
  })

  // 지원 증권사 목록
  ipcMain.handle('import:getBrokerageList', () => {
    return getBrokerageList()
  })

  // ===== KIS API SYNC HANDLERS =====
  ipcMain.handle('sync:testConnection', async (_, appKey: string, appSecret: string) => {
    return await testConnection(appKey, appSecret)
  })

  ipcMain.handle('sync:holdings', async (_, accountId: string) => {
    return await syncHoldings(accountId)
  })

  ipcMain.handle('sync:transactions', async (_, accountId: string, startDate?: string, endDate?: string) => {
    return await syncTransactions(accountId, startDate, endDate)
  })

  ipcMain.handle('sync:all', async (_, accountId: string) => {
    const holdingsResult = await syncHoldings(accountId)
    const transactionsResult = await syncTransactions(accountId)

    return {
      holdings: holdingsResult,
      transactions: transactionsResult
    }
  })

  ipcMain.handle('sync:getLogs', (_, accountId: string, limit?: number) => {
    const db = getDatabase()
    const sql = limit
      ? 'SELECT * FROM sync_logs WHERE account_id = ? ORDER BY synced_at DESC LIMIT ?'
      : 'SELECT * FROM sync_logs WHERE account_id = ? ORDER BY synced_at DESC'
    return limit
      ? db.prepare(sql).all(accountId, limit)
      : db.prepare(sql).all(accountId)
  })

  ipcMain.handle('sync:getLastSync', (_, accountId: string) => {
    const db = getDatabase()
    return db.prepare(`
      SELECT * FROM sync_logs
      WHERE account_id = ? AND status = 'SUCCESS'
      ORDER BY synced_at DESC
      LIMIT 1
    `).get(accountId)
  })

  // ===== MARKET DATA HANDLERS =====
  // 환율 조회
  ipcMain.handle('marketData:getExchangeRate', async (_, from: string, to: string) => {
    return await fetchExchangeRate(from, to)
  })

  // 단일 종목 현재가 조회
  ipcMain.handle('marketData:getStockPrice', async (_, stockCode: string) => {
    return await fetchStockPrice(stockCode)
  })

  // 단일 종목 현재가 업데이트 (DB 반영)
  ipcMain.handle('marketData:updateStockPrice', async (_, stockCode: string) => {
    return await updateHoldingPrice(stockCode)
  })

  // 사용자의 모든 보유종목 현재가 일괄 업데이트
  ipcMain.handle('marketData:refreshAll', async (_, userId: string) => {
    return await updateAllHoldingPrices(userId)
  })

  // 캐시 클리어
  ipcMain.handle('marketData:clearCache', () => {
    clearMarketDataCache()
    return { success: true }
  })

// ===== HOLDINGS IMPORT HANDLERS =====
// 보유종목 파일 파싱
ipcMain.handle('import:parseHoldings', (_, filePath: string) => {
  return parseHoldingsFile(filePath)
})

// 보유종목 일괄 저장
ipcMain.handle('import:saveHoldings', (_, accountId: string, holdings: ParsedHolding[]) => {
  const db = getDatabase()
  let imported = 0
  let updated = 0

  const upsertStmt = db.prepare(`
    INSERT INTO holdings (id, account_id, stock_code, stock_name, quantity, avg_cost, current_price, currency, last_synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(account_id, stock_code) DO UPDATE SET
      stock_name = excluded.stock_name,
      quantity = excluded.quantity,
      avg_cost = excluded.avg_cost,
      current_price = excluded.current_price,
      currency = excluded.currency,
      last_synced = datetime('now')
  `)

  const checkExisting = db.prepare('SELECT id FROM holdings WHERE account_id = ? AND stock_code = ?')

  const transaction = db.transaction(() => {
    for (const h of holdings) {
      if (!h.isValid) continue

      const stockCode = h.stockCode || h.stockName  // 종목코드 없으면 종목명 사용
      const existing = checkExisting.get(accountId, stockCode)

      upsertStmt.run(
        existing ? (existing as { id: string }).id : uuidv4(),
        accountId,
        stockCode,
        h.stockName,
        h.quantity,
        h.avgPrice,
        h.currentPrice,
        h.currency
      )

      if (existing) {
        updated++
      } else {
        imported++
      }
    }
  })

  try {
    transaction()
    return { success: true, imported, updated }
  } catch (error) {
    return {
      success: false,
      imported: 0,
      updated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

// 계좌의 모든 보유종목 삭제 후 새로 저장
ipcMain.handle('import:replaceHoldings', (_, accountId: string, holdings: ParsedHolding[]) => {
  const db = getDatabase()

  const transaction = db.transaction(() => {
    // 기존 보유종목 삭제
    db.prepare('DELETE FROM holdings WHERE account_id = ?').run(accountId)

    // 새로 저장
    const insertStmt = db.prepare(`
      INSERT INTO holdings (id, account_id, stock_code, stock_name, quantity, avg_cost, current_price, currency, last_synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    let imported = 0
    for (const h of holdings) {
      if (!h.isValid) continue

      const stockCode = h.stockCode || h.stockName
      insertStmt.run(
        uuidv4(),
        accountId,
        stockCode,
        h.stockName,
        h.quantity,
        h.avgPrice,
        h.currentPrice,
        h.currency
      )
      imported++
    }

    return imported
  })

  try {
    const imported = transaction()
    return { success: true, imported }
  } catch (error) {
    return {
      success: false,
      imported: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

// 전체 사용자의 통합 보유종목 (동일종목 합산)
ipcMain.handle('holding:getAllAggregated', () => {
  const db = getDatabase()
  return db.prepare(`
    SELECT
      h.stock_code,
      h.stock_name,
      h.currency,
      SUM(h.quantity) as total_quantity,
      SUM(h.quantity * h.avg_cost) / NULLIF(SUM(h.quantity), 0) as weighted_avg_cost,
      SUM(h.quantity * h.current_price) as total_value,
      MAX(h.current_price) as current_price,
      MAX(h.prev_close) as prev_close,
      COUNT(DISTINCT a.id) as account_count,
      GROUP_CONCAT(DISTINCT u.name) as users
    FROM holdings h
    JOIN accounts a ON h.account_id = a.id
    JOIN users u ON a.user_id = u.id
    GROUP BY h.stock_code, h.stock_name, h.currency
    ORDER BY total_value DESC
  `).all()
})

// 종목 검색 (자동완성용)
ipcMain.handle('stock:search', (_, userId: string, query: string) => {
  const db = getDatabase()
  const searchQuery = `%${query}%`
  return db.prepare(`
    SELECT DISTINCT
      h.stock_code,
      h.stock_name,
      h.currency,
      MAX(h.current_price) as current_price
    FROM holdings h
    JOIN accounts a ON h.account_id = a.id
    WHERE a.user_id = ?
      AND (h.stock_code LIKE ? OR h.stock_name LIKE ?)
    GROUP BY h.stock_code, h.stock_name, h.currency
    ORDER BY
      CASE WHEN h.stock_code LIKE ? THEN 0 ELSE 1 END,
      h.stock_name
    LIMIT 10
  `).all(userId, searchQuery, searchQuery, query + '%')
})

// 사용자별 통합 보유종목 (prev_close 포함)
ipcMain.handle('holding:getByUserWithChange', (_, userId: string) => {
  const db = getDatabase()
  return db.prepare(`
    SELECT
      h.*,
      a.brokerage,
      a.account_type,
      a.account_alias,
      CASE
        WHEN h.prev_close > 0 THEN ((h.current_price - h.prev_close) / h.prev_close) * 100
        ELSE 0
      END as day_change_percent
    FROM holdings h
    JOIN accounts a ON h.account_id = a.id
    WHERE a.user_id = ?
    ORDER BY h.stock_name
  `).all(userId)
})
}

// ===== SEED DATA HANDLER =====
ipcMain.handle('seed:importDemoData', async () => {
  const db = getDatabase()
  const { join, dirname } = await import('path')
  const { app } = await import('electron')

  try {
    // 1. 기존 김기덕 사용자 삭제
    const existingUser = db.prepare("SELECT id FROM users WHERE name = '김기덕'").get() as { id: string } | undefined
    if (existingUser) {
      db.prepare('DELETE FROM users WHERE id = ?').run(existingUser.id)
    }

    // 2. 김기덕 사용자 생성
    const userId = uuidv4()
    db.prepare("INSERT INTO users (id, name, is_primary) VALUES (?, '김기덕', 1)").run(userId)

    // 3. 리소스 파일 목록 (개발 모드와 프로덕션 모드 둘 다 지원)
    let resourcesDir = join(app.getAppPath(), 'resources')

    // 개발 모드에서는 app.getAppPath()가 out/main을 가리킬 수 있음
    const { existsSync } = await import('fs')
    if (!existsSync(resourcesDir)) {
      // 개발 모드: 프로젝트 루트에서 resources 폴더 찾기
      resourcesDir = join(dirname(app.getAppPath()), '..', 'resources')
    }
    if (!existsSync(resourcesDir)) {
      // 또 다른 시도
      resourcesDir = join(process.cwd(), 'resources')
    }

    console.log('Resources directory:', resourcesDir)
    const files = [
      { file: '미래.xlsx', brokerage: 'MIRAE', type: 'ISA', alias: '미래에셋 일반' },
      { file: '미래itp.xlsx', brokerage: 'MIRAE', type: 'IRP', alias: '미래에셋 IRP' },
      { file: '삼성.xlsx', brokerage: 'SAMSUNG', type: 'ISA', alias: '삼성증권' },
      { file: '한화 국내.xls', brokerage: 'HANWHA', type: 'ISA', alias: '한화투자증권 국내' },
      { file: '한화 해외.xls', brokerage: 'HANWHA', type: 'OVERSEAS', alias: '한화투자증권 해외' }
    ]

    const results: Array<{ account: string; holdings: number; success: boolean }> = []

    // 4. 각 파일 처리
    for (const fileInfo of files) {
      const filePath = join(resourcesDir, fileInfo.file)

      if (!existsSync(filePath)) {
        console.log('File not found:', filePath)
        results.push({ account: fileInfo.alias, holdings: 0, success: false })
        continue
      }

      // 계좌 생성
      const accountId = uuidv4()
      const accountNumber = uuidv4().substring(0, 12).replace(/-/g, '')

      db.prepare(`
        INSERT INTO accounts (id, user_id, brokerage, account_type, account_number, account_alias)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(accountId, userId, fileInfo.brokerage, fileInfo.type, accountNumber, fileInfo.alias)

      // 파일 파싱
      const parseResult = parseHoldingsFile(filePath)

      if (parseResult.success && parseResult.holdings.length > 0) {
        // 동일 종목 합산을 위한 Map
        const holdingsMap = new Map<string, {
          stockName: string
          quantity: number
          totalCost: number
          currentPrice: number
          currency: string
        }>()

        for (const h of parseResult.holdings) {
          if (!h.isValid) continue
          const stockCode = h.stockCode || h.stockName
          const existing = holdingsMap.get(stockCode)

          if (existing) {
            // 동일 종목: 수량 합산, 평균단가 재계산
            const newQuantity = existing.quantity + h.quantity
            const newTotalCost = existing.totalCost + (h.avgPrice * h.quantity)
            existing.quantity = newQuantity
            existing.totalCost = newTotalCost
            existing.currentPrice = h.currentPrice // 최신 현재가 사용
          } else {
            holdingsMap.set(stockCode, {
              stockName: h.stockName,
              quantity: h.quantity,
              totalCost: h.avgPrice * h.quantity,
              currentPrice: h.currentPrice,
              currency: h.currency
            })
          }
        }

        // 보유종목 저장
        const insertStmt = db.prepare(`
          INSERT INTO holdings (id, account_id, stock_code, stock_name, quantity, avg_cost, current_price, currency, last_synced)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `)

        for (const [stockCode, data] of holdingsMap) {
          const avgCost = data.quantity > 0 ? data.totalCost / data.quantity : 0
          insertStmt.run(
            uuidv4(),
            accountId,
            stockCode,
            data.stockName,
            data.quantity,
            avgCost,
            data.currentPrice,
            data.currency
          )
        }

        results.push({ account: fileInfo.alias, holdings: holdingsMap.size, success: true })
      } else {
        results.push({ account: fileInfo.alias, holdings: 0, success: false })
      }
    }

    return {
      success: true,
      userId,
      userName: '김기덕',
      results
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

// Helper function to update holdings after a transaction
function updateHoldingsAfterTransaction(data: {
  account_id: string
  stock_code: string
  stock_name: string
  type: 'BUY' | 'SELL' | 'DIVIDEND'
  quantity: number
  price: number
  currency?: string
}): void {
  const db = getDatabase()
  const existing = db.prepare('SELECT * FROM holdings WHERE account_id = ? AND stock_code = ?').get(data.account_id, data.stock_code) as { id: string; quantity: number; avg_cost: number } | undefined

  if (data.type === 'BUY') {
    if (existing) {
      // Moving average calculation
      const newQuantity = existing.quantity + data.quantity
      const newAvgCost = (existing.quantity * existing.avg_cost + data.quantity * data.price) / newQuantity

      db.prepare('UPDATE holdings SET quantity = ?, avg_cost = ?, last_synced = datetime("now") WHERE id = ?').run(
        newQuantity,
        newAvgCost,
        existing.id
      )
    } else {
      const id = uuidv4()
      db.prepare(`
        INSERT INTO holdings (id, account_id, stock_code, stock_name, quantity, avg_cost, current_price, currency, last_synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(id, data.account_id, data.stock_code, data.stock_name, data.quantity, data.price, data.price, data.currency || 'KRW')
    }
  } else if (data.type === 'SELL' && existing) {
    const newQuantity = existing.quantity - data.quantity
    if (newQuantity <= 0) {
      db.prepare('DELETE FROM holdings WHERE id = ?').run(existing.id)
    } else {
      // Keep the same avg_cost for selling (moving average method)
      db.prepare('UPDATE holdings SET quantity = ?, last_synced = datetime("now") WHERE id = ?').run(newQuantity, existing.id)
    }
  }
  // DIVIDEND doesn't affect holdings quantity/cost
}

// ===== TRADING STRATEGY HANDLERS =====

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

// Get all strategies for a user
ipcMain.handle('strategy:getAll', (_, userId: string) => {
  const db = getDatabase()
  return db.prepare('SELECT * FROM trading_strategies WHERE user_id = ? ORDER BY created_at DESC').all(userId)
})

// Get active strategies for a user
ipcMain.handle('strategy:getActive', (_, userId: string) => {
  const db = getDatabase()
  return db.prepare('SELECT * FROM trading_strategies WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC').all(userId)
})

// Create a new strategy
ipcMain.handle('strategy:create', (_, data: {
  user_id: string
  name: string
  stock_code?: string
  sell_trigger_percent?: number
  buy_trigger_percent?: number
  sell_quantity_percent?: number
  buy_amount?: number
  buy_quantity_multiplier?: number
}) => {
  const db = getDatabase()
  const id = uuidv4()
  db.prepare(`
    INSERT INTO trading_strategies (id, user_id, stock_code, name, sell_trigger_percent, buy_trigger_percent, sell_quantity_percent, buy_amount, buy_quantity_multiplier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.user_id,
    data.stock_code || null,
    data.name,
    data.sell_trigger_percent ?? 5.0,
    data.buy_trigger_percent ?? -5.0,
    data.sell_quantity_percent ?? 50.0,
    data.buy_amount ?? null,
    data.buy_quantity_multiplier ?? 1.0
  )
  return db.prepare('SELECT * FROM trading_strategies WHERE id = ?').get(id)
})

// Update a strategy
ipcMain.handle('strategy:update', (_, id: string, data: Partial<{
  name: string
  stock_code: string | null
  sell_trigger_percent: number
  buy_trigger_percent: number
  sell_quantity_percent: number
  buy_amount: number | null
  buy_quantity_multiplier: number
  is_active: number
}>) => {
  const db = getDatabase()
  const fields: string[] = []
  const values: (string | number | null)[] = []

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
  if (data.stock_code !== undefined) { fields.push('stock_code = ?'); values.push(data.stock_code) }
  if (data.sell_trigger_percent !== undefined) { fields.push('sell_trigger_percent = ?'); values.push(data.sell_trigger_percent) }
  if (data.buy_trigger_percent !== undefined) { fields.push('buy_trigger_percent = ?'); values.push(data.buy_trigger_percent) }
  if (data.sell_quantity_percent !== undefined) { fields.push('sell_quantity_percent = ?'); values.push(data.sell_quantity_percent) }
  if (data.buy_amount !== undefined) { fields.push('buy_amount = ?'); values.push(data.buy_amount) }
  if (data.buy_quantity_multiplier !== undefined) { fields.push('buy_quantity_multiplier = ?'); values.push(data.buy_quantity_multiplier) }
  if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active) }

  if (fields.length > 0) {
    values.push(id)
    db.prepare(`UPDATE trading_strategies SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }
  return db.prepare('SELECT * FROM trading_strategies WHERE id = ?').get(id)
})

// Delete a strategy
ipcMain.handle('strategy:delete', (_, id: string) => {
  const db = getDatabase()
  db.prepare('DELETE FROM trading_strategies WHERE id = ?').run(id)
  return { success: true }
})

// Check holdings against active strategies and generate signals
ipcMain.handle('strategy:checkSignals', (_, userId: string) => {
  const db = getDatabase()

  // Get active strategies for user
  const strategies = db.prepare('SELECT * FROM trading_strategies WHERE user_id = ? AND is_active = 1').all() as TradingStrategy[]
  if (strategies.length === 0) {
    return { signals: [], checked: 0 }
  }

  // Get user's holdings with account info
  const holdings = db.prepare(`
    SELECT h.*, a.user_id, a.brokerage, a.account_type
    FROM holdings h
    JOIN accounts a ON h.account_id = a.id
    WHERE a.user_id = ? AND h.quantity > 0
  `).all(userId) as Array<{
    id: string
    account_id: string
    stock_code: string
    stock_name: string
    quantity: number
    avg_cost: number
    current_price: number
    currency: string
  }>

  const newSignals: Array<Omit<StrategySignal, 'id' | 'created_at'>> = []
  const today = new Date().toISOString().split('T')[0]

  for (const holding of holdings) {
    // Skip if no avg_cost (can't calculate return)
    if (holding.avg_cost <= 0) continue

    // Calculate return percentage from avg_cost
    const returnPercent = ((holding.current_price - holding.avg_cost) / holding.avg_cost) * 100

    for (const strategy of strategies) {
      // Check if strategy applies to this stock
      if (strategy.stock_code && strategy.stock_code !== holding.stock_code) continue

      // Check if signal already exists for this holding today
      const existingSignal = db.prepare(`
        SELECT id FROM strategy_signals
        WHERE holding_id = ? AND strategy_id = ? AND DATE(created_at) = ? AND status = 'PENDING'
      `).get(holding.id, strategy.id, today)

      if (existingSignal) continue

      // Check SELL trigger (positive return >= threshold)
      if (returnPercent >= strategy.sell_trigger_percent) {
        const suggestedQty = Math.floor(holding.quantity * (strategy.sell_quantity_percent / 100))
        if (suggestedQty > 0) {
          newSignals.push({
            strategy_id: strategy.id,
            holding_id: holding.id,
            stock_code: holding.stock_code,
            stock_name: holding.stock_name,
            account_id: holding.account_id,
            signal_type: 'SELL',
            trigger_price: holding.current_price,
            avg_cost: holding.avg_cost,
            trigger_percent: returnPercent,
            current_quantity: holding.quantity,
            suggested_quantity: suggestedQty,
            status: 'PENDING',
            executed_transaction_id: null,
            executed_at: null,
            dismissed_at: null
          })
        }
      }

      // Check BUY trigger (negative return <= threshold)
      if (returnPercent <= strategy.buy_trigger_percent) {
        let suggestedQty: number
        if (strategy.buy_amount) {
          // Fixed amount buying
          suggestedQty = Math.floor(strategy.buy_amount / holding.current_price)
        } else {
          // Multiplier-based buying
          suggestedQty = Math.floor(holding.quantity * strategy.buy_quantity_multiplier)
        }

        if (suggestedQty > 0) {
          newSignals.push({
            strategy_id: strategy.id,
            holding_id: holding.id,
            stock_code: holding.stock_code,
            stock_name: holding.stock_name,
            account_id: holding.account_id,
            signal_type: 'BUY',
            trigger_price: holding.current_price,
            avg_cost: holding.avg_cost,
            trigger_percent: returnPercent,
            current_quantity: holding.quantity,
            suggested_quantity: suggestedQty,
            status: 'PENDING',
            executed_transaction_id: null,
            executed_at: null,
            dismissed_at: null
          })
        }
      }
    }
  }

  // Insert new signals
  const insertStmt = db.prepare(`
    INSERT INTO strategy_signals (id, strategy_id, holding_id, stock_code, stock_name, account_id, signal_type, trigger_price, avg_cost, trigger_percent, current_quantity, suggested_quantity, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const signal of newSignals) {
    insertStmt.run(
      uuidv4(),
      signal.strategy_id,
      signal.holding_id,
      signal.stock_code,
      signal.stock_name,
      signal.account_id,
      signal.signal_type,
      signal.trigger_price,
      signal.avg_cost,
      signal.trigger_percent,
      signal.current_quantity,
      signal.suggested_quantity,
      signal.status
    )
  }

  return { signals: newSignals.length, checked: holdings.length }
})

// Get pending signals for a user
ipcMain.handle('strategy:getSignals', (_, userId: string, status?: 'PENDING' | 'EXECUTED' | 'DISMISSED') => {
  const db = getDatabase()
  let query = `
    SELECT ss.*, ts.name as strategy_name, a.brokerage, a.account_type, a.account_alias,
           h.currency, h.current_price as latest_price
    FROM strategy_signals ss
    JOIN trading_strategies ts ON ss.strategy_id = ts.id
    JOIN accounts a ON ss.account_id = a.id
    JOIN holdings h ON ss.holding_id = h.id
    WHERE ts.user_id = ?
  `
  const params: (string | undefined)[] = [userId]

  if (status) {
    query += ' AND ss.status = ?'
    params.push(status)
  }

  query += ' ORDER BY ss.created_at DESC'

  return db.prepare(query).all(...params)
})

// Execute a signal (create transaction)
ipcMain.handle('strategy:executeSignal', (_, signalId: string) => {
  const db = getDatabase()

  // Get signal details
  const signal = db.prepare('SELECT * FROM strategy_signals WHERE id = ?').get(signalId) as StrategySignal | undefined
  if (!signal) {
    throw new Error('Signal not found')
  }
  if (signal.status !== 'PENDING') {
    throw new Error('Signal is not pending')
  }

  // Get current holding info
  const holding = db.prepare('SELECT * FROM holdings WHERE id = ?').get(signal.holding_id) as { current_price: number; currency: string } | undefined
  if (!holding) {
    throw new Error('Holding not found')
  }

  // Create transaction
  const transactionId = uuidv4()
  const totalAmount = signal.suggested_quantity * holding.current_price

  db.prepare(`
    INSERT INTO transactions (id, account_id, stock_code, stock_name, type, quantity, price, total_amount, currency, date, is_manual, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'MANUAL')
  `).run(
    transactionId,
    signal.account_id,
    signal.stock_code,
    signal.stock_name,
    signal.signal_type,
    signal.suggested_quantity,
    holding.current_price,
    totalAmount,
    holding.currency,
    new Date().toISOString().split('T')[0]
  )

  // Update holdings
  updateHoldingsAfterTransaction({
    account_id: signal.account_id,
    stock_code: signal.stock_code,
    stock_name: signal.stock_name,
    type: signal.signal_type,
    quantity: signal.suggested_quantity,
    price: holding.current_price,
    currency: holding.currency
  })

  // Mark signal as executed
  db.prepare(`
    UPDATE strategy_signals
    SET status = 'EXECUTED', executed_transaction_id = ?, executed_at = datetime('now')
    WHERE id = ?
  `).run(transactionId, signalId)

  return {
    success: true,
    transaction_id: transactionId,
    type: signal.signal_type,
    quantity: signal.suggested_quantity,
    price: holding.current_price
  }
})

// Dismiss a signal
ipcMain.handle('strategy:dismissSignal', (_, signalId: string) => {
  const db = getDatabase()
  db.prepare(`
    UPDATE strategy_signals
    SET status = 'DISMISSED', dismissed_at = datetime('now')
    WHERE id = ? AND status = 'PENDING'
  `).run(signalId)
  return { success: true }
})

// Get signal history
ipcMain.handle('strategy:getSignalHistory', (_, userId: string, limit: number = 50) => {
  const db = getDatabase()
  return db.prepare(`
    SELECT ss.*, ts.name as strategy_name, a.brokerage, a.account_type, a.account_alias, h.currency
    FROM strategy_signals ss
    JOIN trading_strategies ts ON ss.strategy_id = ts.id
    JOIN accounts a ON ss.account_id = a.id
    JOIN holdings h ON ss.holding_id = h.id
    WHERE ts.user_id = ? AND ss.status != 'PENDING'
    ORDER BY COALESCE(ss.executed_at, ss.dismissed_at) DESC
    LIMIT ?
  `).all(userId, limit)
})
