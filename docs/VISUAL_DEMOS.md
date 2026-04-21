<div align="center">

# Visual Demonstrations

**Step-by-step visual guides showing the trading platform in action**

[Sign-in & Overview](#signing-in-and-platform-overview) · [Market Orders](#market-orders-reverse--close-positions) · [Limit Orders](#limit-orders) · [Stop Orders](#stop-orders) · [Stop Loss & Take Profit](#stop-loss--take-profit)

</div>

---

## Signing In and Platform Overview

![Signing In And General Look](Signing%20In%20And%20General%20Look.gif)

### What This Demonstrates

This demo shows the complete authentication flow and platform overview:

**Sign-In Process:**
1. **Sign-in page appears** — Enter your account credentials
   - **Login:** Your numeric account number (e.g., 1002)
   - **Password:** Your Trade Server password
   - **Server:** Trade Server URL (e.g., `https://uat.api.yourbourse.trade:32285`)

2. **Authentication** — Credentials are validated against the Trade Server REST API
   - POST request to `/api/v1/authorize`
   - Returns API token and signing token
   - Credentials saved to browser sessionStorage

3. **Redirect to trading terminal** — Successful authentication redirects to the main application

**Platform Overview:**
- **Header bar** — Displays your login number and logout button
- **TradingView chart** — Full charting interface with candlesticks, indicators, and drawing tools
- **Symbol selector** — Search and switch between trading instruments
- **Timeframe controls** — 1m, 5m, 15m, 30m, 1H, 4H, D, W, M
- **Trading panel (bottom)** — Three tabs:
  - **Orders** — Working and recently completed orders
  - **Positions** — Open positions with live P&L
  - **Account Summary** — Balance, equity, margin, and account details

**Real-time Data:**
- Chart candles update live via WebSocket `ohlc` channel
- Price ticker updates via WebSocket `L1` (quotes) channel
- Orders and positions stream real-time updates

---

## Market Orders, Reverse & Close Positions

![MarketOrder, Reverse Position, Close Position](MarketOrder,%20Reverse%20Position,%20Close%20Position.gif)

### What This Demonstrates

This demo shows how to execute market orders and manage positions:

#### Part 1: Placing a Market Order

**Steps shown:**
1. **Open order ticket** — Click the Buy or Sell button in the trading panel
2. **Set quantity** — Enter the lot size (e.g., 1.0 lot)
3. **Optional: Set SL/TP** — Add Stop Loss and Take Profit levels
4. **Submit order** — Order executes immediately at current market price

**What happens:**
- Order request sent via REST API: `POST /api/v1/order`
- Order fills instantly at best available price
- Position opens immediately
- Order appears in the **Orders** tab (with Filled status)
- Position appears in the **Positions** tab with live P&L

#### Part 2: Reversing a Position

**Reverse = Close current position + Open opposite position in one action**

**Steps shown:**
1. **Place opposite order** with quantity **greater than** current position
   - Example: Long 1.0 lot → Place Sell 2.0 lots
2. **Result:**
   - Current 1.0 long position closes
   - New 1.0 short position opens
   - Net effect: flipped from long to short

**API calls:**
- One `POST /api/v1/order` (Market Sell 2.0)
- Server closes existing position and opens opposite
- WebSocket `positions` channel broadcasts both updates

#### Part 3: Closing a Position

**Three methods shown:**

1. **From Positions tab:**
   - Right-click position → **Close Position**
   - Confirms and sends close order

2. **From chart:**
   - Click position marker on chart
   - Click **Close** button in the popup

3. **Manually place opposite order:**
   - Place Market order in opposite direction with exact same quantity
   - Example: Long 1.0 → Market Sell 1.0

**What happens:**
- REST API: `POST /api/v1/order` with opposite side and matching quantity
- Position closes, P&L is realized
- WebSocket sends position delete message (`t: "d"`)
- Position removed from Positions tab
- Trade history updated with realized P&L

---

## Limit Orders

![Limit Order](Limit%20Order.gif)

### What This Demonstrates

This demo shows how to place and manage limit orders:

#### Placing a Limit Order

**Steps shown:**
1. **Open order ticket**
2. **Select "Limit" order type** from dropdown
3. **Enter limit price:**
   - **Buy Limit:** Price **below** current market (e.g., buy at 1.0850 when market is 1.0900)
   - **Sell Limit:** Price **above** current market (e.g., sell at 1.0950 when market is 1.0900)
4. **Set quantity** (lot size)
5. **Choose Time in Force:**
   - **GTC** (Good Till Cancel) — Stays active until filled or cancelled
   - **Day** — Cancels at end of trading session
   - **IOC** (Immediate or Cancel) — Fills what it can immediately, cancels rest
   - **FOK** (Fill or Kill) — Must fill entirely or cancel
6. **Optional: Add SL/TP** — Stop Loss and Take Profit on the resulting position
7. **Submit order**

**What happens:**
- Order sent via REST API: `POST /api/v1/order` with `t: "Limit"`, `lp: 1.0850`
- Order status = **Working** (waiting for price to reach limit level)
- Order appears in Orders tab with blue limit line on chart
- Order waits until market price touches limit price
- When filled:
  - Order status changes to **Filled**
  - Position opens at the limit price (or better)
  - WebSocket broadcasts order update (`orders` channel) and new position (`positions` channel)

#### Managing a Limit Order

**Modify:**
- Right-click order in Orders tab → **Modify**
- Change limit price, SL/TP, or quantity
- API: `PUT /api/v1/order`

**Cancel:**
- Right-click order → **Cancel**
- API: `DELETE /api/v1/order/{orderId}`
- Order status changes to **Cancelled**

**Visual on chart:**
- Limit orders show as horizontal lines
- Can drag the line to modify price
- Line color indicates order side (blue = buy, red = sell)

---

## Stop Orders

![Stop Order](Stop%20Order.gif)

### What This Demonstrates

This demo shows stop orders, which trigger a market order when price reaches a specified level:

#### Placing a Stop Order

**Steps shown:**
1. **Open order ticket**
2. **Select "Stop" order type**
3. **Enter stop price (trigger level):**
   - **Buy Stop:** Price **above** current market (breakout buy)
   - **Sell Stop:** Price **below** current market (breakout sell or protective stop)
4. **Set quantity**
5. **Choose Time in Force** (GTC, Day, IOC, FOK)
6. **Optional: Add SL/TP** for the resulting position
7. **Submit order**

**What happens:**
- Order sent via REST API: `POST /api/v1/order` with `t: "Stop"`, `sp: 1.0950`
- Order status = **Inactive** (waiting for trigger)
- Order appears in Orders tab with stop line on chart
- **When price reaches stop level:**
  - Order becomes a **Market order** and executes immediately
  - Position opens at current market price (may differ from stop price due to slippage)
  - Order status changes to **Filled**

#### Use Cases Shown

**Breakout Trading:**
- **Buy Stop above resistance** — Enter long when price breaks upward
- **Sell Stop below support** — Enter short when price breaks downward

**Protective Stop (Stop Loss):**
- **Sell Stop below entry** — Exit long position if price drops
- **Buy Stop above entry** — Exit short position if price rises

**Visual on chart:**
- Stop orders show as dashed horizontal lines
- Trigger price is clearly marked
- Line disappears when order triggers or is cancelled

---

## Stop Loss & Take Profit

![SL TP](SL%20TP.gif)

### What This Demonstrates

This demo shows how to set and modify Stop Loss and Take Profit levels on orders and positions:

#### Setting SL/TP on a New Order

**Steps shown:**
1. **Open order ticket** (Market, Limit, or Stop order)
2. **Enter Stop Loss price:**
   - Long position: SL **below** entry (e.g., buy at 1.0900, SL at 1.0850)
   - Short position: SL **above** entry (e.g., sell at 1.0900, SL at 1.0950)
3. **Enter Take Profit price:**
   - Long position: TP **above** entry (e.g., buy at 1.0900, TP at 1.0950)
   - Short position: TP **below** entry (e.g., sell at 1.0900, TP at 1.0850)
4. **Submit order**

**What happens:**
- Order placed with `sl` and `tp` parameters in API request
- When position opens, SL/TP levels are set automatically
- Chart displays horizontal lines:
  - **Red line** = Stop Loss
  - **Green line** = Take Profit

#### Modifying SL/TP on an Existing Position

**Three methods shown:**

**Method 1: Drag lines on chart (Visual)**
1. **Hover over SL or TP line** on the chart
2. **Click and drag** to new price level
3. **Release** — Modification request sent automatically
4. **API:** `PUT /api/v1/sltp` with new SL/TP values

**Method 2: Positions tab (Right-click)**
1. **Right-click position** in Positions tab
2. Select **Modify SL/TP** or **Set SL/TP**
3. **Enter new values** in dialog
4. **Confirm** — Same API call as Method 1

**Method 3: Order modification (for working orders)**
1. **Right-click pending order** in Orders tab
2. Select **Modify**
3. **Change SL/TP values**
4. **Submit** — `PUT /api/v1/order/sltp`

#### What Happens When SL/TP Triggers

**Stop Loss triggers:**
- Price reaches SL level
- Position closes immediately with realized loss
- WebSocket `positions` channel sends delete message
- Position removed from Positions tab
- Loss amount appears in trade history

**Take Profit triggers:**
- Price reaches TP level
- Position closes immediately with realized profit
- Same WebSocket and UI updates as SL
- Profit appears in trade history

**Chart updates:**
- SL/TP lines disappear when position closes
- New marker added showing close price and P&L

#### Advanced: Trailing Stop

While not shown in this specific demo, the API supports trailing stops:
- SL automatically adjusts as price moves in your favor
- Maintains fixed distance from current price
- Locks in profit as position becomes more profitable

---

## Related Documentation

For more details on each feature:

| Topic | Guide |
|-------|-------|
| Complete platform walkthrough | [Trading Guide](TRADING_GUIDE.md) |
| Detailed order type explanations | [Order Types Guide](ORDER_TYPES_GUIDE.md) |
| API request/response examples | [REST API Reference](REST_API.md) |
| WebSocket data streams | [WebSocket API Reference](WEBSOCKET_API.md) |
| Authentication flow | [Authentication Guide](AUTHENTICATION.md) |
