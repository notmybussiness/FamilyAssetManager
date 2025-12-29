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
  prevClose?: number
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

// ===== 종목코드 검색 (이름 → 코드) =====
const stockCodeCache: Map<string, string> = new Map()

async function searchStockCode(stockName: string): Promise<string | null> {
  // 캐시 확인
  const cached = stockCodeCache.get(stockName)
  if (cached) return cached

  try {
    // 네이버 금융 검색 API
    const url = `https://ac.stock.naver.com/ac?q=${encodeURIComponent(stockName)}&target=stock`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) return null

    const data = await response.json() as {
      query: string
      items: Array<{
        code: string
        name: string
        typeCode: string  // 'KOSPI', 'KOSDAQ' 등
      }>
    }

    // 결과에서 정확히 매칭되는 종목 찾기
    const items = data.items || []
    for (const item of items) {
      // 정확히 일치하거나, 공백 제거 후 일치
      if (item.name === stockName || item.name.replace(/\s/g, '') === stockName.replace(/\s/g, '')) {
        stockCodeCache.set(stockName, item.code)
        return item.code
      }
    }

    // 정확히 일치하지 않으면 첫 번째 결과 사용
    if (items.length > 0) {
      stockCodeCache.set(stockName, items[0].code)
      return items[0].code
    }

    return null
  } catch (error) {
    console.error(`Failed to search stock code for ${stockName}:`, error)
    return null
  }
}

// ===== 주식 현재가 API =====

