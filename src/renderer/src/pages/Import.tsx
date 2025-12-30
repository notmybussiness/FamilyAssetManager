import { useEffect, useState } from 'react'

interface Account {
  id: string
  brokerage: string
  account_type: string
  account_number: string
  account_alias: string | null
}

interface ParsedHolding {
  stockCode: string
  stockName: string
  quantity: number
  avgPrice: number
  currentPrice: number
  purchaseAmount: number
  evalAmount: number
  profitLoss: number
  returnRate: number
  currency: string
  market?: string
  isValid: boolean
  errors: string[]
}

interface ParsedFile {
  filePath: string
  fileName: string
  parseResult: {
    holdings: ParsedHolding[]
    totalRows: number
    validRows: number
    invalidRows: number
    detectedBrokerage: string
    errors: string[]
    success: boolean
  } | null
  matchedAccountId: string
  status: 'pending' | 'importing' | 'success' | 'error'
  importResult?: {
    success: boolean
    imported: number
    updated?: number
    error?: string
  }
}

interface ImportProps {
  userId: string
}

// 증권사 코드 → 표시명
const BROKERAGE_LABELS: Record<string, string> = {
  KOREA_INV: '한국투자',
  HANWHA: '한화투자',
  MIRAE: '미래에셋',
  SAMSUNG: '삼성증권',
  KIWOOM: '키움증권',
  NH: 'NH투자',
  KB: 'KB증권',
  TOSS: '토스증권',
  KAKAO: '카카오페이',
  OTHER: '기타'
}

// 감지된 증권사명 → 코드 매핑 (증권사별 파서에서 감지된 이름)
const DETECTED_TO_CODE: Record<string, string> = {
  '한국투자증권': 'KOREA_INV',
  '한투': 'KOREA_INV',
  '한화투자증권': 'HANWHA',
  '한화': 'HANWHA',
  '미래에셋': 'MIRAE',
  '미래에셋증권': 'MIRAE',
  '삼성증권': 'SAMSUNG',
  '삼성': 'SAMSUNG',
  '키움증권': 'KIWOOM',
  '키움': 'KIWOOM',
  'NH투자증권': 'NH',
  'NH': 'NH',
  'KB증권': 'KB',
  'KB': 'KB',
  '토스증권': 'TOSS',
  '토스': 'TOSS',
  '카카오페이증권': 'KAKAO',
  '카카오페이': 'KAKAO'
}

