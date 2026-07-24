<div align="center">

# TradingView Trading Platform

**A production-ready integration of TradingView's Advanced Charts with YourBourse Trade Server**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TradingView](https://img.shields.io/badge/TradingView-Charting%20Library-131722?logo=tradingview&logoColor=white)](https://www.tradingview.com/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-green?logo=socket.io&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
![License](https://img.shields.io/badge/License-Proprietary-red.svg)

<br>

A fully-featured trading terminal that connects TradingView's charting capabilities with YourBourse Trade Server, providing real-time market data streaming, order management, and account monitoring — all in a modern TypeScript application.

<br>

![Trading Platform Overview](docs/Signing%20In%20And%20General%20Look.gif)

<br>

[Getting Started](docs/GETTING_STARTED.md) · [Quick Start](docs/QUICKSTART.md) · [Trading Guide](docs/TRADING_GUIDE.md) · [API Reference](docs/API_OVERVIEW.md) · [Architecture](docs/ARCHITECTURE.md)

</div>

---

> [!WARNING]
> **Supported TradingView Version:** This project is built and tested against **TradingView Charting Library v30.3.0** and the **Broker API v30.3.0** bundled with it. Using a different version may result in breaking changes, missing features, or unexpected behavior. Please ensure you are using a compatible version before proceeding.

---

## Highlights

| Feature | Description |
|---------|-------------|
| **Advanced Charting** | Full TradingView charting with 100+ indicators, drawing tools, and multiple chart layouts |
| **Live Trading** | Place, modify, and cancel Market, Limit, Stop, and Stop-Limit orders directly from charts |
| **Real-time Data** | WebSocket streaming for market data (OHLC, L1 quotes, L2 order book), orders, positions, and account state |
| **Account Management** | Monitor balance, equity, margin, P&L, and trade history in real-time |
| **Stop Loss / Take Profit** | Set and modify SL/TP on orders and positions with visual chart interaction |
| **HMAC Authentication** | Secure API authentication with HMAC-SHA256 signed requests |
| **TypeScript** | Full type safety with auto-generated SDK from OpenAPI/AsyncAPI specs |
| **Vite** | Lightning-fast HMR development and optimized production builds |

---

## Quick Start

```bash
# 1. Clone and install
git clone <repository-url>
cd client
npm install

# 2. Add TradingView Charting Library
# Obtain from TradingView, extract to charting_library/
# See Getting Started guide for details

# 3. Start development server
npm run dev
# Opens at http://localhost:8080
```

> **Note:** The TradingView Charting Library is **proprietary and NOT included** in this repository (both `charting_library/` and `public/charting_library/` are gitignored). See the [Getting Started Guide](docs/GETTING_STARTED.md) for detailed setup instructions.

---

## Demo

| | |
|:---:|:---:|
| ![Sign In & Overview](docs/Signing%20In%20And%20General%20Look.gif) | ![Market Orders](docs/MarketOrder,%20Reverse%20Position,%20Close%20Position.gif) |
| **Sign In & Platform Overview** | **Market Orders, Reverse & Close Positions** |
| ![Limit Orders](docs/Limit%20Order.gif) | ![Stop Orders](docs/Stop%20Order.gif) |
| **Limit Orders** | **Stop Orders** |
| ![SL/TP Management](docs/SL%20TP.gif) | |
| **Stop Loss & Take Profit** | |

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| **Node.js** | v18.0 or higher ([download](https://nodejs.org/)) |
| **TradingView Charting Library** | Commercial license required ([request access](https://www.tradingview.com/HTML5-stock-forex-bitcoin-charting-library/)) |
| **YourBourse Trade Server** | API access with valid credentials |
| **Modern Browser** | Chrome, Firefox, Edge, or Safari with WebSocket support |
| **HTTPS (production)** | Required for credentials and Web Crypto–based request tracing; `localhost` is fine for local development |

---

## Documentation

### Setup & Configuration

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/GETTING_STARTED.md) | Step-by-step installation and environment setup |
| [Quick Start](docs/QUICKSTART.md) | Fast track for experienced developers |
| [Configuration](docs/CONFIGURATION.md) | All configuration options explained |
| [TypeScript Setup](docs/TYPESCRIPT_SETUP.md) | TypeScript compiler and path alias configuration |
| [Vite Setup](docs/VITE_SETUP.md) | Vite build tool configuration and plugins |

### Usage Guides

| Guide | Description |
|-------|-------------|
| [Trading Guide](docs/TRADING_GUIDE.md) | How to use the trading platform with visual examples |
| [Order Types Guide](docs/ORDER_TYPES_GUIDE.md) | Detailed guide for each order type with demos |
| [Visual Demonstrations](docs/VISUAL_DEMOS.md) | Step-by-step explanations of all demo GIFs |
| [Sign-in Flow](docs/SIGNIN.md) | Authentication flow and session management |
| [Authentication](docs/AUTHENTICATION.md) | HMAC-SHA256 authentication deep dive |

### API Reference

| Reference | Description |
|-----------|-------------|
| [API Overview](docs/API_OVERVIEW.md) | Complete API surface — 31 REST endpoints, 10 WebSocket channels |
| [REST API](docs/REST_API.md) | Full HTTP REST API reference with request/response examples |
| [WebSocket API](docs/WEBSOCKET_API.md) | Real-time WebSocket channels, message formats, and subscriptions |
| [Account Methods](docs/ACCOUNT_METHODS_EXAMPLES.md) | Practical code examples for account operations |

### Architecture & Development

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System architecture, data flows, and component design |
| [Development Guide](docs/DEVELOPMENT.md) | Contributing, code style, project structure, and workflow |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Common issues, debugging tips, and solutions |
| [FAQ](docs/FAQ.md) | Frequently asked questions |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Browser Client                    │
├──────────────────────┬──────────────────────────────┤
│   TradingView Widget │                              │
│   ┌────────┐ ┌─────┐│  ┌──────────┐ ┌───────────┐  │
│   │ Charts ├─┤Trade││  │ Datafeed │ │ Broker API│  │
│   └────────┘ └─────┘│  └─────┬────┘ └─────┬─────┘  │
│                      │        │             │        │
│                      │  ┌─────┴─────────────┴─────┐  │
│                      │  │   TradeServerClient      │  │
│                      │  │  ┌──────┐  ┌──────────┐  │  │
│                      │  │  │ REST │  │WebSocket  │  │  │
│                      │  │  │Client│  │  Client   │  │  │
│                      │  │  └──┬───┘  └────┬─────┘  │  │
│                      │  └─────┼───────────┼────────┘  │
└──────────────────────┴────────┼───────────┼──────────┘
                                │           │
                         HTTPS  │    WSS    │
                                ▼           ▼
                    ┌───────────────────────────────┐
                    │   YourBourse Trade Server     │
                    │   /api/v1    /ws/v1           │
                    └───────────────────────────────┘
```

### Key Modules

| Module | Path | Purpose |
|--------|------|---------|
| **Datafeed** | `src/datafeed/` | Implements TradingView's `IDatafeedChartApi` — symbol search, historical bars, real-time candle/quote streaming |
| **Broker API** | `src/broker-api/` | Implements TradingView's `IBrokerTerminal` — order placement, position management, account info display |
| **Trade Server Client** | `src/trade-server-api/` | REST + WebSocket client for YourBourse Trade Server with auto-reconnect and subscription management |
| **Schema** | `src/schema/` | OpenAPI/AsyncAPI specs with auto-generated TypeScript SDK |
| **Types** | `src/types/` | Shared TypeScript interfaces for configuration and domain models |
| **Utils** | `src/utils/` | HMAC authentication, logging, error handling, notifications |

---

## Project Structure

```
client/
├── src/
│   ├── app.ts                          # Application entry point & lifecycle
│   ├── config.ts                       # Runtime configuration loader
│   ├── signin.ts                       # Sign-in page controller
│   ├── broker-api/
│   │   ├── broker-api.ts               # TradingView Broker API implementation
│   │   ├── abstract-broker-minimal.ts  # Abstract base class
│   │   ├── type-mappings.ts            # Trade Server ↔ TradingView type converters
│   │   ├── types.ts                    # Broker-specific enums and types
│   │   └── columns.ts                  # Account Manager column definitions
│   ├── datafeed/
│   │   ├── datafeed.ts                 # TradingView Datafeed implementation
│   │   ├── ITradeServerApi.ts          # API interface contract
│   │   └── SubscriberInfo.ts           # Bar subscriber metadata
│   ├── trade-server-api/
│   │   ├── TradeServerClient.ts        # Main API facade
│   │   ├── rest/                       # REST service layer
│   │   │   ├── AuthService.ts          #   Authentication (sign-in, token refresh)
│   │   │   ├── TradingService.ts       #   Orders, positions, trade history
│   │   │   ├── MarketDataService.ts    #   Symbols, candles, quotes, order book
│   │   │   └── AccountService.ts       #   Balance, account state, limits
│   │   ├── websocket/                  # WebSocket infrastructure
│   │   │   ├── WebSocketClient.ts      #   Connection, reconnect, heartbeat
│   │   │   ├── SubscriptionManager.ts  #   Pub/sub event bus
│   │   │   └── MessageRouter.ts        #   Message → event routing
│   │   ├── errors/                     # Typed error hierarchy
│   │   └── types/                      # WebSocket message types
│   ├── schema/                         # OpenAPI/AsyncAPI specs + generated SDK
│   ├── types/                          # Shared TypeScript interfaces
│   └── utils/                          # Auth, logging, errors, notifications
├── css/                                # Stylesheets
├── docs/                               # Documentation and demo GIFs
├── index.html                          # Main trading terminal page
├── signin.html                         # Authentication page
├── package.json
├── vite.config.ts                      # Vite build configuration
└── tsconfig.json                       # TypeScript configuration
```

---

## Using as a Git Submodule

This repository is designed to work as a submodule in the **private deployment repository** that contains the proprietary `charting_library/` at its root.

| Benefit | Details |
|---------|---------|
| **Security** | Proprietary TradingView library never committed to public repo |
| **Easy updates** | Client code updates via `git submodule update` |
| **Deployment ready** | Parent repo handles Docker, CI/CD, server config, and SSL |

```bash
# In the parent (private) repository:
git clone --recurse-submodules <parent-repo-url>
cd parent-repo
cd client && npm install && npm run dev
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR (port 8080) |
| `npm run build` | Build optimized production bundle to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run type-check` | Run TypeScript type checking |
| `npm run lint` | Run ESLint code quality checks |
| `npm run contracts-public` | Regenerate TypeScript types from OpenAPI specification |

> **Tip:** When this repo is used as a submodule, you can run `npm run type-check` and `npm run lint` from the parent repository root.

### Regenerating API Types

To update TypeScript types when the Trade Server API changes:

1. Download the latest `openapi.json` from your Trade Server's OpenAPI documentation endpoint
2. Replace `src/schema/openapi.json` with the downloaded file
3. Run `npm run contracts-public` to regenerate TypeScript types in `src/schema/public-api/`

See the [Development Guide](docs/DEVELOPMENT.md#regenerating-typescript-types-from-openapi) for detailed instructions.

---

## License

Copyright (c) 2024-2026 YourBourse. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, distribution, modification, or use of this software, via any medium, is strictly prohibited.
