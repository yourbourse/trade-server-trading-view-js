# Code Standards & Conventions

**Maintaining consistency across the codebase**

[Import Conventions](#import-conventions) · [Code Style](#code-style) · [File Organization](#file-organization) · [Naming Conventions](#naming-conventions) · [Best Practices](#best-practices)

---

## Import Conventions

### 1. Path Aliases - Use `@/` for Internal Imports

**✅ CORRECT:**
```typescript
import { TradeServerClient } from '@/trade-server-api/TradeServerClient';
import { AuthUser } from '@/types/AuthUser';
import CONFIG from '@/config';
import { logger } from '@/utils/logger';
```

**❌ INCORRECT:**
```typescript
import { TradeServerClient } from '../trade-server-api/TradeServerClient';
import { AuthUser } from '../../types/AuthUser';
import CONFIG from '../../../config';
```

**Exception**: Only use relative paths for imports within the same module directory:
```typescript
// In src/trade-server-api/rest/TradingService.ts
import { AuthService } from './AuthService';  // ✅ Same directory - OK
```

---

### 2. File Extensions - Always Include `.js` for Local Files

TypeScript ES modules require `.js` extensions in imports (they're resolved by the build system).

**✅ CORRECT:**
```typescript
import CONFIG from '@/config.js';
import { TradeServerClient } from '@/trade-server-api/TradeServerClient.js';
import { logger } from '@/utils/logger.js';
```

**❌ INCORRECT:**
```typescript
import CONFIG from '@/config';              // Missing .js
import { TradeServerClient } from '@/trade-server-api/TradeServerClient';
```

**Exception**: External libraries (node_modules) never need extensions:
```typescript
import axios from 'axios';                   // ✅ No extension for node_modules
import type { AxiosResponse } from 'axios';  // ✅ Correct
```

---

### 3. Quote Style - Single Quotes Only

**✅ CORRECT:**
```typescript
import { logger } from '@/utils/logger.js';
const message = 'Hello world';
```

**❌ INCORRECT:**
```typescript
import { logger } from "@/utils/logger.js";  // Double quotes
const message = "Hello world";               // Double quotes
```

**Exception**: Double quotes allowed in HTML/JSX attributes:
```typescript
const html = '<div class="container">...</div>';  // ✅ OK in strings
```

---

### 4. Import Order & Grouping

Organize imports in a consistent order with blank lines between groups:

```typescript
// 1. External libraries (node_modules)
import axios from 'axios';
import hmacSHA256 from 'crypto-js/hmac-sha256';

// 2. TradingView Charting Library
import type { IBrokerTerminal } from 'charting_library/charting_library.js';
import type { ResolutionString } from 'charting_library/datafeed-api';

// 3. Internal modules (via @/ alias) - grouped by feature
import { TradeServerClient } from '@/trade-server-api/TradeServerClient.js';
import { BrokerApi } from '@/broker-api/broker-api.js';
import type { AuthUser } from '@/types/AuthUser.js';
import CONFIG from '@/config.js';
import { logger } from '@/utils/logger.js';

// 4. Relative imports (same directory)
import { AuthService } from './AuthService.js';
import type { WebSocketMessage } from './types.js';
```

---

### 5. Type vs Value Imports

Use `type` keyword for type-only imports (better tree-shaking):

**✅ CORRECT:**
```typescript
import type { AuthUser } from '@/types/AuthUser.js';
import type { Order, Position } from '@/schema/public-api';
import { TradeServerClient } from '@/trade-server-api/TradeServerClient.js';
```

**❌ INCORRECT:**
```typescript
import { AuthUser } from '@/types/AuthUser.js';     // Type imported as value
import { Order } from '@/schema/public-api';        // Type imported as value
```

---

## Code Style

### Formatting Rules

| Rule | Standard | Example |
|------|----------|---------|
| **Indentation** | 4 spaces | `    const x = 1;` |
| **Line Length** | 120 characters max | Use line breaks for long statements |
| **Quotes** | Single quotes `'` | `const msg = 'hello';` |
| **Semicolons** | Always required | `const x = 1;` |
| **Trailing Commas** | ES5 style | `{ a: 1, b: 2 }` |
| **Arrow Functions** | Always use parentheses | `(x) => x + 1` |
| **Braces** | Required for all blocks | `if (x) { return true; }` |

### TypeScript Specific

```typescript
// ✅ Explicit return types for public functions
export function processOrder(order: Order): OrderResult {
    return { success: true };
}

// ✅ Avoid 'any' - use 'unknown' if type is truly unknown
function handleData(data: unknown): void {
    if (typeof data === 'string') {
        console.log(data);
    }
}

// ✅ Use type instead of interface for unions/intersections
type OrderParams = {
    symbol: string;
    quantity: number;
};

// ✅ Use interface for object shapes and classes
interface IDatafeedApi {
    getSymbols(): Promise<SymbolCollection>;
}
```

---

## File Organization

### Directory Structure

```
src/
├── app.ts                    # Application entry point
├── config.ts                 # Runtime configuration
├── signin.ts                 # Sign-in page controller
├── broker-api/              # TradingView Broker API implementation
│   ├── broker-api.ts        # Main facade (delegates to services)
│   ├── services/            # Service layer (Single Responsibility Principle)
│   │   ├── OrderService.ts  # Order management
│   │   ├── PositionService.ts # Position operations
│   │   ├── AccountService.ts # Account data & Account Manager
│   │   ├── BracketService.ts # Bracket order activation
│   │   └── UpdateService.ts # WebSocket update handling
│   ├── types.ts             # Broker-specific types
│   ├── type-mappings.ts     # Trade Server ↔ TradingView converters
│   └── columns.ts           # Account Manager column definitions
├── datafeed/                # TradingView Datafeed API implementation
│   ├── datafeed.ts          # Main implementation
│   └── ITradeServerApi.ts   # Interface contract
├── trade-server-api/        # Trade Server client
│   ├── TradeServerClient.ts # Main facade
│   ├── rest/                # REST service layer
│   ├── websocket/           # WebSocket infrastructure
│   ├── types/               # WebSocket message types
│   └── errors/              # Typed error hierarchy
├── types/                   # Shared TypeScript interfaces
├── utils/                   # Utilities (auth, logging, errors)
└── schema/                  # OpenAPI/AsyncAPI specs + generated SDK
```

### File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| **Components/Classes** | PascalCase | `TradeServerClient.ts` |
| **Utilities** | camelCase | `logger.ts`, `apiError.ts` |
| **Types/Interfaces** | PascalCase | `AuthUser.ts`, `AppConfig.ts` |
| **Constants** | camelCase with config suffix | `config.ts` |
| **Entry points** | lowercase | `app.ts`, `signin.ts` |

---

## Naming Conventions

### Variables & Functions

```typescript
// ✅ camelCase for variables and functions
const accountBalance = 10000;
function calculateProfit() { }
const getUserInfo = () => { };

// ✅ No underscore prefix for private/protected fields (use 'private' keyword)
class TradeServerClient {
    private cachedOrders: Order[];    // ✅ Correct
    protected host: IBrokerHost;      // ✅ Correct
}

// ❌ Incorrect
const AccountBalance = 10000;  // PascalCase
const get_user_info = () => { }; // snake_case
class TradeServer {
    private _cachedOrders: Order[];  // ❌ Don't use underscore prefix
    protected _host: IBrokerHost;    // ❌ Don't use underscore prefix
}
```

### Classes, Types, & Interfaces

```typescript
// ✅ PascalCase for classes, types, and interfaces
class TradeServerClient { }
interface IDatafeedApi { }
type OrderParams = { };
enum OrderStatus { }

// ❌ Incorrect
class tradeServerClient { }
interface dataFeedApi { }
type order_params = { };
```

### Constants

```typescript
// ✅ UPPER_CASE for true constants
const MAX_RETRY_ATTEMPTS = 3;
const API_TIMEOUT = 5000;

// ✅ camelCase for config objects
const config = { apiUrl: '...' };
```

---

## Best Practices

### Error Handling

```typescript
// ✅ Always handle errors explicitly
async function fetchData(): Promise<Data> {
    try {
        const response = await api.getData();
        return response.data;
    } catch (error) {
        logger.error('Failed to fetch data:', error);
        throw new Error('Unable to retrieve data');
    }
}

// ✅ Use typed error classes
if (error instanceof AuthenticationError) {
    // Handle auth error
}
```

### Async/Await

```typescript
// ✅ Use async/await over .then()
async function processOrder(order: Order): Promise<void> {
    const result = await tradeServer.placeOrder(order);
    await updateUI(result);
}

// ❌ Avoid promise chains
function processOrder(order: Order): Promise<void> {
    return tradeServer.placeOrder(order)
        .then(result => updateUI(result));
}
```

### Comments

Follow the minimal commenting approach (see [CONTRIBUTING.md](CONTRIBUTING.md)):

```typescript
// ✅ Comment complex business logic
// Convert Trade Server order status to TradingView order status
// Trade Server uses numeric codes while TradingView expects enum values
function mapOrderStatus(serverStatus: number): OrderStatus {
    // ...
}

// ❌ Don't comment obvious code
// This function adds two numbers
function add(a: number, b: number): number {
    return a + b;
}
```

---

## Tooling

### Automated Formatting

```bash
# Format all code
npm run format

# Check if code is formatted
npm run format:check

# Lint and auto-fix
npm run lint:fix

# Type check
npm run type-check
```

### Pre-commit Workflow

Before committing:

1. Run `npm run format` to format code
2. Run `npm run lint:fix` to fix linting issues
3. Run `npm run type-check` to verify types
4. Run `npm run build` to ensure production build works

---

## Enforcement

### ESLint Rules

- `quotes`: Enforce single quotes
- `semi`: Require semicolons
- `@typescript-eslint/no-explicit-any`: Warning (avoid `any`)
- `@typescript-eslint/no-unused-vars`: Warning (with `_` prefix exception)

### Prettier Configuration

See [.prettierrc.json](.prettierrc.json) for formatting rules.

### EditorConfig

See [.editorconfig](.editorconfig) for editor settings.

---

## Migration Plan

For existing code that doesn't follow these standards:

1. **Don't change everything at once** - migrate incrementally
2. **Fix imports when touching a file** - update to `@/` aliases
3. **Run prettier on edited files** - `npm run format`
4. **Fix critical issues first** - focus on import paths and extensions

---

## Questions?

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines or open an issue for clarification.
