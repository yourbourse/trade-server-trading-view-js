<div align="center">

# API Overview

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![REST API](https://img.shields.io/badge/REST-31%20endpoints-blue)](REST_API.md)
[![WebSocket](https://img.shields.io/badge/WebSocket-10%20channels-green)](WEBSOCKET_API.md)

**Complete reference to the YourBourse Trade Server API integration**

[REST Endpoints](#rest-api-endpoints) · [WebSocket Channels](#websocket-channels) · [Authentication](#authentication) · [Rate Limits](#rate-limits)

</div>

---

## Overview

This application provides complete TypeScript integration with the **YourBourse Trading Platform API v0.0.845**, offering both REST and WebSocket connectivity for trading operations and real-time market data.

### API Capabilities

| Feature | REST | WebSocket | Details |
|---------|:----:|:---------:|--------|
| **Authentication** | ✅ | ✅ | HMAC-SHA256, token management |
| **Account Info** | ✅ | ✅ | Balance, equity, margin, P&L |
| **Orders** | ✅ | ✅ | Place, modify, cancel (all types) |
| **Positions** | ✅ | ✅ | Open positions with live P&L |
| **Market Data** | ✅ | ✅ | Quotes, candles, order book |
| **Trade History** | ✅ | ✅ | Completed trades and transfers |
| **Real-time Updates** | ❌ | ✅ | Live streaming data |

---

## REST API (31 Endpoints)

HTTP endpoints for account management, order placement, and market data retrieval.

### Endpoint Categories

| Category | Endpoints | Documentation |
|----------|:---------:|---------------|
| **Authentication** | 4 | [REST_API.md#authentication](REST_API.md#authentication) |
| **Account Info** | 4 | [REST_API.md#account-information](REST_API.md#account-information) |
| **Order Management** | 10 | [REST_API.md#order-management](REST_API.md#order-management) |
| **Market Data** | 6 | [REST_API.md#market-data](REST_API.md#market-data) |
| **Trade History** | 3 | [REST_API.md#trade-history](REST_API.md#trade-history) |
| **Utilities** | 4 | [REST_API.md#utility-methods](REST_API.md#utility-methods) |

**📖 For complete REST API reference:** [REST_API.md](REST_API.md)

**📝 For practical code examples:** [ACCOUNT_METHODS_EXAMPLES.md](ACCOUNT_METHODS_EXAMPLES.md)

---

## WebSocket API (9 Channels)

Real-time data streaming for market data, account updates, and trade executions.

### Channel Categories

#### Account & Trading Channels (5)

| Channel | Description | Snapshot | Streaming |
|---------|-------------|:--------:|:---------:|
| **orders** | Order updates (create, modify, fill, cancel) | ✅ | ✅ |
| **positions** | Position changes and P&L updates | ✅ | ✅ |
| **balances** | Balance and collateral updates | ✅ | ✅ |
| **states** | Account state (equity, margin) | ✅ | ✅ |
| **trades** | Trade execution notifications | ❌ | ✅ |

#### Market Data Channels (3)

| Channel | Description | Symbols | Intervals |
|---------|-------------|:-------:|:---------:|
| **ohlc** | OHLCV candlestick data | Multiple | 1M-M |
| **L1** | Top of book (best bid/ask) | Multiple | Real-time |
| **L2** | Order book depth | Multiple | Real-time |

#### System Channels (1)

| Channel | Description |
|---------|-------------|
| **heartbeat** | Server heartbeat (~1s) |

**📖 For complete WebSocket API reference:** [WEBSOCKET_API.md](WEBSOCKET_API.md)

---

## Quick Reference

### Authentication

```typescript
// REST API - Sign in
const response = await api.signIn('username', 'password');
```

All authenticated requests use **HMAC-SHA256** signatures with microsecond-precision timestamps. Helper functions available in `src/utils/api-helpers.ts`.

### Placing Orders

```typescript
// REST API - Place market order
await api.placeOrder({
  s: 'EURUSD',
  q: 1.0,
  S: 'buy',
  t: 'Market',
  tif: 'FOK'
});
```

**Order Types:** Market, Limit, Stop, StopLimit  
**Time in Force:** FOK, IOC, GTC, GTD, Day

### WebSocket Subscriptions

```typescript
// Subscribe to account updates
await api.subscribeToOrders(true);
await api.subscribeToPositions(true, true);

// Subscribe to market data
await api.subscribeToQuotes('EURUSD', true);
await api.subscribeToCandles('EURUSD', '15M', false);

// Listen for updates
api.subscribe('order_update', (data) => {
  console.log('Order updated:', data);
});
```

---

## Setup Requirements

### TradingView Charting Library

This integration requires the **TradingView Charting Library** (proprietary):

1. **Obtain License**: Contact TradingView at https://www.tradingview.com/HTML5-stock-forex-bitcoin-charting-library/
2. **Download Library**: Receive the library package from TradingView
3. **Install**: Extract `charting_library/` folder to project root
4. **Verify**: Check that required files exist in `charting_library/`

> ⚠️ The library is NOT included in this repository due to licensing restrictions.

## Configuration

Configure API endpoints in `src/config.ts`:

```typescript
export const CONFIG: AppConfig = {
  tradeServer: {
    server: 'https://ts285-uat.yourbourse.trade',
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

---

## Rate Limits

### REST API
- Rate limits enforced per endpoint (weight-based)
- Check `X-YB-USED-WEIGHT-*` headers in responses
- 429 error includes `Retry-After` header

### WebSocket
- **5 messages/second** per connection
- **256 concurrent streams** maximum
- **24-hour** connection lifetime
- **300 connection attempts** per IP every 5 minutes

---

## Integration Architecture

### Component Structure

```
TradingView Widget
       ↑
       │ (Datafeed API / Broker API)
       │
src/datafeed/ & src/broker-api/
       ↑
       │ (Event callbacks)
       │
src/trade-server-api/
       ↑
       │ (REST & WebSocket)
       │
  Trade Server
```

### Key Modules

| Module | Purpose | Documentation |
|--------|---------|---------------|
| **src/trade-server-api/** | API client implementation | This file |
| **src/datafeed/** | TradingView market data | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **src/broker-api/** | TradingView trading interface | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **src/app.ts** | Application lifecycle | [TYPESCRIPT_SETUP.md](TYPESCRIPT_SETUP.md) |
| **src/config.ts** | Configuration management | [QUICKSTART.md](QUICKSTART.md) |

**📖 For complete architecture details:** [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Additional Resources

### 📚 Documentation
- **[Documentation Index](README.md)** - Complete documentation overview
- **[REST API Reference](REST_API.md)** - Complete HTTP endpoint documentation
- **[REST API Examples](ACCOUNT_METHODS_EXAMPLES.md)** - Practical code samples
- **[WebSocket API Reference](WEBSOCKET_API.md)** - Real-time channel documentation
- **[Architecture Overview](ARCHITECTURE.md)** - System design and data flows

### 🚀 Getting Started
- **[Quick Start Guide](QUICKSTART.md)** - Testing and debugging guide
- **[TypeScript Setup](TYPESCRIPT_SETUP.md)** - Development workflow
- **[Vite Configuration](VITE_SETUP.md)** - Build system setup

### 📋 Specifications
- **OpenAPI 3.0** - `schema/openapi.yaml` (REST API)
- **AsyncAPI 3.0** - `schema/asyncapi.yaml` (WebSocket API)
