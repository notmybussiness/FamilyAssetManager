# Suggested Commands for Development

## Development
```bash
# Start development server (with hot reload)
npm run dev

# Preview production build
npm run preview
```

## Build
```bash
# Build for production
npm run build

# Build Windows executable (creates dist/win-unpacked/)
npm run build:win

# Build Mac executable
npm run build:mac

# Build unpacked (for testing)
npm run build:unpack
```

## Type Checking
```bash
# Full type check (main + renderer)
npm run typecheck

# Type check main process only
npm run typecheck:node

# Type check renderer only
npm run typecheck:web
```

## Testing
```bash
# Run unit tests
npm run test

# Run unit tests in watch mode
npm run test:watch

# Run unit tests with coverage
npm run test:coverage

# Run E2E tests (headless)
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:headed

# Run E2E tests in debug mode
npm run test:e2e:debug
```

## Linting
```bash
# Run ESLint with auto-fix
npm run lint
```

## Windows System Commands
```bash
# Directory listing
dir
dir /s  # recursive

# Find files
dir /s /b *.ts

# Text search in files
findstr /s /i "pattern" *.ts

# Git commands (same as unix)
git status
git log --oneline -10
git diff
```

## Post-Install
```bash
# Install dependencies (runs postinstall automatically)
npm install
```
