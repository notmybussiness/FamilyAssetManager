/**
 * 증권사별 보유종목 Excel 파서
 * 실제 증권사 파일 형식에 맞게 파싱
 */

import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'

// ===== 해외주식 판별 데이터 =====

// 알려진 해외주식 (한글명 -> 티커 매핑)
const KNOWN_OVERSEAS_STOCKS: Record<string, string> = {
  // 빅테크
  '애플': 'AAPL',
  '마이크로소프트': 'MSFT',
  '알파벳': 'GOOGL',
  '구글': 'GOOGL',
  '아마존': 'AMZN',
  '아마존닷컴': 'AMZN',
  '메타': 'META',
  '메타 플랫폼스': 'META',
  '엔비디아': 'NVDA',
  '테슬라': 'TSLA',
  '넷플릭스': 'NFLX',

  // 반도체/테크
  '브로드컴': 'AVGO',
  '어도비': 'ADBE',
  '세일즈포스': 'CRM',
  '오라클': 'ORCL',
  '인텔': 'INTC',
  'AMD': 'AMD',
  '퀄컴': 'QCOM',
  '마이크론': 'MU',
  'ASML': 'ASML',
  'TSMC': 'TSM',
  '대만반도체': 'TSM',
  '어플라이드머티리얼즈': 'AMAT',
  '램리서치': 'LRCX',
  'KLA': 'KLAC',
  '시놉시스': 'SNPS',
  '케이던스': 'CDNS',
  '마벨테크놀로지': 'MRVL',
  'ARM': 'ARM',
  '암홀딩스': 'ARM',
  '팔란티어': 'PLTR',
  '스노우플레이크': 'SNOW',
  '크라우드스트라이크': 'CRWD',
  '데이터독': 'DDOG',
  '서비스나우': 'NOW',

  // 금융
  'JP모건': 'JPM',
  'JP모간': 'JPM',
  '뱅크오브아메리카': 'BAC',
  '웰스파고': 'WFC',
  '골드만삭스': 'GS',
  '모건스탠리': 'MS',
  '비자': 'V',
  '마스터카드': 'MA',
  '아메리칸익스프레스': 'AXP',
  '페이팔': 'PYPL',
  '블랙록': 'BLK',
  '찰스슈왑': 'SCHW',
  'HSBC': 'HSBC',
  'HSBC홀딩스': 'HSBC',
  '버크셔해서웨이': 'BRK.B',

  // 헬스케어
  '존슨앤드존슨': 'JNJ',
  '존슨앤존슨': 'JNJ',
  '유나이티드헬스': 'UNH',
  '화이자': 'PFE',
  '머크': 'MRK',
  '애브비': 'ABBV',
  '일라이릴리': 'LLY',
  '노보노디스크': 'NVO',
  '암젠': 'AMGN',
  '길리어드': 'GILD',
  '모더나': 'MRNA',
  '바이오엔테크': 'BNTX',

  // 소비재
  '월마트': 'WMT',
  '코스트코': 'COST',
  '홈디포': 'HD',
  '맥도날드': 'MCD',
  '스타벅스': 'SBUX',
  '나이키': 'NKE',
  '코카콜라': 'KO',
  '펩시코': 'PEP',
  '프록터앤드갬블': 'PG',
  'P&G': 'PG',
  '루이비통': 'LVMUY',
  'LVMH': 'LVMUY',

  // 산업재
  '보잉': 'BA',
  '캐터필러': 'CAT',
  '유니온퍼시픽': 'UNP',
  '허니웰': 'HON',
  '3M': 'MMM',
  '레이시온': 'RTX',
  '록히드마틴': 'LMT',
  '제너럴일렉트릭': 'GE',
  'GE': 'GE',

  // 에너지
  '엑손모빌': 'XOM',
  '셰브론': 'CVX',

  // 통신
  'AT&T': 'T',
  '버라이즌': 'VZ',
  '티모바일': 'TMUS',
  '디즈니': 'DIS',
  '월트디즈니': 'DIS',
  '컴캐스트': 'CMCSA',

  // 중국 ADR
  '알리바바': 'BABA',
  '텐센트': 'TCEHY',
  '바이두': 'BIDU',
  'JD닷컴': 'JD',
  '징동': 'JD',
  '핀둬둬': 'PDD',
  '니오': 'NIO',
  '샤오펑': 'XPEV',
  '리오토': 'LI',
  'BYD': 'BYDDY',
  '비야디': 'BYDDY',

  // AI/클라우드
  '코어위브': 'CRWV',
  '슈퍼마이크로': 'SMCI',
  'C3.ai': 'AI',
  '빅베어AI': 'BBAI',
  '사운드하운드': 'SOUN',

  // 기타
  '마라홀딩스': 'MARA',
  '마라 홀딩스': 'MARA',
  '넷스코프': 'NTSK',
  '리졸브AI': 'RZLV',
  '리졸브 AI': 'RZLV',
  '트윌리오': 'TWLO',
  '줌비디오': 'ZM',
  '도큐사인': 'DOCU',
  '로블록스': 'RBLX',
  '유니티': 'U',
  '코인베이스': 'COIN',
  '로빈후드': 'HOOD',
  '업스타트': 'UPST',
  '어펌': 'AFRM',
  '리비안': 'RIVN',
  '루시드': 'LCID',

  // 항공/우주
  '아처 에비에이션': 'ACHR',
  '아처에비에이션': 'ACHR',
  '조비 에비에이션': 'JOBY',
  '조비에비에이션': 'JOBY',
  '불리쉬': 'BWLSH',  // Bullish
  '버진갤럭틱': 'SPCE',
  '로켓랩': 'RKLB',

  // 원자재/에너지
  '카메코': 'CCJ',
  '우라늄에너지': 'UEC',

  // 암호화폐/블록체인
  '비트마인 이머션 테크놀로지스': 'BTBT',
  '비트마인 이머전 테크놀로지스': 'BTBT',  // 오타 대응
  '비트마인': 'BTBT',
  '라이엇플랫폼스': 'RIOT',
  '마이크로스트래티지': 'MSTR',

  // IBM (별도 추가)
  'IBM': 'IBM',
}

