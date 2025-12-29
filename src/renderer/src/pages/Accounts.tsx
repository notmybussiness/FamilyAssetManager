import { useEffect, useState } from 'react'

interface Account {
  id: string
  user_id: string
  brokerage: 'KOREA_INV' | 'MIRAE' | 'SAMSUNG' | 'KIWOOM' | 'NH' | 'KB' | 'OTHER'
  account_type: 'PENSION' | 'IRP' | 'ISA' | 'OVERSEAS' | 'GENERAL'
  account_number: string
  account_alias: string | null
  api_key: string | null
  api_secret: string | null
  created_at: string
}

interface SyncLog {
  id: string
  account_id: string
  synced_at: string
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL'
  error_message: string | null
}

interface AccountsProps {
  userId: string
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

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  PENSION: '연금저축',
  IRP: 'IRP',
  ISA: 'ISA',
  OVERSEAS: '해외주식',
  GENERAL: '일반'
}

export default function Accounts({ userId }: AccountsProps): JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null)
  const [syncLogs, setSyncLogs] = useState<Record<string, SyncLog | null>>({})
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const [formData, setFormData] = useState({
    brokerage: 'KOREA_INV',
    account_type: 'ISA',
    account_number: '',
    account_alias: '',
    api_key: '',
    api_secret: ''
  })

  useEffect(() => {
    loadAccounts()
  }, [userId])

  useEffect(() => {
    // Load last sync status for KIS accounts
    const loadSyncLogs = async () => {
      for (const account of accounts) {
        if (account.brokerage === 'KOREA_INV' && account.api_key) {
          try {
            const log = await window.api.sync.getLastSync(account.id)
            setSyncLogs((prev) => ({ ...prev, [account.id]: log }))
          } catch (error) {
            console.error('Failed to load sync log:', error)
          }
        }
      }
    }
    if (accounts.length > 0) {
      loadSyncLogs()
    }
  }, [accounts])

  const loadAccounts = async () => {
    try {
      const data = await window.api.account.getAll(userId)
      setAccounts(data)
    } catch (error) {
      console.error('Failed to load accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      brokerage: 'KOREA_INV',
      account_type: 'ISA',
      account_number: '',
      account_alias: '',
      api_key: '',
      api_secret: ''
    })
    setEditingAccount(null)
    setTestResult(null)
  }

  const handleOpenModal = (account?: Account) => {
    setTestResult(null)
    if (account) {
      setEditingAccount(account)
      setFormData({
        brokerage: account.brokerage,
        account_type: account.account_type,
        account_number: account.account_number,
        account_alias: account.account_alias || '',
        api_key: account.api_key || '',
        api_secret: account.api_secret || ''
      })
    } else {
      resetForm()
    }
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.account_number) {
      alert('계좌번호를 입력해주세요')
      return
    }

    try {
      if (editingAccount) {
        await window.api.account.update(editingAccount.id, {
          account_alias: formData.account_alias || undefined,
          api_key: formData.api_key || undefined,
          api_secret: formData.api_secret || undefined
        })
      } else {
        await window.api.account.create({
          user_id: userId,
          brokerage: formData.brokerage,
          account_type: formData.account_type,
          account_number: formData.account_number,
          account_alias: formData.account_alias || undefined,
          api_key: formData.api_key || undefined,
          api_secret: formData.api_secret || undefined
        })
      }

      setShowModal(false)
      resetForm()
      loadAccounts()
    } catch (error) {
      console.error('Failed to save account:', error)
      alert('계좌 저장에 실패했습니다')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 계좌를 삭제하시겠습니까? 관련된 보유종목과 거래내역도 함께 삭제됩니다.')) {
      return
    }

    try {
      await window.api.account.delete(id)
      loadAccounts()
    } catch (error) {
      console.error('Failed to delete account:', error)
    }
  }

  const handleSync = async (accountId: string) => {
    setSyncingAccountId(accountId)
    try {
      const result = await window.api.sync.all(accountId)
      if (result.holdings.success && result.transactions.success) {
        alert(`동기화 완료!\n보유종목: ${result.holdings.synced}건 업데이트\n거래내역: ${result.transactions.synced}건 가져옴 (${result.transactions.skipped}건 중복 제외)`)
      } else {
        const errors: string[] = []
        if (!result.holdings.success) errors.push(`보유종목: ${result.holdings.error}`)
        if (!result.transactions.success) errors.push(`거래내역: ${result.transactions.error}`)
        alert(`동기화 중 오류 발생:\n${errors.join('\n')}`)
      }
      // Refresh sync logs
      const log = await window.api.sync.getLastSync(accountId)
      setSyncLogs((prev) => ({ ...prev, [accountId]: log }))
    } catch (error) {
      console.error('Sync failed:', error)
      alert('동기화 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'))
    } finally {
      setSyncingAccountId(null)
    }
  }

  const handleTestConnection = async () => {
    if (!formData.api_key || !formData.api_secret) {
      setTestResult({ success: false, message: 'API Key와 Secret을 먼저 입력해주세요' })
      return
    }

    setTestingConnection(true)
    setTestResult(null)
    try {
      const result = await window.api.sync.testConnection(formData.api_key, formData.api_secret)
      setTestResult(result)
    } catch (error) {
      setTestResult({ success: false, message: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setTestingConnection(false)
    }
  }

  const formatSyncTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)

    if (diffMins < 1) return '방금 전'
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    return date.toLocaleDateString()
  }

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>
  }

  return (
    <div className="accounts-page">
      <div className="page-header">
        <h1>계좌관리</h1>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          + 계좌 추가
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="empty-state">
          <h3>등록된 계좌가 없습니다</h3>
          <p>"계좌 추가" 버튼을 눌러 증권 계좌를 등록하세요.</p>
        </div>
      ) : (
        <div className="accounts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {accounts.map((account) => (
            <div key={account.id} className="card">
              <div className="card-header">
                <h3 className="card-title">
                  {account.account_alias || BROKERAGE_LABELS[account.brokerage]}
                </h3>
                <div className="flex gap-1">
                  <button className="btn btn-sm btn-secondary" onClick={() => handleOpenModal(account)}>
                    수정
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(account.id)}>
                    삭제
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <div className="mb-1">
                  <span className="text-muted">증권사: </span>
                  {BROKERAGE_LABELS[account.brokerage]}
                </div>
                <div className="mb-1">
                  <span className="text-muted">계좌유형: </span>
                  {ACCOUNT_TYPE_LABELS[account.account_type]}
                </div>
                <div className="mb-1">
                  <span className="text-muted">계좌번호: </span>
                  {account.account_number.replace(/(.{4})/g, '$1-').slice(0, -1)}
                </div>
                <div className="mb-1">
                  <span className="text-muted">데이터 입력: </span>
                  {account.brokerage === 'KOREA_INV' ? (
                    account.api_key ? (
                      <span className="text-success">API 연동됨</span>
                    ) : (
                      <span className="text-warning">API 미설정</span>
                    )
                  ) : (
                    <span className="text-muted">엑셀/수동 입력</span>
                  )}
                </div>
                {account.brokerage === 'KOREA_INV' && account.api_key && (
                  <>
                    <div className="mb-1">
                      <span className="text-muted">마지막 동기화: </span>
                      {syncLogs[account.id] ? (
                        <span className={syncLogs[account.id]?.status === 'SUCCESS' ? 'text-success' : 'text-warning'}>
                          {formatSyncTime(syncLogs[account.id]!.synced_at)}
                        </span>
                      ) : (
                        <span className="text-muted">없음</span>
                      )}
                    </div>
                    <div style={{ marginTop: '0.75rem' }}>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleSync(account.id)}
                        disabled={syncingAccountId === account.id}
                      >
                        {syncingAccountId === account.id ? '동기화 중...' : '동기화'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Account Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingAccount ? '계좌 수정' : '계좌 추가'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {!editingAccount && (
                <>
                  <div className="form-group">
                    <label>증권사 *</label>
                    <select
                      value={formData.brokerage}
                      onChange={(e) => setFormData({ ...formData, brokerage: e.target.value })}
                      required
                    >
                      <option value="KOREA_INV">한국투자증권 (API)</option>
                      <option value="HANWHA">한화투자증권 (엑셀/수동)</option>
                      <option value="MIRAE">미래에셋 (엑셀/수동)</option>
                      <option value="SAMSUNG">삼성증권 (엑셀/수동)</option>
                      <option value="KIWOOM">키움증권 (엑셀/수동)</option>
                      <option value="NH">NH투자증권 (엑셀/수동)</option>
                      <option value="KB">KB증권 (엑셀/수동)</option>
                      <option value="OTHER">기타 (엑셀/수동)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>계좌유형 *</label>
                    <select
                      value={formData.account_type}
                      onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                      required
                    >
                      <option value="GENERAL">일반</option>
                      <option value="PENSION">연금저축</option>
                      <option value="IRP">IRP</option>
                      <option value="ISA">ISA</option>
                      <option value="OVERSEAS">해외주식</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>계좌번호 *</label>
                    <input
                      type="text"
                      value={formData.account_number}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      placeholder="계좌번호 입력"
                      required
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>별명 (표시 이름)</label>
                <input
                  type="text"
                  value={formData.account_alias}
                  onChange={(e) => setFormData({ ...formData, account_alias: e.target.value })}
                  placeholder="예: 내 ISA 계좌"
                />
              </div>

              {formData.brokerage === 'KOREA_INV' && (
                <>
                  <div className="form-group">
                    <label>API Key</label>
                    <input
                      type="password"
                      value={formData.api_key}
                      onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                      placeholder="API Key 입력"
                    />
                  </div>

                  <div className="form-group">
                    <label>API Secret</label>
                    <input
                      type="password"
                      value={formData.api_secret}
                      onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                      placeholder="API Secret 입력"
                    />
                  </div>

                  <div className="form-group">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleTestConnection}
                      disabled={testingConnection || !formData.api_key || !formData.api_secret}
                    >
                      {testingConnection ? '테스트 중...' : '연결 테스트'}
                    </button>
                    {testResult && (
                      <span
                        style={{ marginLeft: '1rem' }}
                        className={testResult.success ? 'text-success' : 'text-danger'}
                      >
                        {testResult.message}
                      </span>
                    )}
                  </div>
                </>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAccount ? '저장' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
