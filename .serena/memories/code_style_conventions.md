# Code Style and Conventions

## TypeScript Configuration
- **Strict Mode**: Enabled (`strict: true`)
- **Module System**: ESNext with bundler resolution
- **JSX**: react-jsx (no import React needed)
- **Path Aliases**: `@/*` maps to `src/renderer/src/*`

## Project Structure Convention
```
src/
├── main/           # Electron Main Process (backend)
│   ├── index.ts    # App entry point
│   ├── database.ts # SQLite schema
│   ├── ipc-handlers.ts # IPC API handlers
│   └── *.ts        # Business logic modules
├── preload/        # IPC bridge
│   ├── index.ts    # API expose
│   └── index.d.ts  # TypeScript types
└── renderer/src/   # React frontend
    ├── App.tsx     # Routing + user selection
    ├── pages/      # Route components
    ├── components/ # Reusable components
    └── styles/     # CSS files
```

## Naming Conventions
- **Files**: kebab-case for modules (`market-data-api.ts`)
- **Components**: PascalCase (`Dashboard.tsx`)
- **Variables/Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE (when applicable)
- **Database columns**: snake_case

## IPC Communication Pattern
- All IPC handlers defined in `src/main/ipc-handlers.ts`
- API exposed via `window.api` object
- Types defined in `src/preload/index.d.ts`
- Pattern: `window.api.{namespace}.{method}()`

## React Patterns
- Functional components with hooks
- No class components
- CSS in separate files (not CSS-in-JS)
- react-router-dom for routing

## Comments
- Korean comments are acceptable (Korean-focused project)
- JSDoc style for complex functions

## Error Handling
- Try-catch in IPC handlers
- Return structured error objects
- Log errors to console in main process
