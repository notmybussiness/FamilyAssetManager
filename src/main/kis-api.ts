/**
 * Korea Investment Securities (KIS) Open API Client
 *
 * API Documentation: https://apiportal.koreainvestment.com/
 * GitHub Samples: https://github.com/koreainvestment/open-trading-api
 */

import { getDatabase } from './database'

// API Base URLs
const API_BASE_PROD = 'https://openapi.koreainvestment.com:9443'
const API_BASE_VTS = 'https://openapivts.koreainvestment.com:29443' // Paper trading

// Token cache (in-memory, per app session)
interface TokenCache {
  [accountId: string]: {
    accessToken: string
    expiresAt: number
  }
}

const tokenCache: TokenCache = {}

// API Response types
interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  access_token_token_expired: string
}

interface HoldingItem {
  pdno: string // 종목코드
  prdt_name: string // 종목명
  hldg_qty: string // 보유수량
  pchs_avg_pric: string // 매입평균가격
  prpr: string // 현재가
  evlu_amt: string // 평가금액
  evlu_pfls_amt: string // 평가손익금액
  evlu_pfls_rt: string // 평가손익률
}

interface BalanceResponse {
  rt_cd: string
  msg_cd: string
  msg1: string
  output1: HoldingItem[]
  output2: Array<{
    dnca_tot_amt: string // 예수금총금액
    tot_evlu_amt: string // 총평가금액
    pchs_amt_smtl_amt: string // 매입금액합계
    evlu_amt_smtl_amt: string // 평가금액합계
    evlu_pfls_smtl_amt: string // 평가손익합계
  }>
}

interface TransactionItem {
  ord_dt: string // 주문일자
  pdno: string // 종목코드
  prdt_name: string // 종목명
  sll_buy_dvsn_cd: string // 매도매수구분코드 (01=매도, 02=매수)
  ord_qty: string // 주문수량
  tot_ccld_qty: string // 총체결수량
  tot_ccld_amt: string // 총체결금액
  avg_prvs: string // 평균가
}

interface TransactionResponse {
  rt_cd: string
  msg_cd: string
  msg1: string
  output1: TransactionItem[]
  ctx_area_fk100: string
  ctx_area_nk100: string
}

/**
 * Get access token for KIS API
 * Token is valid for 24 hours, cached in memory
 */
export async function getAccessToken(
  appKey: string,
  appSecret: string,
  accountId: string,
  isPaper: boolean = false
): Promise<string> {
  // Check cache first
  const cached = tokenCache[accountId]
  if (cached && cached.expiresAt > Date.now() + 60000) {
    // Valid for at least 1 more minute
    return cached.accessToken
  }

  const baseUrl = isPaper ? API_BASE_VTS : API_BASE_PROD
  const url = `${baseUrl}/oauth2/tokenP`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: appKey,
        appsecret: appSecret
      })
    })

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status} ${response.statusText}`)
    }

    const data: TokenResponse = await response.json()

    // Cache the token (expires_in is in seconds, typically 86400 = 24 hours)
    tokenCache[accountId] = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000 // Subtract 1 minute for safety
    }

    return data.access_token
  } catch (error) {
    console.error('Failed to get access token:', error)
    throw error
  }
}

/**
 * Clear cached token for an account
 */
export function clearTokenCache(accountId: string): void {
  delete tokenCache[accountId]
}

/**
 * Fetch holdings (stock balance) from KIS API
 * Uses tr_id: TTTC8434R (real) / VTTC8434R (paper)
 */
export async function fetchHoldings(
  appKey: string,
  appSecret: string,
  accountNumber: string,
  accountId: string,
  isPaper: boolean = false
): Promise<HoldingItem[]> {
  const accessToken = await getAccessToken(appKey, appSecret, accountId, isPaper)
  const baseUrl = isPaper ? API_BASE_VTS : API_BASE_PROD
  const trId = isPaper ? 'VTTC8434R' : 'TTTC8434R'

  // Account number format: 8-digit account + 2-digit product code
  const cano = accountNumber.slice(0, 8)
  const acntPrdtCd = accountNumber.slice(8, 10) || '01'

  const params = new URLSearchParams({
    CANO: cano,
    ACNT_PRDT_CD: acntPrdtCd,
    AFHR_FLPR_YN: 'N',
    OFL_YN: '',
    INQR_DVSN: '02', // 02=종목별
    UNPR_DVSN: '01',
    FUND_STTL_ICLD_YN: 'N',
    FNCG_AMT_AUTO_RDPT_YN: 'N',
    PRCS_DVSN: '00',
    CTX_AREA_FK100: '',
    CTX_AREA_NK100: ''
  })

  const url = `${baseUrl}/uapi/domestic-stock/v1/trading/inquire-balance?${params}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        authorization: `Bearer ${accessToken}`,
        appkey: appKey,
        appsecret: appSecret,
        tr_id: trId,
        custtype: 'P'
      }
    })

    if (!response.ok) {
      throw new Error(`Holdings request failed: ${response.status} ${response.statusText}`)
    }

    const data: BalanceResponse = await response.json()

    if (data.rt_cd !== '0') {
      throw new Error(`API Error: ${data.msg1}`)
    }

    return data.output1.filter((item) => parseFloat(item.hldg_qty) > 0)
  } catch (error) {
    console.error('Failed to fetch holdings:', error)
    throw error
  }
}

