<div align="center">

# Frequently Asked Questions

**Quick answers to common questions**

[General](#general) · [Setup](#setup) · [Trading](#trading) · [Technical](#technical) · [Security](#security)

</div>

---

## General

### What is this project?

A production-ready integration of [TradingView's Charting Library](https://www.tradingview.com/HTML5-stock-forex-bitcoin-charting-library/) with [YourBourse Trade Server](https://yourbourse.com/). It provides a fully-featured trading terminal — charting, order management, real-time data, and account monitoring — in a modern TypeScript web application.

### What can I do with it?

- View real-time and historical market data with professional charts
- Place and manage all order types (Market, Limit, Stop, Stop-Limit)
- Monitor open positions with live P&L
- Set and modify Stop Loss and Take Profit levels
- View account balance, equity, and margin in real-time
- Review trade history and transfers

### What license is this project under?

Note that the **TradingView Charting Library** is proprietary and requires a separate commercial license — it is not included in this repository.

---

## Setup

### Do I need a TradingView license?

**Yes.** The TradingView Charting Library is proprietary software. You must obtain a commercial license from [TradingView](https://www.tradingview.com/HTML5-stock-forex-bitcoin-charting-library/) separately. The library is not included in this repository.

### Do I need a Trade Server?

**Yes.** You need access to a YourBourse Trade Server instance with valid credentials (login, password, and server URL). Contact [YourBourse](https://yourbourse.com/) for access.

### What browsers are supported?

Any modern browser with WebSocket and ES2020 support:

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 80+ |
| Firefox | 78+ |
| Edge | 80+ |
| Safari | 14+ |

### Can I use this without the submodule setup?

**Yes.** The application works standalone. Just place the TradingView `charting_library/` folder in the project root. See the [Getting Started Guide](GETTING_STARTED.md) for details.

### Why does the library need to be in two places?

| Location | Reason |
|----------|--------|
| `charting_library/` (root) | TypeScript type imports, IDE support, and source for production builds |
| `public/charting_library/` | Static assets served by Vite dev server (TradingView dynamically loads JS/CSS bundles at runtime) |

**Both locations are gitignored** — users must create them after obtaining the library.

---

## Trading

### What order types are supported?

| Type | Description |
|------|-------------|
| **Market** | Execute immediately at best available price |
| **Limit** | Execute at a specified price or better |
| **Stop** | Trigger a market order when price reaches a level |
| **Stop-Limit** | Trigger a limit order when price reaches a level |

See the [Order Types Guide](ORDER_TYPES_GUIDE.md) for detailed explanations.

### What time-in-force options are available?

| TIF | Behavior |
|-----|----------|
| **GTC** | Good Till Cancel — stays active until filled or manually cancelled |
| **Day** | Cancels at end of trading session |
| **IOC** | Immediate or Cancel — fills what it can immediately, cancels rest |
| **FOK** | Fill or Kill — must fill entirely immediately, or cancel |
| **GTD** | Good Till Date — stays active until a specified expiration |

### Can I set Stop Loss and Take Profit?

**Yes.** SL/TP can be set:
- When placing a new order (as part of the order parameters)
- On an existing working order (modify order SL/TP)
- On an open position (modify position SL/TP)
- By dragging lines directly on the chart

See the [SL/TP section](ORDER_TYPES_GUIDE.md#stop-loss--take-profit) in the Order Types Guide.

### Is paper trading / demo mode available?

The platform connects to whatever Trade Server you configure. If your Trade Server has a demo/test environment, you can use that by entering the demo server URL when signing in.

---

## Technical

### What is the tech stack?

| Technology | Purpose |
|------------|---------|
| TypeScript 5.3+ | Type-safe application code |
| Vite 5.0+ | Build tool and dev server |
| TradingView Charting Library | Charts and trading UI |
| WebSocket (native) | Real-time data streaming |
| CryptoJS 4.2.0 | HMAC-SHA256 authentication |

### Why doesn't this use React/Vue/Angular?

The TradingView Charting Library manages its own DOM. Adding a framework would add complexity without benefit — the chart widget is the entire UI. The application uses vanilla TypeScript with TradingView's built-in UI components.

### How does authentication work?

1. **Sign-in** → Username/password sent to REST API → Returns an API token
2. **REST requests** → HMAC-SHA256 signed with the signing token
3. **WebSocket** → API key sent in message headers

See the [Authentication Guide](AUTHENTICATION.md) for details.

### How does real-time data work?

A single WebSocket connection multiplexes 10 channels:

| Channel Type | Channels | Purpose |
|-------------|----------|---------|
| Account | orders, positions, balances, states, trades | Trading data |
| Market | ohlc, L1, L2 | Price data |
| System | heartbeat | Keep-alive |

See the [WebSocket API Reference](WEBSOCKET_API.md).

### What are the rate limits?

| Limit | Value |
|-------|-------|
| WebSocket messages | 5/second per connection |
| Max streams | 256 per connection |
| Connection lifetime | 24 hours |
| Connection attempts | 300 per 5 minutes per IP |
| Concurrent connections | 10 per IP |
| REST API | Weight-based (429 responses) |

### Can I modify the chart appearance?

**Yes.** The TradingView widget supports extensive customization through:
- `theme: 'dark'` or `'light'` in config
- `css/custom.css` for CSS overrides
- Widget constructor options (see [TradingView docs](https://www.tradingview.com/charting-library-docs/))

### How is the SDK generated?

The TypeScript SDK in `src/schema/public-api/` is auto-generated from the OpenAPI specification (`src/schema/openapi.json`). **Do not manually edit** generated files — they will be overwritten.

---

## Security

### Are my credentials safe?

| Storage | What's Stored | Lifetime |
|---------|---------------|----------|
| `sessionStorage` | Login, password, API token, signing token | Until tab closes |
| `localStorage` | Login number, server URL (no password) | Persistent |

- Passwords are **never** stored in localStorage
- Session data is cleared when the browser tab is closed
- All API requests use HTTPS
- POST/PUT/DELETE requests are HMAC-SHA256 signed

### What is HMAC authentication?

Every authenticated request includes:
- `X-YB-API-Key` — Your API token
- `X-YB-Timestamp` — Microsecond timestamp
- `X-YB-Sign` — HMAC-SHA256 signature of the request body + timestamp

This ensures requests can't be tampered with or replayed. See the [Authentication Guide](AUTHENTICATION.md).

### Is HTTPS required?

**Yes** for production use. The sign-in page accepts HTTP URLs for local development, but all production deployments should use HTTPS/WSS to protect credentials in transit.

Request tracing also prefers the Web Crypto API (`crypto.getRandomValues`) to generate W3C `traceparent` IDs. That API is only guaranteed in [secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) (HTTPS or `localhost`). If it is unavailable, the client falls back to `Math.random()` so API calls still succeed — but brokers embedding this library should still serve it over HTTPS.

---

## Still have questions?

- Check the [Troubleshooting Guide](TROUBLESHOOTING.md) for common issues
- Review the [Architecture](ARCHITECTURE.md) for how components work together
- Open an issue on the repository

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](GETTING_STARTED.md) | Complete installation and setup walkthrough |
| [Troubleshooting](TROUBLESHOOTING.md) | Solutions to common issues |
| [Trading Guide](TRADING_GUIDE.md) | How to use the trading platform |
| [Order Types Guide](ORDER_TYPES_GUIDE.md) | Visual guide to all order types |
| [API Overview](API_OVERVIEW.md) | REST and WebSocket API reference |
| [Documentation Index](README.md) | Complete documentation overview |
