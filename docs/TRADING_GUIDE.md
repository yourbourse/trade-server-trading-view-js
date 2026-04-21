<div align="center">

# Trading Guide

**Learn how to use the TradingView Trading Platform — with animated demos**

[Sign In](#signing-in) · [Platform Overview](#platform-overview) · [Placing Orders](#placing-orders) · [Managing Positions](#managing-positions) · [Account Panel](#account-management)

</div>

---

## Signing In

When you open the application, you'll be directed to the sign-in page. Enter your Trade Server credentials to access the trading terminal.

![Signing In and General Look](Signing%20In%20And%20General%20Look.gif)

| Field | What to Enter |
|-------|---------------|
| **Login** | Your numeric account number (e.g., `1002`) |
| **Password** | Your Trade Server password |
| **Server** | Your Trade Server URL (e.g., `https://uat.api.yourbourse.trade:32285`) |

After signing in:
- Your credentials are stored in the browser session (cleared when the tab closes)
- The application connects to the Trade Server via REST API and WebSocket
- Real-time data streaming begins automatically

> **Tip:** Your login number and server URL are remembered for next time (saved in localStorage). Passwords are never stored persistently.

---

## Platform Overview

The trading terminal consists of three main areas:

### 1. Header Bar

| Element | Description |
|---------|-------------|
| **Platform Title** | "YourBourse Trading Platform" |
| **User Info** | Your login number |
| **Logout Button** | Signs out and clears session |

### 2. Chart Area

The TradingView chart provides:

| Feature | Description |
|---------|-------------|
| **Candlestick Chart** | Real-time OHLC candles for the selected instrument |
| **Timeframes** | 1m, 5m, 15m, 30m, 1H, 4H, Daily, Weekly, Monthly |
| **Indicators** | 100+ built-in technical indicators |
| **Drawing Tools** | Trend lines, Fibonacci, text annotations, and more |
| **Symbol Search** | Search and switch between available instruments |
| **Chart Types** | Candles, bars, line, area, Heikin Ashi, and more |

### 3. Trading Panel (Bottom)

The bottom panel contains three tabs:

| Tab | Contents |
|-----|----------|
| **Orders** | All working and recently completed orders |
| **Positions** | Open positions with live P&L |
| **Account Summary** | Balance, equity, margin, and account details |

---

## Placing Orders

Orders can be placed through the chart's trading panel or by right-clicking on the chart.

### Market Order

A market order executes immediately at the current market price.

![Market Order Demo](MarketOrder,%20Reverse%20Position,%20Close%20Position.gif)

**How to place a Market Order:**
1. Click the **Buy** or **Sell** button in the order ticket
2. Set the **quantity** (lot size)
3. Optionally set **Stop Loss** and **Take Profit** levels
4. Click **Place Order**

The order executes instantly at the best available price.

### Limit Order

A limit order waits until the price reaches your specified level before executing.

![Limit Order Demo](Limit%20Order.gif)

**How to place a Limit Order:**
1. Open the order ticket
2. Select **Limit** as the order type
3. Enter the **limit price** — the price at which you want the order to fill
4. Set the **quantity**
5. Optionally configure **time in force** (GTC, Day, etc.)
6. Click **Place Order**

| Buy Limit | Sell Limit |
|-----------|------------|
| Price is set **below** current market | Price is set **above** current market |
| Executes when price drops to your level | Executes when price rises to your level |

### Stop Order

A stop order becomes a market order when the price reaches a specified trigger level.

![Stop Order Demo](Stop%20Order.gif)

**How to place a Stop Order:**
1. Open the order ticket
2. Select **Stop** as the order type
3. Enter the **stop price** — the trigger level
4. Set the **quantity**
5. Click **Place Order**

| Buy Stop | Sell Stop |
|----------|-----------|
| Price is set **above** current market | Price is set **below** current market |
| Triggers when price rises to your level | Triggers when price drops to your level |

### Stop-Limit Order

Combines a stop trigger with a limit price. When the stop price is reached, a limit order is placed at the specified limit price.

**How to place a Stop-Limit Order:**
1. Open the order ticket
2. Select **Stop-Limit** as the order type
3. Enter the **stop price** (trigger) and the **limit price** (execution)
4. Set the **quantity**
5. Click **Place Order**

### Time in Force Options

| TIF | Full Name | Behavior |
|-----|-----------|----------|
| **GTC** | Good Till Cancel | Remains active until filled or cancelled |
| **Day** | Day Order | Cancels at end of trading day |
| **IOC** | Immediate or Cancel | Fills immediately (partial OK), cancels remainder |
| **FOK** | Fill or Kill | Fills the entire quantity immediately or cancels completely |
| **GTD** | Good Till Date | Active until specified expiration date |

For detailed information about each order type, see the [Order Types Guide](ORDER_TYPES_GUIDE.md).

---

## Managing Positions

### Viewing Open Positions

Open the **Positions** tab in the bottom panel to see all open positions:

| Column | Description |
|--------|-------------|
| **Symbol** | Instrument name (e.g., EURUSD) |
| **Side** | Buy (Long) or Sell (Short) |
| **Qty** | Position size |
| **Avg Price** | Average entry price |
| **Current Price** | Live market price |
| **P&L** | Unrealized profit/loss (updates in real-time) |
| **SL** | Stop Loss level (if set) |
| **TP** | Take Profit level (if set) |

### Stop Loss & Take Profit

Set or modify SL/TP levels on open positions to manage risk.

![SL/TP Management](SL%20TP.gif)

**Setting SL/TP on an existing position:**
1. Right-click a position in the Positions tab
2. Select **Modify** or **Set SL/TP**
3. Enter your Stop Loss and/or Take Profit price levels
4. Confirm the modification

**Setting SL/TP from the chart:**
- Drag the SL/TP lines directly on the chart after placing an order
- The platform sends a modification request to the Trade Server

### Closing a Position

**Methods to close a position:**

1. **From the Positions tab** — Right-click → Close Position
2. **From the chart** — Click the position marker → Close
3. **Reverse** — Place an opposite order of equal size

![Close Position Demo](MarketOrder,%20Reverse%20Position,%20Close%20Position.gif)

### Reversing a Position

To reverse a position (flip from long to short or vice versa):

1. Place an order in the **opposite direction** with a quantity **greater than** your current position
2. The current position is closed and a new position opens in the opposite direction

---

## Modifying Orders

### Modify a Working Order

1. Find the order in the **Orders** tab
2. Right-click → **Modify**
3. Change the limit price, stop price, or SL/TP levels
4. Confirm the modification

### Cancel an Order

1. Find the order in the **Orders** tab
2. Right-click → **Cancel**
3. Confirm the cancellation

---

## Account Management

### Account Summary Tab

The Account Summary shows real-time financial information:

| Field | Description |
|-------|-------------|
| **Balance** | Account cash balance |
| **Credit** | Credit amount (if applicable) |
| **Equity** | Balance + Credit + Unrealized P&L |
| **Unrealized P&L** | Total profit/loss from open positions |
| **Margin** | Margin used by open positions |
| **Currency** | Account base currency |

All values update in **real-time** via WebSocket.

### Transfer History

View account transfers including deposits, withdrawals, fees, and adjustments. Available in the Account Summary tab.

---

## Keyboard Shortcuts

TradingView provides built-in keyboard shortcuts:

| Shortcut | Action |
|----------|--------|
| `Alt + O` | Open order ticket |
| `Alt + T` | Open chart trading panel |
| `Esc` | Close dialog/cancel action |
| `+` / `-` | Zoom in/out on chart |
| `←` `→` | Scroll chart |

---

## Real-time Data

All data streams update live through the WebSocket connection:

| Data Type | Update Frequency | Source Channel |
|-----------|-----------------|----------------|
| **Candles** | On each tick | `ohlc` |
| **Quotes** | On each tick | `L1` |
| **Order Book** | On each change | `L2` |
| **Orders** | On status change | `orders` |
| **Positions** | On price tick / change | `positions` |
| **Account State** | On position/balance change | `states` |
| **Trades** | On execution | `trades` |

The WebSocket connection automatically reconnects if disconnected. See [WebSocket API](WEBSOCKET_API.md) for technical details.

---

## Next Steps

| Topic | Guide |
|-------|-------|
| Deep dive into each order type | [Order Types Guide](ORDER_TYPES_GUIDE.md) |
| Understand authentication | [Authentication](AUTHENTICATION.md) |
| API endpoint reference | [API Overview](API_OVERVIEW.md) |
| Troubleshoot issues | [Troubleshooting](TROUBLESHOOTING.md) |
