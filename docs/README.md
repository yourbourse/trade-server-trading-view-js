<div align="center">

# Documentation

**Comprehensive guides for the TradingView Trading Platform**

[Getting Started](GETTING_STARTED.md) · [Quick Start](QUICKSTART.md) · [Trading Guide](TRADING_GUIDE.md) · [API Reference](API_OVERVIEW.md) · [Architecture](ARCHITECTURE.md)

</div>

---

## Getting Started

New to the project? Start here:

1. **[Getting Started Guide](GETTING_STARTED.md)** — Full installation walkthrough, environment setup, and first run
2. **[Quick Start](QUICKSTART.md)** — Fast track for experienced developers
3. **[Configuration Reference](CONFIGURATION.md)** — All configuration options explained

---

## Setup Guides

| Guide | Description |
|-------|-------------|
| [Getting Started](GETTING_STARTED.md) | Step-by-step installation, TradingView library setup, and first launch |
| [Quick Start](QUICKSTART.md) | Minimal steps to get running — for developers who know what they're doing |
| [Configuration](CONFIGURATION.md) | Trade Server URLs, WebSocket settings, TradingView options, and more |
| [TypeScript Setup](TYPESCRIPT_SETUP.md) | TypeScript compiler configuration, path aliases, and type-checking |
| [Vite Setup](VITE_SETUP.md) | Vite build tool, dev server, custom plugins, and multi-page builds |

---

## Usage Guides

| Guide | Description |
|-------|-------------|
| [Trading Guide](TRADING_GUIDE.md) | Complete walkthrough of the trading platform with animated demos |
| [Order Types Guide](ORDER_TYPES_GUIDE.md) | Visual guide to every order type — Market, Limit, Stop, Stop-Limit |
| [Visual Demonstrations](VISUAL_DEMOS.md) | Detailed explanations of each demo GIF — what's happening step-by-step |
| [Sign-in Flow](SIGNIN.md) | How authentication works, session management, and credential storage |
| [Authentication](AUTHENTICATION.md) | HMAC-SHA256 signing, API keys, and security architecture |

### Demo Animations

All GIF demonstrations with detailed explanations are available in the [Visual Demonstrations Guide](VISUAL_DEMOS.md).

| Demo | What it shows |
|------|---------------|
| ![Sign In](Signing%20In%20And%20General%20Look.gif) | Signing in and general platform overview |
| ![Market Orders](MarketOrder,%20Reverse%20Position,%20Close%20Position.gif) | Placing market orders, reversing and closing positions |
| ![Limit Orders](Limit%20Order.gif) | Placing and managing limit orders |
| ![Stop Orders](Stop%20Order.gif) | Placing stop orders |
| ![SL/TP](SL%20TP.gif) | Setting stop loss and take profit levels |

---

## API Reference

| Reference | Description |
|-----------|-------------|
| [API Overview](API_OVERVIEW.md) | High-level summary — 31 REST endpoints, 10 WebSocket channels |
| [REST API](REST_API.md) | Complete HTTP REST API with request/response schemas |
| [WebSocket API](WEBSOCKET_API.md) | Real-time channels, message formats, subscription lifecycle |
| [Account Methods Examples](ACCOUNT_METHODS_EXAMPLES.md) | Practical code examples for account and trading operations |

---

## Architecture & Development

| Document | Description |
|----------|-------------|
| [Architecture](ARCHITECTURE.md) | System overview, data flow diagrams, component design |
| [Development Guide](DEVELOPMENT.md) | Project structure, workflow, and conventions |
| [Code Standards](CODE_STANDARDS.md) | Import conventions, formatting rules, and best practices |
| [Contributing Guide](CONTRIBUTING.md) | Code standards, pull request process, and contribution guidelines |
| [Troubleshooting](TROUBLESHOOTING.md) | Common issues, debugging techniques, and solutions |
| [FAQ](FAQ.md) | Frequently asked questions |

---

## Quick Reference

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR (port 8080) |
| `npm run build` | Build optimized production bundle to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run type-check` | Run TypeScript type checking |
| `npm run lint` | Run ESLint code quality checks |

### Key Files

| File | Purpose |
|------|---------|
| `src/config.ts` | Runtime configuration (Trade Server URLs, WebSocket settings) |
| `src/app.ts` | Application entry point and lifecycle |
| `src/broker-api/broker-api.ts` | TradingView Broker API implementation |
| `src/datafeed/datafeed.ts` | TradingView Datafeed API implementation |
| `src/trade-server-api/TradeServerClient.ts` | Trade Server REST + WebSocket client |

### Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | 5.3+ | Type-safe development |
| Vite | 5.0+ | Build tool and dev server |
| TradingView Charting Library | Latest | Charting and trading UI |
| WebSocket | Native | Real-time data streaming |
| CryptoJS | 4.2.0 | HMAC-SHA256 authentication |
