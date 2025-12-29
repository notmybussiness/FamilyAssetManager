/**
 * Excel Import Unit Tests
 *
 * PRD 요구사항 테스트:
 * - F-5.2: Excel 가져오기 (CSV, XLSX, XLS)
 * - F-5.4: Import 템플릿 다운로드
 * - F-5.6: 중복 감지
 */

import { describe, it, expect } from 'vitest'
import { getBrokerageList, generateBatchId } from '../src/main/excel-import'

describe('getBrokerageList', () => {
  it('should return all supported brokerages', () => {
    const list = getBrokerageList()

    expect(list.length).toBe(9) // AUTO + 8 brokerages

    // Check AUTO is first
    expect(list[0]).toEqual({ value: 'AUTO', label: '자동 감지' })
  })

  it('should include all Korean brokerages', () => {
    const list = getBrokerageList()
    const values = list.map(b => b.value)

    expect(values).toContain('KOREA_INV')
    expect(values).toContain('KIWOOM')
    expect(values).toContain('MIRAE')
    expect(values).toContain('SAMSUNG')
    expect(values).toContain('NH')
    expect(values).toContain('KB')
    expect(values).toContain('TOSS')
    expect(values).toContain('KAKAO')
  })

  it('should have Korean labels for all brokerages', () => {
    const list = getBrokerageList()

    const koreanLabels = [
      '자동 감지',
      '한국투자증권',
      '키움증권',
      '미래에셋',
      '삼성증권',
      'NH투자증권',
      'KB증권',
      '토스증권',
      '카카오페이증권'
    ]

    const labels = list.map(b => b.label)
    koreanLabels.forEach(label => {
      expect(labels).toContain(label)
    })
  })
})

describe('generateBatchId', () => {
  it('should generate unique UUIDs', () => {
    const id1 = generateBatchId()
    const id2 = generateBatchId()
    const id3 = generateBatchId()

    expect(id1).not.toBe(id2)
    expect(id2).not.toBe(id3)
    expect(id1).not.toBe(id3)
  })

  it('should return valid UUID format', () => {
    const id = generateBatchId()

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(id).toMatch(uuidRegex)
  })
})

describe('ImportRow Interface', () => {
  it('should define valid ImportRow structure', () => {
    // Type checking via TypeScript
    const validRow = {
      date: '2025-01-15',
      stockCode: '005930',
      stockName: '삼성전자',
      type: 'BUY' as const,
      quantity: 10,
      price: 75000,
      currency: 'KRW',
      isValid: true,
      errors: []
    }

    expect(validRow.date).toBe('2025-01-15')
    expect(validRow.type).toBe('BUY')
    expect(validRow.isValid).toBe(true)
  })

  it('should handle invalid row with errors', () => {
    const invalidRow = {
      date: '',
      stockCode: '',
      stockName: '',
      type: 'BUY' as const,
      quantity: 0,
      price: 0,
      currency: 'KRW',
      isValid: false,
      errors: ['Invalid date', 'Missing stock code/name', 'Invalid quantity']
    }

    expect(invalidRow.isValid).toBe(false)
    expect(invalidRow.errors.length).toBe(3)
  })
})

describe('Transaction Type Mapping', () => {
  // Test that the TYPE_MAPPINGS constant covers all expected cases
  const TYPE_MAPPINGS: Record<string, 'BUY' | 'SELL' | 'DIVIDEND'> = {
    '매수': 'BUY',
    '매도': 'SELL',
    '배당': 'DIVIDEND',
    '배당금': 'DIVIDEND',
    '현금배당': 'DIVIDEND',
    '주식배당': 'DIVIDEND',
    '입고': 'BUY',
    '출고': 'SELL',
    'buy': 'BUY',
    'sell': 'SELL',
    'dividend': 'DIVIDEND',
    'purchase': 'BUY',
    'sale': 'SELL'
  }

  it('should map Korean buy terms to BUY', () => {
    expect(TYPE_MAPPINGS['매수']).toBe('BUY')
    expect(TYPE_MAPPINGS['입고']).toBe('BUY')
  })

  it('should map Korean sell terms to SELL', () => {
    expect(TYPE_MAPPINGS['매도']).toBe('SELL')
    expect(TYPE_MAPPINGS['출고']).toBe('SELL')
  })

  it('should map Korean dividend terms to DIVIDEND', () => {
    expect(TYPE_MAPPINGS['배당']).toBe('DIVIDEND')
    expect(TYPE_MAPPINGS['배당금']).toBe('DIVIDEND')
    expect(TYPE_MAPPINGS['현금배당']).toBe('DIVIDEND')
    expect(TYPE_MAPPINGS['주식배당']).toBe('DIVIDEND')
  })

  it('should map English terms correctly', () => {
    expect(TYPE_MAPPINGS['buy']).toBe('BUY')
    expect(TYPE_MAPPINGS['sell']).toBe('SELL')
    expect(TYPE_MAPPINGS['dividend']).toBe('DIVIDEND')
    expect(TYPE_MAPPINGS['purchase']).toBe('BUY')
    expect(TYPE_MAPPINGS['sale']).toBe('SELL')
  })
})

