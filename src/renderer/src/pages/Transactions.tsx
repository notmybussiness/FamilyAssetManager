import { useEffect, useState } from 'react'
import StockAutocomplete from '../components/StockAutocomplete'

interface Account {
  id: string
  brokerage: string
  account_type: string
  account_alias: string | null
}

interface TransactionWithAccount {
  id: string
  account_id: string
  stock_code: string
  stock_name: string
  type: 'BUY' | 'SELL' | 'DIVIDEND'
  quantity: number
  price: number
  total_amount: number
  currency: string
  date: string
  is_manual: number
  source: string
  brokerage: string
  account_type: string
  account_alias: string | null
}

interface TransactionsProps {
  userId: string
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

export default function Transactions({ userId }: TransactionsProps): JSX.Element {
  const [transactions, setTransactions] = useState<TransactionWithAccount[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithAccount | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    account_id: '',
    stock_code: '',
    stock_name: '',
    type: 'BUY' as 'BUY' | 'SELL' | 'DIVIDEND',
    quantity: '',
    price: '',
    currency: 'KRW',
    date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    try {
      const [txData, accountData] = await Promise.all([
        window.api.transaction.getByUser(userId, 100),
        window.api.account.getAll(userId)
      ])
      setTransactions(txData)
      setAccounts(accountData)
      if (accountData.length > 0 && !formData.account_id) {
        setFormData((prev) => ({ ...prev, account_id: accountData[0].id }))
      }
    } catch (error) {
      console.error('Failed to load transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.account_id || !formData.stock_code || !formData.quantity || !formData.price) {
      alert('필수 항목을 모두 입력해주세요')
      return
    }

    try {
      if (editingTransaction) {
        // Update existing transaction
        await window.api.transaction.update(editingTransaction.id, {
          account_id: formData.account_id,
          stock_code: formData.stock_code.toUpperCase(),
          stock_name: formData.stock_name || formData.stock_code.toUpperCase(),
          type: formData.type,
          quantity: parseFloat(formData.quantity),
          price: parseFloat(formData.price),
          currency: formData.currency,
          date: formData.date
        })
      } else {
        // Create new transaction
        await window.api.transaction.create({
          account_id: formData.account_id,
          stock_code: formData.stock_code.toUpperCase(),
          stock_name: formData.stock_name || formData.stock_code.toUpperCase(),
          type: formData.type,
          quantity: parseFloat(formData.quantity),
          price: parseFloat(formData.price),
          currency: formData.currency,
          date: formData.date,
          is_manual: true
        })
      }

      closeModal()
      loadData()
    } catch (error) {
      console.error('Failed to save transaction:', error)
      alert(editingTransaction ? '거래내역 수정에 실패했습니다' : '거래내역 추가에 실패했습니다')
    }
  }

  const handleEdit = (tx: TransactionWithAccount) => {
    setEditingTransaction(tx)
    setFormData({
      account_id: tx.account_id,
      stock_code: tx.stock_code,
      stock_name: tx.stock_name,
      type: tx.type,
      quantity: tx.quantity.toString(),
      price: tx.price.toString(),
      currency: tx.currency,
      date: tx.date
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingTransaction(null)
    setFormData({
      account_id: accounts[0]?.id || '',
      stock_code: '',
      stock_name: '',
      type: 'BUY',
      quantity: '',
      price: '',
      currency: 'KRW',
      date: new Date().toISOString().split('T')[0]
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 거래내역을 삭제하시겠습니까?')) return

    try {
      await window.api.transaction.delete(id)
      loadData()
    } catch (error) {
      console.error('Failed to delete transaction:', error)
    }
  }

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>
  }

  return (
    <div className="transactions-page">
      <div className="page-header">
        <h1>거래내역</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)} disabled={accounts.length === 0}>
          + 거래 추가
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="empty-state">
          <h3>등록된 계좌가 없습니다</h3>
          <p>거래내역을 기록하려면 먼저 계좌를 추가해주세요.</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <h3>거래내역이 없습니다</h3>
          <p>"거래 추가" 버튼을 눌러 첫 거래를 기록해보세요.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>거래일</th>
                  <th>유형</th>
                  <th>종목</th>
                  <th>계좌</th>
                  <th className="text-right">수량</th>
                  <th className="text-right">단가</th>
                  <th className="text-right">거래금액</th>
                  <th>입력방식</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.date}</td>
                    <td>
                      <span className={`badge badge-${tx.type.toLowerCase()}`}>{tx.type}</span>
                    </td>
                    <td>
                      <div>{tx.stock_name}</div>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                        {tx.stock_code}
                      </div>
                    </td>
                    <td>
                      <div>{tx.account_alias || BROKERAGE_LABELS[tx.brokerage]}</div>
                    </td>
                    <td className="text-right">{tx.quantity.toLocaleString()}</td>
                    <td className="text-right">{formatCurrency(tx.price, tx.currency)}</td>
                    <td className="text-right">{formatCurrency(tx.total_amount, tx.currency)}</td>
                    <td>
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                        {tx.source}
                      </span>
                    </td>
                    <td>
                      {(tx.source === 'MANUAL' || tx.source === 'EXCEL') && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleEdit(tx)}
                          >
                            수정
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(tx.id)}
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
          </div>
        </div>
      )}

      {/* Add/Edit Transaction Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTransaction ? '거래 수정' : '거래 추가'}</h2>
              <button className="modal-close" onClick={closeModal}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>계좌 *</label>
                <select
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  required
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_alias || BROKERAGE_LABELS[account.brokerage]} - {account.account_type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>거래유형 *</label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as 'BUY' | 'SELL' | 'DIVIDEND' })
                    }
                    required
                  >
                    <option value="BUY">매수</option>
                    <option value="SELL">매도</option>
                    <option value="DIVIDEND">배당</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>거래일 *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <StockAutocomplete
                  userId={userId}
                  value={formData.stock_code}
                  onChange={(value) => setFormData({ ...formData, stock_code: value })}
                  onSelect={(stock) => setFormData({
                    ...formData,
                    stock_code: stock.stock_code,
                    stock_name: stock.stock_name,
                    currency: stock.currency
                  })}
                  label="종목코드"
                  placeholder="종목코드 또는 종목명 검색"
                  required
                />

                <div className="form-group">
                  <label>종목명</label>
                  <input
                    type="text"
                    value={formData.stock_name}
                    onChange={(e) => setFormData({ ...formData, stock_name: e.target.value })}
                    placeholder="예: 삼성전자"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>수량 *</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="0"
                    min="0"
                    step="any"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>단가 *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0"
                    min="0"
                    step="any"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>통화</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                >
                  <option value="KRW">KRW (원화)</option>
                  <option value="USD">USD (달러)</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTransaction ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
