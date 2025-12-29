import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import {
  parseWithBrokerageConfig,
  detectBrokerage,
  BrokerageType,
  BROKERAGE_CONFIGS
} from './brokerage-parsers'

export interface ImportRow {
  date: string
  stockCode: string
  stockName: string
  type: 'BUY' | 'SELL' | 'DIVIDEND'
  quantity: number
  price: number
  currency: string
  isValid: boolean
  errors: string[]
}

export interface ImportResult {
  success: boolean
  rows: ImportRow[]
  totalRows: number
  validRows: number
  invalidRows: number
  errors: string[]
  detectedBrokerage?: string    // 감지된 증권사
}

// 거래 유형 매핑
const TYPE_MAPPINGS: Record<string, 'BUY' | 'SELL' | 'DIVIDEND'> = {
  // Korean
  '매수': 'BUY',
  '매도': 'SELL',
  '배당': 'DIVIDEND',
  '배당금': 'DIVIDEND',
  '현금배당': 'DIVIDEND',
  '주식배당': 'DIVIDEND',
  '입고': 'BUY',
  '출고': 'SELL',
  // English
  'buy': 'BUY',
  'sell': 'SELL',
  'dividend': 'DIVIDEND',
  'purchase': 'BUY',
  'sale': 'SELL'
}

// 통화 매핑
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

// 컬럼 이름 매핑 (다양한 증권사 형식 지원)
const COLUMN_MAPPINGS = {
  date: ['거래일', '거래일자', '일자', '날짜', 'date', 'trade_date', '체결일', '체결일자'],
  stockCode: ['종목코드', '종목번호', '코드', 'code', 'stock_code', 'symbol', '티커'],
  stockName: ['종목명', '종목', '종목이름', 'name', 'stock_name', '상품명'],
  type: ['거래유형', '거래구분', '유형', '구분', 'type', 'trade_type', '매매구분'],
  quantity: ['수량', '거래수량', 'quantity', 'qty', '체결수량'],
  price: ['단가', '거래단가', '가격', 'price', '체결단가', '체결가'],
  currency: ['통화', '화폐', 'currency', '결제통화']
}

function findColumnIndex(headers: string[], mappings: string[]): number {
  const lowerHeaders = headers.map(h => h?.toString().toLowerCase().trim())
  for (const mapping of mappings) {
    const index = lowerHeaders.indexOf(mapping.toLowerCase())
    if (index !== -1) return index
  }
  return -1
}

