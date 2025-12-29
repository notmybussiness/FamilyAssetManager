/**
 * Brokerage Parsers Unit Tests
 *
 * PRD 요구사항 테스트:
 * - F-5.2: Excel 가져오기 (증권사별 형식 지원)
 * - F-5.5: 가져오기 전 데이터 검증
 */

import { describe, it, expect } from 'vitest'
import {
  detectBrokerage,
  parseWithBrokerageConfig,
  isUSStock,
  isKRStock,
  BROKERAGE_CONFIGS
} from '../src/main/brokerage-parsers'

describe('Brokerage Detection', () => {
  it('should detect Korea Investment Securities', () => {
    const headers = ['거래일자', '종목코드', '종목명', '매매구분', '수량', '단가', '정산금액']
    expect(detectBrokerage(headers)).toBe('KOREA_INV')
  })

  it('should detect Kiwoom Securities', () => {
    const headers = ['거래일', '종목코드', '종목명', '거래구분', '수량', '체결가', '위탁수수료']
    expect(detectBrokerage(headers)).toBe('KIWOOM')
  })

  it('should detect Mirae Asset', () => {
    const headers = ['체결일자', '상품코드', '종목명', '매매구분', '체결수량', '체결단가', '미래에셋']
    expect(detectBrokerage(headers)).toBe('MIRAE')
  })

  it('should detect Samsung Securities', () => {
    const headers = ['거래일', '종목코드', '종목명', '거래유형', '수량', '단가', '삼성증권']
    expect(detectBrokerage(headers)).toBe('SAMSUNG')
  })

  it('should detect NH Investment', () => {
    const headers = ['거래일자', '종목코드', '종목명', '매매구분', '체결수량', '체결단가', 'NH투자']
    expect(detectBrokerage(headers)).toBe('NH')
  })

  it('should detect KB Securities', () => {
    const headers = ['거래일', '종목코드', '종목명', '구분', '수량', '단가', 'KB증권']
    expect(detectBrokerage(headers)).toBe('KB')
  })

  it('should detect Toss Securities', () => {
    const headers = ['거래일', '티커', '종목명', '거래유형', '수량', '가격', 'TOSS']
    expect(detectBrokerage(headers)).toBe('TOSS')
  })

  it('should detect Kakaopay Securities', () => {
    const headers = ['거래일', '종목코드', '종목명', '거래유형', '수량', '단가', '카카오페이']
    expect(detectBrokerage(headers)).toBe('KAKAO')
  })

  it('should return null for unknown format', () => {
    const headers = ['date', 'code', 'name', 'type', 'qty', 'price']
    expect(detectBrokerage(headers)).toBeNull()
  })
})

describe('Stock Code Detection', () => {
  describe('isKRStock', () => {
    it('should identify Korean stocks (6-digit codes)', () => {
      expect(isKRStock('005930')).toBe(true)  // Samsung Electronics
      expect(isKRStock('035720')).toBe(true)  // Kakao
      expect(isKRStock('000660')).toBe(true)  // SK Hynix
    })

    it('should reject non-Korean stock codes', () => {
      expect(isKRStock('AAPL')).toBe(false)
      expect(isKRStock('12345')).toBe(false)  // 5 digits
      expect(isKRStock('1234567')).toBe(false)  // 7 digits
    })
  })

  describe('isUSStock', () => {
    it('should identify US stocks (1-5 letter codes)', () => {
      expect(isUSStock('AAPL')).toBe(true)
      expect(isUSStock('MSFT')).toBe(true)
      expect(isUSStock('A')).toBe(true)  // Single letter
      expect(isUSStock('GOOGL')).toBe(true)  // 5 letters
    })

    it('should reject non-US stock codes', () => {
      expect(isUSStock('005930')).toBe(false)  // Korean
      expect(isUSStock('ABCDEF')).toBe(false)  // 6 letters
      expect(isUSStock('AAP1')).toBe(false)  // Contains number
    })
  })
})