/**
 * Fetch transaction history from KIS API
 * Uses tr_id: TTTC8001R (real) / VTTC8001R (paper)
 */
export async function fetchTransactions(
  appKey: string,
  appSecret: string,
  accountNumber: string,
  accountId: string,
  startDate: string, // YYYYMMDD
  endDate: string, // YYYYMMDD
  isPaper: boolean = false
): Promise<TransactionItem[]> {
  const accessToken = await getAccessToken(appKey, appSecret, accountId, isPaper)
  const baseUrl = isPaper ? API_BASE_VTS : API_BASE_PROD
  const trId = isPaper ? 'VTTC8001R' : 'TTTC8001R'

  const cano = accountNumber.slice(0, 8)
  const acntPrdtCd = accountNumber.slice(8, 10) || '01'

  const allTransactions: TransactionItem[] = []
  let ctxAreaFk100 = ''
  let ctxAreaNk100 = ''
  let hasMore = true

  while (hasMore) {
    const params = new URLSearchParams({
      CANO: cano,
      ACNT_PRDT_CD: acntPrdtCd,
      INQR_STRT_DT: startDate,
      INQR_END_DT: endDate,
      SLL_BUY_DVSN_CD: '00', // 00=전체
      INQR_DVSN: '00',
      PDNO: '',
      CCLD_DVSN: '01', // 01=체결
      ORD_GNO_BRNO: '',
      ODNO: '',
      INQR_DVSN_3: '00',
      INQR_DVSN_1: '',
      CTX_AREA_FK100: ctxAreaFk100,
      CTX_AREA_NK100: ctxAreaNk100
    })

    const url = `${baseUrl}/uapi/domestic-stock/v1/trading/inquire-daily-ccld?${params}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        authorization: `Bearer ${accessToken}`,
        appkey: appKey,
        appsecret: appSecret,
        tr_id: trId,
        custtype: 'P'
      }
    })

    if (!response.ok) {
      throw new Error(`Transactions request failed: ${response.status} ${response.statusText}`)
    }

    const data: TransactionResponse = await response.json()

    if (data.rt_cd !== '0') {
      throw new Error(`API Error: ${data.msg1}`)
    }

    allTransactions.push(...data.output1)

    // Check for more pages
    if (data.ctx_area_fk100 && data.ctx_area_nk100) {
      ctxAreaFk100 = data.ctx_area_fk100
      ctxAreaNk100 = data.ctx_area_nk100
    } else {
      hasMore = false
    }

    // Safety limit
    if (allTransactions.length > 1000) {
      break
    }
  }

  return allTransactions.filter((item) => parseFloat(item.tot_ccld_qty) > 0)
}

/**
 * Sync holdings from KIS API to local database
 */
export async function syncHoldings(accountId: string): Promise<{
  success: boolean
  synced: number
  error?: string
}> {
  const db = getDatabase()

  try {
    // Get account details
    const account = db
      .prepare(
        `
      SELECT id, account_number, api_key, api_secret, brokerage
      FROM accounts WHERE id = ?
    `
      )
      .get(accountId) as {
      id: string
      account_number: string
      api_key: string | null
      api_secret: string | null
      brokerage: string
    }

    if (!account) {
      throw new Error('Account not found')
    }

    if (account.brokerage !== 'KOREA_INV') {
      throw new Error('API sync only available for Korea Investment Securities')
    }

    if (!account.api_key || !account.api_secret) {
      throw new Error('API credentials not configured')
    }

    // Fetch holdings from API
    const holdings = await fetchHoldings(
      account.api_key,
      account.api_secret,
      account.account_number,
      accountId
    )

    // Begin transaction
    const updateHolding = db.prepare(`
      INSERT INTO holdings (id, account_id, stock_code, stock_name, quantity, avg_cost, current_price, currency, last_synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'KRW', datetime('now'))
      ON CONFLICT(account_id, stock_code) DO UPDATE SET
        stock_name = excluded.stock_name,
        quantity = excluded.quantity,
        avg_cost = excluded.avg_cost,
        current_price = excluded.current_price,
        last_synced = excluded.last_synced
    `)

    const deleteOldHoldings = db.prepare(`
      DELETE FROM holdings
      WHERE account_id = ? AND stock_code NOT IN (${holdings.map(() => '?').join(',')})
    `)

    const { v4: uuidv4 } = await import('uuid')

    db.transaction(() => {
      // Update or insert holdings
      for (const h of holdings) {
        updateHolding.run(
          uuidv4(),
          accountId,
          h.pdno,
          h.prdt_name,
          parseFloat(h.hldg_qty),
          parseFloat(h.pchs_avg_pric),
          parseFloat(h.prpr)
        )
      }

      // Remove holdings that no longer exist
      if (holdings.length > 0) {
        deleteOldHoldings.run(accountId, ...holdings.map((h) => h.pdno))
      } else {
        // Delete all holdings for this account if API returned empty
        db.prepare('DELETE FROM holdings WHERE account_id = ?').run(accountId)
      }
    })()

    // Log sync success
    const logId = (await import('uuid')).v4()
    db.prepare(`
      INSERT INTO sync_logs (id, account_id, status)
      VALUES (?, ?, 'SUCCESS')
    `).run(logId, accountId)

    return { success: true, synced: holdings.length }
  } catch (error) {
    // Log sync failure
    const { v4: uuidv4 } = await import('uuid')
    db.prepare(`
      INSERT INTO sync_logs (id, account_id, status, error_message)
      VALUES (?, ?, 'FAILED', ?)
    `).run(uuidv4(), accountId, error instanceof Error ? error.message : 'Unknown error')

    return {
      success: false,
      synced: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Sync transaction history from KIS API to local database
 */
export async function syncTransactions(
  accountId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  success: boolean
  synced: number
  skipped: number
  error?: string
}> {
  const db = getDatabase()

  try {
    const account = db
      .prepare(
        `
      SELECT id, account_number, api_key, api_secret, brokerage
      FROM accounts WHERE id = ?
    `
      )
      .get(accountId) as {
      id: string
      account_number: string
      api_key: string | null
      api_secret: string | null
      brokerage: string
    }

    if (!account) {
      throw new Error('Account not found')
    }

    if (account.brokerage !== 'KOREA_INV') {
      throw new Error('API sync only available for Korea Investment Securities')
    }

    if (!account.api_key || !account.api_secret) {
      throw new Error('API credentials not configured')
    }

    // Default: last 30 days if not specified
    const now = new Date()
    const defaultEnd = now.toISOString().slice(0, 10).replace(/-/g, '')
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '')

    const transactions = await fetchTransactions(
      account.api_key,
      account.api_secret,
      account.account_number,
      accountId,
      startDate || defaultStart,
      endDate || defaultEnd
    )

    const { v4: uuidv4 } = await import('uuid')

    // Check for existing transactions to avoid duplicates
    const existingTxns = db
      .prepare(
        `
      SELECT date, stock_code, type, quantity, price
      FROM transactions
      WHERE account_id = ? AND source = 'API'
    `
      )
      .all(accountId) as Array<{
      date: string
      stock_code: string
      type: string
      quantity: number
      price: number
    }>

    const existingSet = new Set(
      existingTxns.map((t) => `${t.date}|${t.stock_code}|${t.type}|${t.quantity}|${t.price}`)
    )

    const insertTxn = db.prepare(`
      INSERT INTO transactions (id, account_id, stock_code, stock_name, type, quantity, price, total_amount, currency, date, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'KRW', ?, 'API')
    `)

    let synced = 0
    let skipped = 0

    db.transaction(() => {
      for (const t of transactions) {
        const type = t.sll_buy_dvsn_cd === '02' ? 'BUY' : 'SELL'
        const qty = parseFloat(t.tot_ccld_qty)
        const price = parseFloat(t.avg_prvs)
        const date = `${t.ord_dt.slice(0, 4)}-${t.ord_dt.slice(4, 6)}-${t.ord_dt.slice(6, 8)}`

        const key = `${date}|${t.pdno}|${type}|${qty}|${price}`

        if (existingSet.has(key)) {
          skipped++
          continue
        }

        insertTxn.run(
          uuidv4(),
          accountId,
          t.pdno,
          t.prdt_name,
          type,
          qty,
          price,
          parseFloat(t.tot_ccld_amt),
          date
        )
        synced++
      }
    })()

    return { success: true, synced, skipped }
  } catch (error) {
    return {
      success: false,
      synced: 0,
      skipped: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Test API connection with credentials
 */
export async function testConnection(
  appKey: string,
  appSecret: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Try to get token
    const baseUrl = API_BASE_PROD
    const url = `${baseUrl}/oauth2/tokenP`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: appKey,
        appsecret: appSecret
      })
    })

    if (!response.ok) {
      const text = await response.text()
      return {
        success: false,
        message: `Authentication failed: ${response.status} - ${text}`
      }
    }

    const data = await response.json()

    if (data.access_token) {
      return { success: true, message: 'Connection successful!' }
    } else {
      return { success: false, message: data.msg || 'Unknown error' }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed'
    }
  }
}
