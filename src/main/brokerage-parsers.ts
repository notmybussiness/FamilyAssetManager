/**
 * 증권사별 CSV/Excel 파서
 * 각 증권사의 거래내역 파일 형식에 맞게 파싱
 */

import { ImportRow } from './excel-import'

// 증권사 타입
export type BrokerageType =
  | 'KOREA_INV'   // 한국투자증권
  | 'MIRAE'       // 미래에셋
  | 'SAMSUNG'     // 삼성증권
  | 'KIWOOM'      // 키움증권
  | 'NH'          // NH투자증권
  | 'KB'          // KB증권
  | 'TOSS'        // 토스증권
  | 'KAKAO'       // 카카오페이증권
  | 'AUTO'        // 자동 감지

// 파싱된 거래 데이터
export interface ParsedTransaction {
  date: string              // YYYY-MM-DD
  stockCode: string
  stockName: string
  type: 'BUY' | 'SELL' | 'DIVIDEND'
  quantity: number
  price: number
  totalAmount: number
  currency: string
  fees?: number             // 수수료
  tax?: number              // 세금
}

// 증권사별 컬럼 매핑 설정
interface BrokerageConfig {
  name: string
  dateColumns: string[]
  stockCodeColumns: string[]
  stockNameColumns: string[]
  typeColumns: string[]
  quantityColumns: string[]
  priceColumns: string[]
  amountColumns: string[]
  currencyColumns: string[]
  feeColumns: string[]
  taxColumns: string[]
  typeMappings: Record<string, 'BUY' | 'SELL' | 'DIVIDEND'>
  dateFormats: string[]     // 예상되는 날짜 형식
  skipRows?: number         // 건너뛸 헤더 행 수
  encoding?: string
}

