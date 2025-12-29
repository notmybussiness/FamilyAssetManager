import { useState, useEffect } from 'react'

interface ExchangeRate {
  currency_pair: string
  rate: number
  fetched_at: string
}

interface User {
  id: string
  name: string
  is_primary: number
}

export default function Settings(): JSX.Element {
  const [usdKrw, setUsdKrw] = useState<ExchangeRate | null>(null)
  const [manualRate, setManualRate] = useState('')
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    loadExchangeRate()
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const data = await window.api.user.getAll()
      setUsers(data)
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }

  const loadExchangeRate = async () => {
    try {
      const rate = await window.api.exchangeRate.get('USD/KRW')
      setUsdKrw(rate)
      if (rate) {
        setManualRate(rate.rate.toString())
      }
    } catch (error) {
      console.error('Failed to load exchange rate:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateRate = async () => {
    const rate = parseFloat(manualRate)
    if (isNaN(rate) || rate <= 0) {
      alert('올바른 환율을 입력해주세요')
      return
    }

    try {
      await window.api.exchangeRate.update('USD/KRW', rate)
      loadExchangeRate()
      alert('환율이 업데이트되었습니다')
    } catch (error) {
      console.error('Failed to update exchange rate:', error)
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setEditName(user.name)
  }

  const handleSaveUser = async () => {
    if (!editingUser || !editName.trim()) return

    try {
      await window.api.user.update(editingUser.id, { name: editName.trim() })
      setEditingUser(null)
      setEditName('')
      loadUsers()
      alert('사용자 이름이 변경되었습니다')
    } catch (error) {
      alert(error instanceof Error ? error.message : '사용자 수정에 실패했습니다')
    }
  }

  const handleDeleteUser = async (user: User) => {
    if (user.is_primary) {
      alert('대표 사용자는 삭제할 수 없습니다')
      return
    }

    if (!confirm(`"${user.name}" 사용자를 삭제하시겠습니까?\n해당 사용자의 모든 계좌, 보유종목, 거래내역이 함께 삭제됩니다.`)) {
      return
    }

    try {
      await window.api.user.delete(user.id)
      loadUsers()
      alert('사용자가 삭제되었습니다')
    } catch (error) {
      alert('사용자 삭제에 실패했습니다')
    }
  }

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>설정</h1>
      </div>

      {/* User Management */}
      <div className="card" style={{ maxWidth: '600px' }}>
        <div className="card-header">
          <h3 className="card-title">사용자 관리</h3>
        </div>

        <div className="mt-2">
          {users.length === 0 ? (
            <p className="text-muted">등록된 사용자가 없습니다.</p>
          ) : (
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>이름</th>
                  <th style={{ textAlign: 'center', width: '80px' }}>대표</th>
                  <th style={{ textAlign: 'right', width: '120px' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      {editingUser?.id === user.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{ width: '100%' }}
                          autoFocus
                        />
                      ) : (
                        user.name
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {user.is_primary ? '✓' : ''}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {editingUser?.id === user.id ? (
                        <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn-sm btn-primary" onClick={handleSaveUser}>
                            저장
                          </button>
                          <button className="btn btn-sm btn-secondary" onClick={() => setEditingUser(null)}>
                            취소
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => handleEditUser(user)}>
                            수정
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteUser(user)}
                            disabled={user.is_primary === 1}
                            title={user.is_primary ? '대표 사용자는 삭제할 수 없습니다' : ''}
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-muted mt-2" style={{ fontSize: '0.85rem' }}>
            * 사용자 추가는 좌측 메뉴에서 할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="card mt-2" style={{ maxWidth: '600px' }}>
        <div className="card-header">
          <h3 className="card-title">환율</h3>
        </div>

        <div className="form-group mt-2">
          <label>USD/KRW 환율</label>
          <div className="flex gap-1">
            <input
              type="number"
              value={manualRate}
              onChange={(e) => setManualRate(e.target.value)}
              placeholder="예: 1350.00"
              step="0.01"
              min="0"
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handleUpdateRate}>
              업데이트
            </button>
          </div>
          {usdKrw && (
            <p className="text-muted mt-2" style={{ fontSize: '0.85rem' }}>
              마지막 업데이트: {new Date(usdKrw.fetched_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      <div className="card mt-2" style={{ maxWidth: '600px' }}>
        <div className="card-header">
          <h3 className="card-title">단축키</h3>
        </div>

        <table className="mt-2">
          <tbody>
            <tr>
              <td><code>F5</code></td>
              <td>데이터 새로고침 / 동기화</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card mt-2" style={{ maxWidth: '600px' }}>
        <div className="card-header">
          <h3 className="card-title">정보</h3>
        </div>

        <div className="mt-2">
          <p><strong>가족 자산 관리</strong></p>
          <p className="text-muted">버전 0.1.0</p>
          <p className="text-muted mt-2">
            여러 증권 계좌를 통합 관리하고 수익률을 추적하는 데스크톱 애플리케이션입니다.
          </p>
        </div>
      </div>
    </div>
  )
}
