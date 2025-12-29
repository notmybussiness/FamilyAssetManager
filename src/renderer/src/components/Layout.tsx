import { useState } from 'react'
import { NavLink } from 'react-router-dom'

interface User {
  id: string
  name: string
  is_primary: number
}

interface LayoutProps {
  users: User[]
  currentUserId: string | null
  onUserChange: (userId: string) => void
  onUserCreated: () => void
  children: React.ReactNode
}

export default function Layout({
  users,
  currentUserId,
  onUserChange,
  onUserCreated,
  children
}: LayoutProps): JSX.Element {
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUserName, setNewUserName] = useState('')

  const currentUser = users.find((u) => u.id === currentUserId)

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserName.trim()) return

    try {
      await window.api.user.create({ name: newUserName.trim() })
      setNewUserName('')
      setShowAddUser(false)
      onUserCreated()
    } catch (error) {
      console.error('Failed to add user:', error)
      alert(error instanceof Error ? error.message : '사용자 추가에 실패했습니다')
    }
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="app-title">가족 자산 관리</h1>
        </div>

        <div className="user-selector">
          <label>사용자</label>
          <select value={currentUserId || ''} onChange={(e) => onUserChange(e.target.value)}>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} {user.is_primary ? '(대표)' : ''}
              </option>
            ))}
          </select>
          <button className="btn-link" onClick={() => setShowAddUser(!showAddUser)}>
            + 사용자 추가
          </button>

          {showAddUser && (
            <form onSubmit={handleAddUser} className="add-user-form">
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="이름 입력"
                autoFocus
              />
              <button type="submit" disabled={!newUserName.trim()}>
                추가
              </button>
            </form>
          )}
        </div>

        <nav className="nav-menu">
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-icon">📊</span>
            대시보드
          </NavLink>
          <NavLink to="/holdings" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-icon">💼</span>
            보유종목
          </NavLink>
          <NavLink to="/transactions" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-icon">📝</span>
            거래내역
          </NavLink>
          <NavLink to="/import" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-icon">📥</span>
            엑셀 가져오기
          </NavLink>
          <NavLink to="/accounts" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-icon">🏦</span>
            계좌관리
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-icon">⚙️</span>
            설정
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <p className="hint">F5 - 데이터 새로고침</p>
          <p className="user-info">{currentUser?.name}</p>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  )
}
