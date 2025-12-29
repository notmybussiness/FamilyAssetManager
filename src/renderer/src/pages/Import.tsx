import { useEffect, useState } from 'react'

interface Account {
  id: string
  brokerage: string
  account_type: string
  account_alias: string | null
}

interface ImportRow {
  date: string
  stockCode: string
  stockName: string
  type: 'BUY' | 'SELL' | 'DIVIDEND'
  quantity: number
  price: number
  currency: string
  isValid: boolean
  errors: string[]
}

interface ImportProps {
  userId: string
}

const BROKERAGE_LABELS: Record<string, string> = {
  KOREA_INV: '한국투자',
  MIRAE: '미래에셋',
  SAMSUNG: '삼성증권',
  KIWOOM: '키움증권',
  NH: 'NH투자',
  KB: 'KB증권',
  TOSS: '토스증권',
  KAKAO: '카카오페이',
  OTHER: '기타'
}

function formatCurrency(value: number, currency: string = 'KRW'): string {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  }
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value)
}

export default function Import({ userId }: ImportProps): JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [supportedBrokerages, setSupportedBrokerages] = useState<Array<{ value: string; label: string }>>([])

  // Import state
  const [filePath, setFilePath] = useState<string | null>(null)
  const [parseResult, setParseResult] = useState<{
    rows: ImportRow[]
    totalRows: number
    validRows: number
    invalidRows: number
    errors: string[]
    detectedBrokerage?: string
  } | null>(null)
  const [importResult, setImportResult] = useState<{
    success: boolean
    imported: number
    skipped: number
    error?: string
  } | null>(null)

  useEffect(() => {
    loadAccounts()
    loadSupportedBrokerages()
  }, [userId])

  const loadAccounts = async () => {
    try {
      const data = await window.api.account.getAll(userId)
      setAccounts(data)
      if (data.length > 0) {
        setSelectedAccountId(data[0].id)
      }
    } catch (error) {
      console.error('Failed to load accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSupportedBrokerages = async () => {
    try {
      const list = await window.api.import.getBrokerageList()
      setSupportedBrokerages(list.filter(b => b.value !== 'AUTO'))
    } catch (error) {
      console.error('Failed to load brokerage list:', error)
    }
  }

  const handleSelectFile = async () => {
    const result = await window.api.import.selectFile()
    if (result.success && result.filePath) {
      setFilePath(result.filePath)
      setParseResult(null)
      setImportResult(null)

      // Parse the file
      const parsed = await window.api.import.parseFile(result.filePath)
      setParseResult(parsed)
    }
  }

  const handleImport = async () => {
    if (!selectedAccountId || !parseResult?.rows) return

    setImporting(true)
    try {
      const result = await window.api.import.execute(selectedAccountId, parseResult.rows)
      setImportResult(result)

      if (result.success) {
        // Clear the form after successful import
        setTimeout(() => {
          setFilePath(null)
          setParseResult(null)
        }, 3000)
      }
    } catch (error) {
      setImportResult({
        success: false,
        imported: 0,
        skipped: parseResult.rows.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setImporting(false)
    }
  }

  const handleDownloadTemplate = async () => {
    const template = await window.api.import.getTemplate()
    const csvContent = [
      template.columns.join(','),
      ...template.sampleData.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>
  }

  return (
    <div className="import-page">
      <div className="page-header">
        <h1>엑셀 가져오기</h1>
        <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
          템플릿 다운로드
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="empty-state">
          <h3>등록된 계좌가 없습니다</h3>
          <p>거래내역을 가져오려면 먼저 계좌를 추가해주세요.</p>
        </div>
      ) : (
        <>
          {/* Step 1: Select Account */}
          <div className="card mb-2">
            <h3 className="card-title">1단계: 계좌 선택</h3>
            <div className="form-group mt-2">
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.account_alias || BROKERAGE_LABELS[account.brokerage]} - {account.account_type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 2: Select File */}
          <div className="card mb-2">
            <h3 className="card-title">2단계: 파일 선택</h3>
            <div className="mt-2">
              <button className="btn btn-primary" onClick={handleSelectFile}>
                엑셀 파일 선택 (CSV, XLSX, XLS)
              </button>
              {filePath && (
                <p className="text-muted mt-2" style={{ fontSize: '0.85rem' }}>
                  선택된 파일: {filePath.split(/[/\\]/).pop()}
                </p>
              )}
            </div>

            <div className="mt-2" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <p><strong>지원하는 증권사:</strong></p>
              <p style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                {supportedBrokerages.map(b => (
                  <span
                    key={b.value}
                    style={{
                      background: 'var(--bg-secondary)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}
                  >
                    {b.label}
                  </span>
                ))}
              </p>
              <p className="mt-2"><strong>지원하는 컬럼:</strong></p>
              <p>거래일자, 종목코드, 종목명, 거래유형(매수/매도/배당), 수량, 단가, 통화</p>
            </div>
          </div>

          {/* Step 3: Preview */}
          {parseResult && (
            <div className="card mb-2">
              <div className="card-header">
                <h3 className="card-title">3단계: 미리보기</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {parseResult.detectedBrokerage && (
                    <span
                      style={{
                        background: 'var(--primary)',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}
                    >
                      {parseResult.detectedBrokerage} 형식 감지됨
                    </span>
                  )}
                  <span className="text-success">{parseResult.validRows}건 유효</span>
                  {parseResult.invalidRows > 0 && (
                    <span className="text-danger">
                      {parseResult.invalidRows}건 오류
                    </span>
                  )}
                </div>
              </div>

              {parseResult.errors.length > 0 && (
                <div className="mt-2" style={{ background: 'var(--danger)', padding: '0.75rem', borderRadius: '8px', opacity: 0.9 }}>
                  {parseResult.errors.map((err, i) => (
                    <p key={i} style={{ margin: 0, fontSize: '0.85rem' }}>{err}</p>
                  ))}
                </div>
              )}

              {parseResult.rows.length > 0 && (
                <div className="table-container mt-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>상태</th>
                        <th>거래일</th>
                        <th>유형</th>
                        <th>종목</th>
                        <th className="text-right">수량</th>
                        <th className="text-right">단가</th>
                        <th className="text-right">금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.rows.slice(0, 50).map((row, i) => (
                        <tr key={i} style={{ opacity: row.isValid ? 1 : 0.5 }}>
                          <td>
                            {row.isValid ? (
                              <span className="text-success">정상</span>
                            ) : (
                              <span className="text-danger" title={row.errors.join(', ')}>
                                오류
                              </span>
                            )}
                          </td>
                          <td>{row.date}</td>
                          <td>
                            <span className={`badge badge-${row.type.toLowerCase()}`}>
                              {row.type}
                            </span>
                          </td>
                          <td>
                            <div>{row.stockName}</div>
                            <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                              {row.stockCode}
                            </div>
                          </td>
                          <td className="text-right">{row.quantity.toLocaleString()}</td>
                          <td className="text-right">{formatCurrency(row.price, row.currency)}</td>
                          <td className="text-right">
                            {formatCurrency(row.quantity * row.price, row.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parseResult.rows.length > 50 && (
                    <p className="text-muted text-center mt-2">
                      처음 50개만 표시 (전체 {parseResult.rows.length}건)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Import */}
          {parseResult && parseResult.validRows > 0 && (
            <div className="card">
              <h3 className="card-title">4단계: 가져오기</h3>
              <div className="mt-2">
                <button
                  className="btn btn-primary"
                  onClick={handleImport}
                  disabled={importing || !selectedAccountId}
                >
                  {importing ? '가져오는 중...' : `${parseResult.validRows}건 가져오기`}
                </button>

                {importResult && (
                  <div
                    className="mt-2"
                    style={{
                      padding: '1rem',
                      borderRadius: '8px',
                      background: importResult.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'
                    }}
                  >
                    {importResult.success ? (
                      <p className="text-success">
                        {importResult.imported}건의 거래내역을 가져왔습니다.
                        {importResult.skipped > 0 && ` (${importResult.skipped}건 중복으로 제외)`}
                      </p>
                    ) : (
                      <p className="text-danger">
                        가져오기 실패: {importResult.error}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