// 증권사별 설정
export const BROKERAGE_CONFIGS: Record<string, BrokerageConfig> = {
  KOREA_INV: {
    name: '한국투자증권',
    dateColumns: ['거래일자', '거래일', '체결일자', '체결일', 'trade_date'],
    stockCodeColumns: ['종목코드', '종목번호', '코드', 'stock_code', 'symbol'],
    stockNameColumns: ['종목명', '종목', '상품명', 'stock_name', 'name'],
    typeColumns: ['거래구분', '거래유형', '매매구분', '구분', 'trade_type', 'type'],
    quantityColumns: ['수량', '거래수량', '체결수량', 'quantity', 'qty'],
    priceColumns: ['단가', '거래단가', '체결단가', '체결가', 'price'],
    amountColumns: ['거래금액', '정산금액', '체결금액', '금액', 'amount'],
    currencyColumns: ['통화', '결제통화', '화폐', 'currency'],
    feeColumns: ['수수료', '거래수수료', 'commission', 'fee'],
    taxColumns: ['세금', '제세금', '거래세', 'tax'],
    typeMappings: {
      '매수': 'BUY', '매도': 'SELL', '배당': 'DIVIDEND', '배당금': 'DIVIDEND',
      '현금배당': 'DIVIDEND', '주식배당': 'DIVIDEND', '입고': 'BUY', '출고': 'SELL',
      'buy': 'BUY', 'sell': 'SELL', 'dividend': 'DIVIDEND'
    },
    dateFormats: ['YYYYMMDD', 'YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY.MM.DD']
  },

  KIWOOM: {
    name: '키움증권',
    dateColumns: ['거래일', '일자', '체결일', '체결일자', '거래일자'],
    stockCodeColumns: ['종목코드', '종목번호', '코드'],
    stockNameColumns: ['종목명', '종목', '상품명'],
    typeColumns: ['거래구분', '구분', '매매구분', '거래유형'],
    quantityColumns: ['수량', '거래수량', '체결수량'],
    priceColumns: ['단가', '체결가', '체결단가', '거래단가'],
    amountColumns: ['거래대금', '거래금액', '정산금액', '체결금액'],
    currencyColumns: ['통화', '화폐'],
    feeColumns: ['수수료', '위탁수수료'],
    taxColumns: ['세금', '거래세', '제세금', '증권거래세'],
    typeMappings: {
      '매수': 'BUY', '매도': 'SELL', '배당': 'DIVIDEND', '배당금': 'DIVIDEND',
      '현금배당': 'DIVIDEND', '보통주매수': 'BUY', '보통주매도': 'SELL',
      '입고': 'BUY', '출고': 'SELL'
    },
    dateFormats: ['YYYYMMDD', 'YYYY-MM-DD', 'YYYY/MM/DD']
  },

  MIRAE: {
    name: '미래에셋',
    dateColumns: ['체결일자', '거래일자', '거래일', '일자', '체결일'],
    stockCodeColumns: ['종목코드', '종목번호', '코드', '상품코드'],
    stockNameColumns: ['종목명', '상품명', '종목'],
    typeColumns: ['매매구분', '거래구분', '구분', '거래유형'],
    quantityColumns: ['체결수량', '수량', '거래수량'],
    priceColumns: ['체결단가', '체결가', '단가', '거래단가'],
    amountColumns: ['체결금액', '거래금액', '정산금액', '결제금액'],
    currencyColumns: ['통화', '결제통화', '화폐'],
    feeColumns: ['수수료', '거래수수료', '위탁수수료'],
    taxColumns: ['제세금', '세금', '거래세'],
    typeMappings: {
      '매수': 'BUY', '매도': 'SELL', '배당': 'DIVIDEND', '배당금입금': 'DIVIDEND',
      '현금배당': 'DIVIDEND', '주식배당': 'DIVIDEND'
    },
    dateFormats: ['YYYY/MM/DD', 'YYYYMMDD', 'YYYY-MM-DD']
  },

  SAMSUNG: {
    name: '삼성증권',
    dateColumns: ['거래일', '거래일자', '체결일', '일자'],
    stockCodeColumns: ['종목코드', '종목번호', '코드'],
    stockNameColumns: ['종목명', '종목', '상품명'],
    typeColumns: ['거래유형', '거래구분', '구분', '매매구분'],
    quantityColumns: ['수량', '거래수량', '체결수량'],
    priceColumns: ['단가', '거래단가', '체결단가', '체결가격'],
    amountColumns: ['거래금액', '체결금액', '결제금액'],
    currencyColumns: ['통화', '화폐'],
    feeColumns: ['수수료', '거래수수료'],
    taxColumns: ['세금', '제세금', '거래세'],
    typeMappings: {
      '매수': 'BUY', '매도': 'SELL', '배당': 'DIVIDEND', '배당금': 'DIVIDEND',
      '현금배당': 'DIVIDEND', '입고': 'BUY', '출고': 'SELL'
    },
    dateFormats: ['YYYY-MM-DD', 'YYYYMMDD', 'YYYY/MM/DD']
  },

  NH: {
    name: 'NH투자증권',
    dateColumns: ['거래일자', '거래일', '체결일자', '체결일', '일자'],
    stockCodeColumns: ['종목코드', '종목번호', '코드'],
    stockNameColumns: ['종목명', '종목', '상품명'],
    typeColumns: ['매매구분', '거래구분', '구분', '거래유형'],
    quantityColumns: ['체결수량', '수량', '거래수량'],
    priceColumns: ['체결단가', '단가', '체결가', '거래단가'],
    amountColumns: ['체결금액', '거래금액', '정산금액'],
    currencyColumns: ['통화', '화폐', '결제통화'],
    feeColumns: ['수수료', '거래수수료'],
    taxColumns: ['세금', '제세금'],
    typeMappings: {
      '매수': 'BUY', '매도': 'SELL', '배당': 'DIVIDEND', '배당금': 'DIVIDEND',
      '현금배당': 'DIVIDEND', '매수체결': 'BUY', '매도체결': 'SELL'
    },
    dateFormats: ['YYYYMMDD', 'YYYY-MM-DD', 'YYYY/MM/DD']
  },

  KB: {
    name: 'KB증권',
    dateColumns: ['거래일', '거래일자', '체결일', '일자'],
    stockCodeColumns: ['종목코드', '종목번호', '코드'],
    stockNameColumns: ['종목명', '종목', '상품명'],
    typeColumns: ['구분', '거래구분', '매매구분', '거래유형'],
    quantityColumns: ['수량', '거래수량', '체결수량'],
    priceColumns: ['단가', '거래단가', '체결단가'],
    amountColumns: ['금액', '거래금액', '체결금액'],
    currencyColumns: ['통화', '화폐'],
    feeColumns: ['수수료'],
    taxColumns: ['세금', '거래세'],
    typeMappings: {
      '매수': 'BUY', '매도': 'SELL', '배당': 'DIVIDEND', '배당금': 'DIVIDEND',
      '현금배당': 'DIVIDEND'
    },
    dateFormats: ['YYYY-MM-DD', 'YYYYMMDD', 'YYYY/MM/DD']
  },

  TOSS: {
    name: '토스증권',
    dateColumns: ['거래일', '거래일시', '체결일', '일자'],
    stockCodeColumns: ['종목코드', '티커', '코드'],
    stockNameColumns: ['종목명', '종목', '상품명'],
    typeColumns: ['거래유형', '구분', '거래구분'],
    quantityColumns: ['수량', '거래수량'],
    priceColumns: ['단가', '체결가', '가격'],
    amountColumns: ['거래금액', '금액', '체결금액'],
    currencyColumns: ['통화'],
    feeColumns: ['수수료'],
    taxColumns: ['세금'],
    typeMappings: {
      '매수': 'BUY', '매도': 'SELL', '배당': 'DIVIDEND', '배당금': 'DIVIDEND'
    },
    dateFormats: ['YYYY-MM-DD', 'YYYY.MM.DD']
  },

  KAKAO: {
    name: '카카오페이증권',
    dateColumns: ['거래일', '거래일자', '체결일'],
    stockCodeColumns: ['종목코드', '코드'],
    stockNameColumns: ['종목명', '종목'],
    typeColumns: ['거래유형', '구분'],
    quantityColumns: ['수량', '거래수량'],
    priceColumns: ['단가', '체결가'],
    amountColumns: ['거래금액', '금액'],
    currencyColumns: ['통화'],
    feeColumns: ['수수료'],
    taxColumns: ['세금'],
    typeMappings: {
      '매수': 'BUY', '매도': 'SELL', '배당': 'DIVIDEND'
    },
    dateFormats: ['YYYY-MM-DD', 'YYYY.MM.DD']
  }
}

