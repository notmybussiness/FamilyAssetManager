import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface ChartData {
  name: string
  value: number
  color?: string
}

interface PortfolioChartsProps {
  byAccountType: Array<{ account_type: string; market_value: number; cost_basis: number }>
  byBrokerage: Array<{ brokerage: string; market_value: number; cost_basis: number }>
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

const COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16'  // lime
]

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value)
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { percent: number } }> }) {
  if (active && payload && payload.length) {
    const data = payload[0]
    return (
      <div className="chart-tooltip">
        <div className="tooltip-label">{data.name}</div>
        <div className="tooltip-value">{formatCurrency(data.value)}원</div>
        <div className="tooltip-percent">{(data.payload.percent * 100).toFixed(1)}%</div>
      </div>
    )
  }
  return null
}

export default function PortfolioCharts({ byAccountType, byBrokerage }: PortfolioChartsProps): JSX.Element {
  const accountTypeData: ChartData[] = byAccountType
    .filter(item => item.market_value > 0)
    .map((item, index) => ({
      name: ACCOUNT_TYPE_LABELS[item.account_type] || item.account_type,
      value: item.market_value,
      color: COLORS[index % COLORS.length]
    }))
    .sort((a, b) => b.value - a.value)

  const brokerageData: ChartData[] = byBrokerage
    .filter(item => item.market_value > 0)
    .map((item, index) => ({
      name: BROKERAGE_LABELS[item.brokerage] || item.brokerage,
      value: item.market_value,
      color: COLORS[index % COLORS.length]
    }))
    .sort((a, b) => b.value - a.value)

  const renderLabel = ({ name, percent }: { name: string; percent: number }) => {
    if (percent < 0.05) return null
    return `${name} ${(percent * 100).toFixed(0)}%`
  }

  return (
    <div className="portfolio-charts">
      <div className="charts-grid">
        {/* Account Type Chart */}
        <div className="chart-card card">
          <div className="card-header">
            <h3 className="card-title">계좌유형별 비중</h3>
          </div>
          <div className="chart-container">
            {accountTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={accountTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={renderLabel}
                    labelLine={false}
                  >
                    {accountTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">데이터 없음</div>
            )}
          </div>
          <div className="chart-legend">
            {accountTypeData.map((item, index) => (
              <div key={item.name} className="legend-item">
                <span className="legend-color" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="legend-label">{item.name}</span>
                <span className="legend-value">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Brokerage Chart */}
        <div className="chart-card card">
          <div className="card-header">
            <h3 className="card-title">증권사별 비중</h3>
          </div>
          <div className="chart-container">
            {brokerageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={brokerageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={renderLabel}
                    labelLine={false}
                  >
                    {brokerageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">데이터 없음</div>
            )}
          </div>
          <div className="chart-legend">
            {brokerageData.map((item, index) => (
              <div key={item.name} className="legend-item">
                <span className="legend-color" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="legend-label">{item.name}</span>
                <span className="legend-value">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