function parseDate(value: unknown): string | null {
  if (!value) return null

  // Excel serial number
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (date) {
      const year = date.y
      const month = String(date.m).padStart(2, '0')
      const day = String(date.d).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
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
  const match = str.match(/^(\d{4})[\/\.](\d{2})[\/\.](\d{2})$/)
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`
  }

  return null
}

function parseType(value: unknown): 'BUY' | 'SELL' | 'DIVIDEND' | null {
  if (!value) return null
  const str = String(value).trim().toLowerCase()
  return TYPE_MAPPINGS[str] || null
}

function parseCurrency(value: unknown): string {
  if (!value) return 'KRW'
  const str = String(value).trim()
  return CURRENCY_MAPPINGS[str] || CURRENCY_MAPPINGS[str.toLowerCase()] || 'KRW'
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return value

  // Remove commas and currency symbols
  const str = String(value).replace(/[,₩$\s]/g, '').trim()
  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

function parseStockCode(value: unknown): string {
  if (!value) return ''
  let str = String(value).trim()

  // Remove leading zeros for Korean stocks, but keep format
  // Korean stocks: 6 digits (005930)
  // US stocks: letters (AAPL)
  if (/^\d+$/.test(str)) {
    // Pad to 6 digits for Korean stocks
    str = str.padStart(6, '0')
  }

  return str.toUpperCase()
}

// 레거시 파싱 (기존 방식)
function parseLegacy(data: unknown[][]): ImportRow[] {
  if (data.length < 2) return []

  const headers = data[0] as string[]
  const dataRows = data.slice(1)

  const dateCol = findColumnIndex(headers, COLUMN_MAPPINGS.date)
  const stockCodeCol = findColumnIndex(headers, COLUMN_MAPPINGS.stockCode)
  const stockNameCol = findColumnIndex(headers, COLUMN_MAPPINGS.stockName)
  const typeCol = findColumnIndex(headers, COLUMN_MAPPINGS.type)
  const quantityCol = findColumnIndex(headers, COLUMN_MAPPINGS.quantity)
  const priceCol = findColumnIndex(headers, COLUMN_MAPPINGS.price)
  const currencyCol = findColumnIndex(headers, COLUMN_MAPPINGS.currency)

  const rows: ImportRow[] = []

  for (const row of dataRows) {
    if (!row || row.length === 0) continue

    const errors: string[] = []

    const date = parseDate(row[dateCol])
    if (!date) errors.push('Invalid date')

    const stockCode = stockCodeCol !== -1 ? parseStockCode(row[stockCodeCol]) : ''
    const stockName = stockNameCol !== -1 ? String(row[stockNameCol] || '').trim() : stockCode

    if (!stockCode && !stockName) errors.push('Missing stock code/name')

    const type = parseType(row[typeCol])
    if (!type) errors.push('Invalid transaction type')

    const quantity = parseNumber(row[quantityCol])
    if (quantity === null || quantity <= 0) errors.push('Invalid quantity')

    const price = parseNumber(row[priceCol])
    if (price === null || price < 0) errors.push('Invalid price')

    const currency = currencyCol !== -1 ? parseCurrency(row[currencyCol]) : 'KRW'

    rows.push({
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

  return rows
}

export function parseExcelFile(filePath: string, brokerage?: BrokerageType): ImportResult {
  const result: ImportResult = {
    success: false,
    rows: [],
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    errors: []
  }

  try {
    const buffer = readFileSync(filePath)
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

    // Use first sheet
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      result.errors.push('No sheets found in file')
      return result
    }

    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

    if (data.length < 2) {
      result.errors.push('File is empty or has no data rows')
      return result
    }

    // 헤더와 데이터 분리
    const headers = data[0] as string[]
    const dataRows = data.slice(1)

    // 증권사 자동 감지
    const detectedBrokerage = brokerage || detectBrokerage(headers)
    if (detectedBrokerage && detectedBrokerage !== 'AUTO') {
      result.detectedBrokerage = BROKERAGE_CONFIGS[detectedBrokerage]?.name || detectedBrokerage
    }

    // 증권사별 파서 사용
    let parsedRows: ImportRow[]
    if (detectedBrokerage && detectedBrokerage !== 'AUTO') {
      parsedRows = parseWithBrokerageConfig(headers, dataRows, detectedBrokerage)
    } else {
      // 레거시 파서 fallback
      parsedRows = parseLegacy(data)
    }

    result.rows = parsedRows
    result.totalRows = parsedRows.length
    result.validRows = parsedRows.filter(r => r.isValid).length
    result.invalidRows = parsedRows.filter(r => !r.isValid).length
    result.success = result.validRows > 0

  } catch (error) {
    result.errors.push(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return result
}

// 증권사 목록 반환 (UI용)
export function getBrokerageList(): Array<{ value: BrokerageType; label: string }> {
  return [
    { value: 'AUTO', label: '자동 감지' },
    { value: 'KOREA_INV', label: '한국투자증권' },
    { value: 'KIWOOM', label: '키움증권' },
    { value: 'MIRAE', label: '미래에셋' },
    { value: 'SAMSUNG', label: '삼성증권' },
    { value: 'NH', label: 'NH투자증권' },
    { value: 'KB', label: 'KB증권' },
    { value: 'TOSS', label: '토스증권' },
    { value: 'KAKAO', label: '카카오페이증권' }
  ]
}

export function generateBatchId(): string {
  return uuidv4()
}
