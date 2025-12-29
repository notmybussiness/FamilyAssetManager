import { useState, useEffect, useRef } from 'react'

interface StockSearchResult {
  stock_code: string
  stock_name: string
  currency: string
  current_price: number
}

interface StockAutocompleteProps {
  userId: string
  value: string
  onChange: (value: string) => void
  onSelect: (stock: StockSearchResult) => void
  placeholder?: string
  label: string
  required?: boolean
}

export default function StockAutocomplete({
  userId,
  value,
  onChange,
  onSelect,
  placeholder,
  label,
  required
}: StockAutocompleteProps): JSX.Element {
  const [results, setResults] = useState<StockSearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const searchStocks = async () => {
      if (value.length < 1) {
        setResults([])
        return
      }

      try {
        const searchResults = await window.api.stock.search(userId, value)
        setResults(searchResults)
        setIsOpen(searchResults.length > 0)
        setHighlightedIndex(-1)
      } catch (error) {
        console.error('Stock search failed:', error)
        setResults([])
      }
    }

    const debounce = setTimeout(searchStocks, 150)
    return () => clearTimeout(debounce)
  }, [value, userId])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0) {
          handleSelect(results[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  const handleSelect = (stock: StockSearchResult) => {
    onSelect(stock)
    setIsOpen(false)
    setResults([])
  }

  const formatCurrency = (price: number, currency: string) => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price)
    }
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(price)
  }

  return (
    <div className="form-group autocomplete-container" ref={containerRef}>
      <label>{label} {required && '*'}</label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      {isOpen && results.length > 0 && (
        <ul className="autocomplete-dropdown">
          {results.map((stock, index) => (
            <li
              key={`${stock.stock_code}-${stock.currency}`}
              className={`autocomplete-item ${index === highlightedIndex ? 'highlighted' : ''}`}
              onClick={() => handleSelect(stock)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="autocomplete-item-main">
                <span className="stock-name">{stock.stock_name}</span>
                <span className="stock-code">{stock.stock_code}</span>
              </div>
              <div className="autocomplete-item-sub">
                <span className="stock-price">{formatCurrency(stock.current_price, stock.currency)}</span>
                <span className={`stock-currency ${stock.currency === 'USD' ? 'usd' : 'krw'}`}>
                  {stock.currency}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
