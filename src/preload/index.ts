import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // User APIs
  user: {
    getAll: () => ipcRenderer.invoke('user:getAll'),
    create: (data: { name: string; is_primary?: boolean }) => ipcRenderer.invoke('user:create', data),
    update: (id: string, data: { name: string }) => ipcRenderer.invoke('user:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('user:delete', id)
  },

  // Account APIs
  account: {
    getAll: (userId?: string) => ipcRenderer.invoke('account:getAll', userId),
    create: (data: {
      user_id: string
      brokerage: string
      account_type: string
      account_number: string
      account_alias?: string
      api_key?: string
      api_secret?: string
    }) => ipcRenderer.invoke('account:create', data),
    update: (id: string, data: { account_alias?: string; api_key?: string; api_secret?: string }) =>
      ipcRenderer.invoke('account:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('account:delete', id)
  },

  // Stock Search API (자동완성용)
  stock: {
    search: (userId: string, query: string) => ipcRenderer.invoke('stock:search', userId, query)
  },

  // Holding APIs
  holding: {
    getByAccount: (accountId: string) => ipcRenderer.invoke('holding:getByAccount', accountId),
    getByUser: (userId: string) => ipcRenderer.invoke('holding:getByUser', userId),
    getByUserWithChange: (userId: string) => ipcRenderer.invoke('holding:getByUserWithChange', userId),
    getAggregated: (userId: string) => ipcRenderer.invoke('holding:getAggregated', userId),
    getAllAggregated: () => ipcRenderer.invoke('holding:getAllAggregated'),
    upsert: (data: {
      account_id: string
      stock_code: string
      stock_name: string
      quantity: number
      avg_cost: number
      current_price: number
      currency?: string
    }) => ipcRenderer.invoke('holding:upsert', data)
  },

  // Transaction APIs
  transaction: {
    getByAccount: (accountId: string, limit?: number) =>
      ipcRenderer.invoke('transaction:getByAccount', accountId, limit),
    getByUser: (userId: string, limit?: number) =>
      ipcRenderer.invoke('transaction:getByUser', userId, limit),
    create: (data: {
      account_id: string
      stock_code: string
      stock_name: string
      type: 'BUY' | 'SELL' | 'DIVIDEND'
      quantity: number
      price: number
      currency?: string
      date: string
      is_manual?: boolean
    }) => ipcRenderer.invoke('transaction:create', data),
    delete: (id: string) => ipcRenderer.invoke('transaction:delete', id),
    update: (id: string, data: { account_id: string; stock_code: string; stock_name: string; type: 'BUY' | 'SELL' | 'DIVIDEND'; quantity: number; price: number; currency: string; date: string }) => ipcRenderer.invoke('transaction:update', id, data)
  },

  // Portfolio APIs
  portfolio: {
    getSummary: (userId: string) => ipcRenderer.invoke('portfolio:getSummary', userId),
    getReturns: (userId: string) => ipcRenderer.invoke('portfolio:getReturns', userId)
  },

  // Exchange Rate APIs
  exchangeRate: {
    get: (currencyPair: string) => ipcRenderer.invoke('exchangeRate:get', currencyPair),
    update: (currencyPair: string, rate: number) =>
      ipcRenderer.invoke('exchangeRate:update', currencyPair, rate)
  },

  // Sync trigger
  onTriggerSync: (callback: () => void) => {
    ipcRenderer.on('trigger-sync', callback)
    return () => ipcRenderer.removeListener('trigger-sync', callback)
  },

  // Request refresh (F5)
  requestRefresh: () => ipcRenderer.send('refresh-data'),

  // Excel Import APIs
  import: {
    selectFile: () => ipcRenderer.invoke('import:selectFile'),
    selectMultipleFiles: () => ipcRenderer.invoke('import:selectMultipleFiles'),
    parseFile: (filePath: string) => ipcRenderer.invoke('import:parseFile', filePath),
    execute: (accountId: string, rows: Array<{
      date: string
      stockCode: string
      stockName: string
      type: 'BUY' | 'SELL' | 'DIVIDEND'
      quantity: number
      price: number
      currency: string
      isValid: boolean
      errors: string[]
    }>, overwrite?: boolean) => ipcRenderer.invoke('import:execute', accountId, rows, overwrite),
    getTemplate: () => ipcRenderer.invoke('import:getTemplate'),
    getBrokerageList: () => ipcRenderer.invoke('import:getBrokerageList'),
    parseHoldings: (filePath: string) => ipcRenderer.invoke('import:parseHoldings', filePath),
    saveHoldings: (accountId: string, holdings: any[]) => ipcRenderer.invoke('import:saveHoldings', accountId, holdings),
    replaceHoldings: (accountId: string, holdings: any[]) => ipcRenderer.invoke('import:replaceHoldings', accountId, holdings)
  },

  // KIS API Sync APIs
  sync: {
    testConnection: (appKey: string, appSecret: string) =>
      ipcRenderer.invoke('sync:testConnection', appKey, appSecret),
    holdings: (accountId: string) => ipcRenderer.invoke('sync:holdings', accountId),
    transactions: (accountId: string, startDate?: string, endDate?: string) =>
      ipcRenderer.invoke('sync:transactions', accountId, startDate, endDate),
    all: (accountId: string) => ipcRenderer.invoke('sync:all', accountId),
    getLogs: (accountId: string, limit?: number) =>
      ipcRenderer.invoke('sync:getLogs', accountId, limit),
    getLastSync: (accountId: string) => ipcRenderer.invoke('sync:getLastSync', accountId)
  },

  // Seed Data API
  seed: {
    importDemoData: () => ipcRenderer.invoke('seed:importDemoData')
  },

  // Market Data APIs (실시간 환율/현재가)
  marketData: {
    getExchangeRate: (from: string, to: string, forceRefresh?: boolean) =>
      ipcRenderer.invoke('marketData:getExchangeRate', from, to, forceRefresh),
    getStockPrice: (stockCode: string) =>
      ipcRenderer.invoke('marketData:getStockPrice', stockCode),
    updateStockPrice: (stockCode: string) =>
      ipcRenderer.invoke('marketData:updateStockPrice', stockCode),
    refreshAll: (userId: string) =>
      ipcRenderer.invoke('marketData:refreshAll', userId),
    clearCache: () => ipcRenderer.invoke('marketData:clearCache')
  },

  // Dividend Analysis APIs
  dividend: {
    getMonthlyStats: (userId: string, year: number) =>
      ipcRenderer.invoke('dividend:getMonthlyStats', userId, year),
    getByStock: (userId: string) =>
      ipcRenderer.invoke('dividend:getByStock', userId),
    getYearlyStats: (userId: string) =>
      ipcRenderer.invoke('dividend:getYearlyStats', userId)
  },

  // Ticker Mapping APIs
  tickerMapping: {
    getAll: () => ipcRenderer.invoke('tickerMapping:getAll'),
    create: (data: { stock_name: string; ticker: string; market: string }) =>
      ipcRenderer.invoke('tickerMapping:create', data),
    update: (id: string, data: { ticker: string; market: string }) =>
      ipcRenderer.invoke('tickerMapping:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('tickerMapping:delete', id),
    getFailedStocks: (userId: string) =>
      ipcRenderer.invoke('tickerMapping:getFailedStocks', userId)
  },

  // Trading Strategy APIs (5% 그리드 전략)
  strategy: {
    getAll: (userId: string) =>
      ipcRenderer.invoke('strategy:getAll', userId),
    getActive: (userId: string) =>
      ipcRenderer.invoke('strategy:getActive', userId),
    create: (data: {
      user_id: string
      name: string
      stock_code?: string
      sell_trigger_percent?: number
      buy_trigger_percent?: number
      sell_quantity_percent?: number
      buy_amount?: number
      buy_quantity_multiplier?: number
    }) => ipcRenderer.invoke('strategy:create', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('strategy:update', id, data),
    delete: (id: string) =>
      ipcRenderer.invoke('strategy:delete', id),
    checkSignals: (userId: string) =>
      ipcRenderer.invoke('strategy:checkSignals', userId),
    getSignals: (userId: string, status?: 'PENDING' | 'EXECUTED' | 'DISMISSED') =>
      ipcRenderer.invoke('strategy:getSignals', userId, status),
    executeSignal: (signalId: string) =>
      ipcRenderer.invoke('strategy:executeSignal', signalId),
    dismissSignal: (signalId: string) =>
      ipcRenderer.invoke('strategy:dismissSignal', signalId),
    getSignalHistory: (userId: string, limit?: number) =>
      ipcRenderer.invoke('strategy:getSignalHistory', userId, limit)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
