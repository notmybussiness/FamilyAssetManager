import { useEffect, useState, useCallback } from 'react'

interface HoldingWithChange {
  id: string
  account_id: string
  stock_code: string
  stock_name: string
  quantity: number
  avg_cost: number
  current_price: number
  prev_close: number
  currency: string
  last_synced: string | null
  brokerage: string
  account_type: string
  account_alias: string | null
  day_change_percent: number
}

interface HoldingsProps {
  userId: string
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  PENSION: '연금저축',
  IRP: 'IRP',
  ISA: 'ISA',
  OVERSEAS: '해외주식',
  GENERAL: '일반'
}

const BROKERAGE_LABELS: Record<string, string> = {
  KOREA_INV: '한국투자',
  HANWHA: '한화투자',
  MIRAE: '미래에셋',
  SAMSUNG: '삼성증권',
  KIWOOM: '키움증권',
  NH: 'NH투자',
  KB: 'KB증권',
  OTHER: '기타'
}

function formatCurrency(value: number, currency: string = 'KRW'): string {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  }
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value)
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function formatTime(timestamp: string | null): string {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

export default function Holdings({ userId }: HoldingsProps): JSX.Element {
  const [holdings, setHoldings] = useState<HoldingWithChange[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [exchangeRate, setExchangeRate] = useState<number | null>(null)

  const loadHoldings = useCallback(async () => {
    try {
      const data = await window.api.holding.getByUserWithChange(userId)
      setHoldings(data)
    } catch (error) {
      console.error('Failed to load holdings:', error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // 현재가 새로고침
  const refreshMarketData = useCallback(async () => {
    setRefreshing(true)
    try {
      // 환율 조회
      const rateResult = await window.api.marketData.getExchangeRate('USD', 'KRW')
      if (rateResult.success) {
        setExchangeRate(rateResult.rate)
      }

      // 모든 보유종목 현재가 업데이트
      const result = await window.api.marketData.refreshAll(userId)
      console.log(`Market data refreshed: ${result.updated} updated, ${result.failed} failed`)

      // 데이터 다시 로드
      await loadHoldings()
      setLastUpdate(new Date().toISOString())
    } catch (error) {
      console.error('Failed to refresh market data:', error)
    } finally {
      setRefreshing(false)
    }
  }, [userId, loadHoldings])

  useEffect(() => {
    loadHoldings()

    const cleanup = window.api.onTriggerSync(() => {
      loadHoldings()
    })

    return cleanup
  }, [userId, loadHoldings])

  const filteredHoldings = holdings.filter((h) => {
    if (filter === 'all') return true
    // 한국투자증권 선택 시 한화투자증권도 포함
    if (filter === 'KOREA_INV') {
      return h.brokerage === 'KOREA_INV' || h.brokerage === 'HANWHA'
    }
    return h.account_type === filter || h.brokerage === filter
  })

  const totalValue = filteredHoldings.reduce((sum, h) => sum + h.quantity * h.current_price, 0)
  const totalCost = filteredHoldings.reduce((sum, h) => sum + h.quantity * h.avg_cost, 0)
  const totalReturn = totalValue - totalCost
  const totalReturnPct = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>
  }

  return (
    <div className="holdings-page">
      <div className="page-header">
        <h1>보유종목</h1>
        <div className="header-actions">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">전체 계좌</option>
            <optgroup label="계좌유형">
              <option value="PENSION">연금저축</option>
              <option value="IRP">IRP</option>
              <option value="ISA">ISA</option>
              <option value="OVERSEAS">해외주식</option>
              <option value="GENERAL">일반</option>
            </optgroup>
            <optgroup label="증권사">
              <option value="KOREA_INV">한국투자증권</option>
              <option value="MIRAE">미래에셋</option>
              <option value="SAMSUNG">삼성증권</option>
              <option value="KIWOOM">키움증권</option>
              <option value="NH">NH투자증권</option>
              <option value="KB">KB증권</option>
            </optgroup>
          </select>
          {lastUpdate && (
            <span className="last-update">
              업데이트: {formatTime(lastUpdate)}
              {exchangeRate && ` | USD/KRW: ${exchangeRate.toLocaleString()}`}
            </span>
          )}
          <button
            className="btn btn-secondary"
            onClick={refreshMarketData}
            disabled={refreshing}
          >
            {refreshing ? '조회 중...' : '시세 새로고침'}
          </button>
        </div>
      </div>

      {holdings.length === 0 ? (
        <div className="empty-state">
          <h3>보유종목이 없습니다</h3>
          <p>거래내역을 추가하면 보유종목이 표시됩니다.</p>
        </div>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-label">총 평가금액</div>
              <div className="stat-value">{formatCurrency(totalValue)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">총 투자원금</div>
              <div className="stat-value">{formatCurrency(totalCost)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">총 수익</div>
              <div className={`stat-value ${totalReturn >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(totalReturn)}
              </div>
              <div className={`stat-change ${totalReturnPct >= 0 ? 'positive' : 'negative'}`}>
                {formatPercent(totalReturnPct)}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>종목</th>
                    <th>계좌</th>
                    <th className="text-right">수량</th>
                    <th className="text-right">평균단가</th>
                    <th className="text-right">현재가</th>
                    <th className="text-right">등락률</th>
                    <th className="text-right">평가금액</th>
                    <th className="text-right">수익</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHoldings.map((holding) => {
                    const value = holding.quantity * holding.current_price
                    const cost = holding.quantity * holding.avg_cost
                    const returnVal = value - cost
                    const returnPct = cost > 0 ? (returnVal / cost) * 100 : 0
                    const dayChange = holding.day_change_percent || 0
                    // 해외주식 판별: 통화가 USD인 경우 (파서에서 currency 설정)
                    const isOverseas = holding.currency === 'USD'
                    const isHighChange = Math.abs(dayChange) >= 5

                    return (
                      <tr key={holding.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {holding.stock_name}
                            {isOverseas && (
                              <span className="badge badge-overseas">해외</span>
                            )}
                          </div>
                          <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                            {holding.stock_code}
                          </div>
                        </td>
                        <td>
                          <div>{holding.account_alias || BROKERAGE_LABELS[holding.brokerage]}</div>
                          <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                            {ACCOUNT_TYPE_LABELS[holding.account_type]}
                          </div>
                        </td>
                        <td className="text-right">{holding.quantity.toLocaleString()}</td>
                        <td className="text-right">{formatCurrency(holding.avg_cost, holding.currency)}</td>
                        <td className="text-right">{formatCurrency(holding.current_price, holding.currency)}</td>
                        <td className={`text-right ${dayChange >= 0 ? 'text-success' : 'text-danger'} ${isHighChange ? 'high-change' : ''}`}>
                          {formatPercent(dayChange)}
                        </td>
                        <td className="text-right">{formatCurrency(value, holding.currency)}</td>
                        <td className={`text-right ${returnVal >= 0 ? 'text-success' : 'text-danger'}`}>
                          <div>{formatCurrency(returnVal, holding.currency)}</div>
                          <div style={{ fontSize: '0.8rem' }}>{formatPercent(returnPct)}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
