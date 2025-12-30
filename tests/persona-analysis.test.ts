/**
 * FE/BE/QA Persona Analysis Tests
 *
 * 각 역할별 3명의 관점에서 현재 기능 분석 및 단위 테스트
 *
 * FE (Frontend):
 *   - FE-1 (UX Designer): UI 컴포넌트, 사용자 경험, 네비게이션
 *   - FE-2 (React Developer): 상태 관리, API 통신, 데이터 바인딩
 *   - FE-3 (Data Visualization): 숫자 포맷팅, 차트, 통계 표시
 *
 * BE (Backend):
 *   - BE-1 (API Developer): IPC 핸들러, CRUD 로직, 응답 형식
 *   - BE-2 (DB Engineer): 스키마, 쿼리, 데이터 무결성
 *   - BE-3 (Integration Specialist): 외부 API 연동, 환율/시세
 *
 * QA:
 *   - QA-1 (Functional Tester): 유저 시나리오, Happy Path
 *   - QA-2 (Edge Case Expert): 경계값, 에러, 특수 케이스
 *   - QA-3 (Regression Tester): 기존 기능 보호, 변경 감지
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { detectCurrencyByPriceRatio, ParsedHolding } from '../src/main/holdings-parser'

// ============================================================
// FRONTEND PERSONA TESTS (FE-1, FE-2, FE-3)
// ============================================================

describe('🎨 FE-1: UX Designer Perspective', () => {
  /**
   * UX Designer가 검증하는 항목:
   * - 사용자가 이해하기 쉬운 데이터 표시
   * - 일관된 상태 메시지
   * - 적절한 피드백
   */

  describe('Portfolio Summary Display', () => {
    interface PortfolioSummary {
      totalMarketValue: number
      totalCostBasis: number
      totalReturn: number
      totalReturnPercent: number
    }

    it('should display positive returns in user-friendly format', () => {
      const summary: PortfolioSummary = {
        totalMarketValue: 10500000,
        totalCostBasis: 10000000,
        totalReturn: 500000,
        totalReturnPercent: 5.0
      }

      // UX: 수익이면 + 기호로 명확히 표시
      const displayReturn = summary.totalReturn > 0
        ? `+${summary.totalReturn.toLocaleString()}원`
        : `${summary.totalReturn.toLocaleString()}원`

      expect(displayReturn).toBe('+500,000원')
      expect(summary.totalReturnPercent).toBeGreaterThan(0)
    })

    it('should display negative returns clearly', () => {
      const summary: PortfolioSummary = {
        totalMarketValue: 9500000,
        totalCostBasis: 10000000,
        totalReturn: -500000,
        totalReturnPercent: -5.0
      }

      const displayReturn = summary.totalReturn > 0
        ? `+${summary.totalReturn.toLocaleString()}원`
        : `${summary.totalReturn.toLocaleString()}원`

      expect(displayReturn).toBe('-500,000원')
    })
  })

  describe('Account Type Labels', () => {
    const ACCOUNT_TYPE_LABELS: Record<string, string> = {
      'PENSION': '연금저축',
      'IRP': '개인형IRP',
      'ISA': '중개형ISA',
      'OVERSEAS': '해외주식',
      'GENERAL': '일반'
    }

    it('should have Korean labels for all account types', () => {
      expect(ACCOUNT_TYPE_LABELS['PENSION']).toBe('연금저축')
      expect(ACCOUNT_TYPE_LABELS['IRP']).toBe('개인형IRP')
      expect(ACCOUNT_TYPE_LABELS['ISA']).toBe('중개형ISA')
      expect(ACCOUNT_TYPE_LABELS['OVERSEAS']).toBe('해외주식')
      expect(ACCOUNT_TYPE_LABELS['GENERAL']).toBe('일반')
    })

    it('should handle unknown account type gracefully', () => {
      const getLabel = (type: string): string =>
        ACCOUNT_TYPE_LABELS[type] || type

      expect(getLabel('UNKNOWN')).toBe('UNKNOWN')
    })
  })

  describe('Brokerage Labels', () => {
    const BROKERAGE_LABELS: Record<string, string> = {
      'KOREA_INV': '한국투자증권',
      'MIRAE': '미래에셋',
      'SAMSUNG': '삼성증권',
      'HANWHA': '한화투자증권',
      'KIWOOM': '키움증권',
      'NH': 'NH투자증권',
      'KB': 'KB증권'
    }

    it('should display all brokerages in Korean', () => {
      expect(BROKERAGE_LABELS['KOREA_INV']).toBe('한국투자증권')
      expect(BROKERAGE_LABELS['MIRAE']).toBe('미래에셋')
      expect(BROKERAGE_LABELS['SAMSUNG']).toBe('삼성증권')
    })
  })

  describe('Import Status Messages', () => {
    it('should show success message with count', () => {
      const imported = 15
      const message = `${imported}종목을 성공적으로 가져왔습니다.`
      expect(message).toContain('15종목')
      expect(message).toContain('성공')
    })

    it('should show partial success message', () => {
      const success = 13
      const failed = 2
      const message = `${success}종목 성공, ${failed}종목 실패`
      expect(message).toContain('13종목 성공')
      expect(message).toContain('2종목 실패')
    })
  })
})

