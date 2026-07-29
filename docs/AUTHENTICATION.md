<div align="center">

# Authentication

**HMAC-SHA256 authentication, API keys, and the sign-in flow**

[Overview](#overview) · [Sign-in Flow](#sign-in-flow) · [HMAC Signing](#hmac-signing) · [WebSocket Auth](#websocket-authentication) · [Session Management](#session-management)

</div>

---

## Overview

The trading platform uses a multi-layer authentication system:

```
┌──────────────────────────────────────────────────────────────┐
│                    Authentication Flow                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Sign-in                                                  │
│     POST /api/v1/authorize                                   │
│     { username, password }                                   │
│         ↓                                                    │
│     Returns: { token (API key), signingToken }               │
│                                                              │
│  2. REST API Requests                                        │
│     GET:  X-YB-API-Key header only                           │
│     POST: X-YB-API-Key + X-YB-Timestamp + X-YB-Sign (HMAC)  │
│     PUT:  X-YB-API-Key + X-YB-Timestamp + X-YB-Sign (HMAC)  │
│     DELETE: X-YB-API-Key + X-YB-Sign (HMAC)                 │
│                                                              │
│  3. WebSocket                                                │
│     API key sent in message headers:                         │
│     { h: { "X-YB-API-Key": "<token>" } }                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

| Component | Auth Mechanism |
|-----------|---------------|
| **Sign-in** | Username + password → REST endpoint |
| **GET requests** | API key in `X-YB-API-Key` header |
| **POST/PUT/DELETE requests** | API key + HMAC-SHA256 signed body |
| **WebSocket subscriptions** | API key in message `h` (headers) field |

---

## Sign-in Flow

### Step-by-Step

```
┌────────────┐     ┌────────────┐     ┌──────────────┐
│  Sign-in   │     │  Trade     │     │  Main App    │
│  Page      │     │  Server    │     │  (index.html)│
└─────┬──────┘     └──────┬─────┘     └──────┬───────┘
      │                   │                   │
      │  POST /authorize  │                   │
      │  {username, pwd}  │                   │
      │──────────────────>│                   │
      │                   │                   │
      │  {token, signing  │                   │
      │   Token, expiry}  │                   │
      │<──────────────────│                   │
      │                   │                   │
      │  Save to          │                   │
      │  sessionStorage   │                   │
      │────┐              │                   │
      │    │              │                   │
      │<───┘              │                   │
      │                   │                   │
      │  Redirect to /    │                   │
      │───────────────────────────────────────>│
      │                   │                   │
      │                   │  Read credentials │
      │                   │  from session     │
      │                   │<───────────────────│
      │                   │                   │
      │                   │  WebSocket connect│
      │                   │<───────────────────│
      │                   │                   │
```

### What Gets Stored

**sessionStorage** (cleared when tab closes):

```json
{
  "userCredentials": {
    "login": 1002,
    "server": "https://ts285-uat.yourbourse.trade"
  },
  "apiKey": "eyJhbGciOiJIUzI1NiIs...",
  "signingToken": "a1b2c3d4e5f6..."
}
```

**localStorage** (persists across sessions):

```json
{
  "savedCredentials": {
    "login": 1002,
    "server": "https://ts285-uat.yourbourse.trade"
  }
}
```

> **Security:** 
> - User's actual password is **never stored** - only used during authentication
> - Only `login` and `server` URL are stored in sessionStorage
> - `apiKey` and `signingToken` are stored separately and used for API authentication
> - `baseUrl` and `wsUrl` are **derived on-the-fly** from `server` using `deriveServerUrls()` utility
> - sessionStorage is per-tab and cleared on tab close

### URL Derivation

The application derives REST API and WebSocket URLs from the stored server:

```typescript
// src/utils/serverUrl.ts
function deriveServerUrls(server: string): { baseUrl: string; wsUrl: string } {
  // Append /api/v1 if not already present
  const baseUrl = server.match(/\/api\/v\d+\/?$/) ? server : `${server}/api/v1`;
  
  // Derive WebSocket URL: replace http(s) → ws(s) and /api/vX → /ws/vX
  const wsUrl = baseUrl
    .replace(/^https?:\/\//, (match) => match.replace('http', 'ws'))
    .replace(/\/api\/v(\d+)/, '/ws/v$1');

  return { baseUrl, wsUrl };
}
```

**Examples:**
- Input: `https://server.com:3000` → `baseUrl`: `https://server.com:3000/api/v1`, `wsUrl`: `wss://server.com:3000/ws/v1`
- Input: `https://server.com/admin` → `baseUrl`: `https://server.com/admin/api/v1`, `wsUrl`: `wss://server.com/admin/ws/v1`
- Input: `https://server.com/admin/api/v1` → `baseUrl`: `https://server.com/admin/api/v1`, `wsUrl`: `wss://server.com/admin/ws/v1`

---

## HMAC Signing

All POST, PUT, and DELETE requests are signed with HMAC-SHA256 to prevent tampering and replay attacks.

### Signature Format

```
Signature = HMAC-SHA256(signingToken, message)
```

Where `message` is:

| Method | Message Format |
|--------|---------------|
| POST/PUT | `Content={requestBody}\nTimestamp={microsecondTimestamp}` |
| DELETE | `Timestamp={microsecondTimestamp}` |

### Headers Sent

| Header | Value | Purpose |
|--------|-------|---------|
| `X-YB-API-Key` | API token | Identifies the authenticated user |
| `X-YB-Timestamp` | Microsecond timestamp | Prevents replay attacks |
| `X-YB-Sign` | Base64URL-encoded HMAC | Verifies request integrity |

### Implementation

The signing logic is in `src/utils/api.ts`:

```typescript
// POST request headers
function getPOSTHeaders(user: AuthUser, data: string) {
  const timestamp = Date.now() * 1000; // Convert to microseconds
  const message = `Content=${data}\nTimestamp=${timestamp}`;
  const signature = getHMACDigest(user.signingToken, message);
  
  return {
    'X-YB-API-Key': user.apiKey,
    'X-YB-Timestamp': timestamp.toString(),
    'X-YB-Sign': signature
  };
}

// GET request headers (no signing needed)
function getGETHeaders(user: AuthUser) {
  return {
    'X-YB-API-Key': user.apiKey
  };
}
```

### HMAC Digest

The signature uses **Base64URL** encoding (URL-safe Base64):

```typescript
function getHMACDigest(key: string, message: string): string {
  const hash = CryptoJS.HmacSHA256(message, key);
  return CryptoJS.enc.Base64.stringify(hash)
    .replace(/\+/g, '-')   // + → -
    .replace(/\//g, '_')   // / → _
    .replace(/=+$/, '');   // Remove trailing =
}
```

> CryptoJS is loaded from CDN in `index.html`. It is available as a global `CryptoJS` object.

### Example: Signed POST Request

```
POST /api/v1/order
Content-Type: application/json
X-YB-API-Key: eyJhbGciOi...
X-YB-Timestamp: 1711929600000000
X-YB-Sign: dG9rZW4tc2lnbmF0dXJl...

{"s":"EURUSD","S":"Buy","q":1.0,"t":"Market","tif":"FOK"}
```

Signature computed from:
```
Content={"s":"EURUSD","S":"Buy","q":1.0,"t":"Market","tif":"FOK"}
Timestamp=1711929600000000
```

---

## WebSocket Authentication

WebSocket subscriptions include the API key in the message's `h` (headers) field:

```json
{
  "m": "subscribe",
  "c": "orders",
  "p": { "snapshot": true },
  "h": {
    "X-YB-API-Key": "eyJhbGciOi..."
  },
  "reqId": "abc-123"
}
```

The server validates the API key on each subscribe/unsubscribe request. Data messages do not include authentication — they are sent on the authenticated connection.

### Connection Lifecycle

```
1. WebSocket connects to wss://server/ws/v1
2. First subscribe message includes API key in headers
3. Server validates and starts sending data
4. Subsequent messages on the same connection are authenticated
5. Connection expires after 24 hours (reconnect required)
```

---

## Session Management

### Authentication Check

On every page load, the application checks for valid credentials:

```typescript
// src/utils/auth.ts
function isAuthenticated(): boolean {
  const creds = sessionStorage.getItem('userCredentials');
  if (!creds) return false;
  const parsed = JSON.parse(creds);
  // Only check for login and server - password is never stored
  return !!(parsed.login && parsed.server);
}
```

If not authenticated → redirect to `/signin.html`.

### Sign-out

Signing out clears all session data:

```typescript
function signOut(): void {
  sessionStorage.clear();
  window.location.replace('/signin.html');
}
```

Available via:
- **Logout button** in the header
- `window.logout()` in the browser console
- `signOut()` function in code

### Token Refresh

The authentication system supports token refresh:

```typescript
await tradeServerClient.auth.refreshToken(refreshToken);
// Returns a new API key and signing token
```

---

## Security Considerations

| Aspect | Implementation |
|--------|---------------|
| **Transport** | HTTPS for REST, WSS for WebSocket |
| **Request integrity** | HMAC-SHA256 signatures on POST/PUT/DELETE |
| **Replay protection** | Microsecond timestamps in signatures |
| **Token storage** | session**Never stored** - only used during authentication |
| **Server URL** | Stored in sessionStorage; URLs derived on-the-fly |
| **API key scope** | Per-session, expires after 24 hours |
| **WebSocket auth** | API key in every subscribe message |
| **HMAC signing** | Uses `signingToken` (not user password) |
| **WebSocket auth** | API key in every subscribe message |

### Best Practices

1. **Always use HTTPS/WSS** in production
2. **Don't log API keys or signing tokens** — even in debug mode
3. **Clear session** on sign-out — the `signOut()` function handles this
4. **Monitor for 401 responses** — indicates token expiry, re-authenticate
5. **Don't hardcode credentials** in `src/config.ts` — use the sign-in flow

---

## Error Handling

| HTTP Status | Error Type | Meaning | Action |
|-------------|-----------|---------|--------|
| 401 | `AuthenticationError` | Invalid or expired token | Re-authenticate |
| 403 | `AuthorizationError` | Forbidden (IP ban, locked account) | Contact admin |
| 429 | `RateLimitError` | Too many requests | Wait for `Retry-After` header |

```typescript
try {
  await client.trading.placeOrder(order);
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Token expired — redirect to sign-in
    signOut();
  } else if (error instanceof RateLimitError) {
    // Too many requests — wait and retry
    console.log('Rate limited. Retry after:', error.details);
  }
}
```

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [Sign-in Flow](SIGNIN.md) | Complete sign-in page documentation |
| [Configuration](CONFIGURATION.md) | Authentication-related config options |
| [REST API](REST_API.md) | API endpoints requiring HMAC authentication |
| [WebSocket API](WEBSOCKET_API.md) | Real-time connection authentication |
| [Troubleshooting](TROUBLESHOOTING.md) | Authentication and sign-in issues |
| [Security Best Practices](../README.md#security) | Production security considerations |
