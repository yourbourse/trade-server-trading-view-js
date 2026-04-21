<div align="center">

# Development Guide

**Project structure, workflow, and conventions for contributors**

[Project Structure](#project-structure) · [Workflow](#development-workflow) · [Code Style](#code-style) · [Module Guide](#module-guide) · [Contributing](CONTRIBUTING.md)

</div>

---

## Development Workflow

### Getting Started

```bash
# Clone and install
git clone <repository-url>
cd client
npm install

# Start development server (with HMR)
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with Hot Module Replacement (port 8080) |
| `npm run build` | Build production bundle to `dist/` |
| `npm run preview` | Serve the production build locally for testing |
| `npm run type-check` | Run TypeScript compiler to check for type errors (no emit) |
| `npm run lint` | Run ESLint to check code quality and style |
| `npm run contracts-public` | Regenerate TypeScript types from OpenAPI specification |

> **From the root repository:** You can also run `npm run type-check` and `npm run lint` from the parent repository — they will proxy to the client scripts.

### Regenerating TypeScript Types from OpenAPI

The project uses auto-generated TypeScript types and SDK from the YourBourse Trade Server OpenAPI specification. When the API changes, you need to regenerate the TypeScript files:

#### Steps to Regenerate:

1. **Download the latest OpenAPI specification**
   - Navigate to your Trade Server's OpenAPI documentation endpoint
   - Download the `openapi.json` file

2. **Replace the local specification**
   - Place the downloaded file at `src/schema/openapi.json`
   - This overwrites the existing specification

3. **Run the generation script**
   ```bash
   npm run contracts-public
   ```

4. **Verify the generated files**
   - Check `src/schema/public-api/` for updated TypeScript files
   - The script will delete and regenerate all files in this directory
   - Generated files include:
     - `types.gen.ts` — All request/response type definitions
     - `sdk.gen.ts` — Generated HTTP client functions
     - `client.gen.ts` — SDK configuration

> **Important:** The `contracts-public` script uses [@hey-api/openapi-ts](https://github.com/hey-api/openapi-ts) to generate TypeScript code from the OpenAPI spec. Any changes to the API schema will be reflected in the generated types after running this command.

> **Note:** The generation script clears the `src/schema/public-api/` directory before regenerating files. Do not manually edit files in this directory as they will be overwritten.

### Development Cycle

```
1. Edit TypeScript files in src/
        ↓
2. Vite auto-reloads the browser (HMR)
        ↓
3. Check browser console for errors
        ↓
4. Run type-check and lint: npm run type-check && npm run lint
        ↓
5. Test in TradingView interface
        ↓
6. Build for production when ready: npm run build
```

> **TypeScript note:** Vite transpiles TypeScript on-the-fly but does **not** type-check during development. Use `npm run type-check` to verify types separately.

---

## Project Structure

```
client/
├── src/
│   ├── app.ts                          # Entry point — bootstraps the application
│   ├── config.ts                       # Runtime configuration (reads sessionStorage)
│   ├── signin.ts                       # Sign-in page controller
│   │
│   ├── broker-api/                     # TradingView Broker API
│   │   ├── broker-api.ts              #   Main facade (IBrokerTerminal)
│   │   ├── abstract-broker-minimal.ts #   Abstract base class
│   │   ├── services/                  #   Service layer (modular architecture)
│   │   │   ├── OrderService.ts        #     Order management (place, modify, cancel)
│   │   │   ├── PositionService.ts     #     Position operations (close, reverse, brackets)
│   │   │   ├── AccountService.ts      #     Account data, Account Manager UI
│   │   │   ├── BracketService.ts      #     Bracket order activation logic
│   │   │   ├── UpdateService.ts       #     WebSocket update handling
│   │   │   └── index.ts               #     Service exports
│   │   ├── type-mappings.ts           #   Trade Server ↔ TradingView type converters
│   │   ├── types.ts                   #   Enums (OrderStatus, OrderType, Side, etc.)
│   │   └── columns.ts                 #   Account Manager column definitions
│   │
│   ├── datafeed/                       # TradingView Datafeed API
│   │   ├── datafeed.ts                #   IDatafeedChartApi + IDatafeedQuotesApi
│   │   ├── ITradeServerApi.ts         #   Interface contract
│   │   └── SubscriberInfo.ts          #   Bar subscriber metadata
│   │
│   ├── trade-server-api/               # Trade Server Client (REST + WebSocket)
│   │   ├── TradeServerClient.ts       #   Main facade — entry point for all API calls
│   │   ├── rest/                      #   REST service modules
│   │   │   ├── AuthService.ts         #     Authentication (sign-in, refresh, logout)
│   │   │   ├── TradingService.ts      #     Orders, positions, trade history
│   │   │   ├── MarketDataService.ts   #     Symbols, candles, quotes, order book
│   │   │   └── AccountService.ts      #     Balance, account state, limits, transfers
│   │   ├── websocket/                 #   WebSocket infrastructure
│   │   │   ├── WebSocketClient.ts     #     Connection, heartbeat, reconnect
│   │   │   ├── SubscriptionManager.ts #     Pub/sub event bus
│   │   │   └── MessageRouter.ts       #     Channel → event routing
│   │   ├── errors/                    #   Typed error hierarchy
│   │   │   ├── TradeServerError.ts    #     Base error
│   │   │   ├── ApiError.ts            #     REST errors (401, 403, 404, 429)
│   │   │   └── WebSocketError.ts      #     WebSocket connection/subscription errors
│   │   └── types/                     #   WebSocket message type definitions
│   │       └── websocket-messages.ts
│   │
│   ├── schema/                         # API Specifications
│   │   ├── openapi.json               #   REST API specification (OpenAPI 3.0)
│   │   ├── asyncapi.yaml              #   WebSocket API specification (AsyncAPI 3.0)
│   │   └── public-api/                #   Auto-generated TypeScript SDK
│   │       ├── types.gen.ts           #     All request/response types
│   │       ├── sdk.gen.ts             #     Generated HTTP client functions
│   │       └── client.gen.ts          #     SDK configuration
│   │
│   ├── types/                          # Shared TypeScript Interfaces
│   │   ├── AppConfig.ts               #   Main configuration interface
│   │   ├── AuthUser.ts                #   User credentials
│   │   ├── TradeServerConfig.ts       #   Server connection settings
│   │   ├── WebSocketConfig.ts         #   WebSocket behavior settings
│   │   ├── MarketDataConfig.ts        #   Market data settings
│   │   ├── TradingConfig.ts           #   Trading feature settings
│   │   └── global.d.ts               #   Global type declarations
│   │
│   └── utils/                          # Utilities
│       ├── auth.ts                    #   Session management (isAuthenticated, signOut)
│       ├── api.ts                     #   HMAC headers (GET, POST, DELETE)
│       ├── apiError.ts                #   Error extraction and handling
│       ├── logger.ts                  #   Logger class with levels and prefixes
│       ├── notificationService.ts     #   TradingView notification wrapper
│       ├── axios.ts                   #   Axios instance for non-auth requests
│       └── TradeServerApiAdapter.ts   #   Adapter bridging new/legacy API
│
├── css/
│   ├── app.css                         # Main trading terminal layout
│   ├── custom.css                      # TradingView widget theme overrides
│   └── signin.css                      # Sign-in page styles
│
├── docs/                               # Documentation and demo GIFs
├── public/                             # Static assets (charting_library)
├── index.html                          # Main trading terminal entry page
├── signin.html                         # Authentication entry page
├── package.json                        # Dependencies and scripts
├── vite.config.ts                      # Vite build configuration
└── tsconfig.json                       # TypeScript compiler configuration
```

---

## Module Guide

### How the Modules Connect

```
index.html
  └── src/app.ts (TradingApp)
        ├── Creates TradeServerClient (REST + WebSocket)
        ├── Creates Datafeed (IDatafeedChartApi)
        ├── Creates BrokerApi (IBrokerTerminal)
        └── Initializes TradingView Widget
              ├── Uses Datafeed for chart data
              └── Uses BrokerApi for trading operations
```

### Module Responsibilities

| Module | Depends On | Consumed By |
|--------|-----------|-------------|
| **TradeServerClient** | SDK (schema/), utils/ | Datafeed, BrokerApi, app.ts |
| **Datafeed** | TradeServerClient (via adapter) | TradingView Widget |
| **BrokerApi** | TradeServerClient, Datafeed (quotes) | TradingView Widget |
| **Utils** | CryptoJS (global), sessionStorage | All modules |
| **Schema SDK** | None (auto-generated) | TradeServerClient REST services |

### Adding a New Feature

1. **New REST endpoint** — Add method to the appropriate service in `trade-server-api/rest/`
2. **New WebSocket channel** — Handle in `MessageRouter.ts`, add subscribe/unsubscribe in `WebSocketClient.ts`
3. **New TradingView feature** — Implement in `broker-api/` or `datafeed/` following TradingView API docs
4. **New UI element** — Modify `index.html` and `css/app.css`

---

## Code Style & Conventions

### Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Variables & Functions | camelCase | `getAccountInfo()`, `wsCallbacks` |
| Classes | PascalCase | `TradeServerClient`, `BrokerApi` |
| Interfaces | PascalCase (with `I` prefix for contracts) | `ITradeServerApi`, `AppConfig` |
| Enums | PascalCase | `OrderStatus`, `ConnectionStatus` |
| Constants | UPPER_SNAKE or camelCase | `CONFIG`, `logger` |
| Files | kebab-case or PascalCase (matching class) | `broker-api.ts`, `TradeServerClient.ts` |

### TypeScript

- **Strict mode** is enabled (`strictNullChecks`, `strictFunctionTypes`, etc.)
- **No implicit any** is disabled (`noImplicitAny: false`) for flexibility with TradingView types
- **Path aliases**: Use `@/` for `src/` imports, `@schema/` for generated SDK types

```typescript
// Good — use path aliases
import CONFIG from '@/config';
import { Interval } from '@schema/public-api';

// Avoid — relative paths for cross-module imports
import CONFIG from '../../config';
```

### Comments

- **Minimal commenting** — code should be self-documenting through descriptive names and types
- Comment only **why**, not **what** — explain non-obvious decisions, not obvious operations
- **No redundant comments** on parameter types, return types, or simple assignments
- Comment TradingView API specifics when the behavior is non-obvious

### Imports

- Import from module `index.ts` files when available
- Group imports: external libraries → internal modules → types
- Use the `@/` alias for all `src/` imports

### Error Handling

- Use the typed error hierarchy: `TradeServerError` → `ApiError` / `WebSocketError`
- Use `notificationService` for user-facing errors in the broker API
- Use `logger` for developer-facing debug information
- Handle specific HTTP status codes: 401 (re-auth), 403 (forbidden), 429 (rate limit)

---

## Key Interfaces

### TradingView Contracts

| Interface | File | Implementation |
|-----------|------|----------------|
| `IBrokerTerminal` | `charting_library/broker-api.d.ts` | `BrokerApi` (via `AbstractBrokerMinimal`) |
| `IDatafeedChartApi` | `charting_library/datafeed-api.d.ts` | `Datafeed` |
| `IDatafeedQuotesApi` | `charting_library/datafeed-api.d.ts` | `Datafeed` |

### Internal Contracts

| Interface | File | Purpose |
|-----------|------|---------|
| `ITradeServerApi` | `src/datafeed/ITradeServerApi.ts` | Abstracts API client for datafeed/broker |
| `AppConfig` | `src/types/AppConfig.ts` | Application configuration shape |
| `AuthUser` | `src/types/AuthUser.ts` | User credential structure |

---

## Build System

### Vite Configuration

Key Vite features configured in `vite.config.ts`:

| Feature | Description |
|---------|-------------|
| **Path Aliases** | `@` → `./src`, `@schema` → `./src/schema`, `charting_library` → resolved path |
| **Multi-Page** | `index.html` + `signin.html` as separate entry points |
| **Custom Plugin** | `copyChartingLibrary()` — copies TradingView library to `dist/` on build |
| **Dev Server** | Port 8080, auto-open, filesystem access for parent-repo submodule |
| **Library Detection** | Checks `./charting_library` first, then `../charting_library` for submodule setup |

### Generated SDK

The `src/schema/public-api/` directory contains auto-generated TypeScript code from the OpenAPI specification.

**Do not manually edit files in `schema/public-api/`.** They are regenerated from `schema/openapi.json`.

---

## Debugging Tips

### Browser Console

The `TradingApp` instance is available globally:

```javascript
// Access the app
window.tradingApp

// Access the API client
window.tradingApp.tradeServerClient

// Check WebSocket state
window.tradingApp.tradeServerClient.isConnected()

// View subscriptions
window.tradingApp.tradeServerClient.subscriptions.getEventNames()
```

### Logger

The built-in logger supports levels: `debug`, `info`, `warn`, `error`.

```typescript
import { logger } from '@/utils/logger';

logger.info('Something happened');
logger.debug('Detailed debug info', someObject);
logger.error('Something failed', error);
```

### Network Tab

1. Open DevTools (F12)
2. **Network → WS** — View WebSocket messages in real-time
3. **Network → XHR** — View REST API calls
4. Check for 401/403/429 status codes in REST responses

For more debugging techniques, see the [Troubleshooting Guide](TROUBLESHOOTING.md).

---

## Related Documentation

| Document | Focus Area |
|----------|------------|
| [Contributing Guide](CONTRIBUTING.md) | Code standards and pull request process |
| [Code Standards](CODE_STANDARDS.md) | Import conventions, formatting, and best practices |
| [Architecture](ARCHITECTURE.md) | System overview and component design |
| [API Overview](API_OVERVIEW.md) | REST and WebSocket API reference |
| [Configuration](CONFIGURATION.md) | All configuration options |
| [Troubleshooting](TROUBLESHOOTING.md) | Debugging techniques and solutions |
| [Documentation Index](README.md) | Complete documentation overview |