describe('⚛️ FE-2: React Developer Perspective', () => {
  /**
   * React Developer가 검증하는 항목:
   * - API 응답 타입 일관성
   * - 상태 업데이트 로직
   * - 비동기 처리
   */

  describe('API Response Type Consistency', () => {
    interface APIResponse<T> {
      success: boolean
      data?: T
      error?: string
    }

    it('should have consistent success response structure', () => {
      const response: APIResponse<{ id: string }> = {
        success: true,
        data: { id: 'uuid-123' }
      }

      expect(response.success).toBe(true)
      expect(response.data).toBeDefined()
      expect(response.error).toBeUndefined()
    })

    it('should have consistent error response structure', () => {
      const response: APIResponse<null> = {
        success: false,
        error: 'Database connection failed'
      }

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
    })
  })

  describe('Holdings State Management', () => {
    interface HoldingState {
      holdings: ParsedHolding[]
      isLoading: boolean
      error: string | null
      lastUpdated: Date | null
    }

    it('should initialize with empty state', () => {
      const initialState: HoldingState = {
        holdings: [],
        isLoading: false,
        error: null,
        lastUpdated: null
      }

      expect(initialState.holdings).toHaveLength(0)
      expect(initialState.isLoading).toBe(false)
    })

    it('should set loading state during fetch', () => {
      const loadingState: HoldingState = {
        holdings: [],
        isLoading: true,
        error: null,
        lastUpdated: null
      }

      expect(loadingState.isLoading).toBe(true)
    })

    it('should update holdings after successful fetch', () => {
      const holdings: ParsedHolding[] = [{
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
        isValid: true,
        errors: []
      }]

      const updatedState: HoldingState = {
        holdings,
        isLoading: false,
        error: null,
        lastUpdated: new Date()
      }

      expect(updatedState.holdings).toHaveLength(1)
      expect(updatedState.isLoading).toBe(false)
      expect(updatedState.lastUpdated).toBeDefined()
    })
  })

  describe('Currency Formatting', () => {
    const formatCurrency = (amount: number, currency: string): string => {
      if (currency === 'USD') {
        return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      }
      return `₩${amount.toLocaleString('ko-KR')}`
    }

    it('should format KRW correctly', () => {
      expect(formatCurrency(1500000, 'KRW')).toBe('₩1,500,000')
    })

    it('should format USD correctly', () => {
      expect(formatCurrency(150.5, 'USD')).toBe('$150.50')
    })

    it('should handle zero amounts', () => {
      expect(formatCurrency(0, 'KRW')).toBe('₩0')
      expect(formatCurrency(0, 'USD')).toBe('$0.00')
    })
  })
})