// 해외 ETF 패턴 (한국 ETF가 아닌 미국 ETF)
const OVERSEAS_ETF_PATTERNS = [
  'YIELDMAX',
  'PROSHARES',
  'DIREXION',
  'GRAYSCALE',
  'ISHARES',
  'SPDR',
  'INVESCO',
  'VANECK',
  'ARK ',
  'REX ',
]

// 한국 기업이지만 영문 이름인 경우 (해외 주식으로 오인 방지)
const KOREAN_COMPANIES_ENGLISH_NAME = [
  'NAVER', 'KAKAO', 'LG', 'SK', 'POSCO', 'HYUNDAI', 'SAMSUNG',
  'HANWHA', 'CJ', 'LOTTE', 'GS', 'KUMHO', 'HANA', 'SHINHAN',
  'KB', 'NH', 'WOORI', 'DOUZONE', 'NCSOFT', 'NEXON', 'NETMARBLE',
  'KRAFTON', 'PEARL ABYSS', 'DEVSISTERS', 'COM2US'
]

// 해외주식 판별 함수
function detectOverseasStock(stockName: string): { isOverseas: boolean; ticker: string } {
  const trimmedName = stockName.trim()
  const upperName = trimmedName.toUpperCase()

  // 0. 한국 기업 영문명 체크 (해외로 오인 방지)
  for (const korCompany of KOREAN_COMPANIES_ENGLISH_NAME) {
    if (upperName.startsWith(korCompany) || upperName === korCompany) {
      return { isOverseas: false, ticker: '' }
    }
  }

  // 1. 정확한 매칭
  if (KNOWN_OVERSEAS_STOCKS[trimmedName]) {
    return { isOverseas: true, ticker: KNOWN_OVERSEAS_STOCKS[trimmedName] }
  }

  // 2. 부분 매칭 (종목명에 포함된 경우)
  for (const [korName, ticker] of Object.entries(KNOWN_OVERSEAS_STOCKS)) {
    if (trimmedName.includes(korName) || korName.includes(trimmedName)) {
      return { isOverseas: true, ticker }
    }
  }

  // 3. 해외 ETF 패턴 체크 (YIELDMAX, REX 등)
  for (const pattern of OVERSEAS_ETF_PATTERNS) {
    if (upperName.includes(pattern.trim())) {
      // 티커 추출 시도
      const words = trimmedName.split(/\s+/)
      const possibleTicker = words.find(w => /^[A-Z]{2,5}$/.test(w))
      return { isOverseas: true, ticker: possibleTicker || pattern.trim() }
    }
  }

  // 4. 영문 티커 형식 (1-5자리 대문자) - 단, 한국 기업 제외됨
  if (/^[A-Z]{1,5}$/.test(trimmedName)) {
    return { isOverseas: true, ticker: trimmedName }
  }

  // 5. 영문 티커 + 한글 설명 형식 (예: "AAPL 애플")
  const tickerMatch = trimmedName.match(/^([A-Z]{1,5})\s/)
  if (tickerMatch) {
    return { isOverseas: true, ticker: tickerMatch[1] }
  }

  return { isOverseas: false, ticker: '' }
}

