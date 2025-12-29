import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface MonthlyDividendStat {
  month: string
  amount: number
  count: number
}

interface StockDividendStat {
  stock_code: string
  stock_name: string
  currency: string
  total_dividends: number
  dividend_count: number
  first_dividend: string
  last_dividend: string
  current_quantity: number | null
  avg_cost: number | null
  current_price: number | null
  dividend_yield: number
}

interface DividendAnalysisProps {
  userId: string
}

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

function formatCurrency(value: number, currency: string = 'KRW'): string {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  }
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value)
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <div className="tooltip-label">{label}</div>
        <div className="tooltip-value">{formatCurrency(payload[0].value)}</div>
      </div>
    )
  }
  return null
}

export default function DividendAnalysis({ userId }: DividendAnalysisProps): JSX.Element {
  const [monthlyData, setMonthlyData] = useState<Array<{ name: string; amount: number }>>([])
  const [stockData, setStockData] = useState<StockDividendStat[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [totalDividends, setTotalDividends] = useState(0)

  useEffect(() => {
    loadDividendData()
  }, [userId, selectedYear])

  const loadDividendData = async () => {
    setLoading(true)
    try {
      const [monthly, stocks] = await Promise.all([
        window.api.dividend.getMonthlyStats(userId, selectedYear),
        window.api.dividend.getByStock(userId)
      ])

      // 모든 월에 대한 데이터 생성 (없는 월은 0)
      const monthlyMap = new Map(monthly.map(m => [parseInt(m.month), m.amount]))
      const fullMonthlyData = MONTH_LABELS.map((label, index) => ({
        name: label,
        amount: monthlyMap.get(index + 1) || 0
      }))

      setMonthlyData(fullMonthlyData)
      setStockData(stocks)
      setTotalDividends(fullMonthlyData.reduce((sum, m) => sum + m.amount, 0))
    } catch (error) {
      console.error('Failed to load dividend data:', error)
    } finally {
      setLoading(false)
    }
  }

  const currentMonth = new Date().getMonth()
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  if (loading) {
    return (
      <div className="dividend-analysis card">
        <div className="card-header">
          <h3 className="card-title">배당금 분석</h3>
        </div>
        <div className="loading-spinner" style={{ margin: '2rem auto' }}></div>
      </div>
    )
  }

  return (
    <div className="dividend-analysis">
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">월별 배당금 ({selectedYear}년)</h3>
          <div className="header-actions">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="glass-select"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}년</option>
              ))}
            </select>
          </div>
        </div>

        <div className="dividend-summary">
          <div className="dividend-stat">
            <span className="stat-label">{selectedYear}년 총 배당금</span>
            <span className="stat-value">{formatCurrency(totalDividends)}</span>
          </div>
        </div>

        <div className="chart-container" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {monthlyData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === currentMonth && selectedYear === new Date().getFullYear()
                      ? '#22c55e'
                      : entry.amount > 0 ? '#3b82f6' : '#374151'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stockData.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">종목별 누적 배당금</h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>종목</th>
                  <th className="text-right">배당금 합계</th>
                  <th className="text-right">배당 횟수</th>
                  <th className="text-right">배당수익률</th>
                  <th>최근 배당</th>
                </tr>
              </thead>
              <tbody>
                {stockData.slice(0, 10).map((stock) => (
                  <tr key={stock.stock_code}>
                    <td>
                      <div>{stock.stock_name}</div>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                        {stock.stock_code}
                      </div>
                    </td>
                    <td className="text-right text-success">
                      {formatCurrency(stock.total_dividends, stock.currency)}
                    </td>
                    <td className="text-right">{stock.dividend_count}회</td>
                    <td className="text-right">
                      {stock.dividend_yield > 0 ? (
                        <span className="text-success">{stock.dividend_yield.toFixed(2)}%</span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="text-muted">{stock.last_dividend}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
