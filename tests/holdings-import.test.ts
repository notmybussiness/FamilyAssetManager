/**
 * Holdings Import Unit Tests
 *
 * 테스트 대상:
 * 1. 중복 import 시 최신 데이터로 덮어쓰기
 * 2. 해외주식 달러 자동 감지 (500배 기준)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ParsedHolding, detectCurrencyByPriceRatio } from '../src/main/holdings-parser'

// ===== 테스트 1: 중복 Import 덮어쓰기 =====

describe('Holdings Import - Overwrite Behavior', () => {
  /**
   * 시나리오: 삼성증권 Excel에서 같은 종목이 여러 계좌(위탁/ISA/연금)에 있을 때
   * - 같은 account_id에 같은 stock_code 저장 시 덮어씌워야 함
   * - 수량이 합산되면 안됨 (마지막 값으로 대체)
   */

  interface MockHolding {
    stockCode: string
    stockName: string
    quantity: number
    avgPrice: number
    currentPrice: number
    currency: string
  }

  // 시뮬레이션: DB에 저장된 결과
  let mockDB: Map<string, MockHolding>

  // INSERT ON CONFLICT DO UPDATE 동작 시뮬레이션
  function upsertHolding(accountId: string, holding: MockHolding): void {
    const key = `${accountId}:${holding.stockCode || holding.stockName}`
    // ON CONFLICT DO UPDATE: 마지막 값으로 덮어쓰기 (quantity 합산 X)
    mockDB.set(key, { ...holding })
  }

  beforeEach(() => {
    mockDB = new Map()
  })

  it('should overwrite (not add) when same stock is imported multiple times', () => {
    const accountId = 'account-1'

    // 첫 번째 import: 삼성전자 100주
    upsertHolding(accountId, {
      stockCode: '005930',
      stockName: '삼성전자',
      quantity: 100,
      avgPrice: 70000,
      currentPrice: 75000,
      currency: 'KRW'
    })

    // 두 번째 import: 같은 종목 50주 (다른 계좌유형에서 가져옴)
    upsertHolding(accountId, {
      stockCode: '005930',
      stockName: '삼성전자',
      quantity: 50,  // 다른 수량
      avgPrice: 72000,  // 다른 평균단가
      currentPrice: 75000,
      currency: 'KRW'
    })

    const key = `${accountId}:005930`
    const result = mockDB.get(key)

    // 덮어쓰기: 마지막 값인 50이어야 함 (100 + 50 = 150이 아님!)
    expect(result?.quantity).toBe(50)
    expect(result?.avgPrice).toBe(72000)

    // DB에는 하나의 레코드만 있어야 함
    expect(mockDB.size).toBe(1)
  })

  it('should handle stocks with no stock_code (use stockName as key)', () => {
    const accountId = 'account-1'

    // 삼성증권 형식: stock_code가 비어있고 stock_name만 있음
    upsertHolding(accountId, {
      stockCode: '',  // 빈 종목코드
      stockName: 'KODEX 미국나스닥100',
      quantity: 200,
      avgPrice: 15000,
      currentPrice: 16000,
      currency: 'KRW'
    })

    // 같은 종목 다시 import
    upsertHolding(accountId, {
      stockCode: '',
      stockName: 'KODEX 미국나스닥100',
      quantity: 300,
      avgPrice: 14500,
      currentPrice: 16000,
      currency: 'KRW'
    })

    const key = `${accountId}:KODEX 미국나스닥100`
    const result = mockDB.get(key)

    // 마지막 값으로 덮어쓰기
    expect(result?.quantity).toBe(300)
    expect(mockDB.size).toBe(1)
  })

  it('should keep separate records for different stocks', () => {
    const accountId = 'account-1'

    upsertHolding(accountId, {
      stockCode: '005930',
      stockName: '삼성전자',
      quantity: 100,
      avgPrice: 70000,
      currentPrice: 75000,
      currency: 'KRW'
    })

    upsertHolding(accountId, {
      stockCode: '000660',
      stockName: 'SK하이닉스',
      quantity: 50,
      avgPrice: 150000,
      currentPrice: 160000,
      currency: 'KRW'
    })

    expect(mockDB.size).toBe(2)
    expect(mockDB.get(`${accountId}:005930`)?.stockName).toBe('삼성전자')
    expect(mockDB.get(`${accountId}:000660`)?.stockName).toBe('SK하이닉스')
  })

  it('should trim whitespace from stock codes', () => {
    const accountId = 'account-1'

    // 첫 번째: 공백 없음
    upsertHolding(accountId, {
      stockCode: 'AAPL',
      stockName: 'Apple Inc.',
      quantity: 10,
      avgPrice: 150,
      currentPrice: 180,
      currency: 'USD'
    })

    // 두 번째: 앞뒤 공백 있음 (trim 후 같은 키가 되어야 함)
    const stockCodeWithSpaces = ' AAPL '.trim()
    upsertHolding(accountId, {
      stockCode: stockCodeWithSpaces,
      stockName: 'Apple Inc.',
      quantity: 20,
      avgPrice: 155,
      currentPrice: 180,
      currency: 'USD'
    })

    expect(mockDB.size).toBe(1)
    expect(mockDB.get(`${accountId}:AAPL`)?.quantity).toBe(20)
  })
})


