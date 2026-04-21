<div align="center">

# TypeScript Setup

**TypeScript compiler configuration, path aliases, and type-checking**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)

</div>

---

This project uses TypeScript with Vite for type safety and fast HMR (Hot Module Replacement). Vite handles transpilation — no separate `tsc` build step is needed.

## Setup

### 1. Install Dependencies

```bash
npm install
```

This will install:
- TypeScript compiler
- Type definitions (@types/crypto-js, @types/node)
- Build tools (Vite, rimraf)
- Linting tools (ESLint with TypeScript support)
- Runtime dependencies (axios, crypto-js)

### 2. Build the Project

```bash
npm run build
```

This compiles and bundles all TypeScript files using Vite. The production-ready output is placed in the `dist/` directory, including the copied `charting_library/` assets.

### 3. Development Mode

```bash
npm run dev
```

This starts Vite's development server with hot module replacement. The application will automatically reload when you make changes to TypeScript files. By default, it runs on `http://localhost:8080`.

### 4. Preview Production Build

```bash
npm run preview
```

Preview the production build locally before deploying.

## Project Structure

```
trade-server-trading-view/
├── src/                         # TypeScript source files
│   ├── app.ts                  # Main application entry
│   ├── config.ts               # Configuration
│   ├── broker-api/             # TradingView broker API implementation
│   │   └── broker-api.ts      
│   ├── datafeed/               # TradingView datafeed implementation
│   │   ├── datafeed.ts        
│   │   ├── SubscriberInfo.ts  
│   │   └── ITradeServerApi.ts 
│   ├── trade-server-api/       # Trade Server API client
│   │   └── trade-server-api.ts
│   ├── schema/                 # Generated API schemas
│   │   └── public-api.ts      
│   ├── types/                  # TypeScript type definitions
│   │   ├── AppConfig.ts       
│   │   ├── AuthUser.ts        
│   │   ├── WebSocketConfig.ts 
│   │   └── ...                
│   └── utils/                  # Utility functions
├── charting_library/           # TradingView charting library
│   ├── charting_library.d.ts  # Type definitions
│   ├── datafeed-api.d.ts      # Datafeed API types
│   └── bundles/               # Library assets (CSS, JS chunks)
├── css/                        # Custom stylesheets
│   └── custom.css             
├── dist/                       # Production build output (generated)
│   ├── assets/                # Bundled JS/CSS
│   ├── charting_library/      # Copied library assets
│   └── index.html             
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite configuration
├── package.json               # Dependencies and scripts
└── index.html                 # Entry point HTML
```

## Available Scripts

- `npm run dev` - Start Vite dev server with HMR on port 8080
- `npm run build` - Build for production (cleans dist, then builds)
- `npm run preview` - Preview production build locally
- `npm run clean` - Remove dist/ directory
- `npm run type-check` - Check types without emitting files
- `npm run lint` - Run ESLint on TypeScript files

## TypeScript Configuration

The `tsconfig.json` is configured with:
- **Target**: ES2020
- **Module**: ES2020 (ESM)
- **Module Resolution**: Node
- **Strict mode**: Enabled for maximum type safety
- **No Emit**: TypeScript is used only for type checking; Vite handles compilation
- **Path Aliases**: `@/*` maps to `src/*`, `@schema/*` maps to `src/schema/*`

**For build system details, see:** [VITE_SETUP.md](VITE_SETUP.md)

## Type Definitions

Custom types are organized in `src/types/`, including:
- Configuration types (`AppConfig`, `TradeServerConfig`, `TradingViewConfig`)
- Authentication types (`AuthUser`)
- API types and interfaces
- WebSocket configuration types

The TradingView library provides its own type definitions:
- `charting_library/charting_library.d.ts` - Widget and chart types
- `charting_library/datafeed-api.d.ts` - Datafeed interface types

## Development Workflow

1. Edit TypeScript files in the `src/` directory
2. Vite automatically detects changes and hot-reloads the browser
3. TypeScript type checking runs in the background
4. No manual compilation needed during development

## Type Checking

To check for type errors without building:

```bash
npm run type-check
```

This runs TypeScript compiler in type-check-only mode (no emit).

## Linting

To check code style and potential issues:

```bash
npm run lint
```

## Production Build

The production build process:
1. Runs `npm run clean` to remove old dist/
2. Vite bundles and optimizes TypeScript code
3. Custom plugin copies `charting_library/` folder to `dist/charting_library/`
4. Outputs minified assets to `dist/`

## Path Aliases

Use path aliases for cleaner imports:

```typescript
// Instead of: import config from '../../../config';
import config from '@/config';

// Instead of: import { Interval } from '../../schema/public-api';
import { Interval } from '@schema/public-api';
```

## Notes

- Vite handles all TypeScript compilation and bundling (see [VITE_SETUP.md](VITE_SETUP.md))
- Hot Module Replacement (HMR) works for all TypeScript files during development
- Source maps are automatically generated for debugging
- CryptoJS is loaded from CDN (see index.html)

## Migrating Existing Code

When adding new JavaScript files:
1. Create `.ts` file in appropriate `src/` subdirectory
2. Add proper type annotations
3. Use path aliases (`@/`, `@schema/`) for imports
4. Import types from TradingView library or local types
5. Run `npm run type-check` to verify

## Troubleshooting

**Issue**: `Cannot find module '@/config'`
- **Solution**: Ensure both `tsconfig.json` and `vite.config.ts` have matching path aliases

**Issue**: Build errors about missing types
- **Solution**: Run `npm install` to ensure all @types packages are installed

**Issue**: Changes not reflected in browser
- **Solution**: Check that Vite dev server is running (`npm run dev`) and check browser console for errors

**Issue**: Charting library not loading after build
- **Solution**: Verify `charting_library/` folder exists and the `copyChartingLibrary` plugin ran successfully

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [Development Guide](DEVELOPMENT.md) | Project structure and workflow |
| [Vite Setup](VITE_SETUP.md) | Build configuration and plugins |
| [Getting Started](GETTING_STARTED.md) | Initial TypeScript setup |
| [Configuration](CONFIGURATION.md) | TypeScript path aliases and config |
| [Troubleshooting](TROUBLESHOOTING.md) | Common TypeScript issues |
