import { useEffect, useState, useCallback } from 'react'

interface StrategySignalWithDetails {
  id: string
  strategy_id: string
  holding_id: string
  stock_code: string
  stock_name: string
  account_id: string
  signal_type: 'BUY' | 'SELL'
  trigger_price: number
  avg_cost: number
  trigger_percent: number
  current_quantity: number
  suggested_quantity: number
  status: 'PENDING' | 'EXECUTED' | 'DISMISSED'
  executed_transaction_id: string | null
  executed_at: string | null
  dismissed_at: string | null
  created_at: string
  strategy_name: string
  brokerage: string
  account_type: string
  account_alias: string | null
  currency: string
  latest_price: number
}

interface TradingStrategy {
  id: string
  user_id: string
  stock_code: string | null
  name: string
  sell_trigger_percent: number
  buy_trigger_percent: number
  sell_quantity_percent: number
  buy_amount: number | null
  buy_quantity_multiplier: number
  is_active: number
  created_at: string
}

interface TradingSignalsProps {
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

function formatDateTime(timestamp: string | null): string {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function TradingSignals({ userId }: TradingSignalsProps): JSX.Element {
  const [signals, setSignals] = useState<StrategySignalWithDetails[]>([])
  const [strategies, setStrategies] = useState<TradingStrategy[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [executing, setExecuting] = useState<string | null>(null)
  const [tab, setTab] = useState<'pending' | 'history'>('pending')
  const [showStrategyModal, setShowStrategyModal] = useState(false)
  const [editingStrategy, setEditingStrategy] = useState<TradingStrategy | null>(null)
  const [strategyForm, setStrategyForm] = useState({
    name: '5% 그리드 전략',
    sell_trigger_percent: '5',
    buy_trigger_percent: '-5',
    sell_quantity_percent: '50',
    buy_quantity_multiplier: '1'
  })

  const loadData = useCallback(async () => {
    try {
      const [signalsData, strategiesData] = await Promise.all([
        tab === 'pending'
          ? window.api.strategy.getSignals(userId, 'PENDING')
          : window.api.strategy.getSignalHistory(userId, 50),
        window.api.strategy.getAll(userId)
      ])
      setSignals(signalsData)
      setStrategies(strategiesData)
    } catch (error) {
      console.error('Failed to load signals:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, tab])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCheckSignals = async () => {
    setChecking(true)
    try {
      const result = await window.api.strategy.checkSignals(userId)
      console.log(`Checked ${result.checked} holdings, found ${result.signals} new signals`)
      await loadData()
      if (result.signals > 0) {
        alert(`${result.signals}개의 새로운 매매 신호가 발생했습니다.`)
      } else {
        alert('현재 발생한 매매 신호가 없습니다.')
      }
    } catch (error) {
      console.error('Failed to check signals:', error)
      alert('신호 확인 중 오류가 발생했습니다.')
    } finally {
      setChecking(false)
    }
  }

  const handleExecuteSignal = async (signalId: string) => {
    if (!confirm('이 신호를 실행하시겠습니까? 거래가 자동으로 기록됩니다.')) return

    setExecuting(signalId)
    try {
      const result = await window.api.strategy.executeSignal(signalId)
      console.log('Signal executed:', result)
      await loadData()
      alert(`${result.type === 'BUY' ? '매수' : '매도'} ${result.quantity}주 @ ${formatCurrency(result.price, 'KRW')} 완료`)
    } catch (error) {
      console.error('Failed to execute signal:', error)
      alert('신호 실행 중 오류가 발생했습니다.')
    } finally {
      setExecuting(null)
    }
  }

  const handleDismissSignal = async (signalId: string) => {
    try {
      await window.api.strategy.dismissSignal(signalId)
      await loadData()
    } catch (error) {
      console.error('Failed to dismiss signal:', error)
    }
  }

  const handleCreateStrategy = async () => {
    try {
      await window.api.strategy.create({
        user_id: userId,
        name: strategyForm.name,
        sell_trigger_percent: parseFloat(strategyForm.sell_trigger_percent),
        buy_trigger_percent: parseFloat(strategyForm.buy_trigger_percent),
        sell_quantity_percent: parseFloat(strategyForm.sell_quantity_percent),
        buy_quantity_multiplier: parseFloat(strategyForm.buy_quantity_multiplier)
      })
      setShowStrategyModal(false)
      setStrategyForm({
        name: '5% 그리드 전략',
        sell_trigger_percent: '5',
        buy_trigger_percent: '-5',
        sell_quantity_percent: '50',
        buy_quantity_multiplier: '1'
      })
      await loadData()
      alert('전략이 생성되었습니다.')
    } catch (error) {
      console.error('Failed to create strategy:', error)
      alert('전략 생성 중 오류가 발생했습니다.')
    }
  }

  const handleUpdateStrategy = async () => {
    if (!editingStrategy) return
    try {
      await window.api.strategy.update(editingStrategy.id, {
        name: strategyForm.name,
        sell_trigger_percent: parseFloat(strategyForm.sell_trigger_percent),
        buy_trigger_percent: parseFloat(strategyForm.buy_trigger_percent),
        sell_quantity_percent: parseFloat(strategyForm.sell_quantity_percent),
        buy_quantity_multiplier: parseFloat(strategyForm.buy_quantity_multiplier)
      })
      setEditingStrategy(null)
      setShowStrategyModal(false)
      await loadData()
      alert('전략이 수정되었습니다.')
    } catch (error) {
      console.error('Failed to update strategy:', error)
      alert('전략 수정 중 오류가 발생했습니다.')
    }
  }

  const handleDeleteStrategy = async (strategyId: string) => {
    if (!confirm('이 전략을 삭제하시겠습니까?')) return
    try {
      await window.api.strategy.delete(strategyId)
      await loadData()
    } catch (error) {
      console.error('Failed to delete strategy:', error)
    }
  }

  const handleToggleStrategy = async (strategy: TradingStrategy) => {
    try {
      await window.api.strategy.update(strategy.id, {
        is_active: strategy.is_active ? 0 : 1
      })
      await loadData()
    } catch (error) {
      console.error('Failed to toggle strategy:', error)
    }
  }

  const openEditStrategy = (strategy: TradingStrategy) => {
    setEditingStrategy(strategy)
    setStrategyForm({
      name: strategy.name,
      sell_trigger_percent: strategy.sell_trigger_percent.toString(),
      buy_trigger_percent: strategy.buy_trigger_percent.toString(),
      sell_quantity_percent: strategy.sell_quantity_percent.toString(),
      buy_quantity_multiplier: strategy.buy_quantity_multiplier.toString()
    })
    setShowStrategyModal(true)
  }

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>
  }

  const pendingCount = signals.filter(s => s.status === 'PENDING').length

  return (
    <div className="trading-signals-page">
      <div className="page-header">
        <h1>매매 신호</h1>
        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setShowStrategyModal(true)}
          >
            전략 설정
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCheckSignals}
            disabled={checking || strategies.length === 0}
          >
            {checking ? '확인 중...' : '신호 확인'}
          </button>
        </div>
      </div>

      {/* Strategy Summary */}
      {strategies.length > 0 && (
        <div className="card mb-2">
          <div className="card-header">
            <h3 className="card-title">활성 전략</h3>
          </div>
          <div className="strategy-list">
            {strategies.map(strategy => (
              <div key={strategy.id} className="strategy-item">
                <div className="strategy-info">
                  <span className={`strategy-status ${strategy.is_active ? 'active' : 'inactive'}`}>
                    {strategy.is_active ? '활성' : '비활성'}
                  </span>
                  <strong>{strategy.name}</strong>
                  <span className="strategy-rules">
                    매도: {formatPercent(strategy.sell_trigger_percent)} 이상시 {strategy.sell_quantity_percent}% 매도 |
                    매수: {formatPercent(strategy.buy_trigger_percent)} 이하시 {strategy.buy_quantity_multiplier}배 추가매수
                  </span>
                </div>
                <div className="strategy-actions">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleToggleStrategy(strategy)}
                  >
                    {strategy.is_active ? '비활성화' : '활성화'}
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => openEditStrategy(strategy)}
                  >
                    수정
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDeleteStrategy(strategy.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {strategies.length === 0 && (
        <div className="empty-state">
          <h3>등록된 전략이 없습니다</h3>
          <p>전략을 등록하면 보유종목의 수익률에 따라 매매 신호를 받을 수 있습니다.</p>
          <button className="btn btn-primary" onClick={() => setShowStrategyModal(true)}>
            전략 등록하기
          </button>
        </div>
      )}

      {/* Tabs */}
      {strategies.length > 0 && (
        <>
          <div className="tabs">
            <button
              className={`tab ${tab === 'pending' ? 'active' : ''}`}
              onClick={() => setTab('pending')}
            >
              대기 중 신호 {pendingCount > 0 && `(${pendingCount})`}
            </button>
            <button
              className={`tab ${tab === 'history' ? 'active' : ''}`}
              onClick={() => setTab('history')}
            >
              신호 내역
            </button>
          </div>

          {/* Signals List */}
          <div className="card">
            {signals.length === 0 ? (
              <div className="empty-state">
                <p>{tab === 'pending' ? '대기 중인 신호가 없습니다.' : '신호 내역이 없습니다.'}</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>종목</th>
                      <th>계좌</th>
                      <th className="text-right">평균단가</th>
                      <th className="text-right">현재가</th>
                      <th className="text-right">수익률</th>
                      <th className="text-center">신호</th>
                      <th className="text-right">수량</th>
                      {tab === 'pending' ? (
                        <th className="text-center">액션</th>
                      ) : (
                        <>
                          <th className="text-center">상태</th>
                          <th>시간</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map(signal => (
                      <tr key={signal.id}>
                        <td>
                          <div>{signal.stock_name}</div>
                          <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                            {signal.stock_code}
                          </div>
                        </td>
                        <td>
                          <div>{BROKERAGE_LABELS[signal.brokerage] || signal.brokerage}</div>
                          <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                            {ACCOUNT_TYPE_LABELS[signal.account_type] || signal.account_type}
                          </div>
                        </td>
                        <td className="text-right">
                          {formatCurrency(signal.avg_cost, signal.currency)}
                        </td>
                        <td className="text-right">
                          {formatCurrency(signal.latest_price, signal.currency)}
                        </td>
                        <td className={`text-right ${signal.trigger_percent >= 0 ? 'text-success' : 'text-danger'}`}>
                          {formatPercent(signal.trigger_percent)}
                        </td>
                        <td className="text-center">
                          <span className={`signal-badge ${signal.signal_type.toLowerCase()}`}>
                            {signal.signal_type === 'BUY' ? '매수' : '매도'}
                          </span>
                        </td>
                        <td className="text-right">
                          {signal.suggested_quantity.toLocaleString()}주
                          <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                            (보유: {signal.current_quantity.toLocaleString()})
                          </div>
                        </td>
                        {tab === 'pending' ? (
                          <td className="text-center">
                            <div className="flex gap-1" style={{ justifyContent: 'center' }}>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleExecuteSignal(signal.id)}
                                disabled={executing === signal.id}
                              >
                                {executing === signal.id ? '처리 중...' : '실행'}
                              </button>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => handleDismissSignal(signal.id)}
                              >
                                무시
                              </button>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="text-center">
                              <span className={`status-badge ${signal.status.toLowerCase()}`}>
                                {signal.status === 'EXECUTED' ? '실행됨' : '무시됨'}
                              </span>
                            </td>
                            <td>
                              {formatDateTime(signal.executed_at || signal.dismissed_at)}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Strategy Modal */}
      {showStrategyModal && (
        <div className="modal-overlay" onClick={() => { setShowStrategyModal(false); setEditingStrategy(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingStrategy ? '전략 수정' : '새 전략'}</h2>
              <button className="modal-close" onClick={() => { setShowStrategyModal(false); setEditingStrategy(null) }}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>전략 이름</label>
                <input
                  type="text"
                  value={strategyForm.name}
                  onChange={e => setStrategyForm({ ...strategyForm, name: e.target.value })}
                  placeholder="예: 5% 그리드 전략"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>매도 조건 (%)</label>
                  <input
                    type="number"
                    value={strategyForm.sell_trigger_percent}
                    onChange={e => setStrategyForm({ ...strategyForm, sell_trigger_percent: e.target.value })}
                    step="1"
                    min="0"
                    placeholder="5"
                  />
                  <small className="text-muted">평균단가 대비 이 수익률 이상시 매도 신호</small>
                </div>
                <div className="form-group">
                  <label>매도 수량 (%)</label>
                  <input
                    type="number"
                    value={strategyForm.sell_quantity_percent}
                    onChange={e => setStrategyForm({ ...strategyForm, sell_quantity_percent: e.target.value })}
                    step="10"
                    min="10"
                    max="100"
                    placeholder="50"
                  />
                  <small className="text-muted">보유수량의 몇 % 매도</small>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>매수 조건 (%)</label>
                  <input
                    type="number"
                    value={strategyForm.buy_trigger_percent}
                    onChange={e => setStrategyForm({ ...strategyForm, buy_trigger_percent: e.target.value })}
                    step="1"
                    max="0"
                    placeholder="-5"
                  />
                  <small className="text-muted">평균단가 대비 이 손실률 이하시 매수 신호</small>
                </div>
                <div className="form-group">
                  <label>매수 배수</label>
                  <input
                    type="number"
                    value={strategyForm.buy_quantity_multiplier}
                    onChange={e => setStrategyForm({ ...strategyForm, buy_quantity_multiplier: e.target.value })}
                    step="0.5"
                    min="0.5"
                    placeholder="1"
                  />
                  <small className="text-muted">현재 보유수량의 몇 배 추가 매수</small>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowStrategyModal(false); setEditingStrategy(null) }}>
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={editingStrategy ? handleUpdateStrategy : handleCreateStrategy}
              >
                {editingStrategy ? '수정' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
