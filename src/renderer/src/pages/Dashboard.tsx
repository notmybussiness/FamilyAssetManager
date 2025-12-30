import { useEffect, useState, useCallback } from 'react'
import PortfolioCharts from '../components/PortfolioCharts'
import DividendAnalysis from '../components/DividendAnalysis'

interface PortfolioSummary {
  totalMarketValue: number
  totalCostBasis: number
  totalReturn: number
  totalReturnPercent: number
  byCurrency: Array<{ currency: string; market_value: number; cost_basis: number }>
  byAccountType: Array<{ account_type: string; market_value: number; cost_basis: number }>
  byBrokerage: Array<{ brokerage: string; market_value: number; cost_basis: number }>
}

interface AggregatedHolding {
  stock_code: string
  stock_name: string
  currency: string
  total_quantity: number
  weighted_avg_cost: number
  total_value: number
  current_price: number
  account_count: number
}

interface PortfolioReturns {
  dailyReturn: number
  dailyReturnPercent: number
  priceReturn: number
  priceReturnPercent: number
  totalDividends: number
  mtdDividends: number
  ytdDividends: number
  totalReturnWithDividends: number
  totalReturnWithDividendsPercent: number
  marketValue: number
  costBasis: number
}

interface DashboardProps {
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
  KOREA_INV: '한국투자증권',
  HANWHA: '한화투자증권',
  MIRAE: '미래에셋',
  SAMSUNG: '삼성증권',
  KIWOOM: '키움증권',
  NH: 'NH투자증권',
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

export default function Dashboard({ userId }: DashboardProps): JSX.Element {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [holdings, setHoldings] = useState<AggregatedHolding[]>([])
  const [returns, setReturns] = useState<PortfolioReturns | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [exchangeRate, setExchangeRate] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [summaryData, holdingsData, returnsData] = await Promise.all([
        window.api.portfolio.getSummary(userId),
        window.api.holding.getAggregated(userId),
        window.api.portfolio.getReturns(userId)
      ])
      setSummary(summaryData)
      setHoldings(holdingsData)
      setReturns(returnsData)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // 현재가 및 환율 새로고침
  const refreshMarketData = useCallback(async () => {
    setRefreshing(true)
    try {
      // 환율 조회 (캐시 무시, 강제 새로고침)
      const rateResult = await window.api.marketData.getExchangeRate('USD', 'KRW', true)
      if (rateResult.success) {
        setExchangeRate(rateResult.rate)
      }

      // 모든 보유종목 현재가 업데이트
      const result = await window.api.marketData.refreshAll(userId)
      console.log(`Market data refreshed: ${result.updated} updated, ${result.failed} failed`)

      // 데이터 다시 로드
      await loadData()
      setLastUpdate(new Date().toISOString())
    } catch (error) {
      console.error('Failed to refresh market data:', error)
    } finally {
      setRefreshing(false)
    }
  }, [userId, loadData])

  useEffect(() => {
    // 앱 시작 시: 먼저 기존 데이터 표시, 그 후 시세 업데이트
    let isMounted = true

    const initializeData = async () => {
      // 1. 먼저 기존 DB 데이터로 빠르게 화면 표시
      await loadData()

      // 2. 컴포넌트가 아직 마운트되어 있으면 시세 새로고침
      //    (refreshMarketData는 내부에서 loadData를 다시 호출함)
      if (isMounted) {
        refreshMarketData()
      }
    }

    initializeData()

    const cleanup = window.api.onTriggerSync(() => {
      loadData()
    })

    return () => {
      isMounted = false
      cleanup()
    }
  }, [userId, loadData, refreshMarketData])

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>
  }