// 한국 ETF 판별 (해외지수 추종이어도 한국 ETF)
function isKoreanETF(stockName: string): boolean {
  const etfPrefixes = [
    'KODEX', 'TIGER', 'KBSTAR', 'ARIRANG', 'HANARO',
    'KOSEF', 'KINDEX', 'SOL', 'ACE', 'RISE', 'KoAct',
    'TIMEFOLIO', 'FOCUS', 'PLUS', 'SMART', 'WOORI'
  ]

  const upperName = stockName.toUpperCase()
  return etfPrefixes.some(prefix => upperName.startsWith(prefix))
}

// 파싱된 보유종목 데이터
export interface ParsedHolding {
  stockCode: string         // 종목코드
  stockName: string         // 종목명
  quantity: number          // 보유수량
  avgPrice: number          // 평균매입단가
  currentPrice: number      // 현재가
  purchaseAmount: number    // 매입금액
  evalAmount: number        // 평가금액
  profitLoss: number        // 평가손익
  returnRate: number        // 수익률 (%)
  currency: string          // 통화 (KRW/USD)
  market?: string           // 시장 (KOSPI/KOSDAQ/NASDAQ/NYSE 등)
  isValid: boolean
  errors: string[]
}

export interface HoldingsImportResult {
  success: boolean
  holdings: ParsedHolding[]
  totalRows: number
  validRows: number
  invalidRows: number
  detectedBrokerage: string
  errors: string[]
}

// 숫자 파싱 (콤마, 통화기호 제거)
function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return value

  const str = String(value).replace(/[,₩$\s%원]/g, '').trim()
  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

// 가격 비율로 USD 자동 감지 (500배 기준)
// 이유: 환율 1:1400 기준, 반토막 나도 700배 → 500배 기준으로 안전하게 판단
export function detectCurrencyByPriceRatio(
  avgPrice: number,
  currentPrice: number,
  providedCurrency?: string
): string {
  // 이미 명시적으로 USD가 지정되어 있으면 그대로
  if (providedCurrency === 'USD') return 'USD'

  // 가격이 0이면 판단 불가 → 기본값 KRW
  if (avgPrice <= 0 || currentPrice <= 0) return providedCurrency || 'KRW'

  // 비율 계산
  const ratio = currentPrice / avgPrice

  // 500배 이상이면 USD로 판단
  // 이유: 원화 기준 현재가와 달러 기준 평균단가 혼재
  if (ratio >= 500) {
    return 'USD'
  }

  // 역비율도 체크 (평균단가가 원화, 현재가가 달러인 경우)
  const reverseRatio = avgPrice / currentPrice
  if (reverseRatio >= 500) {
    return 'USD'
  }

  return providedCurrency || 'KRW'
}

