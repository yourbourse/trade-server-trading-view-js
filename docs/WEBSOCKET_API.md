<div align="center">

# WebSocket API Reference

[![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-green?logo=socket.io)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
[![AsyncAPI](https://img.shields.io/badge/AsyncAPI-3.0.0-blue?logo=asyncapi)](https://www.asyncapi.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)

**Complete real-time WebSocket API documentation**

[Connection](#connection) · [Message Format](#message-format) · [Channels](#available-channels) · [Examples](#complete-example)

</div>

---

The WebSocket API provides real-time streaming for market data, orders, positions, and account information. Implementation is in `src/trade-server-api/websocket/`.

## Connection

The WebSocket connection is established using the `connectWebSocket()` method:

```javascript
tradeServerAPI.connectWebSocket();
```

### Connection Details

- **URL Format**: `wss://<IP_address>:<port>/ws/v1`
- **Authentication**: API key sent in message headers (`X-YB-API-Key`)
- **Connection Lifetime**: 24 hours (expect disconnection after 24 hours)
- **Auto-reconnect**: Automatically reconnects after 5 seconds on disconnection
- **Ping/Pong**: Application-level ping sent every 30 seconds

### Rate Limits

| Limit                      | Value | Description                           |
|----------------------------|-------|---------------------------------------|
| **Message Rate**           | 5/sec | Messages per second per connection    |
| **Max Streams**            | 256   | Concurrent subscriptions per connection|
| **Connection Lifetime**    | 24h   | Automatic disconnection after 24 hours|
| **Connection Attempts**    | 300   | Per IP address every 5 minutes        |
| **Concurrent Connections** | 10    | Maximum per IP address                |

## Message Format

All WebSocket messages follow this structure:

### Outgoing Messages (Client → Server)

```javascript
{
    "m": "subscribe",           // Method: subscribe/unsubscribe
    "c": "orders",             // Channel name
    "p": {                     // Parameters (optional)
        "snapshot": true
    },
    "h": {                     // Headers
        "X-YB-API-Key": "your-api-key"
    },
    "reqId": "req_123"         // Request ID (optional)
}
```

### Incoming Messages (Server → Client)

```javascript
{
    "c": "orders",             // Channel name
    "t": "s",                  // Type: s=snapshot, u=update, d=delete
    "d": [...],                // Data array
    "reqId": "req_123"         // Request ID (if applicable)
}
```

### Subscription Acknowledgement

```javascript
{
    "m": "subscribe",
    "c": "orders",
    "s": true,                 // Status: true=success, false=failure
    "e": {                     // Error (only if s=false)
        "code": 10,
        "msg": "Symbol not found",
        "detail": "EURUSD"
    },
    "reqId": "req_123"
}
```

## Available Channels

### Quick Reference

| Channel | Type | Description | Snapshot | Streaming |
|---------|------|-------------|----------|----------|
| [`orders`](#1-orders-channel-orders) | Account | Order updates | ✅ | ✅ |
| [`positions`](#2-positions-channel-positions) | Account | Position updates | ✅ | ✅ |
| [`balances`](#3-balances-channel-balances) | Account | Balance updates | ✅ | ✅ |
| [`states`](#4-account-states-channel-states) | Account | Account state | ✅ | ✅ |
| [`trades`](#5-trades-channel-trades) | Account | Trade executions | ❌ | ✅ |
| [`transfers`](#6-transfers-channel-transfers) | Account | Transfer history | ✅ | ✅ |
| [`ohlc`](#7-candles-channel-ohlc) | Market Data | OHLCV candles | ✅ | ✅ |
| [`L1`](#8-quotes-channel-l1) | Market Data | Top of book | ✅ | ✅ |
| [`L2`](#9-order-book-channel-l2) | Market Data | Order book depth | ✅ | ✅ |
| [`heartbeat`](#10-heartbeat-channel) | System | Server heartbeat | ❌ | ✅ |

---

### 1. Orders Channel (`orders`)

Real-time order updates including creation, modification, fills, and cancellations.

**Subscribe:**
```javascript
await tradeServerAPI.subscribeToOrders(snapshot = true);
```

**Unsubscribe:**
```javascript
await tradeServerAPI.unsubscribeFromOrders();
```

**Listen for Updates:**
```javascript
tradeServerAPI.subscribe('orders', (data) => {
    console.log('Orders update:', data.type, data.data);
});

// Or listen to the specific event:
tradeServerAPI.subscribe('order_update', (data) => {
    console.log('Order update:', data);
});
```

**Order Object Structure:**
```javascript
{
    id: 1263159,              // Order unique identifier
    s: "EURUSD",              // Symbol name
    q: 0.1,                   // Quantity (in lots)
    S: "buy",                 // Side: buy/sell
    t: "limit",               // Type: market/stop/limit/stoplimit/closeby
    fq: 0,                    // Filled quantity
    ap: 1.14214,              // Average fill price
    lp: 1.14214,              // Limit price (for limit orders)
    sp: 1.14000,              // Stop price (for stop orders)
    tif: "GTC",               // Time in Force: FOK/IOC/GTC/GTD/Day/Ms
    C: 1738066591010786,      // Created timestamp (microseconds)
    M: 1738066591010786,      // Modified timestamp (microseconds)
    st: "Working",            // Status: Inactive/Working/PartiallyFilled/Filled/Cancelled/Rejected/Expired
    ct: "My order comment"    // Order comment
}
```

### 2. Positions Channel (`positions`)

Real-time position updates including P&L changes and price updates.

**Subscribe:**
```javascript
await tradeServerAPI.subscribeToPositions(
    snapshot = true,          // Include snapshot
    sendPriceUpdates = true   // Receive price updates
);
```

**Unsubscribe:**
```javascript
await tradeServerAPI.unsubscribeFromPositions();
```

**Listen for Updates:**
```javascript
tradeServerAPI.subscribe('positions', (data) => {
    console.log('Position update:', data.type, data.data);
});

tradeServerAPI.subscribe('position_update', (data) => {
    console.log('Position update:', data);
});
```

**Position Object Structure:**
```javascript
{
    id: 1263159,              // Position unique identifier
    s: "EURUSD",              // Symbol name
    q: 0.1,                   // Quantity (in lots)
    Q: 10000,                 // Quantity in units (lots * lot size)
    S: "buy",                 // Side: buy/sell
    p: 1.1347091,             // Average price
    sl: 1.24739,              // Stop loss price
    tp: 1.22739,              // Take profit price
    pl: 19.4739,              // Unrealised profit/loss
    sw: 0.76,                 // Swaps
    c: 0.0,                   // Commission
    m: 1000.00,               // Margin
    f: 1.00,                  // Fees
    mp: 1.13419,              // Market price
    C: 1738066591010786,      // Created timestamp
    M: 1738066591010786,      // Modified timestamp
    Ci: 1263159,              // Order ID that created position
    Mi: 1263159               // Order ID that last modified position
}
```

**Position Price Update (partial):**
```javascript
{
    id: 1263159,              // Position ID
    mp: 1.1347091,            // Market price
    pl: 19.4739               // Unrealised profit/loss
}
```

### 3. Balances Channel (`balances`)

Account balance and collateral updates.

**Subscribe:**
```javascript
await tradeServerAPI.subscribeToBalances(snapshot = true);
```

**Unsubscribe:**
```javascript
await tradeServerAPI.unsubscribeFromBalances();
```

**Listen for Updates:**
```javascript
tradeServerAPI.subscribe('balances', (data) => {
    console.log('Balance update:', data.type, data.data);
});

tradeServerAPI.subscribe('balance_update', (data) => {
    console.log('Balance update:', data);
});
```

**Balance Object Structure:**
```javascript
{
    a: "BTC",                 // Asset
    d: "Bitcoin",             // Asset description
    t: 1000,                  // Total amount
    av: 10,                   // Available balance
    r: 0.5,                   // Liquidity margin rate (default: 1.0)
    p: 104.24                 // Market price (if applicable)
}
```

### 4. Account States Channel (`states`)

Trading account state including equity, margin, and P&L.

**Subscribe:**
```javascript
await tradeServerAPI.subscribeToAccountStates(snapshot = true);
```

**Unsubscribe:**
```javascript
await tradeServerAPI.unsubscribeFromAccountStates();
```

**Listen for Updates:**
```javascript
tradeServerAPI.subscribe('states', (data) => {
    console.log('Account state update:', data.type, data.data);
});

tradeServerAPI.subscribe('account_state_update', (data) => {
    console.log('Account state:', data);
});
```

**Account State Object Structure:**
```javascript
{
    b: 41757.91,              // Balance
    C: 1000.00,               // Credit
    pl: 1053.02,              // Unrealised profit/loss
    e: 43857.56,              // Equity (balance + credit + unrealizedPL + collateral)
    m: 102.19,                // Margin requirements
    c: "USD",                 // Account currency
    a: 1000.00                // Market value of collateral (adjusted by liquidity margin rate)
}
```

### 5. Trades Channel (`trades`)

Real-time trade execution updates.

**Subscribe:**
```javascript
await tradeServerAPI.subscribeToTrades();
```

**Unsubscribe:**
```javascript
await tradeServerAPI.unsubscribeFromTrades();
```

**Listen for Updates:**
```javascript
tradeServerAPI.subscribe('trades', (data) => {
    console.log('Trade:', data.data);
});

tradeServerAPI.subscribe('trade', (data) => {
    console.log('Trade:', data);
});
```

**Trade Object Structure:**
```javascript
{
    id: 1263159,              // Trade unique identifier
    s: "EURUSD",              // Symbol name
    p: 1.23564,               // Execution price
    t: 1548406235000000,      // Execution time (microseconds)
    q: 0.1,                   // Quantity (in lots)
    S: "buy",                 // Side: buy/sell
    oi: 1263159154,           // Order ID that was filled
    pi: 10098,                // Position ID (opened/modified/closed)
    pp: 1.23564,              // Position price
    pl: 1230.04,              // Profit/loss
    sw: 0.13,                 // Swaps
    c: 0.04,                  // Commission
    C: 1.0,                   // Profit conversion rate
    f: 0.0,                   // Fee
    T: "In",                  // Trade type: In/Out/InOut
    ct: "Trade comment"       // Trade comment
}
```

### 6. Transfers Channel (`transfers`)

Cash/asset transfer updates.

**Subscribe:**
```javascript
await tradeServerAPI.subscribeToTransfers(
    types = ['Balance', 'Credit', 'Fee']  // Optional: filter by types
);
```

**Transfer Types:**
- `Balance`, `Credit`, `Fee`, `Adjustment`, `Bonus`, `CreditBonus`
- `Commission`, `DailyCommission`, `MonthlyCommission`
- `AgentCommission`, `DailyAgentCommission`, `MonthlyAgentCommission`
- `Interest`, `Dividend`, `FrankedDividend`, `Tax`
- `StopoutCompensation`, `StopoutCreditAdjustment`

**Unsubscribe:**
```javascript
await tradeServerAPI.unsubscribeFromTransfers();
```

**Listen for Updates:**
```javascript
tradeServerAPI.subscribe('transfers', (data) => {
    console.log('Transfer:', data.type, data.data);
});
```

**Transfer Object Structure:**
```javascript
{
    id: 100000,               // Transfer unique identifier
    a: 1000.00,               // Amount
    T: "Balance",             // Transfer type
    c: "USD",                 // Currency or asset name
    t: 1726167500000000,      // Transaction timestamp (microseconds)
    ct: "Transfer comment"    // Transfer comment
}
```

### 7. Candles Channel (`ohlc`)

OHLCV (candlestick) data updates.

**Subscribe:**
```javascript
await tradeServerAPI.subscribeToCandles(
    symbol = "EURUSD",
    interval = "1H",          // 1M, 5M, 15M, 30M, 1H, 4H, D, W, M
    snapshot = false
);
```

**Unsubscribe:**
```javascript
await tradeServerAPI.unsubscribeFromCandles("EURUSD", "1H");
```

**Listen for Updates:**
```javascript
// Symbol-specific callback
tradeServerAPI.subscribe('candles_EURUSD', (data) => {
    console.log('EURUSD candle:', data.type, data.candle);
});

// All candles
tradeServerAPI.subscribe('candles', (data) => {
    console.log('Candle update:', data.type, data.candle);
});
```

**Candle Object Structure:**
```javascript
{
    s: "EURUSD",              // Symbol name
    i: "1H",                  // Interval
    t: 1778942400,            // Bar start time (microseconds)
    o: 1.12345,               // Open price
    h: 1.1237,                // High price
    l: 1.1212,                // Low price
    c: 1.12346,               // Close price
    v: 120                    // Volume
}
```

### 8. Quotes Channel (L1)

Top of book (best bid/ask) updates.

**Subscribe:**
```javascript
await tradeServerAPI.subscribeToQuotes(
    symbol = "EURUSD",
    streaming = true          // true: snapshot + updates, false: snapshot only
);
```

**Unsubscribe:**
```javascript
await tradeServerAPI.unsubscribeFromQuotes("EURUSD");
```

**Listen for Updates:**
```javascript
// Symbol-specific callback
tradeServerAPI.subscribe('quote_EURUSD', (data) => {
    console.log('EURUSD quote:', data.type, data.quote);
});

// All quotes
tradeServerAPI.subscribe('quotes', (data) => {
    console.log('Quote update:', data.type, data.quote);
});

// TradingView-compatible ticker format
tradeServerAPI.subscribe('ticker', (data) => {
    console.log('Ticker:', data.symbol, data.bid, data.ask);
});
```

**Quote Object Structure:**
```javascript
{
    s: "EURUSD",              // Symbol name
    bp: 1.13834,              // Best bid price
    bs: 500000,               // Best bid size
    ap: 1.13836,              // Best ask price
    as: 500000,               // Best ask size
    t: 1778942400000000       // Timestamp (microseconds)
}
```

### 9. Order Book Channel (L2)

Depth of market (order book) updates.

**Subscribe:**
```javascript
await tradeServerAPI.subscribeToOrderBook(
    symbol = "EURUSD",
    depth = 10,               // Number of price levels
    streaming = true          // true: snapshot + updates, false: snapshot only
);
```

**Unsubscribe:**
```javascript
await tradeServerAPI.unsubscribeFromOrderBook("EURUSD", 10);
```

**Listen for Updates:**
```javascript
// Symbol-specific callback
tradeServerAPI.subscribe('book_EURUSD', (data) => {
    console.log('EURUSD order book:', data.type, data.book);
});

// All order books
tradeServerAPI.subscribe('book', (data) => {
    console.log('Order book update:', data.type, data.book);
});
```

**Order Book Object Structure:**
```javascript
{
    s: "EURUSD",              // Symbol name
    a: [                      // Asks (sorted by price ascending)
        [45.1, 100],          // [price, volume]
        [48.4, 120]
    ],
    b: [                      // Bids (sorted by price descending)
        [24.7, 80],           // [price, volume]
        [35.6, 30]
    ],
    t: 1778942400000000       // Timestamp (microseconds)
}
```

### 10. Heartbeat Channel

Server sends heartbeat messages approximately once per second when no other updates are occurring.

**Listen for Heartbeat:**
```javascript
tradeServerAPI.subscribe('heartbeat', (message) => {
    console.log('Heartbeat received');
});
```

## Convenience Methods

### Subscribe to Symbol (Quotes)

Shorthand for subscribing to quotes:

```javascript
await tradeServerAPI.subscribeToSymbol("EURUSD");
```

### Unsubscribe from Symbol

Shorthand for unsubscribing from quotes:

```javascript
await tradeServerAPI.unsubscribeFromSymbol("EURUSD");
```

## Error Handling

All subscription methods return promises that resolve on success or reject on error:

```javascript
try {
    await tradeServerAPI.subscribeToOrders(true);
    console.log('Successfully subscribed to orders');
} catch (error) {
    console.error('Subscription failed:', error);
    if (error.error) {
        console.error('Error code:', error.error.code);
        console.error('Error message:', error.error.msg);
        console.error('Error detail:', error.error.detail);
    }
}
```

**Common Error Codes:**
- `10` - Symbol not found
- `1` - Configuration change (e.g., symbol deleted)

## Complete Example

```javascript
// Initialize API
const tradeServerAPI = new TradeServerAPI(CONFIG);

// Connect WebSocket
tradeServerAPI.connectWebSocket();

// Wait for connection (in production, handle via onopen callback)
await new Promise(resolve => setTimeout(resolve, 1000));

// Subscribe to multiple channels
try {
    // Account updates
    await tradeServerAPI.subscribeToOrders(true);
    await tradeServerAPI.subscribeToPositions(true, true);
    await tradeServerAPI.subscribeToBalances(true);
    await tradeServerAPI.subscribeToAccountStates(true);
    await tradeServerAPI.subscribeToTrades();
    
    // Market data for EURUSD
    await tradeServerAPI.subscribeToQuotes('EURUSD', true);
    await tradeServerAPI.subscribeToCandles('EURUSD', '1H', false);
    await tradeServerAPI.subscribeToOrderBook('EURUSD', 10, true);
    
    console.log('All subscriptions successful');
} catch (error) {
    console.error('Subscription error:', error);
}

// Set up event listeners
tradeServerAPI.subscribe('order_update', (data) => {
    console.log('Order update:', data);
    // Update UI with order changes
});

tradeServerAPI.subscribe('position_update', (data) => {
    console.log('Position update:', data);
    // Update UI with position changes
});

tradeServerAPI.subscribe('balance_update', (data) => {
    console.log('Balance update:', data);
    // Update UI with balance changes
});

tradeServerAPI.subscribe('ticker', (data) => {
    console.log(`${data.symbol}: Bid ${data.bid}, Ask ${data.ask}`);
    // Update TradingView chart with new price
});

// Cleanup on disconnect
window.addEventListener('beforeunload', () => {
    tradeServerAPI.disconnectWebSocket();
});
```

## Integration with TradingView

The WebSocket implementation is already integrated with the TradingView datafeed and broker API:

1. **Real-time Price Updates**: Quote updates are automatically forwarded to TradingView charts
2. **Order Updates**: Order changes trigger UI updates in the trading panel
3. **Position Updates**: Position changes update the account panel
4. **Balance Updates**: Balance changes update account equity display

The `datafeed/` and `broker-api/` modules automatically subscribe to the necessary channels and handle the data transformations for TradingView.

## Integration with TradingView

The WebSocket implementation is already integrated with the TradingView datafeed and broker API:

### Real-time Features

1. **Price Updates**: Quote updates automatically forward to TradingView charts
2. **Order Updates**: Order changes trigger UI updates in the trading panel
3. **Position Updates**: Position changes update the account panel
4. **Balance Updates**: Balance changes update account equity display

The `src/datafeed/` and `src/broker-api/` modules automatically subscribe to the necessary channels and handle the data transformations for TradingView.

### Architecture

```
TradingView Widget
       ↑
       │ (Datafeed API / Broker API)
       │
   datafeed/ & broker-api/
       ↑
       │ (Event callbacks)
       │
trade-server-api/
       ↑
       │ (WebSocket)
       │
  Trade Server
```

---

## Additional Resources

- **[REST API](REST_API.md)** - HTTP REST API documentation
- **[Architecture](ARCHITECTURE.md)** - System architecture overview
- **[Quick Start](QUICKSTART.md)** - Testing guide
- **[API Overview](API_OVERVIEW.md)** - Quick reference to all endpoints and channels

---

## Notes

- All timestamps are in **microseconds** since Unix epoch
- Connection is valid for **24 hours** and will be disconnected automatically
- Automatic reconnection is implemented with a 5-second delay
- API key is sent in message headers, not as a separate authentication step
- Maximum 256 concurrent stream subscriptions per connection
- Rate limit: 5 messages per second per connection
