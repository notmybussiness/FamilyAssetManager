# Family Asset Manager - Project Overview

## Purpose
A portfolio tracking system for managing stock assets across multiple brokerage accounts. Designed for family use with multi-user support.

## Tech Stack
- **Framework**: Electron + React + TypeScript
- **Build Tool**: electron-vite
- **Database**: SQLite (better-sqlite3)
- **UI**: React 18 with react-router-dom
- **Charts**: Recharts
- **Testing**: Vitest (unit), Playwright (E2E)
- **Excel/CSV Parsing**: xlsx library

## Key Features
1. Multi-user/account management
2. KIS API integration (Korea Investment & Securities Open API)
3. Excel/CSV import (auto-detect brokerage format)
4. Real-time stock price & exchange rate lookup
5. Portfolio analysis by account type and brokerage

## Supported Brokerages
- 한국투자증권, 키움증권, 미래에셋, 삼성증권
- NH투자증권, KB증권, 토스증권, 카카오페이증권

## External APIs
- **Exchange Rate**: Frankfurter API (ECB-based, free)
- **Stock Price**: Yahoo Finance API, Naver Finance
- **KIS API**: Korea Investment & Securities Open API

## Database Location
- Production: `%AppData%/family-asset-manager/family-assets.db`

## Repository
- GitHub: https://github.com/notmybussiness/FamilyAssetManager
- Branch: master