// 종목코드 정규화
function normalizeStockCode(code: string | undefined, name: string): string {
  if (!code) {
    // 종목명에서 티커 추출 시도 (미국주식)
    const match = name.match(/^([A-Z]{1,5})\s/)
    if (match) return match[1]
    return ''
  }

  let str = String(code).trim()

  // 한화 형식: "0052D0" -> 앞에 0 제거하고 뒤에 0 제거
  if (/^0[0-9A-Z]+0$/.test(str) && str.length === 6) {
    str = str.slice(1, -1).replace(/^0+/, '')
    str = str.padStart(6, '0')
  }

  // 숫자로만 된 코드는 6자리로 패딩 (한국 주식)
  if (/^\d+$/.test(str)) {
    str = str.padStart(6, '0')
  }

  return str.toUpperCase()
}

// 미래에셋 일반 계좌 파싱
function parseMiraeGeneral(data: unknown[][]): ParsedHolding[] {
  // 헤더: 유형 | 종목명 | 종목구분 | 보유량 | 주문가능 | 평균단가 | 매입금액 | 현재가 | 평가금액 | 평가손익 | 수익률
  const holdings: ParsedHolding[] = []

  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length < 10) continue

    const type = String(row[0] || '').trim()
    const stockName = String(row[1] || '').trim()
    if (!stockName) continue

    // 유형 컬럼으로 해외주식 판별 (100% 신뢰)
    const isOverseas = type === '해외주식'

    // 해외주식이면 티커 추출 시도
    let stockCode = ''
    if (isOverseas) {
      const detection = detectOverseasStock(stockName)
      stockCode = detection.ticker
    }

    const quantity = parseNumber(row[3])
    const avgPrice = parseNumber(row[5])
    const purchaseAmount = parseNumber(row[6])
    const currentPrice = parseNumber(row[7])
    const evalAmount = parseNumber(row[8])
    const profitLoss = parseNumber(row[9])
    const returnRate = parseNumber(row[10])

    // 미래에셋 해외주식 특이사항:
    // - 평균단가, 매입금액: 원화
    // - 현재가, 평가금액: USD
    // 이 정보는 나중에 USD/KRW 변환에 활용

    const errors: string[] = []
    if (quantity <= 0) errors.push('Invalid quantity')
    if (!stockName) errors.push('Missing stock name')

    holdings.push({
      stockCode,
      stockName,
      quantity,
      avgPrice,           // 원화
      currentPrice,       // 해외: USD, 국내: KRW
      purchaseAmount,     // 원화
      evalAmount,         // 해외: USD, 국내: KRW
      profitLoss,
      returnRate,
      currency: isOverseas ? 'USD' : 'KRW',
      market: isOverseas ? 'US' : 'KR',
      isValid: errors.length === 0,
      errors
    })
  }

  return holdings
}

// 미래에셋 IRP 계좌 파싱
function parseMiraeIRP(data: unknown[][]): ParsedHolding[] {
  // 헤더: 종목명 | 보유량 | 매입금액 | 평가금액 | 평가손익 | 수익률 | 운용비율
  const holdings: ParsedHolding[] = []

  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length < 6) continue

    const stockName = String(row[0] || '').trim()
    if (!stockName) continue

    const quantity = parseNumber(row[1])
    const purchaseAmount = parseNumber(row[2])
    const evalAmount = parseNumber(row[3])
    const profitLoss = parseNumber(row[4])
    const returnRate = parseNumber(row[5])

    // 평균단가, 현재가 계산
    const avgPrice = quantity > 0 ? purchaseAmount / quantity : 0
    const currentPrice = quantity > 0 ? evalAmount / quantity : 0

    const errors: string[] = []
    if (quantity <= 0) errors.push('Invalid quantity')

    holdings.push({
      stockCode: '',
      stockName,
      quantity,
      avgPrice,
      currentPrice,
      purchaseAmount,
      evalAmount,
      profitLoss,
      returnRate,
      currency: 'KRW',
      market: 'KR',
      isValid: errors.length === 0,
      errors
    })
  }

  return holdings
}