// 네이버 금융 API (한국 주식용 - 안정적)
async function fetchNaverPrice(stockCode: string): Promise<StockPriceResult> {
  try {
    const url = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${stockCode}`
    console.log(`[Naver API] 요청: ${stockCode}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      console.log(`[Naver API] HTTP 오류: ${response.status}`)
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json() as {
      resultCode: string
      result: {
        areas: Array<{
          datas: Array<{
            cd: string      // 종목코드
            nm: string      // 종목명
            nv: number      // 현재가 (now value)
            sv: number      // 전일종가 (standard value = 기준가)
            cv: number      // 전일대비 절대값 (change value)
            cr: number      // 등락률 절대값 (change rate)
            rf: string      // 등락구분 (1,2=상승, 3=보합, 4,5=하락)
            ov: number      // 시가 (open value)
            hv: number      // 고가 (high value)
            lv: number      // 저가 (low value)
            aq: number      // 거래량 (accumulated quantity)
          }>
        }>
      }
    }

    if (data.resultCode !== 'success') {
      console.log(`[Naver API] 응답 오류: resultCode=${data.resultCode}`)
      throw new Error('Naver API error')
    }

    const stockData = data.result?.areas?.[0]?.datas?.[0]
    if (!stockData) {
      console.log(`[Naver API] 데이터 없음: ${stockCode}`, JSON.stringify(data.result))
      throw new Error('No stock data')
    }
    console.log(`[Naver API] ✅ ${stockCode}: ${stockData.nv}원`)

    // rf: 1,2=상승, 3=보합, 4,5=하락
    const isDown = stockData.rf === '4' || stockData.rf === '5'
    const change = isDown ? -stockData.cv : stockData.cv
    const changePercent = isDown ? -stockData.cr : stockData.cr

    return {
      success: true,
      stockCode: stockCode,
      stockName: stockData.nm,
      currentPrice: stockData.nv,
      prevClose: stockData.sv,  // sv = 전일종가 (기준가)
      change,
      changePercent,
      currency: 'KRW',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error(`Naver API failed for ${stockCode}:`, error)
    return {
      success: false,
      stockCode,
      currentPrice: 0,
      currency: 'KRW',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Yahoo Finance API (미국 주식용)
async function fetchYahooPrice(symbol: string): Promise<StockPriceResult> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
    console.log(`[Yahoo API] 요청: ${symbol}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      console.log(`[Yahoo API] HTTP 오류: ${response.status} for ${symbol}`)
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const result = parseYahooResponse(data, symbol)
    if (result.success) {
      console.log(`[Yahoo API] ✅ ${symbol}: $${result.currentPrice}`)
    } else {
      console.log(`[Yahoo API] ❌ ${symbol}: ${result.error}`)
    }
    return result
  } catch (error) {
    console.log(`[Yahoo API] 예외: ${symbol} - ${error}`)
    return {
      success: false,
      stockCode: symbol,
      currentPrice: 0,
      currency: 'USD',
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

    return {
      success: true,
      stockCode: originalSymbol,
      stockName: meta.shortName || meta.symbol,
      currentPrice,
      prevClose: previousClose,
      change,
      changePercent,
      currency: meta.currency || 'USD',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      success: false,
      stockCode: originalSymbol,
      currentPrice: 0,
      currency: 'USD',
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

// 6자리 숫자 코드인지 확인 (한국 주식 표준)
const isStandardKoreanCode = (code: string): boolean => /^\d{6}$/.test(code)

// 미국 티커 패턴 (영문 대문자 1-5자리)
const isUSTickerPattern = (code: string): boolean => /^[A-Z]{1,5}$/.test(code)

export async function fetchStockPrice(stockCode: string, stockName?: string, currency?: string): Promise<StockPriceResult> {
  console.log(`[fetchStockPrice] 시작: code="${stockCode}", name="${stockName || ''}", currency="${currency || ''}"`)

  // HSBC 등 조회 제외 종목
  if (SKIP_STOCK_CODES.some(skip => stockCode.toUpperCase().includes(skip.toUpperCase()))) {
    console.log(`[fetchStockPrice] SKIP: "${stockCode}" - 제외 목록`)
    return {
      success: false,
      stockCode,
      currentPrice: 0,
      currency: 'USD',
      timestamp: new Date().toISOString(),
      error: 'Skipped (known issue)'
    }
  }

  // 캐시 확인
  const cached = stockPriceCache.get(stockCode)
  if (cached && Date.now() - cached.timestamp < STOCK_CACHE_TTL) {
    return {
      success: true,
      stockCode,
      currentPrice: cached.price,
      currency: currency || 'KRW',
      timestamp: new Date(cached.timestamp).toISOString()
    }
  }

  // 미국 주식 판단: currency가 USD
  const isUSStock = currency === 'USD'

  // 한국 주식 판단: currency가 KRW이거나, 6자리 숫자 코드이거나, 한글 포함
  const isKoreanStock = currency === 'KRW' ||
    isStandardKoreanCode(stockCode) ||
    (stockName && /[가-힣]/.test(stockName)) ||
    /[가-힣]/.test(stockCode)

  let actualCode = stockCode

  // 미국 주식: Yahoo Finance로 조회
  if (isUSStock) {
    console.log(`[fetchStockPrice] 미국 주식 → Yahoo API: ${stockCode}`)
    const result = await fetchYahooPrice(stockCode)

    if (result.success) {
      console.log(`[fetchStockPrice] ✅ "${stockCode}" → $${result.currentPrice}`)
      stockPriceCache.set(stockCode, { price: result.currentPrice, timestamp: Date.now() })
    } else {
      console.log(`[fetchStockPrice] ❌ "${stockCode}" → 실패: ${result.error}`)
    }

    return result
  }

  // 한국 주식: 종목명으로 네이버에서 코드 검색
  if (isKoreanStock) {
    // 표준 6자리 숫자 코드가 아니면 → 종목명으로 검색
    if (!isStandardKoreanCode(stockCode)) {
      const searchTerm = stockName || stockCode
      console.log(`[fetchStockPrice] 종목명으로 코드 검색: "${searchTerm}"`)
      const foundCode = await searchStockCode(searchTerm)
      if (foundCode) {
        actualCode = foundCode
        console.log(`[fetchStockPrice] 코드 발견: "${searchTerm}" → ${foundCode}`)
      } else {
        // 네이버에서 못 찾으면 Yahoo로 fallback 시도
        console.log(`[fetchStockPrice] 네이버에서 못찾음, Yahoo fallback: "${stockCode}"`)
        const yahooResult = await fetchYahooPrice(stockCode)
        if (yahooResult.success) {
          console.log(`[fetchStockPrice] ✅ Yahoo fallback 성공: "${stockCode}" → $${yahooResult.currentPrice}`)
          stockPriceCache.set(stockCode, { price: yahooResult.currentPrice, timestamp: Date.now() })
          return yahooResult
        }
        // Yahoo도 실패
        console.log(`[fetchStockPrice] ❌ Yahoo fallback도 실패: "${stockCode}"`)
        return {
          success: false,
          stockCode,
          currentPrice: 0,
          currency: 'KRW',
          timestamp: new Date().toISOString(),
          error: `종목 코드를 찾을 수 없음: ${searchTerm}`
        }
      }
    }

    // 네이버 API로 조회
    console.log(`[fetchStockPrice] 네이버 API 호출: ${actualCode}`)
    const result = await fetchNaverPrice(actualCode)
    result.stockCode = stockCode  // 원래 코드로 반환

    if (result.success) {
      stockPriceCache.set(stockCode, { price: result.currentPrice, timestamp: Date.now() })
      return result
    }

    // 네이버 실패 시 Yahoo fallback (찾은 코드로 시도)
    console.log(`[fetchStockPrice] 네이버 실패, Yahoo fallback: "${actualCode}"`)
    const yahooFallback = await fetchYahooPrice(actualCode)
    if (yahooFallback.success) {
      console.log(`[fetchStockPrice] ✅ Yahoo fallback 성공: "${stockCode}" → $${yahooFallback.currentPrice}`)
      stockPriceCache.set(stockCode, { price: yahooFallback.currentPrice, timestamp: Date.now() })
      return yahooFallback
    }

    return result  // 네이버 실패 결과 반환
  }

  // 분류 불가: 에러 반환
  console.log(`[fetchStockPrice] ❌ "${stockCode}" → 분류 불가`)
  return {
    success: false,
    stockCode,
    currentPrice: 0,
    currency: currency || 'KRW',
    timestamp: new Date().toISOString(),
    error: '종목 분류 불가 (한국/미국 아님)'
  }
}

// 모든 보유종목 현재가 일괄 업데이트
export async function updateAllHoldingPrices(userId: string): Promise<BulkPriceResult> {
  const db = getDatabase()

  // 사용자의 모든 보유종목 조회 (stock_name도 함께)
  const holdings = db.prepare(`
    SELECT DISTINCT h.stock_code, h.stock_name, h.currency
    FROM holdings h
    JOIN accounts a ON h.account_id = a.id
    WHERE a.user_id = ?
  `).all(userId) as Array<{ stock_code: string; stock_name: string; currency: string }>

  console.log(`\n========== 시세 일괄 업데이트 시작 ==========`)
  console.log(`[updateAll] 총 ${holdings.length}개 종목:`, holdings.map(h => h.stock_code))

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
      batch.map(h => fetchStockPrice(h.stock_code, h.stock_name, h.currency))
    )

    for (const result of batchResults) {
      results.push(result)

      if (result.success && result.currentPrice > 0) {
        // DB 업데이트 (prev_close 포함)
        const prevClose = result.prevClose || (result.currentPrice - (result.change || 0))
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

  console.log(`\n========== 시세 업데이트 완료 ==========`)
  console.log(`[updateAll] 성공: ${updated}개, 실패: ${failed}개`)
  const failedResults = results.filter(r => !r.success)
  if (failedResults.length > 0) {
    console.log(`[updateAll] 실패 목록:`)
    failedResults.forEach(r => console.log(`  - ${r.stockCode}: ${r.error}`))
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
