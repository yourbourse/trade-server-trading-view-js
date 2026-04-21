<div align="center">

# Troubleshooting

**Common issues, debugging techniques, and solutions**

[Installation](#installation-issues) · [Sign-in](#sign-in-issues) · [WebSocket](#websocket-issues) · [Chart](#chart-issues) · [Trading](#trading-issues) · [Debugging](#debugging-techniques)

</div>

---

## Installation Issues

### "charting_library/ not found" Warning on `npm run dev`

**Cause:** Vite cannot locate the TradingView Charting Library.

**Note:** The library is **NOT included in this repository** — both `charting_library/` and `public/charting_library/` are gitignored. You must add them after cloning.

**Solutions:**

1. **Obtain the library** from [TradingView](https://www.tradingview.com/HTML5-stock-forex-bitcoin-charting-library/) and extract to the project root

2. Verify the library folder exists at the project root:
   ```
   client/charting_library/charting_library.js    ← Must exist
   ```


### `npm install` Fails

**Solutions:**
- Ensure Node.js 18+ is installed: `node --version`
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules/` and `package-lock.json`, then retry: `npm install`

### Port 8080 Already in Use

**Solutions:**

```bash
# Find what's using port 8080
# Windows
netstat -ano | findstr :8080

# Linux/Mac
lsof -i :8080
```

Or change the port in `vite.config.ts`:
```typescript
server: {
  port: 3000  // Change to any available port
}
```

---

## Sign-in Issues

### Sign-in Form Doesn't Submit

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Login field is empty or non-numeric | Enter a valid numeric account number |
| Password field is empty | Enter your password |
| Server URL is invalid | Use a full URL with protocol: `https://uat.api.yourbourse.trade:32285` |

### "Authentication Failed" Error

**Solutions:**

1. **Verify credentials** — Double-check login number and password
2. **Check the server URL** — Ensure it includes `https://` and the correct port
3. **Test server connectivity** — Open the server URL in a browser (you should see a response, not a connection error)
4. **Check browser console** (F12) for the specific HTTP error:

| HTTP Status | Meaning | Fix |
|-------------|---------|-----|
| 401 | Invalid credentials | Check login/password |
| 403 | Forbidden (IP banned or locked account) | Contact server administrator |
| 404 | Wrong URL or endpoint | Verify the server URL |
| 0 / Network Error | Server unreachable | Check URL and network connectivity |

### Session Expires / Redirected to Sign-in Unexpectedly

**Causes:**
- Browser session storage was cleared (tab closed/refreshed in some browsers)
- API token expired
- Server restarted or maintenance

**Solutions:**
- Sign in again — credentials are re-saved to session
- If persistent, check server status with your administrator

---

## WebSocket Issues

### WebSocket Not Connecting

**Symptoms:** No "WebSocket connected" message in console.

**Debugging:**

1. **Check the console** for error messages:
   ```
   WebSocket connection to 'wss://...' failed
   ```

2. **Verify the WebSocket URL:**
   ```javascript
   // In browser console
   console.log(tradingApp.tradeServerClient.websocket.url);
   ```

3. **Common causes:**

   | Cause | Fix |
   |-------|-----|
   | Wrong WebSocket URL | Ensure `wsUrl` uses `wss://` and correct port |
   | Firewall blocking WebSocket | Allow WebSocket (port 443 or custom port) |
   | Server not running | Verify server is accessible |
   | SSL certificate issues | Check for `ERR_CERT_*` errors in console |

### "Subscription Timeout" Error

**Symptoms:** `SubscriptionTimeoutError: Subscription request timed out`

**Causes & Solutions:**

1. **API key is invalid** — Re-authenticate by refreshing the page and signing in again
2. **Server doesn't support the channel** — Check server version compatibility
3. **Rate limit exceeded** — Wait and retry (max 5 messages/second)
4. **Check connection state:**
   ```javascript
   console.log('Connected:', tradingApp.tradeServerClient.isConnected());
   ```

### No Data After Subscribing

**Symptoms:** Subscription succeeds but no data appears.

**Solutions:**

1. **Check if data exists** — e.g., no open orders means the orders channel sends an empty snapshot
2. **Verify snapshot parameter** — Use `snapshot: true` for initial data:
   ```javascript
   await api.subscribeToOrders({ snapshot: true });
   ```
3. **Check callbacks are registered:**
   ```javascript
   const subs = tradingApp.tradeServerClient.subscriptions;
   console.log('Events:', subs.getEventNames());
   console.log('Order subscribers:', subs.getSubscriberCount('order_update'));
   ```

### WebSocket Disconnects Frequently

**Causes:**

| Cause | Indicator | Fix |
|-------|-----------|-----|
| Network instability | Random disconnects | Check network connection |
| Server-side timeout | Disconnects after ~24h | Normal — auto-reconnects |
| Too many connections | 300 attempts/5min limit | Reduce connection frequency |
| Missing heartbeat | Disconnects after 30-60s | Check that heartbeat is active |

**Auto-reconnect** is enabled by default (5s delay, 10 max attempts). Check logs for:
```
WebSocket disconnected. Reconnecting in 5000ms... (attempt 1/10)
```

---

## Chart Issues

### Chart Shows "Loading TradingView..."

**Cause:** TradingView library failed to load.

**Solutions:**
1. Check that `public/charting_library/` exists and contains the library
2. Check browser console for 404 errors on `charting_library` files

### No Candles / Empty Chart

**Causes & Solutions:**

| Cause | Fix |
|-------|-----|
| Symbol not available | Try a different symbol (e.g., EURUSD) |
| Historical data API error | Check browser console for REST API errors |
| WebSocket not connected | Verify WebSocket connection (see above) |
| Wrong resolution mapping | Check `CONFIG.websocket.intervalMapping` |

### Chart Not Updating in Real-time

**Cause:** WebSocket candle subscription not active.

**Check:**
```javascript
// In browser console — check active subscriptions
const events = tradingApp.tradeServerClient.subscriptions.getEventNames();
console.log('Active events:', events.filter(e => e.startsWith('candles_')));
```

---

## Trading Issues

### Order Rejected

**Check the rejection reason** in the Orders tab or browser console.

| Common Reasons | Fix |
|---------------|-----|
| Insufficient margin | Reduce order size or deposit funds |
| Invalid price | Ensure limit/stop price is on the correct side of the market |
| Symbol not tradable | Verify the symbol is available for trading |
| Market closed | Check trading hours |

### Position P&L Not Updating

**Cause:** Position price updates require the positions subscription with `sendPriceUpdates: true`.

**Verify:**
```javascript
// Check positions subscription is active
const subs = tradingApp.tradeServerClient.subscriptions;
console.log('Position updates:', subs.hasSubscribers('position_update'));
```

### SL/TP Not Working

**Possible causes:**
1. **Order was not linked** — SL/TP must be set on the order or position
2. **Price levels invalid** — SL must be on the losing side, TP on the winning side
3. **Server rejected modification** — Check browser console for API errors

---

## Debugging Techniques

### Browser Console

Access the application state directly:

```javascript
// Application instance
const app = window.tradingApp;

// API client
const client = app.tradeServerClient;

// Check connection
console.log('Connected:', client.isConnected());

// List all WebSocket event subscriptions
console.log('Events:', client.subscriptions.getEventNames());

// Check subscriber count for an event
console.log('Order subscribers:', client.subscriptions.getSubscriberCount('order_update'));
```

### Network Tab (Dev Tools)

1. Open Developer Tools (**F12**)
2. Go to the **Network** tab

**For REST API calls:**
- Filter by **XHR** or **Fetch**
- Check request headers for `X-YB-API-Key` and `X-YB-Sign`
- Inspect response bodies for error messages

**For WebSocket messages:**
- Filter by **WS**
- Click on the WebSocket connection
- Switch to the **Messages** tab
- Green = outgoing (subscribe, ping), White = incoming (data, ack, pong)

### Logger

Enable debug logging:

```javascript
// In browser console
tradingApp.tradeServerClient; // Access logger through the client
```

### WebSocket State Codes

| Code | State | Meaning |
|------|-------|---------|
| `0` | CONNECTING | Connection is being established |
| `1` | OPEN | Connection is active |
| `2` | CLOSING | Connection is shutting down |
| `3` | CLOSED | Connection is closed |

```javascript
// Check WebSocket readyState
console.log('WS State:', tradingApp.tradeServerClient.websocket.ws?.readyState);
```

---

## Performance Issues

### High CPU Usage

**Possible causes:**
- Too many subscriptions updating the DOM simultaneously
- Large number of position price updates

**Solutions:**
- Reduce the number of subscribed symbols
- Disable balances/trades auto-subscribe if not needed:
  ```typescript
  // In src/config.ts
  autoSubscribe: {
    orders: true,
    positions: true,
    balances: false,    // Disable if not needed
    accountStates: true,
    trades: false       // Disable if not needed
  }
  ```

### Slow Initial Load

**Solutions:**
- Ensure dev server (not production build) is being used during development
- Check that no proxy/VPN is slowing WebSocket connections
- The TradingView library is large (~5MB) — first load may be slow, subsequent loads are cached

---

## Getting Help

If none of the above solutions resolve your issue:

1. **Check the browser console** for error messages and stack traces
2. **Check the Network tab** for failed HTTP requests or WebSocket errors
3. **Review the relevant documentation**:
   - [WebSocket API](WEBSOCKET_API.md) for connection/subscription issues
   - [REST API](REST_API.md) for HTTP request issues
   - [Authentication](AUTHENTICATION.md) for sign-in/auth issues
4. **Open an issue** on the repository with:
   - Browser and version
   - Console error output
   - Network tab screenshot (if relevant)
   - Steps to reproduce

---

## Related Documentation

| Document | When to Use |
|----------|-------------|
| [Getting Started](GETTING_STARTED.md) | First-time setup and installation |
| [FAQ](FAQ.md) | Quick answers to common questions |
| [Authentication](AUTHENTICATION.md) | Sign-in and HMAC authentication issues |
| [WebSocket API](WEBSOCKET_API.md) | Real-time connection and subscription problems |
| [REST API](REST_API.md) | HTTP request and endpoint issues |
| [Configuration](CONFIGURATION.md) | Config options and environment setup |
| [Development Guide](DEVELOPMENT.md) | Debugging tools and techniques |