// 삼성증권 파싱
function parseSamsung(data: unknown[][]): ParsedHolding[] {
  // 헤더: 계좌번호 | 계좌유형 | 종목명 | 구분 | 잔고수량 | 매수단가 | 현재가 | 평가금액 | 매수금액 | 평가손익 | 수익률 | ...
  const holdings: ParsedHolding[] = []

  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length < 11) continue

    const stockName = String(row[2] || '').trim()
    if (!stockName) continue

    // 현금잔고 등 제외
    if (stockName.includes('현금') || stockName.includes('예수금') || stockName.includes('RP')) {
      continue
    }

    const quantity = parseNumber(row[4])
    const avgPrice = parseNumber(row[5])
    const currentPrice = parseNumber(row[6])
    const evalAmount = parseNumber(row[7])
    const purchaseAmount = parseNumber(row[8])
    const profitLoss = parseNumber(row[9])
    const returnRate = parseNumber(row[10]) * 100  // 삼성은 소수점 형식 (0.0667 -> 6.67%)

    // 해외주식 판별 (한국 ETF는 제외)
    let isOverseas = false
    let stockCode = ''

    if (isKoreanETF(stockName)) {
      // 한국 ETF: KODEX 미국나스닥 등도 국내 상품
      isOverseas = false
    } else {
      const detection = detectOverseasStock(stockName)
      isOverseas = detection.isOverseas
      stockCode = detection.ticker
    }

    const errors: string[] = []
    if (quantity <= 0) errors.push('Invalid quantity')

    holdings.push({
      stockCode,
      stockName,
      quantity,
      avgPrice,
      currentPrice,
      purchaseAmount,
      evalAmount,
      profitLoss,
      returnRate,
      currency: isOverseas ? 'USD' : 'KRW',
      market: isOverseas ? 'US' : 'KR',
      isValid: errors.length === 0,
      errors
    })
  }

  return holdings
}

// 한화투자증권 국내 파싱
function parseHanwhaDomestic(data: unknown[][]): ParsedHolding[] {
  // 헤더: (빈) | (빈) | 종목명 | 보유수량 | 매입단가 | 평가손익 | 수익률 | 현재가 | 평가금액 | 매입금액 | 잔고비중(%) | 신용구분 | 종목코드
  const holdings: ParsedHolding[] = []

  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length < 12) continue

    const stockName = String(row[2] || '').trim()
    if (!stockName) continue

    const quantity = parseNumber(row[3])
    const avgPrice = parseNumber(row[4])
    const profitLoss = parseNumber(row[5])
    const returnRate = parseNumber(row[6])
    const currentPrice = parseNumber(row[7])
    const evalAmount = parseNumber(row[8])
    const purchaseAmount = parseNumber(row[9])
    const stockCode = normalizeStockCode(String(row[12] || ''), stockName)

    const errors: string[] = []
    if (quantity <= 0) errors.push('Invalid quantity')

    holdings.push({
      stockCode,
      stockName,
      quantity,
      avgPrice,
      currentPrice,
      purchaseAmount,
      evalAmount,
      profitLoss,
      returnRate,
      currency: 'KRW',
      market: 'KR',
      isValid: errors.length === 0,
      errors
    })
  }

  return holdings
}

// 한화투자증권 해외 파싱
function parseHanwhaOverseas(data: unknown[][]): ParsedHolding[] {
  // 헤더: 구분 | 종목명 | 결제보유수량 | 매입단가 | 매입금액 | 현재가 | 평가금액 | 평가손익 | 수익률 | 종목코드 | 기준환율 | 통화 | 거래국가 | 거래시장
  const holdings: ParsedHolding[] = []

  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length < 12) continue

    const stockName = String(row[1] || '').trim()
    if (!stockName) continue

    const quantity = parseNumber(row[2])
    const avgPrice = parseNumber(row[3])           // 원화
    const purchaseAmount = parseNumber(row[4])     // 원화
    const currentPrice = parseNumber(row[5])       // 원화
    const evalAmount = parseNumber(row[6])         // 원화
    const profitLoss = parseNumber(row[7])
    const returnRate = parseNumber(row[8])
    const stockCode = String(row[9] || '').trim().toUpperCase()
    // row[10] = 기준환율 (참고용)
    const currency = String(row[11] || 'USD').trim()
    const market = String(row[13] || '').trim()

    const errors: string[] = []
    if (quantity <= 0) errors.push('Invalid quantity')

    holdings.push({
      stockCode,
      stockName,
      quantity,
      avgPrice,
      currentPrice,
      purchaseAmount,
      evalAmount,
      profitLoss,
      returnRate,
      currency: currency === 'USD' ? 'USD' : 'KRW',
      market: market || 'US',
      isValid: errors.length === 0,
      errors
    })
  }

  return holdings
}

