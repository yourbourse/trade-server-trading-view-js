<div align="center">

# Quick Start

**Get the trading platform running in under 5 minutes**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite)](https://vitejs.dev/)

[Install](#1-install) · [Library](#2-charting-library) · [Run](#3-run) · [Verify](#4-verify) · [Test](#5-test-trading)

</div>

---

> **New here?** For a more detailed walkthrough, see the [Getting Started Guide](GETTING_STARTED.md).

## 1. Install

```bash
git clone <repository-url>
cd client
npm install
```

## 2. Charting Library

> **Note:** The library is **NOT included** in this repo. Obtain it from [TradingView](https://www.tradingview.com/HTML5-stock-forex-bitcoin-charting-library/).

Copy charting libraries to the `charting_library/` folder to the project root

## 3. Run

```bash
npm run dev
```

Opens at **http://localhost:8080**. Sign in with your Trade Server credentials.

![Sign In](Signing%20In%20And%20General%20Look.gif)

## 4. Verify

Open the browser console (F12). You should see:

```
Initializing Trading Application...
WebSocket connected
Auto-subscribed to orders
Auto-subscribed to positions
Auto-subscribed to account states
All auto-subscriptions completed successfully
Trading Application initialized successfully
```

## 5. Test Trading

Try placing a market order from the chart's trading panel:

![Market Order](MarketOrder,%20Reverse%20Position,%20Close%20Position.gif)

### Browser Console Testing

Test the API directly from the browser console:

```javascript
// Access the trading app
const api = tradingApp.tradeServerClient;

// Subscribe to market data
await api.subscribeToQuotes('EURUSD', true);
api.subscriptions.subscribe('quote_EURUSD', (data) => {
  console.log('EURUSD:', data.quote);
});

// Subscribe to candles
await api.subscribeToCandles('EURUSD', '1H', true);
api.subscriptions.subscribe('candles_EURUSD', (data) => {
  console.log('Candle:', data.candle);
});

// Check account state
api.subscriptions.subscribe('account_state_update', (data) => {
  console.log('Account:', data.data);
});
```

## 6. Build for Production

```bash
npm run build     # Outputs to dist/
npm run preview   # Preview the built app
```

---

## Common Issues

| Problem | Solution |
|---------|----------|
| "charting_library/ not found" | Ensure the library folder exists at project root |
| Sign-in fails | Check server URL includes `https://`, verify credentials |
| WebSocket not connecting | Verify server is accessible, check browser console for errors |
| No chart data | Ensure `public/charting_library/` exists (Vite build will copy the files) |

For detailed troubleshooting, see the [Troubleshooting Guide](TROUBLESHOOTING.md).

---

## What's Next?

| Topic | Guide |
|-------|-------|
| All configuration options | [Configuration](CONFIGURATION.md) |
| Platform features | [Trading Guide](TRADING_GUIDE.md) |
| Order types explained | [Order Types Guide](ORDER_TYPES_GUIDE.md) |
| API reference | [API Overview](API_OVERVIEW.md) |
| Development workflow | [Development Guide](DEVELOPMENT.md) |
```

### Monitor Subscription Count

```javascript
// Count active subscriptions
const subscriptionCount = Array.from(api.wsCallbacks.keys()).length;
console.log(`Active subscriptions: ${subscriptionCount} / 256 max`);
```

## Support

For issues related to:
- **WebSocket API**: Check `WEBSOCKET_API.md`
- **API Overview**: Check [API_OVERVIEW.md](API_OVERVIEW.md)
- **TradingView Integration**: Check `README.md`
- **Server Issues**: Contact Trade Server support team

## Advanced Testing

### Load Testing Multiple Symbols

```javascript
// Subscribe to multiple symbols (be mindful of 256 stream limit)
const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'];

for (const symbol of symbols) {
    await api.subscribeToQuotes(symbol, true);
    await api.subscribeToCandles(symbol, '1H', false);
    console.log(`Subscribed to ${symbol}`);
}

// Monitor all updates
api.subscribe('quotes', (data) => {
    console.log(`Quote: ${data.quote.s}`);
});

api.subscribe('candles', (data) => {
    console.log(`Candle: ${data.candle.s} ${data.candle.i}`);
});
```

### Stress Test Reconnection

```javascript
// Close connection manually to test reconnection
api.ws.close();

// Watch console for:
// "WebSocket disconnected"
// ... 5 seconds later ...
// "WebSocket connected"
// Auto-resubscriptions should happen
```

### Test Unsubscription

```javascript
// Subscribe
await api.subscribeToQuotes('EURUSD', true);

// Verify subscription
console.log('Subscribed, should see quotes...');

// Wait for some updates...
await new Promise(resolve => setTimeout(resolve, 5000));

// Unsubscribe
await api.unsubscribeFromQuotes('EURUSD');

// Verify no more updates
console.log('Unsubscribed, should NOT see quotes anymore');
```

Good luck with your implementation! 🚀
