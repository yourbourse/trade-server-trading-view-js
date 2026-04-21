<div align="center">

# REST API Reference

[![REST API](https://img.shields.io/badge/REST-API%20v1-blue)](REST_API.md)
[![HMAC-SHA256](https://img.shields.io/badge/Auth-HMAC--SHA256-green)](AUTHENTICATION.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)

**Complete reference for all REST API methods**

[Authentication](#authentication) · [Account Info](#account-information) · [Orders](#order-management) · [Market Data](#market-data) · [History](#trade-history)

</div>

---

All REST endpoints are implemented in `src/trade-server-api/rest/`. For authentication details, see the [Authentication Guide](AUTHENTICATION.md).

## Table of Contents

- [Authentication](#authentication)
- [Account Information](#account-information)
- [Order Management](#order-management)
- [Market Data](#market-data)
- [Trade History](#trade-history)
- [Utility Methods](#utility-methods)

---

## Authentication

All REST API requests require the `X-YB-API-Key` header with your public API token. POST, PUT, and DELETE requests also require HMAC signature authentication.

### HMAC Signature Generation

The API uses HMAC-SHA256 for authentication with **timestamp-based** method:

1. Create signature string: `Content={request_body}\nTimestamp={timestamp_in_microseconds}`
2. Sign with your private key using HMAC-SHA256 (via CryptoJS library)
3. Encode the signature in Base64 URL format (replacing `+` with `-`, `/` with `_`, and removing `=`)
4. Include headers:
   - `X-YB-API-Key`: Your public API token
   - `X-YB-Timestamp`: Current timestamp in microseconds
   - `X-YB-Sign`: HMAC signature in Base64 URL format

The implementation uses helper functions from `src/utils/` which leverage the CryptoJS library for HMAC generation, consistent with the YourBourse API reference implementation.

### signIn(username, password)

Authenticate user with username and password.

**Endpoint:** `POST /authorize`

```javascript
const response = await api.signIn('username', 'password');
// Returns: { token: 'api_token_here', expiration: 1234567890 }
```

### refreshToken(refreshToken)

Refresh an expired API token.

**Endpoint:** `POST /refresh`

```javascript
const response = await api.refreshToken('refresh_token_here');
// Returns: { token: 'new_api_token', expiration: 1234567890 }
```

### logout()

Logout the current session.

**Endpoint:** `POST /logout`

```javascript
await api.logout();
// Returns: { s: 'ok' }
```

### changePassword(oldPassword, newPassword)

Change trading account password.

**Endpoint:** `POST /password`

```javascript
await api.changePassword('oldPass123', 'newPass456');
// Returns: { s: 'ok' }
```

---

## Account Information

### getAccountInfo()

Get trading account state (balance, equity, margin, etc.).

**Endpoint:** `POST /account/state`

```javascript
const state = await api.getAccountInfo();
// Returns: {
//   b: 41757.91,      // Balance
//   C: 1000,          // Credit
//   pl: 1053.02,      // Unrealized P/L
//   e: 43857.56,      // Equity
//   m: 102.19,        // Used margin
//   c: 'USD',         // Currency
//   a: 'Account Name' // Account name
// }
```

### getBalance()

Get account balance(s) and collateral.

**Endpoint:** `GET /account/balances`

```javascript
const balances = await api.getBalance();
// Returns: {
//   balances: [
//     { c: 'USD', b: 10000, ab: 9500, av: 9000 },
//     { c: 'EUR', b: 5000, ab: 4800, av: 4500 }
//   ]
// }
```

### getPositions(filter, nextToken)

Get open positions with optional filtering and pagination.

**Endpoint:** `POST /positions`

**Parameters:**
- `filter` (Object): Filter options
  - `symbol` (string): Filter by symbol
  - `sortBy` (string): Sort field
  - `sortOrder` (string): 'asc' or 'desc'
- `nextToken` (string): Pagination token from previous response

```javascript
const positions = await api.getPositions({ symbol: 'EURUSD' });
// Returns: {
//   positions: [
//     {
//       id: 123456,
//       s: 'EURUSD',
//       q: 1.5,
//       S: 'buy',
//       ap: 1.12345,
//       up: 123.45,
//       // ... more fields
//     }
//   ],
//   nextToken: 'eyJjb3...' // For pagination
// }
```

### getLimits()

Get rate limits and unfilled order count limits.

**Endpoint:** `GET /limits`

```javascript
const limits = await api.getLimits();
// Returns array of limit configurations
```

### getTransfersHistory(filter, nextToken)

Get cash/asset transfers history for an account.

**Endpoint:** `POST /transfers`

**Parameters:**
- `filter` (Object): Filter options
  - `maxResults` (number): Maximum number of results (default: 100, max: 100)
  - `sortOrder` (string): 'asc' or 'desc'
  - `from` (number): Start timestamp (microseconds)
  - `to` (number): End timestamp (microseconds)
- `nextToken` (string): Pagination token from previous response

```javascript
const transfers = await api.getTransfersHistory({
    from: Date.now() * 1000 - (7 * 24 * 3600 * 1000 * 1000), // 7 days ago
    to: Date.now() * 1000,
    sortOrder: 'desc'
});
// Returns: {
//   transfers: [
//     {
//       id: 12345,
//       a: 1000,           // Amount
//       T: 'Balance',      // Transfer type
//       c: 'USD',          // Currency
//       t: 1234567890000,  // Timestamp (microseconds)
//       ct: 'Deposit'      // Comment
//     }
//   ],
//   nextToken: '...'
// }
```

### getAccountSummary()

Get comprehensive account summary (convenience method that combines account state and balances).

**Combines:** `getAccountInfo()` + `getBalance()`

```javascript
const summary = await api.getAccountSummary();
// Returns: {
//   state: {
//     b: 41757.91,   // Balance
//     C: 1000,       // Credit
//     pl: 1053.02,   // Unrealized P/L
//     e: 43857.56,   // Equity
//     m: 102.19,     // Used margin
//     c: 'USD'       // Currency
//   },
//   balances: {
//     balances: [
//       { c: 'USD', b: 10000, ab: 9500, av: 9000 }
//     ]
//   }
// }
```

### getPositionById(positionId)

Get a single position by its ID (convenience method).

```javascript
const position = await api.getPositionById(123456);
// Returns: Position object or null if not found
```

### hasOpenPositions(symbol?)

Check if there are any open positions (convenience method).

**Parameters:**
- `symbol` (string, optional): Check for specific symbol only

```javascript
const hasPositions = await api.hasOpenPositions();
// Returns: true or false

const hasEURUSD = await api.hasOpenPositions('EURUSD');
// Returns: true if there are open EURUSD positions
```

### getAllTransfersHistory(filter)

Get ALL cash/asset transfers history with automatic pagination. This method automatically fetches all pages and returns a flat array of all transfers.

**WARNING:** This will make multiple API calls if there are many pages.

**Parameters:**
- `filter` (Object): Same filters as `getTransfersHistory()`

```javascript
// Get all transfers automatically
const allTransfers = await api.getAllTransfersHistory({
    sortOrder: 'desc'
});
console.log(`Total transfers: ${allTransfers.length}`);

// Get all transfers for specific period
const allTransfers = await api.getAllTransfersHistory({
    from: Date.now() * 1000 - (30 * 24 * 3600 * 1000 * 1000),
    to: Date.now() * 1000
});
```

### getAllPositions(filter)

Get ALL open positions with automatic pagination.

**WARNING:** This will make multiple API calls if there are many pages.

```javascript
const allPositions = await api.getAllPositions();
// Returns: Position[]

const allEURUSDPositions = await api.getAllPositions({ symbol: 'EURUSD' });
```

### getAllOrders(filter)

Get ALL open orders with automatic pagination.

**WARNING:** This will make multiple API calls if there are many pages.

```javascript
const allOrders = await api.getAllOrders();
// Returns: Order[]
```

### getAllOrderHistory(filter)

Get ALL historical orders with automatic pagination.

**WARNING:** This will make multiple API calls if there are many pages.

```javascript
const allHistoricalOrders = await api.getAllOrderHistory({
    from: Date.now() * 1000 - (30 * 24 * 3600 * 1000 * 1000),
    to: Date.now() * 1000
});
// Returns: Order[]
```

### getAllTradeHistory(filter)

Get ALL trade history with automatic pagination.

**WARNING:** This will make multiple API calls if there are many pages.

```javascript
const allTrades = await api.getAllTradeHistory({
    from: Date.now() * 1000 - (7 * 24 * 3600 * 1000 * 1000),
    to: Date.now() * 1000
});
// Returns: Trade[]
```

---

## Order Management

### placeOrder(order)

Place a new order.

**Endpoint:** `POST /order`

**Order Object:**
- `s` (string): Symbol name (required)
- `q` (number): Quantity in lots (required)
- `S` (string): Side - 'buy' or 'sell' (required)
- `t` (string): Order type - 'Market', 'Limit', 'Stop', 'StopLimit' (required)
- `tif` (string): Time in force - 'FOK', 'IOC', 'GTC', 'GTD', 'Day' (required)
- `lp` (number): Limit price (for Limit/StopLimit orders)
- `sp` (number): Stop price (for Stop/StopLimit orders)
- `tt` (number): Termination time in microseconds (for GTD orders)
- `pi` (number): Parent order ID (for conditional orders)
- `pbi` (number): Position by ID
- `sl` (number): Stop loss price
- `tp` (number): Take profit price
- `ct` (string): Client tag/comment

```javascript
const order = {
  s: 'EURUSD',
  q: 1.0,
  S: 'buy',
  t: 'Limit',
  lp: 1.12345,
  tif: 'GTC',
  sl: 1.12000,
  tp: 1.13000
};

const response = await api.placeOrder(order);
// Returns: { id: 1263159, s: 'ok' }
```

### modifyOrder(modifications)

Modify an existing order's price.

**Endpoint:** `PUT /order`

```javascript
const modifications = {
  id: 1263159,
  lp: 1.12500  // New limit price
};

await api.modifyOrder(modifications);
// Returns: { success: true, status: 202 }
```

### cancelOrder(orderId)

Cancel a specific order.

**Endpoint:** `DELETE /order/{orderId}`

```javascript
await api.cancelOrder(1263159);
// Returns: { success: true, status: 202 }
```

### modifyOrderSLTP(orderId, stopLoss, takeProfit)

Modify stop loss and/or take profit of an order.

**Endpoint:** `PUT /order/sltp`

```javascript
await api.modifyOrderSLTP(1263159, 1.12000, 1.13000);
// Updates order #1263159 with new SL/TP levels
```

### modifyPositionSLTP(positionId, stopLoss, takeProfit)

Modify stop loss and/or take profit of a position.

**Endpoint:** `PUT /sltp`

```javascript
await api.modifyPositionSLTP(987654, 1.12000, 1.13000);
// Updates position #987654 with new SL/TP levels
```

### getOrders(filter, nextToken)

Get all open (working and inactive) orders.

**Endpoint:** `POST /orders/open`

```javascript
const orders = await api.getOrders({ symbol: 'EURUSD' });
// Returns: {
//   orders: [
//     {
//       id: 1263159,
//       s: 'EURUSD',
//       q: 1.0,
//       S: 'buy',
//       t: 'Limit',
//       lp: 1.12345,
//       st: 'Working',
//       // ... more fields
//     }
//   ],
//   nextToken: '...'
// }
```

### getOrder(orderId)

Get a single open order by ID.

**Endpoint:** `POST /orders/open/single`

```javascript
const order = await api.getOrder(1263159);
// Returns single order object
```

### getOrderHistory(filter, nextToken)

Get completed orders (filled, cancelled, rejected, expired).

**Endpoint:** `POST /orders/completed`

**Filter Options:**
- `symbol` (string): Filter by symbol
- `from` (number): Start timestamp in microseconds
- `to` (number): End timestamp in microseconds
- `sortBy` (string): Sort field
- `sortOrder` (string): 'asc' or 'desc'

```javascript
const history = await api.getOrderHistory({
  symbol: 'EURUSD',
  from: 1726167500000000,
  to: 1726197500000000
});
// Returns: { orders: [...], nextToken: '...' }
```

### getHistoricalOrder(orderId)

Get a single historical order by ID.

**Endpoint:** `POST /orders/completed/single`

```javascript
const order = await api.getHistoricalOrder(1263159);
```

### cancelAllOrders(symbol)

Cancel all orders (optionally filtered by symbol).

**Note:** This method fetches all open orders and cancels them individually, as YourBourse API doesn't have a bulk cancel endpoint.

```javascript
// Cancel all orders
await api.cancelAllOrders();

// Cancel all EURUSD orders
await api.cancelAllOrders('EURUSD');
```

---

## Market Data

### getSymbolInfo(symbol, locale, ifNoneMatch)

Get configuration for a specific symbol.

**Endpoint:** `GET /symbols/get/{symbolName}`

```javascript
const symbol = await api.getSymbolInfo('EURUSD', 'en');
// Returns: {
//   n: 'EURUSD',
//   d: 'Euro vs US Dollar',
//   dp: 5,
//   l: 100000,
//   tm: 'FullTrading',
//   min: 0.01,
//   max: 10,
//   // ... more configuration
// }
```

### getSymbols(locale, maxResults, nextToken, ifNoneMatch)

Get all available symbols.

**Endpoint:** `GET /symbols/query`

```javascript
const symbols = await api.getSymbols('en', 100);
// Returns: {
//   symbols: [ /* array of symbol objects */ ],
//   nextToken: '...' // For pagination
// }
```

### getTicker(symbol)

Get current quote (top of the book) for a symbol.

**Endpoint:** `GET /quote/{symbolName}`

```javascript
const quote = await api.getTicker('EURUSD');
// Returns: {
//   s: 'EURUSD',
//   b: 1.12345,  // Best bid
//   a: 1.12347,  // Best ask
//   bv: 1000000, // Bid volume
//   av: 1000000, // Ask volume
//   t: 1726167500000000 // Timestamp
// }
```

### getHistoricalBars(symbol, interval, from, to)

Get historical OHLCV candle data.

**Endpoint:** `POST /charts`

**Intervals:** '1M', '5M', '15M', '30M', '1H', '4H', 'D', 'W', 'M'

```javascript
const bars = await api.getHistoricalBars(
  'EURUSD',
  '1H',
  1726167500000000,  // From (microseconds)
  1726197500000000   // To (microseconds)
);
// Returns: {
//   s: 'ok',
//   d: [
//     {
//       t: 1726167500000000,
//       o: 1.12345,
//       h: 1.12400,
//       l: 1.12300,
//       c: 1.12380,
//       v: 125000
//     },
//     // ... more candles
//   ]
// }
```

### getOrderBook(symbol, limit)

Get order book / depth of market.

**Endpoint:** `GET /depth/{symbolName}`

```javascript
const book = await api.getOrderBook('EURUSD', 20);
// Returns: {
//   s: 'EURUSD',
//   a: [[1.12347, 100000], [1.12348, 200000]], // Asks [price, volume]
//   b: [[1.12345, 150000], [1.12344, 180000]]  // Bids [price, volume]
// }
```

### getRecentTrades(symbol, limit)

Get recent trades for a symbol.

**Endpoint:** `POST /trades`

```javascript
const trades = await api.getRecentTrades('EURUSD', 50);
// Returns: {
//   trades: [
//     {
//       id: 456789,
//       s: 'EURUSD',
//       p: 1.12345,
//       q: 1.0,
//       S: 'buy',
//       t: 1726167500000000
//     },
//     // ... more trades
//   ]
// }
```

---

## Trade History

### getTradeHistory(filter, nextToken)

Get trade history with filtering.

**Endpoint:** `POST /trades`

**Filter Options:**
- `symbol` (string): Filter by symbol
- `from` (number): Start timestamp in microseconds
- `to` (number): End timestamp in microseconds
- `sortBy` (string): Sort field
- `sortOrder` (string): 'asc' or 'desc'

```javascript
const trades = await api.getTradeHistory({
  symbol: 'EURUSD',
  from: 1726167500000000,
  to: 1726197500000000,
  sortOrder: 'desc'
});
// Returns: {
//   trades: [ /* array of trade objects */ ],
//   nextToken: '...'
// }
```

### getTrade(tradeId)

Get a specific trade by ID.

**Note:** This method filters the trade history to find a specific trade, as YourBourse API doesn't have a single trade endpoint.

```javascript
const trade = await api.getTrade(456789);
```

### getTransferHistory(filter, nextToken)

Get cash/asset transfer history.

**Endpoint:** `POST /transfers`

```javascript
const transfers = await api.getTransferHistory({
  from: 1726167500000000,
  to: 1726197500000000
});
// Returns: {
//   transfers: [
//     {
//       id: 123,
//       T: 'Balance',
//       a: 1000.00,
//       c: 'USD',
//       t: 1726167500000000,
//       ct: 'Deposit'
//     }
//   ],
//   nextToken: '...'
// }
```

---

## Utility Methods

### healthCheck()

Get server status and current time.

**Endpoint:** `GET /now`

```javascript
const status = await api.healthCheck();
// Returns: {
//   now: 1726167500000000,  // Server time in microseconds
//   version: '0.0.845'       // API version
// }
```

### getServerTime()

Get server time in microseconds.

```javascript
const serverTime = await api.getServerTime();
// Returns: 1726167500000000
```

### getBrokerConfig(locale)

Get broker configuration (symbols configuration).

```javascript
const config = await api.getBrokerConfig('en');
// Returns configuration object with available symbols
```

---

## Error Handling

All methods may throw errors. Use try-catch blocks:

```javascript
try {
  const order = await api.placeOrder({
    s: 'EURUSD',
    q: 1.0,
    S: 'buy',
    t: 'Market',
    tif: 'FOK'
  });
  console.log('Order placed:', order.id);
} catch (error) {
  console.error('Failed to place order:', error.message);
}
```

### Common HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Order placed successfully
- `202 Accepted` - Order modification/cancellation accepted
- `304 Not Modified` - Cached data is still valid
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Invalid or missing API key
- `403 Forbidden` - IP banned or insufficient permissions
- `404 Not Found` - Resource not found
- `412 Precondition Failed` - ETag mismatch
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Rate Limits

The API enforces rate limits based on IP address. Each endpoint has a weight, and limits are tracked per time interval (second, minute, hour, day).

Check response headers:
- `X-YB-USED-WEIGHT-1S` - Weight used in last 1 second
- `X-YB-USED-WEIGHT-1M` - Weight used in last 1 minute
- `Retry-After` - Seconds to wait before retrying (on 429 errors)

### Conditional Requests (ETags)

Use ETags for efficient caching:

```javascript
// First request
const symbols1 = await api.getSymbols('en');
const etag = symbols1.etag;

// Subsequent request with ETag
const symbols2 = await api.getSymbols('en', null, null, etag);
// Returns { notModified: true } if data hasn't changed
```

---

## Configuration

Update `src/config.ts` with your API credentials:

```typescript
export const CONFIG: AppConfig = {
  tradeServer: {
    server: 'https://uat.api.yourbourse.trade:32285',
    user: {
      login: 10,
      password: '',  // Signing token (set after authentication)
      apiKey: '',    // Set after login
      signingToken: ''  // Set after login
    },
    timeout: 5000
  }
};
// Note: baseUrl and wsUrl are derived from 'server' using deriveServerUrls()
```

### Dependencies

The implementation uses the **CryptoJS library** for HMAC-SHA256 signature generation. This is included automatically via CDN in `index.html`:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js"></script>
```

Utility functions for generating authentication headers are available in `src/utils/api-helpers.ts`, consistent with the YourBourse API reference implementation.

**Security Note:** Never expose your private key in client-side code in production. Consider implementing a backend proxy service to handle HMAC signature generation server-side.

---

## Integration with TradingView

The REST API methods integrate seamlessly with TradingView's Broker API:

```typescript
// In src/broker-api/broker-api.ts
export class BrokerAPI {
  placeOrder(order: Order): Promise<OrderResponse> {
    return tradeServerAPI.placeOrder({
      s: order.symbol,
      q: order.qty,
      S: order.side === 1 ? 'buy' : 'sell',
      t: order.type,
      lp: order.limitPrice,
      tif: order.duration.type
    });
  }
}
```

See [API_OVERVIEW.md](API_OVERVIEW.md) for a complete overview of all endpoints and channels.

---

## Additional Resources

- **[WebSocket API](WEBSOCKET_API.md)** - Real-time data streaming
- **[Architecture](ARCHITECTURE.md)** - System architecture overview  
- **[Quick Start](QUICKSTART.md)** - Testing guide
- **[TypeScript Setup](TYPESCRIPT_SETUP.md)** - Development workflow