  const hasData = summary && summary.totalMarketValue > 0

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>대시보드</h1>
        <div className="header-actions">
          {lastUpdate && (
            <span className="last-update">
              마지막 업데이트: {formatTime(lastUpdate)}
              {exchangeRate && ` | USD/KRW: ${exchangeRate.toLocaleString()}`}
            </span>
          )}
          <button
            className="btn btn-primary"
            onClick={refreshMarketData}
            disabled={refreshing}
          >
            {refreshing ? '조회 중...' : '시세 새로고침'}
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="empty-state">
          <h3>포트폴리오 데이터가 없습니다</h3>
          <p>계좌와 거래내역을 추가하면 포트폴리오 요약을 볼 수 있습니다.</p>
        </div>
      ) : (
        <>
          {/* Main Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">총 평가금액</div>
              <div className="stat-value">{formatCurrency(summary.totalMarketValue)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">총 투자원금</div>
              <div className="stat-value">{formatCurrency(summary.totalCostBasis)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">총 수익</div>
              <div className={`stat-value ${summary.totalReturn >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(summary.totalReturn)}
              </div>
              <div className={`stat-change ${summary.totalReturnPercent >= 0 ? 'positive' : 'negative'}`}>
                {formatPercent(summary.totalReturnPercent)}
              </div>
            </div>
          </div>

          {/* Returns Breakdown */}
          {returns && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">일일 변동</div>
                <div className={`stat-value ${returns.dailyReturn >= 0 ? 'positive' : 'negative'}`}>
                  {formatCurrency(returns.dailyReturn)}
                </div>
                <div className={`stat-change ${returns.dailyReturnPercent >= 0 ? 'positive' : 'negative'}`}>
                  {formatPercent(returns.dailyReturnPercent)}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">평가손익</div>
                <div className={`stat-value ${returns.priceReturn >= 0 ? 'positive' : 'negative'}`}>
                  {formatCurrency(returns.priceReturn)}
                </div>
                <div className={`stat-change ${returns.priceReturnPercent >= 0 ? 'positive' : 'negative'}`}>
                  {formatPercent(returns.priceReturnPercent)}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">누적 배당금</div>
                <div className="stat-value">{formatCurrency(returns.totalDividends)}</div>
                <div className="stat-sub">
                  <span>MTD: {formatCurrency(returns.mtdDividends)}</span>
                  <span style={{ marginLeft: '8px' }}>YTD: {formatCurrency(returns.ytdDividends)}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">총 수익 (배당 포함)</div>
                <div className={`stat-value ${returns.totalReturnWithDividends >= 0 ? 'positive' : 'negative'}`}>
                  {formatCurrency(returns.totalReturnWithDividends)}
                </div>
                <div className={`stat-change ${returns.totalReturnWithDividendsPercent >= 0 ? 'positive' : 'negative'}`}>
                  {formatPercent(returns.totalReturnWithDividendsPercent)}
                </div>
              </div>
            </div>
          )}

          {/* Portfolio Charts */}
          <PortfolioCharts
            byAccountType={summary.byAccountType}
            byBrokerage={summary.byBrokerage}
          />

          {/* Breakdown Cards */}
          <div className="stats-grid">
            {/* By Account Type */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">계좌유형별</h3>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>유형</th>
                    <th className="text-right">평가금액</th>
                    <th className="text-right">수익률</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byAccountType.map((item: { account_type: string; market_value: number; cost_basis: number }) => {
                    const returnVal = item.market_value - item.cost_basis
                    const returnPct = item.cost_basis > 0 ? (returnVal / item.cost_basis) * 100 : 0
                    return (
                      <tr key={item.account_type}>
                        <td>{ACCOUNT_TYPE_LABELS[item.account_type] || item.account_type}</td>
                        <td className="text-right">{formatCurrency(item.market_value)}</td>
                        <td className={`text-right ${returnVal >= 0 ? 'text-success' : 'text-danger'}`}>
                          {formatPercent(returnPct)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* By Brokerage */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">증권사별</h3>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>증권사</th>
                    <th className="text-right">평가금액</th>
                    <th className="text-right">수익률</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byBrokerage.map((item: { brokerage: string; market_value: number; cost_basis: number }) => {
                    const returnVal = item.market_value - item.cost_basis
                    const returnPct = item.cost_basis > 0 ? (returnVal / item.cost_basis) * 100 : 0
                    return (
                      <tr key={item.brokerage}>
                        <td>{BROKERAGE_LABELS[item.brokerage] || item.brokerage}</td>
                        <td className="text-right">{formatCurrency(item.market_value)}</td>
                        <td className={`text-right ${returnVal >= 0 ? 'text-success' : 'text-danger'}`}>
                          {formatPercent(returnPct)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dividend Analysis */}
          <DividendAnalysis userId={userId} />

          {/* Top Holdings */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">주요 보유종목</h3>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>종목</th>
                    <th className="text-right">수량</th>
                    <th className="text-right">평균단가</th>
                    <th className="text-right">현재가</th>
                    <th className="text-right">평가금액</th>
                    <th className="text-right">수익률</th>
                    <th className="text-center">계좌수</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.slice(0, 10).map((holding) => {
                    const returnVal = holding.total_value - holding.total_quantity * holding.weighted_avg_cost
                    const returnPct =
                      holding.weighted_avg_cost > 0
                        ? ((holding.current_price - holding.weighted_avg_cost) / holding.weighted_avg_cost) * 100
                        : 0
                    return (
                      <tr key={holding.stock_code}>
                        <td>
                          <div>{holding.stock_name}</div>
                          <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                            {holding.stock_code}
                          </div>
                        </td>
                        <td className="text-right">{holding.total_quantity.toLocaleString()}</td>
                        <td className="text-right">
                          {formatCurrency(holding.weighted_avg_cost, holding.currency)}
                        </td>
                        <td className="text-right">
                          {formatCurrency(holding.current_price, holding.currency)}
                        </td>
                        <td className="text-right">
                          {formatCurrency(holding.total_value, holding.currency)}
                        </td>
                        <td className={`text-right ${returnVal >= 0 ? 'text-success' : 'text-danger'}`}>
                          {formatPercent(returnPct)}
                        </td>
                        <td className="text-center">{holding.account_count}</td>
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
