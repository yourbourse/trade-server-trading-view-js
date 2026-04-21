<div align="center">

# Account Methods — Code Examples

**Practical examples for account, trading, and data operations**

</div>

---

## Basic Account Information

### Get Account State

```javascript
// Get current account state (balance, equity, margin, P/L)
const state = await api.getAccountInfo();
console.log('Balance:', state.b);
console.log('Equity:', state.e);
console.log('P/L:', state.pl);
console.log('Margin:', state.m);
console.log('Credit:', state.C);
console.log('Currency:', state.c);
```

### Get Account Balances

```javascript
// Get all balances/collateral
const balances = await api.getBalance();
balances.balances.forEach(balance => {
    console.log(`${balance.c}: Total=${balance.t}, Available=${balance.av}`);
});
```

### Get Comprehensive Account Summary

```javascript
// Get both state and balances in a single call
const summary = await api.getAccountSummary();

// Access account state
console.log('Account State:');
console.log('  Balance:', summary.state.b);
console.log('  Equity:', summary.state.e);
console.log('  P/L:', summary.state.pl);
console.log('  Margin:', summary.state.m);

// Access balances
console.log('\nBalances:');
summary.balances.balances.forEach(balance => {
    console.log(`  ${balance.c}: ${balance.av} available`);
});
```

## Position Management

### Get All Open Positions

```javascript
// Get all positions
const positions = await api.getPositions();
console.log(`You have ${positions.positions.length} open positions`);

// Filter by symbol
const eurusdPositions = await api.getPositions({ symbol: 'EURUSD' });
console.log(`EURUSD positions:`, eurusdPositions.positions);
```

### Get Position by ID

```javascript
// Get specific position
const position = await api.getPositionById(123456);
if (position) {
    console.log(`Position #${position.id}:`);
    console.log(`  Symbol: ${position.s}`);
    console.log(`  Side: ${position.S}`);
    console.log(`  Quantity: ${position.q}`);
    console.log(`  Avg Price: ${position.ap}`);
    console.log(`  Unrealized P/L: ${position.up}`);
} else {
    console.log('Position not found');
}
```

### Check for Open Positions

```javascript
// Check if any positions are open
if (await api.hasOpenPositions()) {
    console.log('You have open positions');
} else {
    console.log('No open positions');
}

// Check for specific symbol
if (await api.hasOpenPositions('EURUSD')) {
    console.log('You have open EURUSD positions');
} else {
    console.log('No EURUSD positions');
}
```

## Rate Limits

### Get API Rate Limits

```javascript
// Get current rate limits
const limits = await api.getLimits();
limits.forEach(limit => {
    const type = limit.t === 'weight' ? 'API Weight' : 'Order Count';
    const interval = {
        'S': 'second',
        'M': 'minute',
        'H': 'hour',
        'D': 'day'
    }[limit.i];
    console.log(`${type}: ${limit.l} per ${limit.n} ${interval}(s)`);
});
```

## Transfer History

### Get Cash/Asset Transfers

```javascript
// Get recent transfers
const transfers = await api.getTransfersHistory({
    maxResults: 50,
    sortOrder: 'desc'
});

console.log(`Found ${transfers.transfers.length} transfers`);
transfers.transfers.forEach(transfer => {
    const date = new Date(transfer.t / 1000); // Convert from microseconds
    console.log(`${date.toISOString()}: ${transfer.T} - ${transfer.a} ${transfer.c}`);
    if (transfer.ct) {
        console.log(`  Comment: ${transfer.ct}`);
    }
});
```

### Get Transfers for Specific Period

```javascript
// Get transfers for the last 7 days
const sevenDaysAgo = Date.now() * 1000 - (7 * 24 * 3600 * 1000 * 1000);
const now = Date.now() * 1000;

const weeklyTransfers = await api.getTransfersHistory({
    from: sevenDaysAgo,
    to: now,
    sortOrder: 'desc'
});

console.log(`Transfers in the last 7 days: ${weeklyTransfers.transfers.length}`);
```

### Paginate Through Transfer History

```javascript
// Manual pagination - Get transfers page by page
let allTransfers = [];
let nextToken = null;

do {
    const result = await api.getTransfersHistory({
        maxResults: 100,
        sortOrder: 'desc'
    }, nextToken);
    
    allTransfers = allTransfers.concat(result.transfers);
    nextToken = result.nextToken;
    
    console.log(`Fetched ${result.transfers.length} transfers, total: ${allTransfers.length}`);
} while (nextToken);

console.log(`Total transfers: ${allTransfers.length}`);

// OR use automatic pagination - fetch all transfers at once
const allTransfers = await api.getAllTransfersHistory({
    sortOrder: 'desc'
});
console.log(`Total transfers: ${allTransfers.length}`);
```

### Get All Open Positions (Auto-pagination)

```javascript
// Automatically fetch all positions across all pages
const allPositions = await api.getAllPositions();
console.log(`Total positions: ${allPositions.length}`);

// With filter
const allEURUSDPositions = await api.getAllPositions({ symbol: 'EURUSD' });
console.log(`EURUSD positions: ${allEURUSDPositions.length}`);
```

### Get All Orders (Auto-pagination)

```javascript
// Get all open orders across all pages
const allOpenOrders = await api.getAllOrders();
console.log(`Total open orders: ${allOpenOrders.length}`);

