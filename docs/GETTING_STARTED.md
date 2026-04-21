<div align="center">

# Getting Started

**Complete setup guide — from zero to running trading platform**

[Prerequisites](#prerequisites) · [Installation](#installation) · [Library Setup](#step-2-add-tradingview-charting-library) · [First Launch](#step-4-first-launch) · [Next Steps](#next-steps)

</div>

---

## Prerequisites

Before you begin, make sure you have the following:

| Requirement | Minimum Version | How to Check |
|-------------|-----------------|--------------|
| **Node.js** | 18.0+ | `node --version` |
| **npm** | 9.0+ | `npm --version` |
| **Git** | 2.0+ | `git --version` |
| **Modern Browser** | Latest Chrome/Firefox/Edge | WebSocket + ES2020 support |

You will also need:

- **TradingView Charting Library** — A commercial license from [TradingView](https://www.tradingview.com/HTML5-stock-forex-bitcoin-charting-library/). This is proprietary software and is **not included** in this repository.
- **YourBourse Trade Server** — API access with valid credentials (login, password, and server URL).

---

## Installation

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd client

# Install dependencies
npm install
```

This installs Vite and TypeScript — the only two dependencies. All other libraries (CryptoJS, TradingView) are loaded at runtime.

---

### Step 2: Add TradingView Charting Library

The TradingView Charting Library needs to be available in **two locations** for the application to work:

| Location | Purpose |
|----------|---------|
| `charting_library/` (project root) | TypeScript type imports during development |
| `public/charting_library/` | Static assets served to the browser at runtime |

#### Option A: Standalone Setup (Manual)

1. **Obtain the library** from [TradingView](https://www.tradingview.com/HTML5-stock-forex-bitcoin-charting-library/)

2. **Copy to project root:**
   ```
   client/
     charting_library/              <-- Copy here
       charting_library.js
       charting_library.d.ts
       charting_library.standalone.js
       datafeed-api.d.ts
       broker-api.d.ts
       bundles/
       ...
   ```

3. **Verify** the library is detected:
   ```bash
   npm run dev
   # Console should NOT show "charting_library/ not found" warning
   ```

#### Option B: Git Submodule Setup (Recommended for Teams)

When this repository is used as a **git submodule** in the private deployment repo (which contains the proprietary library):

```bash
# In the parent (private) repository:
git clone --recurse-submodules <parent-repo-url>
cd parent-repo/client
npm install
```

> **Note:** When using as a submodule, the charting library is provided by the parent repo.

---

### Step 3: Verify File Structure

After setup, your project should look like this:

```
client/
├── charting_library/              ✅ TradingView library (root)
│   ├── charting_library.js
│   ├── charting_library.d.ts
│   ├── charting_library.standalone.js
│   ├── datafeed-api.d.ts
│   ├── broker-api.d.ts
│   ├── bundles/
│   └── ...
├── public/
│   └── charting_library/          ✅ Vite build will copy files there (for browser)
├── src/
│   ├── app.ts
│   ├── config.ts
│   └── ...
├── node_modules/                  ✅ Created by npm install
├── index.html
├── signin.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

### Step 4: First Launch

```bash
npm run dev
```

This starts the Vite development server:

- Opens automatically at **http://localhost:8080**
- You'll see the **Sign-in page**:

![Sign-in and Platform Overview](Signing%20In%20And%20General%20Look.gif)

**Sign in with your Trade Server credentials:**

| Field | Value |
|-------|-------|
| **Login** | Your account number (numeric) |
| **Password** | Your Trade Server password |
| **Server** | Your Trade Server URL (e.g., `https://uat.api.yourbourse.trade:32285`) |

After signing in, the application:
1. Authenticates against the Trade Server REST API
2. Stores session tokens in `sessionStorage`
3. Redirects to the main trading terminal
4. Connects to the WebSocket for real-time data
5. Auto-subscribes to account channels (orders, positions, balances, account state)

### Expected Console Output

Open the browser developer console (F12) to verify everything is working:

```
Initializing Trading Application...
WebSocket connected
Auto-subscribed to orders
Auto-subscribed to positions
Auto-subscribed to balances
Auto-subscribed to account states
Auto-subscribed to trades
All auto-subscriptions completed successfully
Trading Application initialized successfully
```

---

## Build for Production

```bash
# Build optimized bundle
npm run build

# Preview the production build locally
npm run preview
```

The build outputs to `dist/` and includes:
- Bundled and minified JavaScript
- Optimized CSS
- TradingView `charting_library/` (copied by custom Vite plugin)
- Both `index.html` and `signin.html` entry points

---

## Configuration

The application reads configuration from `src/config.ts` at runtime. When using the sign-in flow, most settings are configured automatically from the sign-in form values.

For detailed configuration options, see the [Configuration Guide](CONFIGURATION.md).

---

## Troubleshooting First Launch

### "charting_library/ not found" Warning

The Vite config cannot find the TradingView library.

**Fix:** Ensure `charting_library/` exists at the project root (or one level up for submodule setups). Check that the folder contains `charting_library.js` and the `bundles/` directory.

### Sign-in Page Doesn't Load

**Fix:** Check that `npm run dev` started without errors. Verify no port conflicts on 8080.

### Sign-in Fails

**Fix:**
- Verify your Trade Server URL is correct and accessible (try opening it in a browser)
- Check that your credentials are valid
- Ensure `https://` is included in the server URL
- Check browser console for network errors

### WebSocket Not Connecting

**Fix:**
- Verify the Trade Server WebSocket endpoint is accessible
- Check browser console for connection error messages  
- The WebSocket URL is derived from the REST URL (same host, `/ws/v1` path)
- Ensure no firewall is blocking WebSocket connections

### Chart Not Loading

**Fix:**
- Verify `public/charting_library/` exists and contains the library files
- Check browser console for 404 errors on `charting_library` assets

For more common issues, see the [Troubleshooting Guide](TROUBLESHOOTING.md).

---

## Next Steps

Now that your platform is running:

| What to do next | Guide |
|-----------------|-------|
| Learn the trading interface | [Trading Guide](TRADING_GUIDE.md) |
| Understand order types | [Order Types Guide](ORDER_TYPES_GUIDE.md) |
| Configure the application | [Configuration Reference](CONFIGURATION.md) |
| Explore the API | [API Overview](API_OVERVIEW.md) |
| Understand the architecture | [Architecture](ARCHITECTURE.md) |
| Set up development workflow | [Development Guide](DEVELOPMENT.md) |