export default function Import({ userId }: ImportProps): JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [supportedBrokerages, setSupportedBrokerages] = useState<Array<{ value: string; label: string }>>([])

  // 다중 파일 상태
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([])
  const [overwriteMode, setOverwriteMode] = useState(true) // 기본: 덮어쓰기 모드

  useEffect(() => {
    loadAccounts()
    loadSupportedBrokerages()
  }, [userId])

  const loadAccounts = async () => {
    try {
      console.log('Loading accounts for user:', userId)
      const data = await window.api.account.getAll(userId)
      console.log('Loaded accounts:', data)
      setAccounts(data || [])
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

  // 파일명 + 증권사로 계좌 자동 매칭
  const findMatchingAccount = (fileName: string, detectedBrokerage: string | undefined): string => {
    if (accounts.length === 0) return ''

    // 파일명에서 확장자 제거
    const nameWithoutExt = fileName.replace(/\.(xlsx|xls|csv)$/i, '')

    // 1. 파일명에 계좌번호가 포함되어 있는지 확인
    for (const acc of accounts) {
      if (acc.account_number && nameWithoutExt.includes(acc.account_number)) {
        return acc.id
      }
    }

    // 2. 파일명에 계좌 별명(alias)이 포함되어 있는지 확인
    for (const acc of accounts) {
      if (acc.account_alias && nameWithoutExt.includes(acc.account_alias)) {
        return acc.id
      }
    }

    // 3. 파일명에 계좌 유형이 포함되어 있는지 확인 (ISA, IRP 등)
    const accountTypes = ['ISA', 'IRP', 'PENSION', '연금', '해외']
    for (const acc of accounts) {
      // 파일명에서 계좌 유형 찾기
      for (const type of accountTypes) {
        if (nameWithoutExt.toUpperCase().includes(type.toUpperCase())) {
          // 해당 유형의 계좌 중 증권사도 일치하는지 확인
          const brokerageCode = detectedBrokerage ? DETECTED_TO_CODE[detectedBrokerage] : ''
          if (acc.account_type.toUpperCase().includes(type.toUpperCase()) ||
              (type === '연금' && acc.account_type === 'PENSION') ||
              (type === '해외' && acc.account_type === 'OVERSEAS')) {
            // 증권사도 일치하면 더 정확한 매칭
            if (brokerageCode && acc.brokerage === brokerageCode) {
              return acc.id
            }
          }
        }
      }
    }

    // 4. 파일명에 증권사명이 포함되어 있는지 확인
    const brokerageKeywords: Record<string, string> = {
      '한국투자': 'KOREA_INV', '한투': 'KOREA_INV',
      '한화': 'HANWHA',
      '미래에셋': 'MIRAE', '미래': 'MIRAE',
      '삼성': 'SAMSUNG',
      '키움': 'KIWOOM',
      'NH': 'NH',
      'KB': 'KB',
      '토스': 'TOSS',
      '카카오': 'KAKAO'
    }

    for (const [keyword, code] of Object.entries(brokerageKeywords)) {
      if (nameWithoutExt.includes(keyword)) {
        const matchedAccount = accounts.find(acc => acc.brokerage === code)
        if (matchedAccount) return matchedAccount.id
      }
    }

    // 5. 감지된 증권사로 매칭 (fallback)
    if (detectedBrokerage) {
      const brokerageCode = DETECTED_TO_CODE[detectedBrokerage] || ''
      const matchedAccount = accounts.find(acc => acc.brokerage === brokerageCode)
      if (matchedAccount) return matchedAccount.id
    }

    // 6. 첫 번째 계좌 반환 (최후의 fallback)
    return accounts[0].id
  }

  // 여러 파일 선택 및 파싱
  const handleSelectFiles = async () => {
    try {
      console.log('Selecting files...')
      const result = await window.api.import.selectMultipleFiles()
      console.log('File selection result:', result)

      if (!result.success || !result.filePaths || result.filePaths.length === 0) {
        console.log('No files selected or canceled')
        return
      }

      const newFiles: ParsedFile[] = []

      for (const filePath of result.filePaths) {
        const fileName = filePath.split(/[/\\]/).pop() || filePath
        console.log(`Parsing file: ${fileName}`)

        try {
          const parseResult = await window.api.import.parseHoldings(filePath)
          console.log(`Parse result for ${fileName}:`, parseResult)

          // 파일명 + 감지된 증권사로 계좌 매칭
          const matchedAccountId = findMatchingAccount(fileName, parseResult?.detectedBrokerage)
          console.log(`Matched account for ${fileName}: ${matchedAccountId}`)

          // parseResult 항상 저장 (에러 메시지 표시용)
          newFiles.push({
            filePath,
            fileName,
            parseResult: parseResult || null,
            matchedAccountId: matchedAccountId || (accounts.length > 0 ? accounts[0].id : ''),
            status: 'pending'
          })
        } catch (parseError) {
          console.error(`Failed to parse ${fileName}:`, parseError)
          newFiles.push({
            filePath,
            fileName,
            parseResult: {
              holdings: [],
              totalRows: 0,
              validRows: 0,
              invalidRows: 0,
              errors: [parseError instanceof Error ? parseError.message : 'Unknown parse error'],
              success: false
            } as any,
            matchedAccountId: accounts.length > 0 ? accounts[0].id : '',
            status: 'pending'
          })
        }
      }

      console.log('New files to add:', newFiles)
      setParsedFiles(prev => [...prev, ...newFiles])
    } catch (error) {
      console.error('Failed to select/parse files:', error)
      alert('파일 선택 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  // 파일별 계좌 변경
  const handleAccountChange = (index: number, accountId: string) => {
    setParsedFiles(prev => prev.map((file, i) =>
      i === index ? { ...file, matchedAccountId: accountId } : file
    ))
  }

  // 파일 제거
  const handleRemoveFile = (index: number) => {
    setParsedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // 전체 가져오기 실행
  const handleImportAll = async () => {
    if (parsedFiles.length === 0) return

    // 유효한 파일만 필터링 (계좌 선택됨 + 유효한 보유종목 있음)
    const validFiles = parsedFiles.filter(f =>
      f.matchedAccountId &&
      f.parseResult &&
      f.parseResult.holdings &&
      f.parseResult.holdings.length > 0
    )

    if (validFiles.length === 0) {
      alert('가져올 유효한 보유종목가 없습니다.')
      return
    }

    console.log(`Valid files to import: ${validFiles.length}`)

    // 덮어쓰기 확인
    if (overwriteMode) {
      const accountIds = [...new Set(validFiles.map(f => f.matchedAccountId))]
      const accountNames = accountIds.map(id => {
        const acc = accounts.find(a => a.id === id)
        return acc?.account_alias || BROKERAGE_LABELS[acc?.brokerage || ''] || '알 수 없음'
      }).join(', ')

      const confirmed = window.confirm(
        `덮어쓰기 모드가 활성화되어 있습니다.\n\n` +
        `다음 계좌의 기존 보유종목이 삭제됩니다:\n${accountNames}\n\n` +
        `계속하시겠습니까?`
      )
      if (!confirmed) return
    }

    setImporting(true)

    // 계좌별로 파일 그룹화 (같은 계좌에 여러 파일이 있으면 마지막 파일만 덮어쓰기)
    const accountFileMap = new Map<string, ParsedFile[]>()
    for (const file of validFiles) {
      const existing = accountFileMap.get(file.matchedAccountId) || []
      existing.push(file)
      accountFileMap.set(file.matchedAccountId, existing)
    }

    // 각 파일 가져오기 실행
    for (let i = 0; i < parsedFiles.length; i++) {
      const file = parsedFiles[i]

      // 유효하지 않은 파일은 스킵
      if (!file.matchedAccountId) {
        console.log(`Skipping file ${file.fileName}: no account selected`)
        setParsedFiles(prev => prev.map((f, idx) =>
          idx === i ? {
            ...f,
            status: 'error',
            importResult: {
              success: false,
              imported: 0,
              skipped: 0,
              error: '계좌를 선택해주세요'
            }
          } : f
        ))
        continue
      }

      if (!file.parseResult || !file.parseResult.holdings || file.parseResult.holdings.length === 0) {
        console.log(`Skipping file ${file.fileName}: no valid holdings`)
        continue
      }

      // 상태 업데이트: importing
      setParsedFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'importing' } : f
      ))

      try {
        // 같은 계좌의 첫 번째 파일일 때만 덮어쓰기 (이후 파일은 추가)
        const filesForAccount = accountFileMap.get(file.matchedAccountId) || []
        const isFirstForAccount = filesForAccount[0] === file
        const shouldOverwrite = overwriteMode && isFirstForAccount

        console.log(`Importing ${file.fileName} to account ${file.matchedAccountId}, overwrite: ${shouldOverwrite}`)

        const result = shouldOverwrite
          ? await window.api.import.replaceHoldings(file.matchedAccountId, file.parseResult.holdings)
          : await window.api.import.saveHoldings(file.matchedAccountId, file.parseResult.holdings)

        console.log(`Import result for ${file.fileName}:`, result)

        setParsedFiles(prev => prev.map((f, idx) =>
          idx === i ? {
            ...f,
            status: result.success ? 'success' : 'error',
            importResult: result
          } : f
        ))
      } catch (error) {
        console.error(`Import failed for ${file.fileName}:`, error)
        setParsedFiles(prev => prev.map((f, idx) =>
          idx === i ? {
            ...f,
            status: 'error',
            importResult: {
              success: false,
              imported: 0,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          } : f
        ))
      }
    }

    setImporting(false)
  }

  // 완료된 파일 정리
  const handleClearCompleted = () => {
    setParsedFiles(prev => prev.filter(f => f.status !== 'success'))
  }

  // 전체 통계
  const totalFiles = parsedFiles.length
  const totalValidRows = parsedFiles.reduce((sum, f) => sum + (f.parseResult?.validRows || 0), 0)
  const successFiles = parsedFiles.filter(f => f.status === 'success').length
  const errorFiles = parsedFiles.filter(f => f.status === 'error').length

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
        <h1>보유종목 가져오기</h1>
        <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
          템플릿 다운로드
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="empty-state">
          <h3>등록된 계좌가 없습니다</h3>
          <p>보유종목을 가져오려면 먼저 계좌를 추가해주세요.</p>
        </div>
      ) : (
        <>
          {/* 파일 선택 */}
          <div className="card mb-2">
            <h3 className="card-title">1단계: 파일 선택</h3>
            <div className="mt-2">
              <button className="btn btn-primary" onClick={handleSelectFiles}>
                엑셀 파일 선택 (여러 개 가능)
              </button>
              <p className="text-muted mt-2" style={{ fontSize: '0.85rem' }}>
                여러 파일을 한번에 선택하면 증권사를 자동 감지하여 계좌에 매칭합니다.
              </p>
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
            </div>
          </div>

          {/* 파일 목록 */}
          {parsedFiles.length > 0 && (
            <div className="card mb-2">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title">2단계: 파일 확인 및 계좌 매칭</h3>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                    {totalFiles}개 파일 / {totalValidRows}종목
                  </span>
                  {successFiles > 0 && (
                    <button className="btn btn-secondary" onClick={handleClearCompleted} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                      완료 항목 정리
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2">
                {parsedFiles.map((file, index) => (
                  <div
                    key={file.filePath}
                    style={{
                      padding: '1rem',
                      marginBottom: '0.5rem',
                      background: file.status === 'success' ? 'rgba(34, 197, 94, 0.1)' :
                                 file.status === 'error' ? 'rgba(239, 68, 68, 0.1)' :
                                 file.status === 'importing' ? 'rgba(59, 130, 246, 0.1)' :
                                 'var(--bg-secondary)',
                      borderRadius: '8px',
                      border: file.status === 'success' ? '1px solid rgba(34, 197, 94, 0.3)' :
                              file.status === 'error' ? '1px solid rgba(239, 68, 68, 0.3)' :
                              '1px solid transparent'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <strong>{file.fileName}</strong>
                          {file.parseResult?.detectedBrokerage && (
                            <span
                              style={{
                                background: 'var(--primary)',
                                color: 'white',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem'
                              }}
                            >
                              {file.parseResult.detectedBrokerage}
                            </span>
                          )}
                          {file.status === 'importing' && (
                            <span style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>
                              가져오는 중...
                            </span>
                          )}
                          {file.status === 'success' && (
                            <span className="text-success" style={{ fontSize: '0.85rem' }}>
                              완료 ({file.importResult?.imported}건)
                            </span>
                          )}
                          {file.status === 'error' && (
                            <span className="text-danger" style={{ fontSize: '0.85rem' }}>
                              실패: {file.importResult?.error}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                            {file.parseResult?.validRows || 0}건 유효
                            {(file.parseResult?.invalidRows || 0) > 0 && (
                              <span className="text-danger"> / {file.parseResult?.invalidRows}건 오류</span>
                            )}
                          </span>
                          {file.parseResult?.errors && file.parseResult.errors.length > 0 && (
                            <span className="text-danger" style={{ fontSize: '0.8rem' }}>
                              {file.parseResult.errors[0]}
                            </span>
                          )}

                          {file.status === 'pending' && (
                            <select
                              value={file.matchedAccountId}
                              onChange={(e) => handleAccountChange(index, e.target.value)}
                              style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem' }}
                            >
                              {!file.matchedAccountId && (
                                <option value="">계좌 선택...</option>
                              )}
                              {accounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.account_alias || BROKERAGE_LABELS[account.brokerage]} - {account.account_type}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>

                      {file.status === 'pending' && (
                        <button
                          onClick={() => handleRemoveFile(index)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            fontSize: '1.2rem'
                          }}
                          title="제거"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 가져오기 실행 */}
          {parsedFiles.length > 0 && parsedFiles.some(f => f.status === 'pending' && (f.parseResult?.validRows || 0) > 0) && (
            <div className="card">
              <h3 className="card-title">3단계: 가져오기</h3>
              <div className="mt-2">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={overwriteMode}
                    onChange={(e) => setOverwriteMode(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>덮어쓰기 (같은 계좌의 기존 데이터 삭제 후 새로 가져오기)</span>
                </label>
                {overwriteMode && (
                  <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    같은 계좌에 여러 파일이 매칭된 경우, 첫 번째 파일에서 기존 보유종목을 삭제하고 이후 파일은 추가됩니다.
                  </p>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handleImportAll}
                  disabled={importing}
                >
                  {importing ? '가져오는 중...' : `${totalValidRows}종목 가져오기`}
                </button>

                {successFiles > 0 && errorFiles === 0 && parsedFiles.every(f => f.status !== 'pending') && (
                  <div
                    className="mt-2"
                    style={{
                      padding: '1rem',
                      borderRadius: '8px',
                      background: 'rgba(34, 197, 94, 0.2)'
                    }}
                  >
                    <p className="text-success">
                      모든 파일을 성공적으로 가져왔습니다!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 결과 요약 */}
          {parsedFiles.length > 0 && parsedFiles.every(f => f.status !== 'pending' && f.status !== 'importing') && (
            <div className="card mt-2">
              <h3 className="card-title">결과 요약</h3>
              <div className="mt-2">
                <p>
                  <span className="text-success">{successFiles}개 성공</span>
                  {errorFiles > 0 && <span className="text-danger"> / {errorFiles}개 실패</span>}
                </p>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  총 {parsedFiles.reduce((sum, f) => sum + (f.importResult?.imported || 0), 0)}종목 가져옴
                </p>
                <button
                  className="btn btn-secondary mt-2"
                  onClick={() => setParsedFiles([])}
                >
                  새로 시작
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
