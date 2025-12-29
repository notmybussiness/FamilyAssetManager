/**
 * Market Data API Service
 * 환율 및 주식 현재가 실시간 조회 서비스
 */

import { getDatabase } from './database'

// ===== 타입 정의 =====
export interface ExchangeRateResult {
  success: boolean
  pair: string
  rate: number
  timestamp: string
  error?: string
}

export interface StockPriceResult {
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

export interface BulkPriceResult {
  success: boolean
  updated: number
  failed: number
  results: StockPriceResult[]
  exchangeRate?: ExchangeRateResult
}

// ===== 환율 API (Frankfurter - 무료, 제한없음) =====
const FRANKFURTER_API = 'https://api.frankfurter.app'

// 캐시 (5분)
const exchangeRateCache: Map<string, { rate: number; timestamp: number }> = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5분

export async function fetchExchangeRate(from: string = 'USD', to: string = 'KRW'): Promise<ExchangeRateResult> {
  const pair = `${from}/${to}`
  const cacheKey = pair
  const cached = exchangeRateCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      success: true,
      pair,
      rate: cached.rate,
      timestamp: new Date(cached.timestamp).toISOString()
    }
  }

  try {
    const response = await fetch(`${FRANKFURTER_API}/latest?from=${from}&to=${to}`)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json() as { rates: Record<string, number>; date: string }
    const rate = data.rates[to]

    if (!rate) {
      throw new Error(`Rate not found for ${pair}`)
    }

    // 캐시 저장
    exchangeRateCache.set(cacheKey, { rate, timestamp: Date.now() })

    // DB에도 저장
    const db = getDatabase()
    const { v4: uuidv4 } = await import('uuid')
    db.prepare('INSERT INTO exchange_rates (id, currency_pair, rate) VALUES (?, ?, ?)').run(
      uuidv4(),
      pair,
      rate
    )

    return {
      success: true,
      pair,
      rate,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error(`Failed to fetch exchange rate ${pair}:`, error)

    // 캐시에서 fallback
    if (cached) {
      return {
        success: true,
        pair,
        rate: cached.rate,
        timestamp: new Date(cached.timestamp).toISOString(),
        error: 'Using cached data'
      }
    }

    // DB에서 마지막 환율 조회
    const db = getDatabase()
    const lastRate = db.prepare(
      'SELECT rate, fetched_at FROM exchange_rates WHERE currency_pair = ? ORDER BY fetched_at DESC LIMIT 1'
    ).get(pair) as { rate: number; fetched_at: string } | undefined

    if (lastRate) {
      return {
        success: true,
        pair,
        rate: lastRate.rate,
        timestamp: lastRate.fetched_at,
        error: 'Using database fallback'
      }
    }

    return {
      success: false,
      pair,
      rate: 0,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ===== 주식 현재가 API =====

// Yahoo Finance API (비공식, 무료)
async function fetchYahooPrice(symbol: string): Promise<StockPriceResult> {
  try {
    // Yahoo Finance는 한국 주식은 .KS (KOSPI) 또는 .KQ (KOSDAQ) 접미사 필요
    let yahooSymbol = symbol

    // 한국 주식 코드 (6자리 숫자)
    if (/^\d{6}$/.test(symbol)) {
      // KOSPI 종목으로 가정 (대부분)
      yahooSymbol = `${symbol}.KS`
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      // KOSDAQ 시도
      if (yahooSymbol.endsWith('.KS')) {
        yahooSymbol = `${symbol}.KQ`
        const retryResponse = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }
        )
        if (!retryResponse.ok) {
          throw new Error(`HTTP ${retryResponse.status}`)
        }
        const retryData = await retryResponse.json()
        return parseYahooResponse(retryData, symbol)
      }
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    return parseYahooResponse(data, symbol)
  } catch (error) {
    return {
      success: false,
      stockCode: symbol,
      currentPrice: 0,
      currency: 'KRW',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function parseYahooResponse(data: any, originalSymbol: string): StockPriceResult {
  try {
    const result = data.chart?.result?.[0]
    if (!result) {
      throw new Error('No data')
    }

    const meta = result.meta
    const quote = result.indicators?.quote?.[0]

    // 현재가: regularMarketPrice 또는 마지막 close
    const currentPrice = meta.regularMarketPrice ||
      (quote?.close ? quote.close[quote.close.length - 1] : 0)

    const previousClose = meta.previousClose || meta.chartPreviousClose || currentPrice
    const change = currentPrice - previousClose
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

    // 통화 결정
    let currency = meta.currency || 'USD'
    if (currency === 'KRW' || originalSymbol.match(/^\d{6}$/)) {
      currency = 'KRW'
    }

    return {
      success: true,
      stockCode: originalSymbol,
      stockName: meta.shortName || meta.symbol,
      currentPrice,
      change,
      changePercent,
      currency,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      success: false,
      stockCode: originalSymbol,
      currentPrice: 0,
      currency: 'KRW',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Parse error'
    }
  }
}

// 주식 현재가 조회 (캐시 포함)
const stockPriceCache: Map<string, { price: number; timestamp: number }> = new Map()
const STOCK_CACHE_TTL = 1 * 60 * 1000 // 1분

// 시세 조회 제외 종목 (조회 오류 발생)
const SKIP_STOCK_CODES = ['HSBC', 'HSBC.L', 'HSBC.N']

export async function fetchStockPrice(stockCode: string): Promise<StockPriceResult> {
  // HSBC 등 조회 제외 종목
  if (SKIP_STOCK_CODES.some(skip => stockCode.toUpperCase().includes(skip.toUpperCase()))) {
    return {
      success: false,
      stockCode,
      currentPrice: 0,
      currency: 'USD',
      timestamp: new Date().toISOString(),
      error: 'Skipped (known issue)'
    }
  }

  const cached = stockPriceCache.get(stockCode)

  if (cached && Date.now() - cached.timestamp < STOCK_CACHE_TTL) {
    return {
      success: true,
      stockCode,
      currentPrice: cached.price,
      currency: /^\d{6}$/.test(stockCode) ? 'KRW' : 'USD',
      timestamp: new Date(cached.timestamp).toISOString()
    }
  }

  const result = await fetchYahooPrice(stockCode)

  if (result.success) {
    stockPriceCache.set(stockCode, {
      price: result.currentPrice,
      timestamp: Date.now()
    })
  }

  return result
}

// 모든 보유종목 현재가 일괄 업데이트
export async function updateAllHoldingPrices(userId: string): Promise<BulkPriceResult> {
  const db = getDatabase()

  // 사용자의 모든 보유종목 조회
  const holdings = db.prepare(`
    SELECT DISTINCT h.stock_code, h.currency
    FROM holdings h
    JOIN accounts a ON h.account_id = a.id
    WHERE a.user_id = ?
  `).all(userId) as Array<{ stock_code: string; currency: string }>

  const results: StockPriceResult[] = []
  let updated = 0
  let failed = 0

  // 환율 먼저 조회 (USD 종목이 있는 경우)
  let exchangeRate: ExchangeRateResult | undefined
  const hasUSD = holdings.some(h => h.currency === 'USD')
  if (hasUSD) {
    exchangeRate = await fetchExchangeRate('USD', 'KRW')
  }

  // 병렬 처리 (5개씩 배치)
  const batchSize = 5
  for (let i = 0; i < holdings.length; i += batchSize) {
    const batch = holdings.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(h => fetchStockPrice(h.stock_code))
    )

    for (const result of batchResults) {
      results.push(result)

      if (result.success && result.currentPrice > 0) {
        // DB 업데이트 (prev_close 포함)
        // prev_close: 전일종가 (Yahoo Finance의 previousClose)
        const prevClose = result.currentPrice - (result.change || 0)
        db.prepare(`
          UPDATE holdings
          SET current_price = ?, prev_close = ?, last_synced = datetime('now')
          WHERE stock_code = ?
        `).run(result.currentPrice, prevClose > 0 ? prevClose : result.currentPrice, result.stockCode)
        updated++
      } else {
        failed++
      }
    }

    // Rate limiting: 배치 간 딜레이
    if (i + batchSize < holdings.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return {
    success: true,
    updated,
    failed,
    results,
    exchangeRate
  }
}

// 특정 종목 현재가 업데이트
export async function updateHoldingPrice(stockCode: string): Promise<StockPriceResult> {
  const result = await fetchStockPrice(stockCode)

  if (result.success && result.currentPrice > 0) {
    const db = getDatabase()
    db.prepare(`
      UPDATE holdings
      SET current_price = ?, last_synced = datetime('now')
      WHERE stock_code = ?
    `).run(result.currentPrice, stockCode)
  }

  return result
}

// 캐시 클리어
export function clearMarketDataCache(): void {
  exchangeRateCache.clear()
  stockPriceCache.clear()
}