// Get all historical orders for last month
const oneMonthAgo = Date.now() * 1000 - (30 * 24 * 3600 * 1000 * 1000);
const now = Date.now() * 1000;
const allHistoricalOrders = await api.getAllOrderHistory({
    from: oneMonthAgo,
    to: now
});
console.log(`Orders in last month: ${allHistoricalOrders.length}`);
```

### Get All Trade History (Auto-pagination)

```javascript
// Get all trades for a specific period
const sevenDaysAgo = Date.now() * 1000 - (7 * 24 * 3600 * 1000 * 1000);
const allTrades = await api.getAllTradeHistory({
    from: sevenDaysAgo,
    to: Date.now() * 1000,
    sortOrder: 'desc'
});
console.log(`Total trades in last 7 days: ${allTrades.length}`);
```

## Practical Examples

### Account Health Check

```javascript
async function checkAccountHealth() {
    const summary = await api.getAccountSummary();
    const state = summary.state;
    
    // Calculate margin level (equity / margin * 100)
    const marginLevel = state.m > 0 ? (state.e / state.m) * 100 : Infinity;
    
    console.log('=== Account Health ===');
    console.log(`Balance: ${state.b} ${state.c}`);
    console.log(`Equity: ${state.e} ${state.c}`);
    console.log(`Unrealized P/L: ${state.pl} ${state.c}`);
    console.log(`Used Margin: ${state.m} ${state.c}`);
    console.log(`Margin Level: ${marginLevel.toFixed(2)}%`);
    
    if (marginLevel < 200) {
        console.warn('⚠️ WARNING: Low margin level!');
    } else if (marginLevel < 100) {
        console.error('🚨 CRITICAL: Margin call risk!');
    } else {
        console.log('✅ Account health is good');
    }
}

await checkAccountHealth();
```

### Position Summary

```javascript
async function getPositionSummary() {
    const positions = await api.getPositions();
    
    if (positions.positions.length === 0) {
        console.log('No open positions');
        return;
    }
    
    // Group by symbol
    const bySymbol = {};
    let totalPL = 0;
    
    positions.positions.forEach(pos => {
        if (!bySymbol[pos.s]) {
            bySymbol[pos.s] = { count: 0, totalQty: 0, totalPL: 0 };
        }
        bySymbol[pos.s].count++;
        bySymbol[pos.s].totalQty += pos.q;
        bySymbol[pos.s].totalPL += pos.up || 0;
        totalPL += pos.up || 0;
    });
    
    console.log('=== Position Summary ===');
    Object.entries(bySymbol).forEach(([symbol, data]) => {
        console.log(`${symbol}: ${data.count} position(s), ${data.totalQty} lots, P/L: ${data.totalPL.toFixed(2)}`);
    });
    console.log(`\nTotal P/L: ${totalPL.toFixed(2)}`);
}

await getPositionSummary();
```

### Daily Activity Report

```javascript
async function getDailyReport() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMicros = today.getTime() * 1000;
    const nowMicros = Date.now() * 1000;
    
    // Get today's transfers
    const transfers = await api.getTransfersHistory({
        from: todayMicros,
        to: nowMicros,
        sortOrder: 'desc'
    });
    
    // Get account summary
    const summary = await api.getAccountSummary();
    
    console.log('=== Daily Report ===');
    console.log('Date:', today.toDateString());
    console.log('\nAccount Balance:', summary.state.b, summary.state.c);
    console.log('Current Equity:', summary.state.e, summary.state.c);
    console.log('Unrealized P/L:', summary.state.pl, summary.state.c);
    
    console.log('\nToday\'s Transfers:', transfers.transfers.length);
    let depositTotal = 0;
    let withdrawalTotal = 0;
    
    transfers.transfers.forEach(t => {
        if (t.T === 'Balance' && t.a > 0) {
            depositTotal += t.a;
        } else if (t.T === 'Balance' && t.a < 0) {
            withdrawalTotal += Math.abs(t.a);
        }
    });
    
    console.log('  Deposits:', depositTotal, summary.state.c);
    console.log('  Withdrawals:', withdrawalTotal, summary.state.c);
}

await getDailyReport();
```

## Error Handling

```javascript
try {
    const summary = await api.getAccountSummary();
    console.log('Account summary retrieved successfully');
} catch (error) {
    if (error.status === 403) {
        console.error('Authentication failed or IP banned');
    } else if (error.status === 429) {
        console.error('Rate limit exceeded');
    } else {
        console.error('Error fetching account summary:', error.message);
    }
}
```

## Notes

- All timestamps in the API are in **microseconds** (multiply JavaScript milliseconds by 1000)
- Transfer types include: 'Balance', 'Credit', 'Fee', 'Adjustment', 'Bonus', 'Commission', etc.
- Rate limits apply to all API calls - use convenience methods to reduce API calls
- Position IDs are unique and can be used for direct lookups

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [REST API](REST_API.md) | Complete REST API endpoint reference |
| [WebSocket API](WEBSOCKET_API.md) | Real-time account and trading updates |
| [API Overview](API_OVERVIEW.md) | High-level API capabilities |
| [Trading Guide](TRADING_GUIDE.md) | Using account features in the UI |
| [Authentication](AUTHENTICATION.md) | HMAC signing for API requests |
