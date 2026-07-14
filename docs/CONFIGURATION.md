<div align="center">

# Configuration Reference

**All configuration options for the TradingView Trading Platform**

[Trade Server](#trade-server-config) · [TradingView](#tradingview-config) · [WebSocket](#websocket-config) · [Market Data](#market-data-config)

</div>

---

## Overview

Configuration is managed in `src/config.ts` and exported as the `CONFIG` object. At runtime, the application reads credentials from `sessionStorage` (populated by the sign-in flow) and falls back to defaults from the config file.

```typescript
import CONFIG from '@/config';
import { deriveServerUrls } from '@/utils/serverUrl';

// Access configuration
const { baseUrl, wsUrl } = deriveServerUrls(CONFIG.tradeServer.server);
console.log(baseUrl);
console.log(CONFIG.tradingView.theme);
console.log(CONFIG.websocket.reconnect.maxAttempts);
```

---

## Configuration Structure

```typescript
interface AppConfig {
  tradeServer: TradeServerConfig;
  tradingView: TradingViewConfig;
  marketData: MarketDataConfig;
  websocket: WebSocketConfig;
}
```

---

## Trade Server Config

Connection settings for the YourBourse Trade Server.

```typescript
tradeServer: {
  server: string;     // Server base URL (baseUrl and wsUrl are derived from this)
  user: AuthUser;     // Authentication credentials
  timeout: number;    // Request timeout in milliseconds
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `server` | `string` | From sign-in form | Server base URL, e.g. `https://ts285-uat.yourbourse.trade` |
| `user.login` | `number` | From sign-in form | Account login number |
| `user.password` | `string` | From sign-in form | Password for authentication and then Signing token (used for HMAC signing, not the actual password) |
| `user.apiKey` | `string` | Set after authentication | API token (returned by sign-in) |
| `user.signingToken` | `string` | Set after authentication | HMAC signing token (returned by sign-in) |
| `timeout` | `number` | `5000` | HTTP request timeout in milliseconds |

> **Note:** REST API URL (`baseUrl`) and WebSocket URL (`wsUrl`) are derived on-the-fly from the `server` field using the `deriveServerUrls()` utility function. See [AUTHENTICATION.md](./AUTHENTICATION.md#url-derivation) for details.

### How Credentials Are Loaded

1. **Sign-in form** → saves to `sessionStorage.userCredentials` and `sessionStorage.apiKey`
2. **`src/config.ts`** → reads from `sessionStorage` at module load time
3. **AuthService** → updates `user.apiKey` and `user.signingToken` after authentication

```typescript
// Stored in sessionStorage by the sign-in page:
sessionStorage.setItem('userCredentials', JSON.stringify({
  login: 1002,
  server: 'https://ts285-uat.yourbourse.trade'
}));
// Note: baseUrl and wsUrl are derived from 'server' using deriveServerUrls()
```

---

## TradingView Config

Settings passed to the TradingView widget constructor.

```typescript
tradingView: {
  container: string;
  library_path: string;
  locale: string;
  theme: string;
  autosize: boolean;
  debug: boolean;
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `container` | `string` | `'tradingview_container'` | DOM element ID for the widget |
| `library_path` | `string` | `'/charting_library/'` | Path to TradingView static assets |
| `locale` | `string` | `'en'` | UI language |
| `theme` | `string` | `'dark'` | Color theme: `'dark'` or `'light'` |
| `autosize` | `boolean` | `true` | Auto-resize the widget to fill its container |
| `debug` | `boolean` | `false` | Enable TradingView debug logging |

### Additional Widget Options

The following are set in `app.ts` when creating the widget (not in config):

| Option | Value | Description |
|--------|-------|-------------|
| `symbol` | `'EURUSD'` | Default symbol loaded on startup |
| `interval` | `'15'` | Default chart timeframe |
| `timezone` | `'Etc/UTC'` | Chart timezone |
| `fullscreen` | `false` | Whether to use full browser window |

---

## WebSocket Config

Controls WebSocket behavior, subscriptions, and reconnection.

```typescript
websocket: {
  intervalMapping: Record<string, string>;
  autoSubscribe: AutoSubscribeConfig;
  orderBookDepth: number;
  reconnect: ReconnectConfig;
}
```

### Interval Mapping

Maps TradingView resolution strings to Trade Server interval format:

```typescript
intervalMapping: {
  '1':   '1M',    // 1 minute
  '5':   '5M',    // 5 minutes
  '15':  '15M',   // 15 minutes
  '30':  '30M',   // 30 minutes
  '60':  '1H',    // 1 hour
  '240': '4H',    // 4 hours
  'D':   'D',     // Daily
  '1D':  'D',
  'W':   'W',     // Weekly (shorthand)
  '1W':  'W',     // Weekly
  'M':   'M',     // Monthly (shorthand)
  '1M':  'M'      // Monthly — TradingView "1M" is not API "1M" (one minute)
}
```

### Auto-Subscribe

Channels automatically subscribed when the WebSocket connects:

```typescript
autoSubscribe: {
  orders: boolean;         // Working and inactive orders
  positions: boolean;      // Open positions with P&L updates
  balances: boolean;       // Account balance changes
  accountStates: boolean;  // Equity, margin, P&L summary
  trades: boolean;         // Executed trade notifications
}
```

| Channel | Default | Description |
|---------|---------|-------------|
| `orders` | `true` | Order snapshots and real-time updates |
| `positions` | `true` | Position snapshots with live price/P&L |
| `balances` | `false` | Balance updates per currency |
| `accountStates` | `true` | Account equity, margin, unrealized P&L |
| `trades` | `false` | Trade execution notifications |

### Reconnection

Automatic WebSocket reconnection settings:

```typescript
reconnect: {
  enabled: boolean;   // Enable auto-reconnect
  delay: number;      // Base delay in milliseconds
  maxAttempts: number; // Maximum retry attempts
}
```

| Property | Default | Description |
|----------|---------|-------------|
| `enabled` | `true` | Whether to auto-reconnect on disconnect |
| `delay` | `5000` | Initial reconnect delay (5 seconds) |
| `maxAttempts` | `10` | Max reconnect attempts before giving up |

The reconnection uses **exponential backoff**: delay doubles on each attempt, capped at `5 × delay` (25 seconds by default).

---

## Market Data Config

Supported chart resolutions.

```typescript
marketData: {
  historyResolutions: string[];
}
```

| Property | Default | Description |
|----------|---------|-------------|
| `historyResolutions` | `['1','5','15','30','60','240','D','1W','1M']` | Available chart timeframes in TradingView format |

These map to the Trade Server intervals via `websocket.intervalMapping`.

---

## Environment-Specific Configuration

### Development

During development (`npm run dev`), the Vite dev server:

- Runs on **port 8080**
- Opens the browser automatically
- Enables Hot Module Replacement (HMR)
- Allows filesystem access to parent directory (for submodule charting_library)
- Does **not** perform TypeScript type checking (use `npm run type-check` separately)

### Production

For production builds (`npm run build`):

- TypeScript is transpiled (not type-checked) by Vite
- The `charting_library/` folder is copied to `dist/charting_library/` by a custom Vite plugin
- Both `index.html` and `signin.html` are included as entry points
- All JavaScript is bundled and minified
- Path aliases (`@/`, `@schema/`) are resolved at build time

### Session Storage Keys

| Key | Format | Purpose |
|-----|--------|---------|
| `userCredentials` | JSON: `{login, server}` | User credentials (baseUrl/wsUrl derived on-demand) |
| `apiKey` | String: JWT token | API authentication token |
| `signingToken` | String: HMAC key | Request signing key |

### Local Storage Keys

| Key | Format | Purpose |
|-----|--------|---------|
| `savedCredentials` | JSON: `{login, server}` | Remember login and server (no password) |

---

## Example: Complete Config

```typescript
const CONFIG: AppConfig = {
  tradeServer: {
    server: 'https://ts285-uat.yourbourse.trade',
    user: {
      login: 1002,
      password: '',            // Signing token (set from sessionStorage)
      apiKey: '',              // Set after authentication
      signingToken: ''         // Set after authentication
    },
    timeout: 5000
  },
  // Note: baseUrl and wsUrl are derived from 'server' using deriveServerUrls()
  tradingView: {
    container: 'tradingview_container',
    library_path: '/charting_library/',
    locale: 'en',
    theme: 'dark',
    autosize: true,
    debug: false
  },
  marketData: {
    historyResolutions: ['1', '5', '15', '30', '60', '240', 'D', '1W', '1M']
  },
  websocket: {
    intervalMapping: {
      '1': '1M', '5': '5M', '15': '15M', '30': '30M',
      '60': '1H', '240': '4H', 'D': 'D', '1D': 'D', 'W': 'W', '1W': 'W', 'M': 'M', '1M': 'M'
    },
    autoSubscribe: {
      orders: true,
      positions: true,
      balances: false,
      accountStates: true,
      trades: false
    },
    reconnect: {
      enabled: true,
      delay: 5000,
      maxAttempts: 10
    }
  }
};
```

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](GETTING_STARTED.md) | First-time setup and initialization |
| [Authentication](AUTHENTICATION.md) | HMAC signing and credential management |
| [WebSocket API](WEBSOCKET_API.md) | Real-time connection and subscription configuration |
| [Architecture](ARCHITECTURE.md) | How configuration flows through the system |
| [Development Guide](DEVELOPMENT.md) | Using configuration during development |