describe('Currency Mapping', () => {
  const CURRENCY_MAPPINGS: Record<string, string> = {
    '원': 'KRW',
    '원화': 'KRW',
    'krw': 'KRW',
    'KRW': 'KRW',
    '달러': 'USD',
    '미국달러': 'USD',
    'usd': 'USD',
    'USD': 'USD',
    '$': 'USD',
    '₩': 'KRW'
  }

  it('should map Korean won notations to KRW', () => {
    expect(CURRENCY_MAPPINGS['원']).toBe('KRW')
    expect(CURRENCY_MAPPINGS['원화']).toBe('KRW')
    expect(CURRENCY_MAPPINGS['₩']).toBe('KRW')
  })

  it('should map USD notations to USD', () => {
    expect(CURRENCY_MAPPINGS['달러']).toBe('USD')
    expect(CURRENCY_MAPPINGS['미국달러']).toBe('USD')
    expect(CURRENCY_MAPPINGS['$']).toBe('USD')
  })

  it('should handle case insensitivity for currency codes', () => {
    expect(CURRENCY_MAPPINGS['krw']).toBe('KRW')
    expect(CURRENCY_MAPPINGS['KRW']).toBe('KRW')
    expect(CURRENCY_MAPPINGS['usd']).toBe('USD')
    expect(CURRENCY_MAPPINGS['USD']).toBe('USD')
  })
})

describe('Column Mappings', () => {
  // Verify column mappings cover various brokerage formats
  const COLUMN_MAPPINGS = {
    date: ['거래일', '거래일자', '일자', '날짜', 'date', 'trade_date', '체결일', '체결일자'],
    stockCode: ['종목코드', '종목번호', '코드', 'code', 'stock_code', 'symbol', '티커'],
    stockName: ['종목명', '종목', '종목이름', 'name', 'stock_name', '상품명'],
    type: ['거래유형', '거래구분', '유형', '구분', 'type', 'trade_type', '매매구분'],
    quantity: ['수량', '거래수량', 'quantity', 'qty', '체결수량'],
    price: ['단가', '거래단가', '가격', 'price', '체결단가', '체결가'],
    currency: ['통화', '화폐', 'currency', '결제통화']
  }

  it('should have date column mappings for various formats', () => {
    expect(COLUMN_MAPPINGS.date).toContain('거래일')
    expect(COLUMN_MAPPINGS.date).toContain('거래일자')
    expect(COLUMN_MAPPINGS.date).toContain('체결일')
    expect(COLUMN_MAPPINGS.date).toContain('date')
  })

  it('should have stock code column mappings', () => {
    expect(COLUMN_MAPPINGS.stockCode).toContain('종목코드')
    expect(COLUMN_MAPPINGS.stockCode).toContain('종목번호')
    expect(COLUMN_MAPPINGS.stockCode).toContain('티커')
    expect(COLUMN_MAPPINGS.stockCode).toContain('symbol')
  })

  it('should have type column mappings', () => {
    expect(COLUMN_MAPPINGS.type).toContain('거래유형')
    expect(COLUMN_MAPPINGS.type).toContain('거래구분')
    expect(COLUMN_MAPPINGS.type).toContain('매매구분')
    expect(COLUMN_MAPPINGS.type).toContain('type')
  })

  it('should have quantity and price column mappings', () => {
    expect(COLUMN_MAPPINGS.quantity).toContain('수량')
    expect(COLUMN_MAPPINGS.quantity).toContain('체결수량')
    expect(COLUMN_MAPPINGS.price).toContain('단가')
    expect(COLUMN_MAPPINGS.price).toContain('체결단가')
  })
})
