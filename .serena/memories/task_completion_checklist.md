# Task Completion Checklist

## Before Committing

### 1. Type Check
```bash
npm run typecheck
```
Must pass with no errors.

### 2. Lint
```bash
npm run lint
```
Fix any linting issues.

### 3. Run Unit Tests
```bash
npm run test
```
All tests must pass.

### 4. Run E2E Tests (for UI changes)
```bash
npm run test:e2e
```
21 tests should pass.

### 5. Manual Testing
- Start dev server: `npm run dev`
- Test the changed functionality
- Check for console errors

## For Releases

### Windows Build
```bash
npm run build:win
```
Output: `dist/win-unpacked/family-asset-manager.exe`

### Verify Build
1. Run the executable
2. Test core functionality
3. Check database creation in `%AppData%/family-asset-manager/`

## File Locations to Update
- `CLAUDE.md`: Update when making significant changes
- `package.json`: Update version for releases
- `README.md`: Update for user-facing changes

## Known Issues to Consider
- HSBC stock ticker intentionally skipped
- Insurance/cash products won't have price data
- Some US stocks need manual ticker mapping
