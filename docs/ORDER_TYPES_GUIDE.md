<div align="center">

# Order Types Guide

**Visual guide to every order type supported by the trading platform**

[Market](#market-order) · [Limit](#limit-order) · [Stop](#stop-order) · [Stop-Limit](#stop-limit-order) · [SL/TP](#stop-loss--take-profit)

</div>

---

## Overview

The trading platform supports four order types, each suited for different trading strategies:

| Order Type | Execution | Use Case |
|------------|-----------|----------|
| **Market** | Immediately at current price | Enter/exit positions now |
| **Limit** | When price reaches a better level | Buy low, sell high |
| **Stop** | When price reaches a trigger level | Breakout trades, protection |
| **Stop-Limit** | Limit order placed after stop trigger | Precise entry after breakout |

---

## Market Order

A market order is the simplest order type — it executes **immediately** at the best available price.

### Demo

![Market Order — Place, Reverse, and Close Position](MarketOrder,%20Reverse%20Position,%20Close%20Position.gif)

### When to Use

- You want to enter or exit a position **right now**
- Speed of execution matters more than exact price
- High-liquidity instruments where slippage is minimal

### How It Works

```
Market Buy:  Your Order → Matches best ASK price → Position opened
Market Sell: Your Order → Matches best BID price → Position opened
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| **Side** | Yes | Buy or Sell |
| **Quantity** | Yes | Number of lots |
| **Stop Loss** | No | Protection price level |
| **Take Profit** | No | Target price level |

### API Request

```typescript
await tradeServerClient.trading.placeOrder({
  s: 'EURUSD',         // Symbol
  S: 'Buy',            // Side: 'Buy' or 'Sell'
  q: 1.0,              // Quantity (lots)
  t: 'Market',         // Order type
  tif: 'FOK',          // Time in force
  sl: 1.0850,          // Stop Loss (optional)
  tp: 1.0950           // Take Profit (optional)
});
```

---

## Limit Order

A limit order is placed at a specific price and waits until the market reaches that level to execute. The order fills at the **limit price or better**.

### Demo

![Limit Order Demo](Limit%20Order.gif)

### When to Use

- You want to buy at a **lower** price than the current market
- You want to sell at a **higher** price than the current market  
- You're willing to wait for the price to come to you

### How It Works

```
Buy Limit (below market):
  Current price: 1.0900
  Limit price:   1.0850
  → Order waits. Fills when price drops to 1.0850 or lower.

Sell Limit (above market):
  Current price: 1.0900
  Limit price:   1.0950
  → Order waits. Fills when price rises to 1.0950 or higher.
```

### Price Level Rules

| Direction | Limit Price Must Be | Reason |
|-----------|---------------------|--------|
| **Buy Limit** | Below current ASK | You want to buy cheaper |
| **Sell Limit** | Above current BID | You want to sell higher |

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| **Side** | Yes | Buy or Sell |
| **Quantity** | Yes | Number of lots |
| **Limit Price** | Yes | Desired execution price |
| **Time in Force** | Yes | GTC, Day, IOC, FOK, or GTD |
| **Stop Loss** | No | Protection price level |
| **Take Profit** | No | Target price level |

### API Request

```typescript
await tradeServerClient.trading.placeOrder({
  s: 'EURUSD',         // Symbol
  S: 'Buy',            // Side
  q: 1.0,              // Quantity
  t: 'Limit',          // Order type
  lp: 1.0850,          // Limit price
  tif: 'GTC',          // Good Till Cancel
  sl: 1.0800,          // Stop Loss (optional)
  tp: 1.0950           // Take Profit (optional)
});
```

---

## Stop Order

A stop order becomes a **market order** when the price reaches the specified stop (trigger) price. It is commonly used for breakout entries or as a protective stop.

### Demo

![Stop Order Demo](Stop%20Order.gif)

### When to Use

- **Breakout trading** — enter when price breaks above resistance or below support
- **Stop-loss protection** — place a sell stop below your entry to limit losses
- You want to trade the momentum of a price move

### How It Works

```
Buy Stop (above market):
  Current price: 1.0900
  Stop price:    1.0950
  → When price reaches 1.0950, a Market Buy is triggered.

Sell Stop (below market):
  Current price: 1.0900
  Stop price:    1.0850
  → When price reaches 1.0850, a Market Sell is triggered.
```

### Price Level Rules

| Direction | Stop Price Must Be | Reason |
|-----------|-------------------|--------|
| **Buy Stop** | Above current ASK | Triggers on upward breakout |
| **Sell Stop** | Below current BID | Triggers on downward breakout |

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| **Side** | Yes | Buy or Sell |
| **Quantity** | Yes | Number of lots |
| **Stop Price** | Yes | Trigger price level |
| **Time in Force** | Yes | GTC, Day, IOC, FOK, or GTD |
| **Stop Loss** | No | Protection price level |
| **Take Profit** | No | Target price level |

### API Request

```typescript
await tradeServerClient.trading.placeOrder({
  s: 'EURUSD',         // Symbol
  S: 'Buy',            // Side
  q: 1.0,              // Quantity
  t: 'Stop',           // Order type
  sp: 1.0950,          // Stop (trigger) price
  tif: 'GTC',          // Good Till Cancel
  sl: 1.0900,          // Stop Loss (optional)
  tp: 1.1050           // Take Profit (optional)
});
```

---

## Stop-Limit Order

A stop-limit order combines a **stop trigger** with a **limit price**. When the stop price is reached, a limit order is placed (instead of a market order), giving you more control over the execution price.

### When to Use

- You want to enter on a breakout, but **only at a specific price or better**
- You need protection against slippage in volatile markets
- Precise entry is more important than guaranteed execution

### How It Works

```
Buy Stop-Limit:
  Current price: 1.0900
  Stop price:    1.0950  (trigger)
  Limit price:   1.0960  (max buy price)
  
  → When price reaches 1.0950, a Buy Limit at 1.0960 is placed.
  → The order fills at 1.0960 or lower (if available).
  → If price jumps past 1.0960, the order may NOT fill.

Sell Stop-Limit:
  Current price: 1.0900
  Stop price:    1.0850  (trigger)
  Limit price:   1.0840  (min sell price)
  
  → When price reaches 1.0850, a Sell Limit at 1.0840 is placed.
  → The order fills at 1.0840 or higher (if available).
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| **Side** | Yes | Buy or Sell |
| **Quantity** | Yes | Number of lots |
| **Stop Price** | Yes | Trigger price level |
| **Limit Price** | Yes | Execution price limit |
| **Time in Force** | Yes | GTC, Day, IOC, FOK, or GTD |
| **Stop Loss** | No | Protection price level |
| **Take Profit** | No | Target price level |

### API Request

```typescript
await tradeServerClient.trading.placeOrder({
  s: 'EURUSD',         // Symbol
  S: 'Buy',            // Side
  q: 1.0,              // Quantity
  t: 'StopLimit',      // Order type
  sp: 1.0950,          // Stop (trigger) price
  lp: 1.0960,          // Limit price
  tif: 'GTC',          // Good Till Cancel
});
```

---

## Stop Loss & Take Profit

Stop Loss (SL) and Take Profit (TP) are protective levels that can be attached to **orders** and **positions**.

### Demo

![Stop Loss and Take Profit](SL%20TP.gif)

### Concepts

| Level | Purpose | Triggers |
|-------|---------|----------|
| **Stop Loss** | Limits losses on a position | When price moves **against** you past the SL level |
| **Take Profit** | Locks in profits | When price moves **in your favor** past the TP level |

### Setting SL/TP on a New Order

Include `sl` and `tp` parameters when placing any order:

```typescript
await tradeServerClient.trading.placeOrder({
  s: 'EURUSD',
  S: 'Buy',
  q: 1.0,
  t: 'Market',
  tif: 'FOK',
  sl: 1.0850,    // Stop Loss: close if price drops to 1.0850
  tp: 1.0950     // Take Profit: close if price rises to 1.0950
});
```

### Modifying SL/TP on a Working Order

```typescript
await tradeServerClient.trading.modifyOrderSLTP(orderId, 1.0840, 1.0960);
// Parameters: orderId, stopLoss, takeProfit
// Pass undefined to keep the current value
```

### Modifying SL/TP on an Open Position

```typescript
await tradeServerClient.trading.modifyPositionSLTP(positionId, 1.0840, 1.0960);
// Parameters: positionId, stopLoss, takeProfit
// Pass undefined to keep the current value
```

### Visual Interaction

On the TradingView chart, SL/TP levels are displayed as horizontal lines:
- **Red line** — Stop Loss level
- **Green line** — Take Profit level
- **Drag** the lines to modify levels directly on the chart

---

## Order Status Lifecycle

Orders move through these statuses:

```
                    ┌──────────┐
           ┌──────►│ Cancelled │
           │       └──────────┘
           │
┌──────────┤       ┌──────────┐
│ Working  ├──────►│  Filled  │
└──────────┤       └──────────┘
           │
           │       ┌──────────┐
           ├──────►│ Rejected │
           │       └──────────┘
           │
           │       ┌──────────┐
           └──────►│ Expired  │
                   └──────────┘
```

| Status | Meaning |
|--------|---------|
| **Inactive** | Order accepted but not yet active (e.g., Stop-Limit before trigger) |
| **Working** | Order is active and waiting to be filled |
| **Partially Filled** | Part of the order has been filled |
| **Filled** | Order is completely filled |
| **Cancelled** | Order was cancelled by the user |
| **Rejected** | Order was rejected by the server |
| **Expired** | Order expired (e.g., Day order at end of session) |

---

## Order Type Comparison

| Feature | Market | Limit | Stop | Stop-Limit |
|---------|--------|-------|------|------------|
| Execution guarantee | Yes | No | No | No |
| Price guarantee | No | Yes | No | Yes |
| Requires limit price | No | Yes | No | Yes |
| Requires stop price | No | No | Yes | Yes |
| Best for | Instant execution | Precise entry | Breakout / protection | Precise breakout |
| Risk | Slippage in volatile markets | May not fill | Slippage after trigger | May not fill after trigger |

---

## Next Steps

| Topic | Guide |
|-------|-------|
| Platform navigation | [Trading Guide](TRADING_GUIDE.md) |
| API endpoint details | [REST API Reference](REST_API.md) |
| Real-time data | [WebSocket API Reference](WEBSOCKET_API.md) |
| Code examples | [Account Methods Examples](ACCOUNT_METHODS_EXAMPLES.md) |
