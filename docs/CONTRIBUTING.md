<div align="center">

# Contributing Guide

**Guidelines for contributing to the TradingView Integration Client**

[Getting Started](#getting-started) · [Code Standards](#code-standards) · [Pull Requests](#pull-request-process) · [Architecture](#architecture-guidelines) · [Testing](#testing) · [Documentation](README.md)

</div>

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js** 18+ installed
- **Git** with submodules support
- Familiarity with **TypeScript** and **ES modules**
- Understanding of **TradingView Charting Library** APIs (Broker API & Datafeed API)
- Access to **YourBourse Trade Server** documentation

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd client

# Install dependencies
npm install

# Start development server
npm run dev

# In a separate terminal, run type checking
npm run type-check
```

### Before You Start

1. **Read the documentation**: Familiarize yourself with [ARCHITECTURE.md](ARCHITECTURE.md), [DEVELOPMENT.md](DEVELOPMENT.md), and [API_OVERVIEW.md](API_OVERVIEW.md)
2. **Check existing issues**: Look for related issues or feature requests
3. **Discuss major changes**: Open an issue first to discuss significant architectural changes
4. **Set up your editor**: Use TypeScript-aware IDE (VS Code recommended) with ESLint integration

---

## Code Standards

### TypeScript Guidelines

#### Minimal Commenting Approach

- **DO comment**: Complex business logic, algorithms, non-obvious design decisions
- **DO comment**: External library usage (especially TradingView Charting Library APIs)
- **DON'T comment**: Simple operations, variable declarations, obvious code
- **DON'T comment**: Parameter types, return types, or interface properties (TypeScript provides this)

**Example - Good commenting:**

```typescript
// Convert Trade Server order status to TradingView order status
// Trade Server uses numeric codes while TradingView expects enum values
function mapOrderStatus(serverStatus: number): OrderStatus {
    switch (serverStatus) {
        case 1: return OrderStatus.Working;
        case 2: return OrderStatus.Filled;
        // ... more cases
    }
}
```

**Example - Avoid redundant comments:**

```typescript
// ❌ BAD: Redundant comment
// This function creates a new order
function createOrder(params: OrderParams): Promise<Order> { }

// ✅ GOOD: No comment needed - function name and types are self-explanatory
function createOrder(params: OrderParams): Promise<Order> { }
```

#### Naming Conventions

- **camelCase**: Variables, functions, and methods
  ```typescript
  const accountBalance = 10000;
  function calculateProfit() { }
  ```

- **PascalCase**: Classes, types, interfaces, and enums
  ```typescript
  class BrokerApi { }
  interface IDatafeedChartApi { }
  enum OrderStatus { }
  type OrderParams = { };
  ```

- **UPPER_CASE**: Constants and environment variables
  ```typescript
  const MAX_RETRY_ATTEMPTS = 3;
  const API_BASE_URL = config.apiUrl;
  ```

#### Type Safety

- **Always** provide explicit return types for public functions
- **Avoid** using `any` type — use `unknown` if type is truly unknown, then narrow it
- **Prefer** interfaces for object shapes, types for unions/intersections
- **Use** strict null checks — handle `null` and `undefined` explicitly

```typescript
// ✅ GOOD: Explicit types, no 'any'
function processOrder(order: Order): OrderResult {
    const status: OrderStatus = order.status;
    return { success: true, orderId: order.id };
}

// ❌ BAD: Implicit any, no return type
function processOrder(order) {
    return { success: true, orderId: order.id };
}
```

### Code Quality Standards

#### Error Handling

- Handle all error cases explicitly
- Use try-catch for async operations
- Provide meaningful error messages
- Log errors appropriately

```typescript
async function fetchAccountData(): Promise<AccountData> {
    try {
        const response = await tradeServerApi.getAccount();
        return response.data;
    } catch (error) {
        console.error('Failed to fetch account data:', error);
        throw new Error('Unable to retrieve account information');
    }
}
```

#### Import Organization

```typescript
// 1. External libraries
import axios from 'axios';
import CryptoJS from 'crypto-js';

// 2. TradingView types (from charting_library)
import type { IDatafeedChartApi, ResolutionString } from '../../charting_library/datafeed-api';

// 3. Internal modules (grouped by feature)
import { BrokerApi } from './broker-api/broker-api';
import { TradeServerClient } from './trade-server-api/TradeServerClient';
import type { Order, Position } from './broker-api/types';

// 4. Configuration and utilities
import { config } from './config';
```

#### Module Boundaries

Maintain clear separation between modules:

- **broker-api/**: TradingView Broker API implementation — handles orders, positions, account operations
- **datafeed/**: TradingView Datafeed API implementation — provides market data and chart history
- **trade-server-api/**: YourBourse Trade Server client (REST + WebSocket)
- **No cross-imports**: Each module should only import from its own directory or use shared types

---

## Architecture Guidelines

### Modular Structure

The application follows a strict modular architecture. When adding new features:

1. **Identify the correct module** where your change belongs
2. **Respect module boundaries** — don't create cross-dependencies
3. **Use type mappings** when converting between Trade Server and TradingView formats
4. **Keep business logic in the appropriate layer**

### TradingView API Compliance

All implementations must follow TradingView specifications:

- **Broker API**: Implement `IBrokerTerminal` interface correctly
- **Datafeed API**: Implement `IDatafeedChartApi` and `IDatafeedQuotesApi` interfaces correctly
- **Follow conventions**: Use TradingView's enum values, data structures, and callback patterns
- **Test thoroughly**: Verify integration works with TradingView widget

### WebSocket Management

When working with WebSocket connections:

- Implement proper connection lifecycle (connect, subscribe, unsubscribe, disconnect)
- Handle reconnection logic with exponential backoff
- Clean up subscriptions to prevent memory leaks
- Handle network errors gracefully
- Log connection state changes for debugging

```typescript
// Example reconnection pattern
private reconnect(): void {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    setTimeout(() => {
        this.connect();
        this.reconnectAttempts++;
    }, delay);
}
```

### Authentication

- All Trade Server API requests must use **HMAC authentication**
- Never log or expose API keys or secrets
- Validate authentication tokens before making requests
- Handle authentication failures with clear error messages

---

## Pull Request Process

### Before Submitting

1. **Run all checks**:
   ```bash
   npm run type-check  # Verify TypeScript types
   npm run lint        # Check code quality
   npm run build       # Ensure production build works
   ```

2. **Test your changes**:
   - Test in the TradingView widget interface
   - Verify all affected features still work
   - Test edge cases and error scenarios
   - Check browser console for errors

3. **Update documentation**:
   - Add/update JSDoc comments for complex logic
   - Update relevant `.md` files in `client/docs/`
   - Add examples if introducing new patterns

### PR Guidelines

1. **One feature per PR**: Keep pull requests focused on a single feature or fix
2. **Clear description**: Explain what changed and why
3. **Reference issues**: Link to related issues using `Fixes #123` or `Relates to #456`
4. **Clean commits**: Use meaningful commit messages following conventional commits format
5. **No commented code**: Remove debugging code and commented-out blocks

### Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(broker-api): add support for bracket orders

fix(datafeed): resolve memory leak in bar subscription cleanup

docs(contributing): add guidelines for WebSocket management

refactor(type-mappings): simplify order status conversion logic
```

### Code Review Process

1. **Automated checks**: All CI/CD checks must pass
2. **Peer review**: At least one approval from a maintainer
3. **Address feedback**: Respond to all review comments
4. **Keep updated**: Rebase on latest `master` if needed

---

## Testing

### Manual Testing Checklist

When making changes, verify:

- [ ] **Authentication**: Sign-in flow works correctly
- [ ] **Order placement**: Market, limit, and stop orders execute properly
- [ ] **Position management**: Opening, modifying, and closing positions works
- [ ] **Real-time data**: Price updates stream correctly via WebSocket
- [ ] **Chart functionality**: Historical data loads and displays correctly
- [ ] **Error handling**: Error messages are clear and helpful
- [ ] **Browser console**: No errors or warnings in console
- [ ] **Network tab**: API requests have correct payloads and authentication

### Testing Best Practices

- **Test in production mode**: Run `npm run build && npm run preview` to test the production bundle
- **Test reconnection**: Disable network and verify WebSocket reconnection works
- **Test edge cases**: Empty accounts, large positions, network errors, invalid inputs
- **Cross-browser testing**: Verify functionality in Chrome, Firefox, Safari, and Edge

### Integration Testing

Since this is a TradingView integration:

1. Test within the TradingView widget environment
2. Verify all Account Manager features (orders, positions, account info)
3. Test chart data loading and real-time updates
4. Verify watchlist quotes update correctly
5. Test all supported order types and modifications

---

## Security Considerations

### Authentication & API Keys

- **Never commit** API keys, secrets, or tokens
- Use environment variables or sessionStorage for sensitive data
- Validate all user inputs before sending to APIs
- Use HTTPS for all API communications

### Code Security

- Sanitize all user inputs
- Avoid `eval()` and similar dynamic code execution
- Use Content Security Policy (CSP) headers
- Keep dependencies up to date (`npm audit` regularly)

---

## Documentation

### When to Update Documentation

Update documentation when you:

- Add a new feature or API endpoint
- Change existing behavior or interfaces
- Introduce new configuration options
- Discover and fix edge cases worth documenting
- Add new order types or trading features

### Documentation Location

- **API documentation**: `client/docs/API_OVERVIEW.md`, `client/docs/REST_API.md`, `client/docs/WEBSOCKET_API.md`
- **Architecture changes**: `client/docs/ARCHITECTURE.md`
- **Developer guides**: `client/docs/DEVELOPMENT.md`
- **User guides**: `client/docs/TRADING_GUIDE.md`, `client/docs/GETTING_STARTED.md`
- **Troubleshooting**: `client/docs/TROUBLESHOOTING.md`, `client/docs/FAQ.md`

---

## Getting Help

### Resources

- **Documentation**: Start with `client/docs/README.md` for an overview
- **Architecture**: Read `client/docs/ARCHITECTURE.md` for system design
- **Issues**: Check existing issues for similar problems or questions
- **TradingView docs**: Refer to TradingView Broker API and Datafeed API documentation

### Communication

- **Bug reports**: Open an issue with detailed reproduction steps
- **Feature requests**: Open an issue explaining the use case and expected behavior
- **Questions**: Use GitHub Discussions or open an issue tagged with `question`
- **Security issues**: Contact maintainers privately — do not open public issues

---

## Related Documentation

| Document | Focus Area |
|----------|------------|
| [Code Standards](CODE_STANDARDS.md) | Import conventions, formatting, and naming rules |
| [Development Guide](DEVELOPMENT.md) | Project structure, workflow, and conventions |
| [Architecture](ARCHITECTURE.md) | System design and data flows |
| [API Overview](API_OVERVIEW.md) | Complete REST & WebSocket API reference |
| [Troubleshooting](TROUBLESHOOTING.md) | Common issues and debugging techniques |
| [Code Quality Standards](../.github/copilot-instructions.md) | PR review guidelines and code standards |
| [Documentation Index](README.md) | Complete documentation overview |

---

## License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

<div align="center">

**Thank you for contributing to the TradingView Integration Client!** 🚀

Your contributions help make trading more accessible and efficient.

</div>
