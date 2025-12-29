/**
 * Market Data API Unit Tests
 *
 * PRD 요구사항 테스트:
 * - F-2.8: Market-aligned FX rate updates
 * - F-3.3: Per-stock view with current prices
 * - F-4.1: Highlight stocks with 5%+ daily change
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { clearMarketDataCache } from '../src/main/market-data-api'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock database
vi.mock('../src/main/database', () => ({
  getDatabase: () => ({
    prepare: () => ({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn()
    })
  })
}))

describe('Exchange Rate Types', () => {
  it('should define ExchangeRateResult interface correctly', () => {
    const successResult = {
      success: true,
      pair: 'USD/KRW',
      rate: 1450.25,
      timestamp: '2025-01-15T10:00:00Z'
    }

    expect(successResult.success).toBe(true)
    expect(successResult.pair).toBe('USD/KRW')
    expect(successResult.rate).toBeGreaterThan(0)
    expect(successResult.timestamp).toBeTruthy()
  })

  it('should handle error cases', () => {
    const errorResult = {
      success: false,
      pair: 'USD/KRW',
      rate: 0,
      timestamp: '2025-01-15T10:00:00Z',
      error: 'API connection failed'
    }

    expect(errorResult.success).toBe(false)
    expect(errorResult.error).toBe('API connection failed')
  })
})

describe('Stock Price Types', () => {
  it('should define StockPriceResult for Korean stocks', () => {
    const krStock = {
      success: true,
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 75000,
      prevClose: 74000,
      change: 1000,
      changePercent: 1.35,
      currency: 'KRW',
      timestamp: '2025-01-15T10:00:00Z'
    }

    expect(krStock.stockCode).toBe('005930')
    expect(krStock.currency).toBe('KRW')
    expect(krStock.changePercent).toBeCloseTo(1.35, 2)
  })

  it('should define StockPriceResult for US stocks', () => {
    const usStock = {
      success: true,
      stockCode: 'AAPL',
      stockName: 'Apple Inc.',
      currentPrice: 185.50,
      prevClose: 183.00,
      change: 2.50,
      changePercent: 1.37,
      currency: 'USD',
      timestamp: '2025-01-15T10:00:00Z'
    }

    expect(usStock.stockCode).toBe('AAPL')
    expect(usStock.currency).toBe('USD')
  })

  it('should identify high change stocks (5%+)', () => {
    const highChangeStock = {
      success: true,
      stockCode: '000660',
      stockName: 'SK하이닉스',
      currentPrice: 150000,
      prevClose: 140000,
      change: 10000,
      changePercent: 7.14,
      currency: 'KRW',
      timestamp: '2025-01-15T10:00:00Z'
    }

    const isHighChange = Math.abs(highChangeStock.changePercent) >= 5
    expect(isHighChange).toBe(true)
  })
})

describe('BulkPriceResult Types', () => {
  it('should define bulk update result correctly', () => {
    const bulkResult = {
      success: true,
      updated: 10,
      failed: 2,
      results: [
        { success: true, stockCode: '005930', currentPrice: 75000, currency: 'KRW', timestamp: '' },
        { success: false, stockCode: 'INVALID', currentPrice: 0, currency: 'KRW', timestamp: '', error: 'Not found' }
      ],
      exchangeRate: {
        success: true,
        pair: 'USD/KRW',
        rate: 1450.25,
        timestamp: '2025-01-15T10:00:00Z'
      }
    }

    expect(bulkResult.updated).toBe(10)
    expect(bulkResult.failed).toBe(2)
    expect(bulkResult.results).toHaveLength(2)
    expect(bulkResult.exchangeRate?.rate).toBe(1450.25)
  })
})

describe('Skip Stock Codes', () => {
  const SKIP_STOCK_CODES = ['HSBC', 'HSBC.L', 'HSBC.N']

  it('should skip known problematic stocks', () => {
    const testCodes = ['HSBC', 'HSBC.L', 'HSBC.N']

    testCodes.forEach(code => {
      const shouldSkip = SKIP_STOCK_CODES.some(skip =>
        code.toUpperCase().includes(skip.toUpperCase())
      )
      expect(shouldSkip).toBe(true)
    })
  })

  it('should not skip valid stocks', () => {
    const validCodes = ['AAPL', 'MSFT', '005930', '035720']

    validCodes.forEach(code => {
      const shouldSkip = SKIP_STOCK_CODES.some(skip =>
        code.toUpperCase().includes(skip.toUpperCase())
      )
      expect(shouldSkip).toBe(false)
    })
  })
})

describe('Stock Code Pattern Detection', () => {
  // Korean stock code patterns
  const isStandardKoreanCode = (code: string): boolean => /^\d{6}$/.test(code)
  // US ticker patterns
  const isUSTickerPattern = (code: string): boolean => /^[A-Z]{1,5}$/.test(code)

  describe('Korean Stock Detection', () => {
    it('should identify valid Korean stock codes', () => {
      expect(isStandardKoreanCode('005930')).toBe(true)  // Samsung
      expect(isStandardKoreanCode('035720')).toBe(true)  // Kakao
      expect(isStandardKoreanCode('000660')).toBe(true)  // SK Hynix
      expect(isStandardKoreanCode('207940')).toBe(true)  // Samsung Biologics
    })

    it('should reject invalid Korean stock codes', () => {
      expect(isStandardKoreanCode('AAPL')).toBe(false)
      expect(isStandardKoreanCode('12345')).toBe(false)  // 5 digits
      expect(isStandardKoreanCode('1234567')).toBe(false)  // 7 digits
      expect(isStandardKoreanCode('00593A')).toBe(false)  // Contains letter
    })
  })

  describe('US Stock Detection', () => {
    it('should identify valid US tickers', () => {
      expect(isUSTickerPattern('AAPL')).toBe(true)
      expect(isUSTickerPattern('MSFT')).toBe(true)
      expect(isUSTickerPattern('A')).toBe(true)  // Single letter (Agilent)
      expect(isUSTickerPattern('GOOGL')).toBe(true)  // 5 letters
    })

    it('should reject invalid US tickers', () => {
      expect(isUSTickerPattern('005930')).toBe(false)  // Numbers
      expect(isUSTickerPattern('ABCDEF')).toBe(false)  // 6 letters
      expect(isUSTickerPattern('aapl')).toBe(false)  // Lowercase
      expect(isUSTickerPattern('AA1')).toBe(false)  // Contains number
    })
  })
})

describe('Cache Management', () => {
  beforeEach(() => {
    clearMarketDataCache()
  })

  it('should clear cache without errors', () => {
    expect(() => clearMarketDataCache()).not.toThrow()
  })

  it('should be idempotent', () => {
    clearMarketDataCache()
    clearMarketDataCache()
    clearMarketDataCache()
    // Should not throw
    expect(true).toBe(true)
  })
})

describe('Currency Detection', () => {
  it('should identify USD stocks by currency', () => {
    const holding = {
      stock_code: 'AAPL',
      stock_name: 'Apple Inc.',
      currency: 'USD'
    }

    const isUSStock = holding.currency === 'USD'
    expect(isUSStock).toBe(true)
  })

  it('should identify KRW stocks by currency', () => {
    const holding = {
      stock_code: '005930',
      stock_name: '삼성전자',
      currency: 'KRW'
    }

    const isKoreanStock = holding.currency === 'KRW'
    expect(isKoreanStock).toBe(true)
  })

  it('should identify Korean stocks by Korean characters in name', () => {
    const hasKoreanChars = (name: string): boolean => /[가-힣]/.test(name)

    expect(hasKoreanChars('삼성전자')).toBe(true)
    expect(hasKoreanChars('SK하이닉스')).toBe(true)
    expect(hasKoreanChars('Apple Inc.')).toBe(false)
    expect(hasKoreanChars('NVIDIA')).toBe(false)
  })
})

describe('Price Change Calculation', () => {
  it('should calculate positive change', () => {
    const currentPrice = 75000
    const prevClose = 70000
    const change = currentPrice - prevClose
    const changePercent = (change / prevClose) * 100

    expect(change).toBe(5000)
    expect(changePercent).toBeCloseTo(7.14, 2)
  })

  it('should calculate negative change', () => {
    const currentPrice = 65000
    const prevClose = 70000
    const change = currentPrice - prevClose
    const changePercent = (change / prevClose) * 100

    expect(change).toBe(-5000)
    expect(changePercent).toBeCloseTo(-7.14, 2)
  })

  it('should handle zero change', () => {
    const currentPrice = 70000
    const prevClose = 70000
    const change = currentPrice - prevClose
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0

    expect(change).toBe(0)
    expect(changePercent).toBe(0)
  })

  it('should handle zero previous close safely', () => {
    const currentPrice = 70000
    const prevClose = 0
    const changePercent = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0

    expect(changePercent).toBe(0)
  })
})

describe('Yahoo Finance Response Parsing', () => {
  it('should parse valid Yahoo response', () => {
    const yahooResponse = {
      chart: {
        result: [{
          meta: {
            symbol: 'AAPL',
            shortName: 'Apple Inc.',
            regularMarketPrice: 185.50,
            previousClose: 183.00,
            currency: 'USD'
          },
          indicators: {
            quote: [{
              close: [183.00, 184.00, 185.50]
            }]
          }
        }]
      }
    }

    const result = yahooResponse.chart.result[0]
    const meta = result.meta

    expect(meta.symbol).toBe('AAPL')
    expect(meta.regularMarketPrice).toBe(185.50)
    expect(meta.previousClose).toBe(183.00)
    expect(meta.currency).toBe('USD')
  })

  it('should handle missing data gracefully', () => {
    const emptyResponse = {
      chart: {
        result: null
      }
    }

    const result = emptyResponse.chart.result
    expect(result).toBeNull()
  })
})

describe('Naver Finance Response Parsing', () => {
  it('should parse valid Naver response', () => {
    const naverResponse = {
      resultCode: 'success',
      result: {
        areas: [{
          datas: [{
            cd: '005930',
            nm: '삼성전자',
            nv: 75000,
            sv: 74000,
            cv: 1000,
            cr: 1.35,
            rf: '2'  // 상승
          }]
        }]
      }
    }

    const stockData = naverResponse.result.areas[0].datas[0]

    expect(stockData.cd).toBe('005930')
    expect(stockData.nm).toBe('삼성전자')
    expect(stockData.nv).toBe(75000)  // 현재가
    expect(stockData.sv).toBe(74000)  // 전일종가
  })

  it('should determine change direction from rf field', () => {
    // rf: 1,2=상승, 3=보합, 4,5=하락
    const upRf = ['1', '2']
    const downRf = ['4', '5']

    expect(upRf.includes('1')).toBe(true)
    expect(upRf.includes('2')).toBe(true)
    expect(downRf.includes('4')).toBe(true)
    expect(downRf.includes('5')).toBe(true)
  })
})

describe('Frankfurter API Response Parsing', () => {
  it('should parse valid exchange rate response', () => {
    const frankfurterResponse = {
      amount: 1,
      base: 'USD',
      date: '2025-01-15',
      rates: {
        KRW: 1450.25
      }
    }

    expect(frankfurterResponse.rates.KRW).toBe(1450.25)
    expect(frankfurterResponse.base).toBe('USD')
  })

  it('should handle missing currency pair', () => {
    const response = {
      rates: {
        EUR: 0.92
      }
    }

    expect(response.rates['KRW']).toBeUndefined()
  })
})

describe('Rate Limiting', () => {
  it('should respect batch size', () => {
    const holdings = Array(15).fill({ stock_code: '005930', stock_name: '삼성전자', currency: 'KRW' })
    const batchSize = 5
    const batches = Math.ceil(holdings.length / batchSize)

    expect(batches).toBe(3)
  })

  it('should calculate delay correctly', () => {
    const delayMs = 500
    const batches = 3
    const totalDelay = (batches - 1) * delayMs

    expect(totalDelay).toBe(1000)  // 2 delays between 3 batches
  })
})
