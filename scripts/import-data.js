/**
 * 데이터 Import 스크립트
 * 리소스 폴더의 Excel 파일들을 파싱하여 김기덕 사용자 계좌로 import
 */

const Database = require('better-sqlite3')
const XLSX = require('xlsx')
const path = require('path')
const fs = require('fs')
const { randomUUID } = require('crypto')

// DB 경로 (Windows AppData)
const dbPath = path.join(
  process.env.APPDATA || '',
  'family-asset-manager',
  'data',
  'family-assets.db'
)

console.log('Database path:', dbPath)

// DB 연결
const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

// 숫자 파싱
function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return value
  const str = String(value).replace(/[,₩$\s%원]/g, '').trim()
  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

// 미래에셋 일반 파싱
function parseMiraeGeneral(data) {
  const holdings = []
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length < 10) continue

    const type = String(row[0] || '').trim()
    const stockName = String(row[1] || '').trim()
    if (!stockName) continue

    const isOverseas = type === '해외주식'
    const currency = isOverseas ? 'USD' : 'KRW'

    const quantity = parseNumber(row[3])
    const avgPrice = parseNumber(row[5])
    const purchaseAmount = parseNumber(row[6])
    const currentPrice = parseNumber(row[7])
    const evalAmount = parseNumber(row[8])

    if (quantity <= 0) continue

    holdings.push({
      stockCode: stockName.substring(0, 10),
      stockName,
      quantity,
      avgPrice,
      currentPrice,
      currency,
      market: isOverseas ? 'US' : 'KR'
    })
  }
  return holdings
}

// 미래에셋 IRP 파싱
function parseMiraeIRP(data) {
  const holdings = []
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length < 6) continue

    const stockName = String(row[0] || '').trim()
    if (!stockName) continue

    const quantity = parseNumber(row[1])
    const purchaseAmount = parseNumber(row[2])
    const evalAmount = parseNumber(row[3])

    if (quantity <= 0) continue

    const avgPrice = quantity > 0 ? purchaseAmount / quantity : 0
    const currentPrice = quantity > 0 ? evalAmount / quantity : 0

    holdings.push({
      stockCode: stockName.substring(0, 10),
      stockName,
      quantity,
      avgPrice,
      currentPrice,
      currency: 'KRW',
      market: 'KR'
    })
  }
  return holdings
}

// 삼성증권 파싱
function parseSamsung(data) {
  const holdings = []
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length < 11) continue

    const stockName = String(row[2] || '').trim()
    if (!stockName) continue

    const quantity = parseNumber(row[4])
    const avgPrice = parseNumber(row[5])
    const currentPrice = parseNumber(row[6])

    if (quantity <= 0) continue

    holdings.push({
      stockCode: stockName.substring(0, 10),
      stockName,
      quantity,
      avgPrice,
      currentPrice,
      currency: 'KRW',
      market: 'KR'
    })
  }
  return holdings
}

// 한화 국내 파싱
function parseHanwhaDomestic(data) {
  const holdings = []
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length < 10) continue

    const stockName = String(row[2] || '').trim()
    if (!stockName) continue

    const quantity = parseNumber(row[3])
    const avgPrice = parseNumber(row[4])
    const currentPrice = parseNumber(row[7])
    const stockCode = String(row[12] || '').trim() || stockName.substring(0, 10)

    if (quantity <= 0) continue

    holdings.push({
      stockCode,
      stockName,
      quantity,
      avgPrice,
      currentPrice,
      currency: 'KRW',
      market: 'KR'
    })
  }
  return holdings
}

// 한화 해외 파싱
function parseHanwhaOverseas(data) {
  const holdings = []
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length < 10) continue

    const stockName = String(row[1] || '').trim()
    if (!stockName) continue

    const quantity = parseNumber(row[2])
    const avgPrice = parseNumber(row[3])
    const currentPrice = parseNumber(row[5])
    const stockCode = String(row[9] || '').trim() || stockName.substring(0, 10)
    const currency = String(row[11] || 'USD').trim()

    if (quantity <= 0) continue

    holdings.push({
      stockCode,
      stockName,
      quantity,
      avgPrice,
      currentPrice,
      currency: currency === 'USD' ? 'USD' : 'KRW',
      market: 'US'
    })
  }
  return holdings
}