// 파일 형식 감지
function detectFileFormat(headers: string[], data: unknown[][]): string {
  const headerStr = headers.map(h => String(h || '').toLowerCase()).join('|')

  // 삼성증권: 계좌번호, 계좌유형 컬럼 있음
  if (headerStr.includes('계좌번호') && headerStr.includes('계좌유형')) {
    return 'SAMSUNG'
  }

  // 한화 해외: 거래국가, 거래시장, 기준환율 있음
  if (headerStr.includes('거래국가') || headerStr.includes('기준환율')) {
    return 'HANWHA_OVERSEAS'
  }

  // 한화 국내: 잔고비중, 신용구분 있음
  if (headerStr.includes('잔고비중') || headerStr.includes('신용구분')) {
    return 'HANWHA_DOMESTIC'
  }

  // 미래에셋 IRP: 운용비율 있음
  if (headerStr.includes('운용비율')) {
    return 'MIRAE_IRP'
  }

  // 미래에셋 일반: 유형 컬럼에 "해외주식", "주식" 있음
  if (headerStr.includes('유형') && data.length > 1) {
    const firstType = String(data[1]?.[0] || '').toLowerCase()
    if (firstType.includes('주식') || firstType.includes('해외')) {
      return 'MIRAE_GENERAL'
    }
  }

  return 'UNKNOWN'
}

// 메인 파싱 함수
export function parseHoldingsFile(filePath: string): HoldingsImportResult {
  const result: HoldingsImportResult = {
    success: false,
    holdings: [],
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    detectedBrokerage: '',
    errors: []
  }

  try {
    const buffer = readFileSync(filePath)
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      result.errors.push('시트를 찾을 수 없습니다')
      return result
    }

    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

    if (data.length < 2) {
      result.errors.push('데이터가 없습니다')
      return result
    }

    const headers = data[0] as string[]
    const format = detectFileFormat(headers, data)

    let holdings: ParsedHolding[] = []

    switch (format) {
      case 'MIRAE_GENERAL':
        result.detectedBrokerage = '미래에셋'
        holdings = parseMiraeGeneral(data)
        break
      case 'MIRAE_IRP':
        result.detectedBrokerage = '미래에셋 IRP'
        holdings = parseMiraeIRP(data)
        break
      case 'SAMSUNG':
        result.detectedBrokerage = '삼성증권'
        holdings = parseSamsung(data)
        break
      case 'HANWHA_DOMESTIC':
        result.detectedBrokerage = '한화투자증권 (국내)'
        holdings = parseHanwhaDomestic(data)
        break
      case 'HANWHA_OVERSEAS':
        result.detectedBrokerage = '한화투자증권 (해외)'
        holdings = parseHanwhaOverseas(data)
        break
      default:
        result.errors.push('알 수 없는 파일 형식입니다')
        return result
    }

    // 후처리: 500배 기준 USD 자동 감지
    // currency가 KRW인데 가격 비율이 500배 이상이면 USD로 변경
    for (const h of holdings) {
      if (h.currency !== 'USD' && h.avgPrice > 0 && h.currentPrice > 0) {
        const correctedCurrency = detectCurrencyByPriceRatio(h.avgPrice, h.currentPrice, h.currency)
        if (correctedCurrency === 'USD' && h.currency !== 'USD') {
          h.currency = 'USD'
          h.market = 'US'
        }
      }
    }

    result.holdings = holdings
    result.totalRows = holdings.length
    result.validRows = holdings.filter(h => h.isValid).length
    result.invalidRows = holdings.filter(h => !h.isValid).length
    result.success = result.validRows > 0

  } catch (error) {
    result.errors.push(`파일 파싱 실패: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return result
}

// 증권사 목록
export const BROKERAGE_LIST = [
  { value: 'MIRAE', label: '미래에셋' },
  { value: 'MIRAE_IRP', label: '미래에셋 IRP' },
  { value: 'SAMSUNG', label: '삼성증권' },
  { value: 'HANWHA', label: '한화투자증권' }
]