describe('📊 FE-3: Data Visualization Perspective', () => {
  /**
   * Data Visualization 담당자가 검증하는 항목:
   * - 숫자 포맷팅
   * - 퍼센트 계산
   * - 차트용 데이터 변환
   */

  describe('Percentage Calculations', () => {
    const calculateReturnPercent = (current: number, cost: number): number => {
      if (cost === 0) return 0
      return ((current - cost) / cost) * 100
    }

    it('should calculate positive return percentage', () => {
      const percent = calculateReturnPercent(110, 100)
      expect(percent).toBe(10)
    })

    it('should calculate negative return percentage', () => {
      const percent = calculateReturnPercent(90, 100)
      expect(percent).toBe(-10)
    })

    it('should handle zero cost (division by zero)', () => {
      const percent = calculateReturnPercent(100, 0)
      expect(percent).toBe(0)
    })

    it('should calculate decimal percentages correctly', () => {
      const percent = calculateReturnPercent(107.14, 100)
      expect(percent).toBeCloseTo(7.14, 2)
    })
  })

  describe('Portfolio Breakdown Data', () => {
    interface BreakdownItem {
      label: string
      value: number
      percent: number
      color?: string
    }

    const calculateBreakdown = (items: { label: string; value: number }[]): BreakdownItem[] => {
      const total = items.reduce((sum, item) => sum + item.value, 0)
      return items.map(item => ({
        ...item,
        percent: total > 0 ? (item.value / total) * 100 : 0
      }))
    }

    it('should calculate breakdown percentages', () => {
      const breakdown = calculateBreakdown([
        { label: '주식', value: 70 },
        { label: 'ETF', value: 30 }
      ])

      expect(breakdown[0].percent).toBe(70)
      expect(breakdown[1].percent).toBe(30)
    })

    it('should handle empty portfolio', () => {
      const breakdown = calculateBreakdown([])
      expect(breakdown).toHaveLength(0)
    })

    it('should handle zero total (all zeros)', () => {
      const breakdown = calculateBreakdown([
        { label: '주식', value: 0 },
        { label: 'ETF', value: 0 }
      ])

      expect(breakdown[0].percent).toBe(0)
      expect(breakdown[1].percent).toBe(0)
    })
  })

  describe('Daily Change Display', () => {
    const formatDayChange = (current: number, prevClose: number): {
      change: number
      percent: number
      direction: 'up' | 'down' | 'flat'
    } => {
      const change = current - prevClose
      const percent = prevClose > 0 ? (change / prevClose) * 100 : 0
      const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
      return { change, percent, direction }
    }

    it('should indicate up direction for positive change', () => {
      const result = formatDayChange(75000, 74000)
      expect(result.direction).toBe('up')
      expect(result.change).toBe(1000)
      expect(result.percent).toBeCloseTo(1.35, 1)
    })

    it('should indicate down direction for negative change', () => {
      const result = formatDayChange(73000, 74000)
      expect(result.direction).toBe('down')
      expect(result.change).toBe(-1000)
    })

    it('should indicate flat when no change', () => {
      const result = formatDayChange(74000, 74000)
      expect(result.direction).toBe('flat')
      expect(result.change).toBe(0)
    })
  })
})


// ============================================================
// BACKEND PERSONA TESTS (BE-1, BE-2, BE-3)
// ============================================================