describe('Transaction Type Parsing', () => {
  it('should parse Korean transaction types', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']

    const buyRow = ['2025-01-15', '005930', '삼성전자', '매수', 10, 75000, 'KRW']
    const sellRow = ['2025-01-16', '005930', '삼성전자', '매도', 5, 76000, 'KRW']
    const dividendRow = ['2025-01-17', '005930', '삼성전자', '배당', 100, 500, 'KRW']

    const result = parseWithBrokerageConfig(headers, [buyRow, sellRow, dividendRow], 'AUTO')

    expect(result[0].type).toBe('BUY')
    expect(result[1].type).toBe('SELL')
    expect(result[2].type).toBe('DIVIDEND')
  })

  it('should handle alternative Korean terms', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']

    const rows = [
      ['2025-01-15', '005930', '삼성전자', '현금배당', 100, 500, 'KRW'],
      ['2025-01-16', '005930', '삼성전자', '주식배당', 10, 0, 'KRW'],
      ['2025-01-17', '005930', '삼성전자', '입고', 10, 75000, 'KRW'],
      ['2025-01-18', '005930', '삼성전자', '출고', 5, 76000, 'KRW'],
    ]

    const result = parseWithBrokerageConfig(headers, rows, 'AUTO')

    expect(result[0].type).toBe('DIVIDEND')
    expect(result[1].type).toBe('DIVIDEND')
    expect(result[2].type).toBe('BUY')
    expect(result[3].type).toBe('SELL')
  })
})

describe('Date Parsing', () => {
  it('should parse YYYY-MM-DD format', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']
    const row = ['2025-01-15', '005930', '삼성전자', '매수', 10, 75000, 'KRW']

    const result = parseWithBrokerageConfig(headers, [row], 'AUTO')
    expect(result[0].date).toBe('2025-01-15')
  })

  it('should parse YYYYMMDD format', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']
    const row = ['20250115', '005930', '삼성전자', '매수', 10, 75000, 'KRW']

    const result = parseWithBrokerageConfig(headers, [row], 'AUTO')
    expect(result[0].date).toBe('2025-01-15')
  })

  it('should parse YYYY/MM/DD format', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']
    const row = ['2025/01/15', '005930', '삼성전자', '매수', 10, 75000, 'KRW']

    const result = parseWithBrokerageConfig(headers, [row], 'AUTO')
    expect(result[0].date).toBe('2025-01-15')
  })

  it('should parse YYYY.MM.DD format', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']
    const row = ['2025.01.15', '005930', '삼성전자', '매수', 10, 75000, 'KRW']

    const result = parseWithBrokerageConfig(headers, [row], 'AUTO')
    expect(result[0].date).toBe('2025-01-15')
  })

  it('should parse Excel serial date', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']
    // Excel serial number for 2025-01-15 is approximately 45672
    const row = [45672, '005930', '삼성전자', '매수', 10, 75000, 'KRW']

    const result = parseWithBrokerageConfig(headers, [row], 'AUTO')
    expect(result[0].date).toBe('2025-01-15')
  })

  it('should handle invalid dates', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']
    const row = ['invalid-date', '005930', '삼성전자', '매수', 10, 75000, 'KRW']

    const result = parseWithBrokerageConfig(headers, [row], 'AUTO')
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('Invalid date')
  })
})

describe('Currency Parsing', () => {
  it('should parse Korean currency notation', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']

    const rows = [
      ['2025-01-15', '005930', '삼성전자', '매수', 10, 75000, '원'],
      ['2025-01-16', '005930', '삼성전자', '매수', 10, 75000, '원화'],
      ['2025-01-17', '005930', '삼성전자', '매수', 10, 75000, 'KRW'],
      ['2025-01-18', '005930', '삼성전자', '매수', 10, 75000, '₩'],
    ]

    const result = parseWithBrokerageConfig(headers, rows, 'AUTO')
    result.forEach(r => expect(r.currency).toBe('KRW'))
  })

  it('should parse USD currency notation', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']

    const rows = [
      ['2025-01-15', 'AAPL', 'Apple', '매수', 10, 180, 'USD'],
      ['2025-01-16', 'AAPL', 'Apple', '매수', 10, 180, '달러'],
      ['2025-01-17', 'AAPL', 'Apple', '매수', 10, 180, '미국달러'],
      ['2025-01-18', 'AAPL', 'Apple', '매수', 10, 180, '$'],
    ]

    const result = parseWithBrokerageConfig(headers, rows, 'AUTO')
    result.forEach(r => expect(r.currency).toBe('USD'))
  })

  it('should default to KRW when currency is missing', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가']
    const row = ['2025-01-15', '005930', '삼성전자', '매수', 10, 75000]

    const result = parseWithBrokerageConfig(headers, [row], 'AUTO')
    expect(result[0].currency).toBe('KRW')
  })
})

