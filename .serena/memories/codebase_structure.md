# Codebase Structure

## Main Process (`src/main/`)
| File | Purpose |
|------|---------|
| `index.ts` | App entry point, window creation |
| `database.ts` | SQLite schema definition |
| `ipc-handlers.ts` | All IPC API handlers |
| `kis-api.ts` | Korea Investment Securities API |
| `excel-import.ts` | Transaction Excel/CSV parsing |
| `holdings-parser.ts` | Holdings Excel parsing |
| `brokerage-parsers.ts` | Brokerage-specific parsers |
| `market-data-api.ts` | Exchange rate & stock price API |

## Preload (`src/preload/`)
| File | Purpose |
|------|---------|
| `index.ts` | IPC bridge, API expose |
| `index.d.ts` | TypeScript type definitions |

## Renderer (`src/renderer/src/`)

### Pages
| File | Purpose |
|------|---------|
| `Dashboard.tsx` | Portfolio summary, charts |
| `Holdings.tsx` | Stock holdings list |
| `Transactions.tsx` | Transaction history |
| `Import.tsx` | Holdings Excel import |
| `Accounts.tsx` | Account management |
| `Settings.tsx` | App settings |
| `TradingSignals.tsx` | Trading signals (if any) |

### Components
| File | Purpose |
|------|---------|
| `Layout.tsx` | Navigation sidebar |
| `PortfolioCharts.tsx` | Chart visualizations |
| `DividendAnalysis.tsx` | Dividend analysis |
| `StockAutocomplete.tsx` | Stock search autocomplete |

### Entry Points
| File | Purpose |
|------|---------|
| `App.tsx` | Main app, routing, user selection |
| `main.tsx` | React DOM render |

## E2E Tests (`e2e/`)
| File | Purpose |
|------|---------|
| `app.spec.ts` | 21 E2E test cases |
| `electron-app.ts` | Test utilities |

## Configuration Files
| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | TypeScript config (references) |
| `tsconfig.node.json` | Main/preload TypeScript |
| `tsconfig.web.json` | Renderer TypeScript |
| `electron.vite.config.ts` | Vite config |
| `playwright.config.ts` | E2E test config |

## Database Schema (SQLite)
- `users` - User information
- `accounts` - Brokerage accounts
- `holdings` - Stock holdings
- `transactions` - Trade history
- `exchange_rates` - Currency rates
- `sync_logs` - Sync history