// 공통 매핑 (모든 증권사에서 사용)
const COMMON_TYPE_MAPPINGS: Record<string, 'BUY' | 'SELL' | 'DIVIDEND'> = {
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

const CURRENCY_MAPPINGS: Record<string, string> = {
  '원': 'KRW',
  '원화': 'KRW',
  'krw': 'KRW',
  'KRW': 'KRW',
  '달러': 'USD',
  '미국달러': 'USD',
  '미달러': 'USD',
  'usd': 'USD',
  'USD': 'USD',
  '$': 'USD',
  '₩': 'KRW'
}

// 헤더에서 컬럼 인덱스 찾기
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const normalizedHeaders = headers.map(h =>
    h?.toString().toLowerCase().trim().replace(/\s+/g, '')
  )

  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase().trim().replace(/\s+/g, '')
    const index = normalizedHeaders.findIndex(h => h === normalizedName || h?.includes(normalizedName))
    if (index !== -1) return index
  }
  return -1
}

// 날짜 파싱
function parseDate(value: unknown): string | null {
  if (!value) return null

  // Excel 시리얼 넘버
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30)
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const str = String(value).trim()

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str
  }

  // YYYYMMDD
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`
  }

  // YYYY/MM/DD or YYYY.MM.DD
  const match = str.match(/^(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})/)
  if (match) {
    const month = match[2].padStart(2, '0')
    const day = match[3].padStart(2, '0')
    return `${match[1]}-${month}-${day}`
  }

  // MM/DD/YYYY (미국 형식)
  const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (usMatch) {
    const month = usMatch[1].padStart(2, '0')
    const day = usMatch[2].padStart(2, '0')
    return `${usMatch[3]}-${month}-${day}`
  }

  return null
}

// 거래 유형 파싱
function parseType(value: unknown, config?: BrokerageConfig): 'BUY' | 'SELL' | 'DIVIDEND' | null {
  if (!value) return null
  const str = String(value).trim().toLowerCase()

  // 증권사별 매핑 먼저 확인
  if (config?.typeMappings) {
    const mapped = config.typeMappings[str]
    if (mapped) return mapped
  }

  // 공통 매핑
  return COMMON_TYPE_MAPPINGS[str] || null
}

// 통화 파싱
function parseCurrency(value: unknown): string {
  if (!value) return 'KRW'
  const str = String(value).trim()
  return CURRENCY_MAPPINGS[str] || CURRENCY_MAPPINGS[str.toLowerCase()] || 'KRW'
}

// 숫자 파싱
function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return value

  // 콤마, 통화 기호, 공백 제거
  const str = String(value).replace(/[,₩$\s원]/g, '').trim()

  // 괄호로 감싸진 음수 처리 (예: (100) -> -100)
  if (/^\([\d.]+\)$/.test(str)) {
    const num = parseFloat(str.replace(/[()]/g, ''))
    return isNaN(num) ? null : -num
  }

  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

// 종목 코드 파싱
function parseStockCode(value: unknown): string {
  if (!value) return ''
  let str = String(value).trim()

  // 숫자로만 된 코드는 6자리로 패딩 (한국 주식)
  if (/^\d+$/.test(str)) {
    str = str.padStart(6, '0')
  }

  return str.toUpperCase()
}

// 증권사 자동 감지
export function detectBrokerage(headers: string[]): BrokerageType | null {
  const headerStr = headers.join(' ').toLowerCase()

  // 증권사별 고유 컬럼명 패턴으로 감지
  if (headerStr.includes('한국투자') || headerStr.includes('정산금액')) {
    return 'KOREA_INV'
  }
  if (headerStr.includes('키움') || headerStr.includes('영웅문') || headerStr.includes('위탁수수료')) {
    return 'KIWOOM'
  }
  if (headerStr.includes('미래에셋') || headerStr.includes('m-stock')) {
    return 'MIRAE'
  }
  if (headerStr.includes('삼성증권') || headerStr.includes('팝')) {
    return 'SAMSUNG'
  }
  if (headerStr.includes('nh투자') || headerStr.includes('나무')) {
    return 'NH'
  }
  if (headerStr.includes('kb증권') || headerStr.includes('m-able')) {
    return 'KB'
  }
  if (headerStr.includes('토스증권') || headerStr.includes('toss')) {
    return 'TOSS'
  }
  if (headerStr.includes('카카오페이') || headerStr.includes('kakaopay')) {
    return 'KAKAO'
  }

  return null
}

// 증권사별 파싱
export function parseWithBrokerageConfig(
  headers: string[],
  dataRows: unknown[][],
  brokerageType: BrokerageType = 'AUTO'
): ImportRow[] {
  // 증권사 자동 감지
  let config: BrokerageConfig | undefined
  if (brokerageType === 'AUTO') {
    const detected = detectBrokerage(headers)
    if (detected && detected !== 'AUTO') {
      config = BROKERAGE_CONFIGS[detected]
    }
  } else {
    config = BROKERAGE_CONFIGS[brokerageType]
  }

  // 컬럼 인덱스 찾기
  const allDateColumns = [...new Set([
    ...(config?.dateColumns || []),
    '거래일', '거래일자', '체결일', '체결일자', '일자', 'date', 'trade_date'
  ])]
  const allCodeColumns = [...new Set([
    ...(config?.stockCodeColumns || []),
    '종목코드', '종목번호', '코드', 'code', 'stock_code', 'symbol', '티커'
  ])]
  const allNameColumns = [...new Set([
    ...(config?.stockNameColumns || []),
    '종목명', '종목', '상품명', 'name', 'stock_name'
  ])]
  const allTypeColumns = [...new Set([
    ...(config?.typeColumns || []),
    '거래구분', '거래유형', '매매구분', '구분', 'type', 'trade_type'
  ])]
  const allQtyColumns = [...new Set([
    ...(config?.quantityColumns || []),
    '수량', '거래수량', '체결수량', 'quantity', 'qty'
  ])]
  const allPriceColumns = [...new Set([
    ...(config?.priceColumns || []),
    '단가', '거래단가', '체결단가', '체결가', 'price'
  ])]
  const allCurrencyColumns = [...new Set([
    ...(config?.currencyColumns || []),
    '통화', '화폐', 'currency', '결제통화'
  ])]

  const dateCol = findColumnIndex(headers, allDateColumns)
  const codeCol = findColumnIndex(headers, allCodeColumns)
  const nameCol = findColumnIndex(headers, allNameColumns)
  const typeCol = findColumnIndex(headers, allTypeColumns)
  const qtyCol = findColumnIndex(headers, allQtyColumns)
  const priceCol = findColumnIndex(headers, allPriceColumns)
  const currencyCol = findColumnIndex(headers, allCurrencyColumns)

  const results: ImportRow[] = []

  for (const row of dataRows) {
    if (!row || row.length === 0) continue

    const errors: string[] = []

    // 날짜 파싱
    const date = dateCol !== -1 ? parseDate(row[dateCol]) : null
    if (!date) {
      errors.push('Invalid date')
    }

    // 종목 코드/이름 파싱
    const stockCode = codeCol !== -1 ? parseStockCode(row[codeCol]) : ''
    const stockName = nameCol !== -1 ? String(row[nameCol] || '').trim() : stockCode

    if (!stockCode && !stockName) {
      errors.push('Missing stock code/name')
    }

    // 거래 유형 파싱
    const type = typeCol !== -1 ? parseType(row[typeCol], config) : null
    if (!type) {
      errors.push('Invalid transaction type')
    }

    // 수량 파싱
    const quantity = qtyCol !== -1 ? parseNumber(row[qtyCol]) : null
    if (quantity === null || quantity <= 0) {
      errors.push('Invalid quantity')
    }

    // 단가 파싱
    const price = priceCol !== -1 ? parseNumber(row[priceCol]) : null
    if (price === null || price < 0) {
      errors.push('Invalid price')
    }

    // 통화 파싱
    const currency = currencyCol !== -1 ? parseCurrency(row[currencyCol]) : 'KRW'

    results.push({
      date: date || '',
      stockCode: stockCode || stockName,
      stockName: stockName || stockCode,
      type: type || 'BUY',
      quantity: quantity || 0,
      price: price || 0,
      currency,
      isValid: errors.length === 0,
      errors
    })
  }

  return results
}

// 미국 주식 감지
export function isUSStock(stockCode: string): boolean {
  // 미국 주식은 보통 영문자로만 구성 (1-5자)
  return /^[A-Z]{1,5}$/.test(stockCode)
}

// 한국 주식 감지
export function isKRStock(stockCode: string): boolean {
  // 한국 주식은 6자리 숫자
  return /^\d{6}$/.test(stockCode)
}