describe('Number Parsing', () => {
  it('should parse comma-formatted numbers', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']
    const row = ['2025-01-15', '005930', '삼성전자', '매수', '1,000', '75,000', 'KRW']

    const result = parseWithBrokerageConfig(headers, [row], 'AUTO')
    expect(result[0].quantity).toBe(1000)
    expect(result[0].price).toBe(75000)
  })

  it('should handle currency symbols in numbers', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']
    const row = ['2025-01-15', '005930', '삼성전자', '매수', 10, '₩75,000', 'KRW']

    const result = parseWithBrokerageConfig(headers, [row], 'AUTO')
    expect(result[0].price).toBe(75000)
  })

  it('should reject invalid quantities', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']
    const row = ['2025-01-15', '005930', '삼성전자', '매수', 0, 75000, 'KRW']

    const result = parseWithBrokerageConfig(headers, [row], 'AUTO')
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('Invalid quantity')
  })

  it('should reject negative prices', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']
    const row = ['2025-01-15', '005930', '삼성전자', '매수', 10, -75000, 'KRW']

    const result = parseWithBrokerageConfig(headers, [row], 'AUTO')
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('Invalid price')
  })
})

describe('Stock Code Parsing', () => {
  it('should pad Korean stock codes to 6 digits', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']
    const row = ['2025-01-15', '5930', '삼성전자', '매수', 10, 75000, 'KRW']

    const result = parseWithBrokerageConfig(headers, [row], 'AUTO')
    expect(result[0].stockCode).toBe('005930')
  })

  it('should uppercase US stock codes', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']
    const row = ['2025-01-15', 'aapl', 'Apple', '매수', 10, 180, 'USD']

    const result = parseWithBrokerageConfig(headers, [row], 'AUTO')
    expect(result[0].stockCode).toBe('AAPL')
  })

  it('should use stock name as code when code is missing', () => {
    const headers = ['거래일자', '종목명', '거래구분', '수량', '단가', '통화']
    const row = ['2025-01-15', '삼성전자', '매수', 10, 75000, 'KRW']

    const result = parseWithBrokerageConfig(headers, [row], 'AUTO')
    expect(result[0].stockCode).toBe('삼성전자')
  })
})

describe('Row Validation', () => {
  it('should mark valid rows as valid', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']
    const row = ['2025-01-15', '005930', '삼성전자', '매수', 10, 75000, 'KRW']

    const result = parseWithBrokerageConfig(headers, [row], 'AUTO')
    expect(result[0].isValid).toBe(true)
    expect(result[0].errors).toHaveLength(0)
  })

  it('should collect multiple errors', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']
    const row = ['invalid', '', '', 'unknown', 0, -100, 'KRW']

    const result = parseWithBrokerageConfig(headers, [row], 'AUTO')
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors.length).toBeGreaterThan(1)
  })

  it('should skip empty rows', () => {
    const headers = ['거래일자', '종목코드', '종목명', '거래구분', '수량', '단가', '통화']
    const rows = [
      ['2025-01-15', '005930', '삼성전자', '매수', 10, 75000, 'KRW'],
      [],
      ['2025-01-16', '005930', '삼성전자', '매도', 5, 76000, 'KRW'],
    ]

    const result = parseWithBrokerageConfig(headers, rows, 'AUTO')
    expect(result).toHaveLength(2)
  })
})

describe('Brokerage Configurations', () => {
  it('should have all required brokerages configured', () => {
    const expectedBrokerages = ['KOREA_INV', 'KIWOOM', 'MIRAE', 'SAMSUNG', 'NH', 'KB', 'TOSS', 'KAKAO']

    expectedBrokerages.forEach(brokerage => {
      expect(BROKERAGE_CONFIGS[brokerage]).toBeDefined()
      expect(BROKERAGE_CONFIGS[brokerage].name).toBeTruthy()
      expect(BROKERAGE_CONFIGS[brokerage].dateColumns.length).toBeGreaterThan(0)
      expect(BROKERAGE_CONFIGS[brokerage].typeMappings).toBeDefined()
    })
  })

  it('should have proper type mappings for all brokerages', () => {
    Object.values(BROKERAGE_CONFIGS).forEach(config => {
      expect(config.typeMappings['매수']).toBe('BUY')
      expect(config.typeMappings['매도']).toBe('SELL')
      expect(config.typeMappings['배당'] || config.typeMappings['배당금']).toBe('DIVIDEND')
    })
  })
})
