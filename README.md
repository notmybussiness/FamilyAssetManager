# Family Asset Manager

가족의 여러 증권사 계좌를 통합 관리하는 포트폴리오 추적 앱

![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)

## 주요 기능

- **다중 사용자/계좌 관리** - 가족 구성원별 계좌 분리 관리
- **Excel/CSV Import** - 증권사별 형식 자동 감지 (한투, 키움, 미래에셋, 삼성, NH, KB, 토스, 카카오페이)
- **실시간 시세 조회** - 환율(USD/KRW) 및 주식 현재가 자동 업데이트
- **포트폴리오 분석** - 계좌유형별, 증권사별, 국내/해외별 분석
- **배당금 분석** - 월별 배당금 차트

## 스크린샷

| Dashboard | Holdings |
|-----------|----------|
| 포트폴리오 요약, 자산 배분 차트 | 보유종목 상세, 수익률 |

## 설치 및 실행

### 개발 환경
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

### 빌드
```bash
# Windows 빌드
npm run build:win

# 빌드 결과: dist/win-unpacked/family-asset-manager.exe
```

### 다운로드 (Releases)
[Releases](../../releases) 페이지에서 최신 버전 다운로드

## 기술 스택

- **Frontend**: React 18 + TypeScript + React Router
- **Backend**: Electron (Main Process)
- **Database**: SQLite (better-sqlite3)
- **Charts**: Recharts
- **Build**: electron-vite + electron-builder

## 프로젝트 구조

```
src/
├── main/                 # Electron Main Process
│   ├── database.ts       # SQLite 스키마
│   ├── ipc-handlers.ts   # IPC API
│   ├── market-data-api.ts # 시세 조회 (Yahoo, Naver)
│   ├── brokerage-parsers.ts # 증권사별 CSV 파서
│   └── excel-import.ts   # Excel 파싱
├── preload/              # IPC Bridge
└── renderer/             # React Frontend
    ├── pages/            # 페이지 컴포넌트
    └── components/       # 공통 컴포넌트
```

## API 출처

- **환율**: [Frankfurter API](https://frankfurter.app) (ECB 데이터)
- **주식 시세**: Yahoo Finance, Naver Finance

## 라이선스

MIT
