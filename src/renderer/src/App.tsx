import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Transactions from './pages/Transactions'
import Holdings from './pages/Holdings'
import Import from './pages/Import'
import Settings from './pages/Settings'

interface User {
  id: string
  name: string
  is_primary: number
}

function App(): JSX.Element {
  const [users, setUsers] = useState<User[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsers()

    // F5 refresh handler
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault()
        window.api.requestRefresh()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const loadUsers = async () => {
    try {
      const fetchedUsers = await window.api.user.getAll()
      setUsers(fetchedUsers)

      if (fetchedUsers.length > 0) {
        // Select primary user or first user
        const primaryUser = fetchedUsers.find((u) => u.is_primary === 1)
        setCurrentUserId(primaryUser?.id || fetchedUsers[0].id)
      }
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUserChange = (userId: string) => {
    setCurrentUserId(userId)
  }

  const handleUserCreated = async () => {
    await loadUsers()
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>로딩 중...</p>
      </div>
    )
  }

  // If no users exist, show welcome/setup screen
  if (users.length === 0) {
    return (
      <div className="welcome-screen">
        <h1>가족 자산 관리</h1>
        <p>환영합니다! 첫 번째 사용자 프로필을 설정해주세요.</p>
        <SetupForm onUserCreated={handleUserCreated} />
      </div>
    )
  }

  return (
    <Layout
      users={users}
      currentUserId={currentUserId}
      onUserChange={handleUserChange}
      onUserCreated={handleUserCreated}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard userId={currentUserId!} />} />
        <Route path="/holdings" element={<Holdings userId={currentUserId!} />} />
        <Route path="/transactions" element={<Transactions userId={currentUserId!} />} />
        <Route path="/import" element={<Import userId={currentUserId!} />} />
        <Route path="/accounts" element={<Accounts userId={currentUserId!} />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}

// Simple setup form for first user
function SetupForm({ onUserCreated }: { onUserCreated: () => void }) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      await window.api.user.create({ name: name.trim(), is_primary: true })
      onUserCreated()
    } catch (error) {
      console.error('Failed to create user:', error)
      alert(error instanceof Error ? error.message : '사용자 생성에 실패했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="setup-form">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="이름을 입력하세요"
        disabled={submitting}
        autoFocus
      />
      <button type="submit" disabled={submitting || !name.trim()}>
        {submitting ? '생성 중...' : '시작하기'}
      </button>
    </form>
  )
}

export default App