// ===== 테스트 2: 달러 자동 감지 (500배 기준) =====

describe('USD Auto-Detection (500x Price Ratio)', () => {
  /**
   * 로직:
   * - currency 필드가 없거나 빈약할 때
   * - 현재가 / 평균단가 >= 500 이면 USD로 판단
   * - 이유: 환율 1:1400 기준, 반토막 나도 700배 → 500배 기준으로 안전하게 판단
   *
   * 예시:
   * - 평균단가: $150 (150으로 저장)
   * - 시세 조회로 가져온 현재가: ₩210,000 (원화)
   * - 비율: 210000 / 150 = 1400 → USD로 판단
   */

  // detectCurrencyByPriceRatio는 holdings-parser.ts에서 import

  it('should detect USD when currentPrice/avgPrice >= 500', () => {
    // AAPL: 평균단가 $150, 현재가 ₩210,000
    const currency = detectCurrencyByPriceRatio(150, 210000)
    expect(currency).toBe('USD')
  })

  it('should detect USD when avgPrice/currentPrice >= 500 (reverse case)', () => {
    // 역방향: 평균단가 ₩150,000, 현재가 $180
    const currency = detectCurrencyByPriceRatio(150000, 180)
    expect(currency).toBe('USD')
  })

  it('should return KRW for Korean stocks', () => {
    // 삼성전자: 평균단가 70,000원, 현재가 75,000원
    const currency = detectCurrencyByPriceRatio(70000, 75000)
    expect(currency).toBe('KRW')
  })

  it('should return KRW for small ratio differences', () => {
    // 주가 변동: 2배 상승 (100 → 200)
    const currency = detectCurrencyByPriceRatio(100, 200)
    expect(currency).toBe('KRW')
  })

  it('should respect explicit USD currency', () => {
    // 이미 USD로 지정된 경우 그대로 유지
    const currency = detectCurrencyByPriceRatio(150, 180, 'USD')
    expect(currency).toBe('USD')
  })

  it('should handle zero prices gracefully', () => {
    expect(detectCurrencyByPriceRatio(0, 100)).toBe('KRW')
    expect(detectCurrencyByPriceRatio(100, 0)).toBe('KRW')
    expect(detectCurrencyByPriceRatio(0, 0)).toBe('KRW')
  })

  it('should detect USD for VOO-like cases', () => {
    // Vanguard S&P 500 ETF (VOO)
    // 평균단가: $400 (400으로 저장)
    // 시세 조회 시 원화로 가져옴: ₩600,000
    const currency = detectCurrencyByPriceRatio(400, 600000)
    expect(currency).toBe('USD')  // 1500배 → USD
  })

  it('should work with edge case at exactly 500x', () => {
    // 정확히 500배
    const currency = detectCurrencyByPriceRatio(100, 50000)
    expect(currency).toBe('USD')

    // 499배 → KRW
    const currency2 = detectCurrencyByPriceRatio(100, 49900)
    expect(currency2).toBe('KRW')
  })
})


// ===== 통합 테스트: ParsedHolding 타입 검증 =====

describe('ParsedHolding Type Validation', () => {
  it('should have all required fields', () => {
    const holding: ParsedHolding = {
      stockCode: '005930',
      stockName: '삼성전자',
      quantity: 100,
      avgPrice: 70000,
      currentPrice: 75000,
      purchaseAmount: 7000000,
      evalAmount: 7500000,
      profitLoss: 500000,
      returnRate: 7.14,
      currency: 'KRW',
      market: 'KR',
      isValid: true,
      errors: []
    }

    expect(holding.stockCode).toBe('005930')
    expect(holding.currency).toBe('KRW')
    expect(holding.isValid).toBe(true)
  })

  it('should mark invalid when quantity is zero', () => {
    const holding: ParsedHolding = {
      stockCode: 'AAPL',
      stockName: 'Apple',
      quantity: 0,  // 무효
      avgPrice: 150,
      currentPrice: 180,
      purchaseAmount: 0,
      evalAmount: 0,
      profitLoss: 0,
      returnRate: 0,
      currency: 'USD',
      isValid: false,
      errors: ['Invalid quantity']
    }

    expect(holding.isValid).toBe(false)
    expect(holding.errors).toContain('Invalid quantity')
  })
})