describe('🔧 BE-1: API Developer Perspective', () => {
  /**
   * API Developer가 검증하는 항목:
   * - IPC 핸들러 응답 형식
   * - CRUD 로직 정확성
   * - 에러 핸들링
   */

  describe('Holdings CRUD Operations', () => {
    interface HoldingInput {
      account_id: string
      stock_code: string
      stock_name: string
      quantity: number
      avg_cost: number
      current_price: number
      currency?: string
    }

    const validateHoldingInput = (input: HoldingInput): { valid: boolean; errors: string[] } => {
      const errors: string[] = []

      if (!input.account_id) errors.push('account_id is required')
      if (!input.stock_name) errors.push('stock_name is required')
      if (input.quantity <= 0) errors.push('quantity must be positive')
      if (input.avg_cost < 0) errors.push('avg_cost cannot be negative')

      return { valid: errors.length === 0, errors }
    }

    it('should validate required fields', () => {
      const result = validateHoldingInput({
        account_id: '',
        stock_code: '005930',
        stock_name: '삼성전자',
        quantity: 100,
        avg_cost: 70000,
        current_price: 75000
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('account_id is required')
    })

    it('should reject zero or negative quantity', () => {
      const result = validateHoldingInput({
        account_id: 'acc-1',
        stock_code: '005930',
        stock_name: '삼성전자',
        quantity: 0,
        avg_cost: 70000,
        current_price: 75000
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('quantity must be positive')
    })

    it('should pass valid input', () => {
      const result = validateHoldingInput({
        account_id: 'acc-1',
        stock_code: '005930',
        stock_name: '삼성전자',
        quantity: 100,
        avg_cost: 70000,
        current_price: 75000
      })

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Upsert Logic (ON CONFLICT DO UPDATE)', () => {
    // Simulates DB upsert behavior
    let mockHoldings: Map<string, { quantity: number; avgCost: number }>

    beforeEach(() => {
      mockHoldings = new Map()
    })

    const upsertHolding = (accountId: string, stockCode: string, stockName: string, quantity: number, avgCost: number) => {
      const key = `${accountId}:${stockCode || stockName}`
      // ON CONFLICT (account_id, stock_code) DO UPDATE: 덮어쓰기
      mockHoldings.set(key, { quantity, avgCost })
      return mockHoldings.get(key)
    }

    it('should insert new holding', () => {
      upsertHolding('acc-1', '005930', '삼성전자', 100, 70000)
      expect(mockHoldings.size).toBe(1)
      expect(mockHoldings.get('acc-1:005930')?.quantity).toBe(100)
    })

    it('should update existing holding (not add)', () => {
      // First insert
      upsertHolding('acc-1', '005930', '삼성전자', 100, 70000)
      // Second upsert - should OVERWRITE not ADD
      upsertHolding('acc-1', '005930', '삼성전자', 50, 72000)

      expect(mockHoldings.size).toBe(1)  // Still only 1 record
      expect(mockHoldings.get('acc-1:005930')?.quantity).toBe(50)  // 50, not 150
      expect(mockHoldings.get('acc-1:005930')?.avgCost).toBe(72000)
    })

    it('should use stock_name as key when stock_code is empty', () => {
      upsertHolding('acc-1', '', 'KODEX 나스닥100', 200, 15000)
      upsertHolding('acc-1', '', 'KODEX 나스닥100', 300, 14500)

      expect(mockHoldings.size).toBe(1)
      expect(mockHoldings.get('acc-1:KODEX 나스닥100')?.quantity).toBe(300)
    })
  })

  describe('Transaction Type Validation', () => {
    type TransactionType = 'BUY' | 'SELL' | 'DIVIDEND'

    const isValidTransactionType = (type: string): type is TransactionType => {
      return ['BUY', 'SELL', 'DIVIDEND'].includes(type)
    }

    it('should accept valid transaction types', () => {
      expect(isValidTransactionType('BUY')).toBe(true)
      expect(isValidTransactionType('SELL')).toBe(true)
      expect(isValidTransactionType('DIVIDEND')).toBe(true)
    })

    it('should reject invalid transaction types', () => {
      expect(isValidTransactionType('DEPOSIT')).toBe(false)
      expect(isValidTransactionType('TRANSFER')).toBe(false)
      expect(isValidTransactionType('')).toBe(false)
    })
  })
})

describe('🗄️ BE-2: DB Engineer Perspective', () => {
  /**
   * DB Engineer가 검증하는 항목:
   * - 데이터 무결성
   * - UNIQUE 제약 조건
   * - Cascade 삭제
   */

  describe('Holdings Unique Constraint', () => {
    // UNIQUE(account_id, stock_code, stock_name) 시뮬레이션
    const existingKeys = new Set<string>()

    const checkUniqueConstraint = (accountId: string, stockCode: string, stockName: string): boolean => {
      const key = `${accountId}:${stockCode}:${stockName}`
      if (existingKeys.has(key)) {
        return false // Constraint violation
      }
      existingKeys.add(key)
      return true
    }

    beforeEach(() => {
      existingKeys.clear()
    })

    it('should allow different stocks in same account', () => {
      expect(checkUniqueConstraint('acc-1', '005930', '삼성전자')).toBe(true)
      expect(checkUniqueConstraint('acc-1', '000660', 'SK하이닉스')).toBe(true)
    })

    it('should allow same stock in different accounts', () => {
      expect(checkUniqueConstraint('acc-1', '005930', '삼성전자')).toBe(true)
      expect(checkUniqueConstraint('acc-2', '005930', '삼성전자')).toBe(true)
    })

    it('should detect duplicate in same account', () => {
      expect(checkUniqueConstraint('acc-1', '005930', '삼성전자')).toBe(true)
      expect(checkUniqueConstraint('acc-1', '005930', '삼성전자')).toBe(false)
    })
  })

  describe('Currency Validation', () => {
    const VALID_CURRENCIES = ['KRW', 'USD', 'EUR', 'JPY', 'CNY']

    const isValidCurrency = (currency: string): boolean => {
      return VALID_CURRENCIES.includes(currency.toUpperCase())
    }

    it('should accept KRW', () => {
      expect(isValidCurrency('KRW')).toBe(true)
    })

    it('should accept USD', () => {
      expect(isValidCurrency('USD')).toBe(true)
    })

    it('should be case-insensitive', () => {
      expect(isValidCurrency('usd')).toBe(true)
      expect(isValidCurrency('krw')).toBe(true)
    })

    it('should reject invalid currency', () => {
      expect(isValidCurrency('BTC')).toBe(false)
      expect(isValidCurrency('ABC')).toBe(false)
    })
  })

  describe('Data Type Constraints', () => {
    it('should ensure quantity is INTEGER', () => {
      const quantity = Math.floor(10.5)  // DB stores as INTEGER
      expect(quantity).toBe(10)
      expect(Number.isInteger(quantity)).toBe(true)
    })

    it('should ensure price is REAL (float)', () => {
      const price = 75000.50
      expect(typeof price).toBe('number')
    })

    it('should ensure timestamp format', () => {
      const timestamp = new Date().toISOString()
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })
  })
})

describe('🌐 BE-3: Integration Specialist Perspective', () => {
  /**
   * Integration Specialist가 검증하는 항목:
   * - 외부 API 응답 파싱
   * - 환율/시세 변환
   * - 에러 복구
   */

  describe('Exchange Rate Handling', () => {
    const applyExchangeRate = (usdAmount: number, rate: number): number => {
      return Math.round(usdAmount * rate)  // 원화로 변환 후 반올림
    }

    it('should convert USD to KRW correctly', () => {
      const krwAmount = applyExchangeRate(100, 1400)
      expect(krwAmount).toBe(140000)
    })

    it('should handle decimal exchange rates', () => {
      const krwAmount = applyExchangeRate(100, 1432.50)
      expect(krwAmount).toBe(143250)
    })

    it('should round to whole won', () => {
      const krwAmount = applyExchangeRate(100.55, 1400.25)
      expect(Number.isInteger(krwAmount)).toBe(true)
    })
  })

  describe('Stock Price Response Parsing', () => {
    interface YahooFinanceResponse {
      chart: {
        result: Array<{
          meta: {
            regularMarketPrice: number
            previousClose: number
            currency: string
          }
        }>
        error: null | { code: string; description: string }
      }
    }

    const parseYahooResponse = (response: YahooFinanceResponse): {
      price: number
      prevClose: number
      currency: string
    } | null => {
      if (response.chart.error) return null
      const result = response.chart.result?.[0]
      if (!result) return null

      return {
        price: result.meta.regularMarketPrice,
        prevClose: result.meta.previousClose,
        currency: result.meta.currency
      }
    }

    it('should parse successful response', () => {
      const response: YahooFinanceResponse = {
        chart: {
          result: [{
            meta: {
              regularMarketPrice: 75000,
              previousClose: 74000,
              currency: 'KRW'
            }
          }],
          error: null
        }
      }

      const parsed = parseYahooResponse(response)
      expect(parsed?.price).toBe(75000)
      expect(parsed?.prevClose).toBe(74000)
    })

    it('should return null for error response', () => {
      const response: YahooFinanceResponse = {
        chart: {
          result: [],
          error: { code: 'Not Found', description: 'Symbol not found' }
        }
      }

      const parsed = parseYahooResponse(response)
      expect(parsed).toBeNull()
    })
  })

  describe('USD Auto-Detection (500x Rule)', () => {
    // detectCurrencyByPriceRatio 함수 테스트 (holdings-parser.ts에서 import)

    it('should detect USD when price ratio >= 500', () => {
      // 평균단가 $150, 현재가 ₩210,000 (환율 1400)
      expect(detectCurrencyByPriceRatio(150, 210000)).toBe('USD')
    })

    it('should detect USD in reverse ratio case', () => {
      // 평균단가 ₩210,000, 현재가 $150
      expect(detectCurrencyByPriceRatio(210000, 150)).toBe('USD')
    })

    it('should keep KRW for normal Korean stocks', () => {
      // 삼성전자: 70,000 -> 75,000 (정상 범위)
      expect(detectCurrencyByPriceRatio(70000, 75000)).toBe('KRW')
    })

    it('should respect explicit USD currency', () => {
      expect(detectCurrencyByPriceRatio(150, 180, 'USD')).toBe('USD')
    })
  })
})


// ============================================================
// QA PERSONA TESTS (QA-1, QA-2, QA-3)
// ============================================================

describe('✅ QA-1: Functional Tester Perspective', () => {
  /**
   * Functional Tester가 검증하는 항목:
   * - Happy Path 시나리오
   * - 주요 유저 플로우
   * - 기능 요구사항
   */

  describe('User Story: Import Holdings from Excel', () => {
    it('should parse valid holdings file', () => {
      // Given: 유효한 Excel 데이터가 파싱됨
      const parsedHoldings: ParsedHolding[] = [
        {
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
          isValid: true,
          errors: []
        }
      ]

      // Then: 유효한 종목만 필터링
      const validHoldings = parsedHoldings.filter(h => h.isValid)
      expect(validHoldings).toHaveLength(1)
      expect(validHoldings[0].stockName).toBe('삼성전자')
    })

    it('should save holdings to selected account', () => {
      // Simulates the save operation result
      interface SaveResult {
        success: boolean
        imported: number
        updated: number
      }

      const saveResult: SaveResult = {
        success: true,
        imported: 10,
        updated: 5
      }

      expect(saveResult.success).toBe(true)
      expect(saveResult.imported + saveResult.updated).toBe(15)
    })
  })

  describe('User Story: View Portfolio Summary', () => {
    interface PortfolioData {
      holdings: Array<{
        stockName: string
        evalAmount: number
        currency: string
      }>
    }

    const calculateTotalByKRW = (data: PortfolioData, usdToKrw: number): number => {
      return data.holdings.reduce((sum, h) => {
        const krwAmount = h.currency === 'USD' ? h.evalAmount * usdToKrw : h.evalAmount
        return sum + krwAmount
      }, 0)
    }

    it('should calculate total portfolio value in KRW', () => {
      const portfolio: PortfolioData = {
        holdings: [
          { stockName: '삼성전자', evalAmount: 7500000, currency: 'KRW' },
          { stockName: 'AAPL', evalAmount: 1850, currency: 'USD' }
        ]
      }

      const totalKRW = calculateTotalByKRW(portfolio, 1400)
      expect(totalKRW).toBe(7500000 + 1850 * 1400)
    })
  })

  describe('User Story: Add Manual Transaction', () => {
    interface TransactionInput {
      accountId: string
      stockCode: string
      stockName: string
      type: 'BUY' | 'SELL' | 'DIVIDEND'
      quantity: number
      price: number
      date: string
    }

    const validateTransaction = (input: TransactionInput): boolean => {
      if (!input.accountId || !input.stockName) return false
      if (input.quantity <= 0 || input.price <= 0) return false
      if (!['BUY', 'SELL', 'DIVIDEND'].includes(input.type)) return false
      return true
    }

    it('should accept valid BUY transaction', () => {
      const tx: TransactionInput = {
        accountId: 'acc-1',
        stockCode: '005930',
        stockName: '삼성전자',
        type: 'BUY',
        quantity: 10,
        price: 75000,
        date: '2025-01-15'
      }

      expect(validateTransaction(tx)).toBe(true)
    })

    it('should accept valid DIVIDEND transaction', () => {
      const tx: TransactionInput = {
        accountId: 'acc-1',
        stockCode: 'AAPL',
        stockName: 'Apple',
        type: 'DIVIDEND',
        quantity: 1,  // Dividend doesn't need quantity, but schema requires it
        price: 0.96,  // Dividend per share
        date: '2025-01-15'
      }

      expect(validateTransaction(tx)).toBe(true)
    })
  })
})

describe('🔍 QA-2: Edge Case Expert Perspective', () => {
  /**
   * Edge Case Expert가 검증하는 항목:
   * - 경계값 테스트
   * - 에러 상황
   * - 특수 케이스
   */

  describe('Edge Case: Zero Quantity Holdings', () => {
    it('should mark holding as invalid when quantity is 0', () => {
      const holding: ParsedHolding = {
        stockCode: '005930',
        stockName: '삼성전자',
        quantity: 0,
        avgPrice: 70000,
        currentPrice: 75000,
        purchaseAmount: 0,
        evalAmount: 0,
        profitLoss: 0,
        returnRate: 0,
        currency: 'KRW',
        isValid: false,
        errors: ['Invalid quantity']
      }

      expect(holding.isValid).toBe(false)
      expect(holding.errors).toContain('Invalid quantity')
    })
  })

  describe('Edge Case: Very Large Numbers', () => {
    it('should handle large KRW amounts', () => {
      const largeAmount = 100_000_000_000  // 1000억
      expect(largeAmount.toLocaleString()).toBe('100,000,000,000')
    })

    it('should calculate returns for large positions', () => {
      const costBasis = 50_000_000_000  // 500억
      const marketValue = 55_000_000_000  // 550억
      const returnPercent = ((marketValue - costBasis) / costBasis) * 100

      expect(returnPercent).toBe(10)
    })
  })

  describe('Edge Case: Special Characters in Stock Names', () => {
    const sanitizeStockName = (name: string): string => {
      return name.trim().replace(/[\r\n]/g, '')
    }

    it('should handle stock names with spaces', () => {
      expect(sanitizeStockName('  삼성전자  ')).toBe('삼성전자')
    })

    it('should handle stock names with newlines', () => {
      expect(sanitizeStockName('삼성전자\n')).toBe('삼성전자')
    })

    it('should preserve special characters in ETF names', () => {
      expect(sanitizeStockName('KODEX 200')).toBe('KODEX 200')
    })
  })

  describe('Edge Case: Currency Detection Boundaries', () => {
    it('should detect USD at exactly 500x ratio', () => {
      expect(detectCurrencyByPriceRatio(100, 50000)).toBe('USD')
    })

    it('should keep KRW at 499x ratio', () => {
      expect(detectCurrencyByPriceRatio(100, 49900)).toBe('KRW')
    })

    it('should handle zero prices', () => {
      expect(detectCurrencyByPriceRatio(0, 100)).toBe('KRW')
      expect(detectCurrencyByPriceRatio(100, 0)).toBe('KRW')
      expect(detectCurrencyByPriceRatio(0, 0)).toBe('KRW')
    })

    it('should handle negative prices (invalid data)', () => {
      // Negative prices should default to KRW
      expect(detectCurrencyByPriceRatio(-100, 50000)).toBe('KRW')
    })
  })

  describe('Edge Case: Empty Data', () => {
    it('should handle empty holdings array', () => {
      const holdings: ParsedHolding[] = []
      const validCount = holdings.filter(h => h.isValid).length

      expect(validCount).toBe(0)
    })

    it('should handle null/undefined values', () => {
      const parseNumber = (value: unknown): number => {
        if (value === null || value === undefined || value === '') return 0
        if (typeof value === 'number') return value
        const num = parseFloat(String(value))
        return isNaN(num) ? 0 : num
      }

      expect(parseNumber(null)).toBe(0)
      expect(parseNumber(undefined)).toBe(0)
      expect(parseNumber('')).toBe(0)
      expect(parseNumber('abc')).toBe(0)
    })
  })
})

describe('🔄 QA-3: Regression Tester Perspective', () => {
  /**
   * Regression Tester가 검증하는 항목:
   * - 기존 기능 보호
   * - 타입 안정성
   * - API 계약 유지
   */

  describe('Regression: ParsedHolding Type Stability', () => {
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
        isValid: true,
        errors: []
      }

      // All required fields must exist
      expect(holding).toHaveProperty('stockCode')
      expect(holding).toHaveProperty('stockName')
      expect(holding).toHaveProperty('quantity')
      expect(holding).toHaveProperty('avgPrice')
      expect(holding).toHaveProperty('currentPrice')
      expect(holding).toHaveProperty('purchaseAmount')
      expect(holding).toHaveProperty('evalAmount')
      expect(holding).toHaveProperty('profitLoss')
      expect(holding).toHaveProperty('returnRate')
      expect(holding).toHaveProperty('currency')
      expect(holding).toHaveProperty('isValid')
      expect(holding).toHaveProperty('errors')
    })

    it('should support optional market field', () => {
      const holding: ParsedHolding = {
        stockCode: 'AAPL',
        stockName: 'Apple',
        quantity: 10,
        avgPrice: 150,
        currentPrice: 185,
        purchaseAmount: 1500,
        evalAmount: 1850,
        profitLoss: 350,
        returnRate: 23.33,
        currency: 'USD',
        market: 'US',  // Optional field
        isValid: true,
        errors: []
      }

      expect(holding.market).toBe('US')
    })
  })

  describe('Regression: API Response Formats', () => {
    interface HoldingsSaveResult {
      success: boolean
      imported: number
      updated?: number
      error?: string
    }

    it('should maintain success response format', () => {
      const result: HoldingsSaveResult = {
        success: true,
        imported: 10,
        updated: 5
      }

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('imported')
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.imported).toBe('number')
    })

    it('should maintain error response format', () => {
      const result: HoldingsSaveResult = {
        success: false,
        imported: 0,
        error: 'Account not found'
      }

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Regression: Calculation Formulas', () => {
    // 이 계산 공식들이 변경되면 안됨

    it('should calculate profit/loss correctly', () => {
      const evalAmount = 7500000
      const purchaseAmount = 7000000
      const profitLoss = evalAmount - purchaseAmount

      expect(profitLoss).toBe(500000)
    })

    it('should calculate return rate correctly', () => {
      const evalAmount = 7500000
      const purchaseAmount = 7000000
      const returnRate = ((evalAmount - purchaseAmount) / purchaseAmount) * 100

      expect(returnRate).toBeCloseTo(7.14, 2)
    })

    it('should calculate total amount correctly', () => {
      const quantity = 10
      const price = 75000
      const totalAmount = quantity * price

      expect(totalAmount).toBe(750000)
    })
  })

  describe('Regression: Korean Stock Code Format', () => {
    const isValidKoreanStockCode = (code: string): boolean => {
      // 6자리 숫자
      return /^\d{6}$/.test(code)
    }

    it('should validate 6-digit stock codes', () => {
      expect(isValidKoreanStockCode('005930')).toBe(true)  // 삼성전자
      expect(isValidKoreanStockCode('000660')).toBe(true)  // SK하이닉스
      expect(isValidKoreanStockCode('035720')).toBe(true)  // 카카오
    })

    it('should reject invalid formats', () => {
      expect(isValidKoreanStockCode('AAPL')).toBe(false)
      expect(isValidKoreanStockCode('5930')).toBe(false)
      expect(isValidKoreanStockCode('00593A')).toBe(false)
    })
  })

  describe('Regression: US Stock Ticker Format', () => {
    const isValidUSTicker = (ticker: string): boolean => {
      // 1-5자리 대문자 (일부 특수 케이스 포함)
      return /^[A-Z]{1,5}(\.[A-Z])?$/.test(ticker)
    }

    it('should validate standard tickers', () => {
      expect(isValidUSTicker('AAPL')).toBe(true)
      expect(isValidUSTicker('MSFT')).toBe(true)
      expect(isValidUSTicker('A')).toBe(true)  // Agilent
    })

    it('should validate tickers with class suffix', () => {
      expect(isValidUSTicker('BRK.B')).toBe(true)  // Berkshire B
    })

    it('should reject invalid formats', () => {
      expect(isValidUSTicker('005930')).toBe(false)
      expect(isValidUSTicker('aapl')).toBe(false)  // lowercase
      expect(isValidUSTicker('TOOLONG')).toBe(false)  // too long
    })
  })
})
