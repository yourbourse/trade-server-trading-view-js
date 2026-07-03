<div align="center">

# Architecture

**System design, data flows, and component overview**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite)](https://vitejs.dev/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-green?logo=socket.io)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

[System Overview](#system-overview) · [Data Flows](#data-flows) · [WebSocket Architecture](#websocket-architecture) · [Configuration](#configuration) · [Error Handling](#error-handling)

</div>

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              TradingView Widget                        │     │
│  │  ┌──────────────────┐    ┌──────────────────┐          │     │
│  │  │  Chart Component │    │  Trading Panel   │          │     │
│  │  │  - Candles       │    │  - Orders        │          │     │
│  │  │  - Indicators    │    │  - Positions     │          │     │
│  │  │  - Drawings      │    │  - Account Info  │          │     │
│  │  └──────────────────┘    └──────────────────┘          │     │
│  └────────────────────────────────────────────────────────┘     │
│           │                            │                        │
│           │ Datafeed API              │ Broker API              │
│           ▼                            ▼                        │
│  ┌─────────────────┐         ┌─────────────────────┐            │
│  │  datafeed.ts    │         │  broker-api.ts      │            │
│  │  - Symbol search│         │  (Facade Pattern)   │            │
│  │  - Historical   │         │  ┌───────────────┐  │            │
│  │  - Real-time    │         │  │ Services:     │  │            │
│  │  - Candles      │         │  │ - Orders      │  │            │
│  └─────────────────┘         │  │ - Positions   │  │            │
│           │                  │  │ - Account     │  │            │
│           │                  │  │ - Brackets    │  │            │
│           │                  │  │ - Updates     │  │            │
│           │                  │  └───────────────┘  │            │
│           │                  └─────────────────────┘            │
│           │                            │                        │
│           └────────────┬───────────────┘                        │
│                        │                                        │
│                        ▼                                        │
│           ┌──────────────────────────┐                          │
│           │  trade-server-api.ts     │                          │
│           │  ┌────────────────────┐  │                          │
│           │  │  WebSocket Client  │  │                          │
│           │  │                    │  │                          │
│           │  └────────────────────┘  │                          │
│           │  ┌────────────────────┐  │                          │
│           │  │  HTTP REST Client  │  │                          │
│           │  │                    │  │                          │
│           │  └────────────────────┘  │                          │
│           └──────────────────────────┘                           │
│                        │                                         │
└────────────────────────┼─────────────────────────────────────────┘
                         │
                         │ WebSocket (wss://)
                         │ HTTP REST (https://)
                         │
┌────────────────────────┼─────────────────────────────────────────┐
│                        ▼                                          │
│              Trade Server (YourBourse)                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │  WebSocket API   │         │  REST API        │             │
│  │  /ws/v1          │         │  /api/v1         │             │
│  └──────────────────┘         └──────────────────┘             │
│           │                            │                         │
│           └────────────┬───────────────┘                         │
│                        │                                         │
│  ┌─────────────────────────────────────────────────┐           │
│  │           Trading Engine & Database              │           │
│  │  - Order Management                              │           │
│  │  - Position Management                           │           │
│  │  - Market Data                                   │           │
│  │  - Account Management                            │           │
│  └─────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## WebSocket Data Flow

### Real-time Market Data

```
Trade Server          →    WebSocket Client    →    TradingView
─────────────              ──────────────────       ────────────

Candles (OHLC)        →    handleCandlesUpdate →    Chart bars
{                          notifyCallbacks          update in
  s: "EURUSD",            "candles_EURUSD"          real-time
  i: "1H",
  o, h, l, c, v
}

Quotes (L1)           →    handleQuotesUpdate  →    Price ticker
{                          notifyCallbacks          updates
  s: "EURUSD",            "quote_EURUSD"
  bp, bs, ap, as          "ticker"
}

Order Book (L2)       →    handleBookUpdate    →    Depth widget
{                          notifyCallbacks          (if enabled)
  s: "EURUSD",            "book_EURUSD"
  a: [[price,vol]],
  b: [[price,vol]]
}
```

### Real-time Trading Data

```
Trade Server          →    WebSocket Client    →    TradingView
─────────────              ──────────────────       ────────────

Orders                →    handleOrdersUpdate  →    Trading Panel
{                          transformOrders          Orders list
  id, s, q, S, t,          notifyCallbacks          updates
  st, lp, sp              "order_update"
}

Positions             →    handlePositionsUpdate→   Trading Panel
{                          transformPositions       Positions list
  id, s, q, S,             notifyCallbacks          P&L updates
  p, pl, mp               "position_update"
}

Balances              →    handleBalancesUpdate →   Account Panel
{                          notifyCallbacks          Balance
  a, t, av, p             "balance_update"          display
}

Account States        →    handleAccountStates →    Account Panel
{                          Update account data      Equity, margin
  b, C, pl, e, m, c       notifyCallbacks          display
}                         "account_state_update"

Trades                →    handleTradesUpdate  →    Trade History
{                          notifyCallbacks          Executions
  id, s, p, q, S,         "trade"                  display
  oi, pi, pl
}
```

## WebSocket Subscription Flow

```
1. Application Start
   ├─ app.js init()
   ├─ Create TradeServerAPI instance
   ├─ connectWebSocket()
   │  ├─ new WebSocket(wsUrl)
   │  ├─ Setup event handlers (onopen, onmessage, onerror, onclose)
   │  └─ Start heartbeat (ping every 30s)
   │
   └─ waitForWebSocketConnection()
      └─ Wait for ws.readyState === OPEN

2. Auto-Subscribe (if enabled)
   ├─ subscribeToOrders(snapshot: true)
   │  ├─ Generate reqId
   │  ├─ Send: {m:"subscribe", c:"orders", p:{snapshot:true}, h:{X-YB-API-Key}}
   │  └─ Wait for ack: {m:"subscribe", c:"orders", s:true, reqId}
   │
   ├─ subscribeToPositions(snapshot: true, sendPriceUpdates: true)
   ├─ subscribeToBalances(snapshot: true)
   ├─ subscribeToAccountStates(snapshot: true)
   └─ subscribeToTrades()

3. Market Data Subscription (on symbol change)
   ├─ User selects symbol "EURUSD" in chart
   │
   ├─ datafeed.js subscribeBars()
   │  ├─ Map resolution: "15" → "15M"
   │  └─ subscribeToCandles("EURUSD", "15M", snapshot: false)
   │
   └─ subscribeToQuotes("EURUSD", streaming: true)

4. Message Handling
   ├─ ws.onmessage receives data
   ├─ Parse JSON message
   ├─ handleWebSocketMessage(message)
   │  ├─ Check message type (subscribe ack, data update, pong)
   │  ├─ Route by channel (orders, positions, ohlc, L1, L2, etc.)
   │  └─ Call specific handler
   │
   ├─ Handler processes data
   │  ├─ Transform API format to internal format
   │  ├─ Merge with cached data (for updates)
   │  └─ notifyCallbacks(event, data)
   │
   └─ Callbacks update UI
      ├─ TradingView chart updates
      ├─ Trading panel updates
      └─ Account panel updates

5. Unsubscribe (on symbol change or component unmount)
   ├─ unsubscribeFromCandles("EURUSD", "15M")
   │  ├─ Send: {m:"unsubscribe", c:"ohlc", p:{s:"EURUSD",i:"15M"}}
   │  └─ Wait for ack
   │
   └─ Remove event listeners
```

## Channel Mapping

### Account Channels (Always Subscribed)

| Channel      | Subscribe Method              | Events                              | Used By         |
|-------------|-------------------------------|-------------------------------------|-----------------|
| `orders`    | subscribeToOrders()           | `orders`, `order_update`           | broker-api/     |
| `positions` | subscribeToPositions()        | `positions`, `position_update`     | broker-api/     |
| `balances`  | subscribeToBalances()         | `balances`, `balance_update`       | broker-api/     |
| `states`    | subscribeToAccountStates()    | `states`, `account_state_update`   | broker-api/     |
| `trades`    | subscribeToTrades()           | `trades`, `trade`                  | broker-api/     |

### Market Data Channels (Per Symbol)

| Channel | Subscribe Method           | Events                        | Used By        |
|---------|---------------------------|-------------------------------|----------------|
| `ohlc`  | subscribeToCandles()      | `candles`, `candles_{symbol}` | datafeed/      |
| `L1`    | subscribeToQuotes()       | `quotes`, `quote_{symbol}`, `ticker` | datafeed/      |
| `L2`    | subscribeToOrderBook()    | `book`, `book_{symbol}`       | datafeed/      |

### System Channels (Auto-handled)
| Channel     | Purpose                          | Events       |
|------------|----------------------------------|--------------|
| `heartbeat`| Server heartbeat (every ~1s)     | `heartbeat`  |
| `ping`/`pong`| Application-level keep-alive  | (internal)   |

## Message Types

### Snapshot (`t: "s"`)
- Initial data when subscribing with `snapshot: true`
- Contains full dataset
- Replaces any cached data
- Example: All open orders when subscribing to orders

### Update (`t: "u"`)
- Incremental changes
- Merge with cached data
- Most common message type
- Example: Order status change, position P&L update

### Delete (`t: "d"`)
- Item removal
- Remove from cached data
- Only used by positions channel
- Example: Position closed

## Configuration Options

### WebSocket Settings (src/config.ts)
```typescript
websocket: {
    // TradingView resolution → API interval mapping
    intervalMapping: {
        '1': '1M',   '5': '5M',   '15': '15M',
        '30': '30M', '60': '1H',  '240': '4H',
        'D': 'D', '1D': 'D', 'W': 'W', '1W': 'W', 'M': 'M', '1M': 'M'
    },
    
    // Auto-subscribe on connection
    autoSubscribe: {
        orders: true,
        positions: true,
        balances: true,
        accountStates: true,
        trades: true
    },
    
    // Order book depth for L2
    orderBookDepth: 10,
    
    // Reconnection settings
    reconnect: {
        enabled: true,
        delay: 2000        // 2 seconds, retried indefinitely
    }
}
```

### TradingView Integration (src/config.ts)

```typescript
export const CONFIG: AppConfig = {
    tradingView: {
        library_path: '/charting_library/',
        container: 'tv_chart_container',
        autosize: true,
        symbol: 'EURUSD',
        interval: '15',
        timezone: 'Etc/UTC',
        theme: 'dark',
    },
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
    // Note: baseUrl and wsUrl are derived from 'server' using deriveServerUrls()
};
```

## API Limits

| Limit                    | Value | Notes                              |
|--------------------------|-------|------------------------------------|
| Message rate             | 5/sec | Per connection                     |
| Max concurrent streams   | 256   | Total subscriptions per connection |
| Connection lifetime      | 24h   | Auto-disconnect after 24 hours     |
| Connection attempts      | 300   | Per IP every 5 minutes            |
| Concurrent connections   | 10    | Per IP address                     |

## Error Handling

```
┌─────────────────────┐
│  Subscription Error │
└──────────┬──────────┘
           │
           ├─► Code 10: Symbol not found
           │   └─► Retry with different symbol
           │
           ├─► Code 1: Configuration change
           │   └─► Symbol deleted/disabled
           │
           ├─► Timeout (10s)
           │   └─► Check connection, retry
           │
           └─► Authentication error
               └─► Check API key, re-authenticate
```

## Performance Optimization

### Subscription Management
- ✅ Subscribe only to visible symbols
- ✅ Unsubscribe when symbol changes
- ✅ Use symbol-specific callbacks
- ✅ Cache data to minimize updates
- ✅ Throttle UI updates if needed

### Memory Management
- ✅ Clean up callbacks on unsubscribe
- ✅ Remove closed orders/positions
- ✅ Limit order history depth
- ✅ Clear cached data on snapshot

### Network Efficiency
- ✅ Single WebSocket connection
- ✅ Multiplexed channels
- ✅ Efficient message format (JSON)
- ✅ Heartbeat mechanism
- ✅ Automatic reconnection

## Testing Flow

```
1. Start Application
   ├─ Check console for connection logs
   └─ Verify "WebSocket connected"

2. Check Auto-Subscriptions
   ├─ orders, positions, balances, states, trades
   └─ Verify "All auto-subscriptions completed"

3. Load Chart
   ├─ Select symbol (e.g., EURUSD)
   ├─ Verify candle subscription
   └─ Check real-time updates
```

For detailed testing and debugging, see the [Troubleshooting Guide](TROUBLESHOOTING.md).

---

## Related Documentation

| Document | Focus Area |
|----------|------------|
| [API Overview](API_OVERVIEW.md) | Complete REST & WebSocket endpoint reference |
| [WebSocket API](WEBSOCKET_API.md) | Channel documentation and message formats |
| [REST API](REST_API.md) | HTTP endpoint details and request/response schemas |
| [Authentication](AUTHENTICATION.md) | HMAC signing and session management |
| [Configuration](CONFIGURATION.md) | All configuration options explained |
| [Development Guide](DEVELOPMENT.md) | Project structure and contributing |