// 파일 형식 감지
function detectFormat(headers) {
  const headerStr = headers.map(h => String(h || '').toLowerCase()).join('|')

  if (headerStr.includes('계좌번호') && headerStr.includes('계좌유형')) return 'SAMSUNG'
  if (headerStr.includes('거래국가') || headerStr.includes('기준환율')) return 'HANWHA_OVERSEAS'
  if (headerStr.includes('잔고비중') || headerStr.includes('신용구분')) return 'HANWHA_DOMESTIC'
  if (headerStr.includes('운용비율')) return 'MIRAE_IRP'
  if (headerStr.includes('유형')) return 'MIRAE_GENERAL'

  return 'UNKNOWN'
}

// 파일 파싱
function parseFile(filePath) {
  const buffer = fs.readFileSync(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  if (data.length < 2) return { format: 'UNKNOWN', holdings: [] }

  const format = detectFormat(data[0])
  let holdings = []

  switch (format) {
    case 'MIRAE_GENERAL':
      holdings = parseMiraeGeneral(data)
      break
    case 'MIRAE_IRP':
      holdings = parseMiraeIRP(data)
      break
    case 'SAMSUNG':
      holdings = parseSamsung(data)
      break
    case 'HANWHA_DOMESTIC':
      holdings = parseHanwhaDomestic(data)
      break
    case 'HANWHA_OVERSEAS':
      holdings = parseHanwhaOverseas(data)
      break
  }

  return { format, holdings }
}

// Main
async function main() {
  try {
    // 1. 기존 데이터 삭제 (김기덕 관련)
    console.log('Cleaning up existing data...')
    const existingUser = db.prepare("SELECT id FROM users WHERE name = '김기덕'").get()
    if (existingUser) {
      db.prepare('DELETE FROM users WHERE id = ?').run(existingUser.id)
      console.log('Deleted existing user: 김기덕')
    }

    // 2. 김기덕 사용자 생성
    const userId = randomUUID()
    db.prepare(`
      INSERT INTO users (id, name, is_primary) VALUES (?, '김기덕', 1)
    `).run(userId)
    console.log('Created user: 김기덕')

    // 3. 리소스 파일 목록
    const resourcesDir = path.join(__dirname, '..', 'resources')
    const files = [
      { file: '미래.xlsx', brokerage: 'MIRAE', type: 'GENERAL', alias: '미래에셋 일반' },
      { file: '미래itp.xlsx', brokerage: 'MIRAE', type: 'IRP', alias: '미래에셋 IRP' },
      { file: '삼성.xlsx', brokerage: 'SAMSUNG', type: 'GENERAL', alias: '삼성증권' },
      { file: '한화 국내.xls', brokerage: 'HANWHA', type: 'GENERAL', alias: '한화투자증권 국내' },
      { file: '한화 해외.xls', brokerage: 'HANWHA', type: 'OVERSEAS', alias: '한화투자증권 해외' }
    ]

    // 4. 각 파일 처리
    for (const fileInfo of files) {
      const filePath = path.join(resourcesDir, fileInfo.file)

      if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${fileInfo.file}`)
        continue
      }

      console.log(`\nProcessing: ${fileInfo.file}`)

      // 계좌 생성
      const accountId = randomUUID()
      const accountNumber = randomUUID().substring(0, 12).replace(/-/g, '')

      db.prepare(`
        INSERT INTO accounts (id, user_id, brokerage, account_type, account_number, account_alias)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(accountId, userId, fileInfo.brokerage, fileInfo.type, accountNumber, fileInfo.alias)
      console.log(`  Created account: ${fileInfo.alias}`)

      // 파일 파싱
      const { format, holdings } = parseFile(filePath)
      console.log(`  Detected format: ${format}`)
      console.log(`  Found ${holdings.length} holdings`)

      // 보유종목 저장
      const insertHolding = db.prepare(`
        INSERT OR REPLACE INTO holdings (id, account_id, stock_code, stock_name, quantity, avg_cost, current_price, currency)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const h of holdings) {
        insertHolding.run(
          randomUUID(),
          accountId,
          h.stockCode,
          h.stockName,
          h.quantity,
          h.avgPrice,
          h.currentPrice,
          h.currency
        )
      }
      console.log(`  Imported ${holdings.length} holdings`)
    }

    console.log('\n=== Import Complete ===')
    console.log('User: 김기덕')

    // 결과 확인
    const accounts = db.prepare(`
      SELECT a.account_alias, COUNT(h.id) as holding_count
      FROM accounts a
      LEFT JOIN holdings h ON h.account_id = a.id
      WHERE a.user_id = ?
      GROUP BY a.id
    `).all(userId)

    for (const acc of accounts) {
      console.log(`  ${acc.account_alias}: ${acc.holding_count} 종목`)
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    db.close()
  }
}

main()
