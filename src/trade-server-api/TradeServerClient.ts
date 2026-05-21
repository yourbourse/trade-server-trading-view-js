/**
 * Trade Server Client
 * Main facade for the Trade Server API
 * Provides a clean, unified interface for all API operations
 */

import { client } from '../schema/public-api/client.gen.js';
import { AppConfig } from '../types/AppConfig.js';
import { AuthUser } from '../types/AuthUser.js';
import { WebSocketClient } from './websocket/WebSocketClient.js';
import { SubscriptionManager } from './websocket/SubscriptionManager.js';
import { AuthService } from './rest/AuthService.js';
import { TradingService } from './rest/TradingService.js';
import { MarketDataService } from './rest/MarketDataService.js';
import { AccountService } from './rest/AccountService.js';
import { CandleInterval } from '../schema/public-api/types.gen.js';
import type {
    OrdersSubscriptionParams,
    PositionsSubscriptionParams,
    BalancesSubscriptionParams,
    AccountStatesSubscriptionParams,
    TransfersSubscriptionParams,
    CandlesSubscriptionParams,
    QuotesSubscriptionParams,
    OrderBookSubscriptionParams,
} from './types/index.js';
import { deriveServerUrls } from '../utils/serverUrl.js';
import { logger } from '../utils/logger.js';
import { persistApiToken, getTokenExpiration, signOut } from '../utils/auth.js';

const TOKEN_REFRESH_SAFETY_MARGIN_MS = 60_000;

/**
 * Main Trade Server API Client
 *
 * @example
 * ```typescript
 * const client = new TradeServerClient(config);
 * await client.connect();
 *
 * // Use service modules
 * await client.auth.signIn('username');
 * const orders = await client.trading.getOrders();
 * const symbols = await client.marketData.getSymbols();
 * const balance = await client.account.getBalance();
 *
 * // Subscribe to WebSocket events
 * client.subscriptions.subscribe('orders', (data) => console.log(data));
 * await client.websocket.subscribeToChannel('orders', { snapshot: true });
 * ```
 */
export class TradeServerClient {
    // Configuration
    private config: AppConfig;
    private user: AuthUser;

    // Service modules
    public readonly auth: AuthService;
    public readonly trading: TradingService;
    public readonly marketData: MarketDataService;
    public readonly account: AccountService;

    // WebSocket
    private wsClient: WebSocketClient | null = null;

    // Token refresh scheduler
    private refreshTimer: ReturnType<typeof setTimeout> | null = null;
    private isRefreshing = false;
    private visibilityListener: (() => void) | null = null;

    // Logging
    private log = logger.child('TradeServerClient');

    constructor(config: AppConfig) {
        this.config = config;
        this.user = config.tradeServer.user;

        // Derive baseUrl from server string
        const { baseUrl } = deriveServerUrls(config.tradeServer.server);

        // Configure SDK client with base URL
        client.setConfig({
            baseURL: baseUrl,
        });

        // Initialize service modules
        this.auth = new AuthService(this.user);
        this.trading = new TradingService(this.user);
        this.marketData = new MarketDataService(this.user);
        this.account = new AccountService(this.user);

        this.log.info('TradeServerClient initialized');
    }

    /**
     * Get WebSocket subscription manager
     */
    get subscriptions(): SubscriptionManager {
        if (!this.wsClient) {
            throw new Error('WebSocket not connected. Call connect() first.');
        }
        return this.wsClient.getSubscriptions();
    }

    /**
     * Get WebSocket client (for advanced usage)
     */
    get websocket(): WebSocketClient {
        if (!this.wsClient) {
            throw new Error('WebSocket not connected. Call connect() first.');
        }
        return this.wsClient;
    }

    /**
     * Initialize and connect WebSocket
     */
    async connect(): Promise<void> {
        if (this.wsClient?.isConnected()) {
            this.log.info('WebSocket already connected');
            return;
        }

        this.log.info('Connecting WebSocket...');

        // Derive wsUrl from server string
        const { wsUrl } = deriveServerUrls(this.config.tradeServer.server);

        this.wsClient = new WebSocketClient({
            url: wsUrl,
            apiKey: this.user.apiKey,
            autoReconnect: this.config.websocket.reconnect?.enabled ?? true,
            reconnectDelay: this.config.websocket.reconnect?.delay ?? 5000,
            maxReconnectAttempts: this.config.websocket.reconnect?.maxAttempts ?? 10,
            heartbeatInterval: 30000,
            subscriptionTimeout: 10000,
        });

        await this.wsClient.connect();
        this.log.info('WebSocket connected');

        // Auto-subscribe to configured channels
        if (this.config.websocket.autoSubscribe) {
            await this.autoSubscribe();
        }

        // Activate background token refresh if we have a persisted expiration.
        // Missing expiration (legacy session, or signin path that hasn't been
        // updated) is handled gracefully — the scheduler simply doesn't run.
        const expiration = getTokenExpiration();
        if (expiration !== null) {
            this.scheduleTokenRefresh(expiration);
            this.installVisibilityListener();
        } else {
            this.log.debug('No token expiration in sessionStorage; refresh scheduler not installed');
        }
    }

    /**
     * Disconnect WebSocket
     */
    disconnect(): void {
        this.stopTokenRefresh();
        if (this.wsClient) {
            this.wsClient.disconnect();
            this.wsClient = null;
            this.log.info('WebSocket disconnected');
        }
    }

    /**
     * Schedule a single token refresh to fire SAFETY_MARGIN before expiry.
     * Replaces any previously scheduled timer.
     */
    private scheduleTokenRefresh(expirationMicros: number): void {
        const expirationMs = Math.floor(expirationMicros / 1000);
        const delayMs = Math.max(0, expirationMs - Date.now() - TOKEN_REFRESH_SAFETY_MARGIN_MS);

        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        this.refreshTimer = setTimeout(() => void this.runScheduledRefresh(), delayMs);
        this.log.info(
            `Token refresh scheduled in ${delayMs}ms (expires at ${new Date(expirationMs).toISOString()})`
        );
    }

    /**
     * Perform a token refresh. Re-entry guard makes it safe to call from both
     * the scheduled timer and the visibilitychange listener.
     *
     * On failure (network, 401, anything): sign the user out — chosen
     * behaviour per the design (single-shot, no retries).
     */
    private async runScheduledRefresh(): Promise<void> {
        if (this.isRefreshing) {
            this.log.debug('Refresh already in flight; skipping re-entry');
            return;
        }
        this.isRefreshing = true;
        try {
            this.log.info('Refreshing token...');
            const token = await this.auth.refreshToken();

            // If the user disconnected during the in-flight refresh, drop the
            // result rather than persisting and rescheduling on a dead client.
            if (!this.wsClient) {
                this.log.debug('Disconnected during refresh; dropping result');
                return;
            }

            persistApiToken(token);
            this.rotateWebSocketAuth();
            this.scheduleTokenRefresh(token.expiration);
            this.log.info(
                `Token refreshed (new expiration ${new Date(Math.floor(token.expiration / 1000)).toISOString()})`
            );
        } catch (err) {
            this.log.error('Token refresh failed, signing out:', err);
            signOut();
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Propagate the rotated apiKey to the open WebSocket. The server
     * authenticates each frame on X-YB-API-Key, so an in-place update is
     * sufficient — no reconnect.
     */
    private rotateWebSocketAuth(): void {
        if (!this.wsClient) return;
        this.wsClient.setApiKey(this.user.apiKey);
    }

    /**
     * Re-evaluate the schedule when the tab becomes visible. Browsers
     * throttle setTimeout in background tabs (and don't fire across system
     * sleep), so the original timer may already be late.
     */
    private installVisibilityListener(): void {
        if (this.visibilityListener) return;
        this.visibilityListener = () => {
            if (document.visibilityState !== 'visible') return;
            const expiration = getTokenExpiration();
            if (expiration === null) return;
            const expirationMs = Math.floor(expiration / 1000);
            if (expirationMs - Date.now() <= TOKEN_REFRESH_SAFETY_MARGIN_MS) {
                this.log.debug('Tab visible and within refresh margin; refreshing now');
                void this.runScheduledRefresh();
            }
        };
        document.addEventListener('visibilitychange', this.visibilityListener);
    }

    /**
     * Tear down the refresh timer and the visibility listener.
     */
    private stopTokenRefresh(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        if (this.visibilityListener) {
            document.removeEventListener('visibilitychange', this.visibilityListener);
            this.visibilityListener = null;
        }
    }

    /**
     * Check if WebSocket is connected
     */
    isConnected(): boolean {
        return this.wsClient?.isConnected() ?? false;
    }

    /**
     * Auto-subscribe to configured channels
     */
    private async autoSubscribe(): Promise<void> {
        if (!this.wsClient || !this.config.websocket.autoSubscribe) {
            return;
        }

        const { autoSubscribe } = this.config.websocket;
        const subscriptions: Promise<unknown>[] = [];

        if (autoSubscribe.orders) {
            this.log.debug('Auto-subscribing to orders channel');
            subscriptions.push(
                this.subscribeToOrders({ snapshot: true }).catch((err) =>
                    this.log.error('Failed to subscribe to orders', err)
                )
            );
        }

        if (autoSubscribe.positions) {
            this.log.debug('Auto-subscribing to positions channel');
            subscriptions.push(
                this.subscribeToPositions({ snapshot: true, sendPriceUpdates: true }).catch((err) =>
                    this.log.error('Failed to subscribe to positions', err)
                )
            );
        }

        if (autoSubscribe.balances) {
            this.log.debug('Auto-subscribing to balances channel');
            subscriptions.push(
                this.subscribeToBalances({ snapshot: true }).catch((err) =>
                    this.log.error('Failed to subscribe to balances', err)
                )
            );
        }

        if (autoSubscribe.accountStates) {
            this.log.debug('Auto-subscribing to account states channel');
            subscriptions.push(
                this.subscribeToAccountStates({ snapshot: true }).catch((err) =>
                    this.log.error('Failed to subscribe to account states', err)
                )
            );
        }

        if (autoSubscribe.trades) {
            this.log.debug('Auto-subscribing to trades channel');
            subscriptions.push(
                this.subscribeToTrades().catch((err) => this.log.error('Failed to subscribe to trades', err))
            );
        }

        await Promise.allSettled(subscriptions);
    }

    // ==================== WEBSOCKET SUBSCRIPTION HELPERS ====================

    /**
     * Subscribe to orders channel
     */
    async subscribeToOrders(params: OrdersSubscriptionParams = {}): Promise<unknown> {
        return this.websocket.subscribeToChannel('orders', params as Record<string, unknown>);
    }

    /**
     * Unsubscribe from orders channel
     */
    async unsubscribeFromOrders(): Promise<unknown> {
        return this.websocket.unsubscribeFromChannel('orders');
    }

    /**
     * Subscribe to positions channel
     */
    async subscribeToPositions(params: PositionsSubscriptionParams = {}): Promise<unknown> {
        return this.websocket.subscribeToChannel('positions', params as Record<string, unknown>);
    }

    /**
     * Unsubscribe from positions channel
     */
    async unsubscribeFromPositions(): Promise<unknown> {
        return this.websocket.unsubscribeFromChannel('positions');
    }

    /**
     * Subscribe to balances channel
     */
    async subscribeToBalances(params: BalancesSubscriptionParams = {}): Promise<unknown> {
        return this.websocket.subscribeToChannel('balances', params as Record<string, unknown>);
    }

    /**
     * Unsubscribe from balances channel
     */
    async unsubscribeFromBalances(): Promise<unknown> {
        return this.websocket.unsubscribeFromChannel('balances');
    }

    /**
     * Subscribe to account states channel
     */
    async subscribeToAccountStates(params: AccountStatesSubscriptionParams = {}): Promise<unknown> {
        return this.websocket.subscribeToChannel('states', params as Record<string, unknown>);
    }

    /**
     * Unsubscribe from account states channel
     */
    async unsubscribeFromAccountStates(): Promise<unknown> {
        return this.websocket.unsubscribeFromChannel('states');
    }

    /**
     * Subscribe to trades channel
     */
    async subscribeToTrades(): Promise<unknown> {
        return this.websocket.subscribeToChannel('trades');
    }

    /**
     * Unsubscribe from trades channel
     */
    async unsubscribeFromTrades(): Promise<unknown> {
        return this.websocket.unsubscribeFromChannel('trades');
    }

    /**
     * Subscribe to transfers channel
     */
    async subscribeToTransfers(params: TransfersSubscriptionParams = {}): Promise<unknown> {
        return this.websocket.subscribeToChannel('transfers', params as Record<string, unknown>);
    }

    /**
     * Unsubscribe from transfers channel
     */
    async unsubscribeFromTransfers(): Promise<unknown> {
        return this.websocket.unsubscribeFromChannel('transfers');
    }

    /**
     * Subscribe to candles (OHLC) for a symbol
     */
    async subscribeToCandles(symbol: string, interval: CandleInterval, snapshot = false): Promise<unknown> {
        const params: CandlesSubscriptionParams = { s: symbol, i: interval, snapshot };
        return this.websocket.subscribeToChannel('ohlc', params as unknown as Record<string, unknown>);
    }

    /**
     * Unsubscribe from candles (OHLC) for a symbol
     */
    async unsubscribeFromCandles(symbol: string, interval: CandleInterval): Promise<unknown> {
        const params: CandlesSubscriptionParams = { s: symbol, i: interval };
        return this.websocket.unsubscribeFromChannel('ohlc', params as unknown as Record<string, unknown>);
    }

    /**
     * Subscribe to quotes (L1 - top of book) for a symbol
     */
    async subscribeToQuotes(symbol: string, streaming = true): Promise<unknown> {
        const params: QuotesSubscriptionParams = { s: symbol, streaming };
        return this.websocket.subscribeToChannel('L1', params as unknown as Record<string, unknown>);
    }

    /**
     * Unsubscribe from quotes (L1) for a symbol
     */
    async unsubscribeFromQuotes(symbol: string): Promise<unknown> {
        const params: QuotesSubscriptionParams = { s: symbol };
        return this.websocket.unsubscribeFromChannel('L1', params as unknown as Record<string, unknown>);
    }

    /**
     * Subscribe to order book (L2) for a symbol
     */
    async subscribeToOrderBook(symbol: string, depth = 10, streaming = true): Promise<unknown> {
        const params: OrderBookSubscriptionParams = { s: symbol, d: depth, streaming };
        return this.websocket.subscribeToChannel('L2', params as unknown as Record<string, unknown>);
    }

    /**
     * Unsubscribe from order book (L2) for a symbol
     */
    async unsubscribeFromOrderBook(symbol: string, depth = 10): Promise<unknown> {
        const params: OrderBookSubscriptionParams = { s: symbol, d: depth };
        return this.websocket.unsubscribeFromChannel('L2', params as unknown as Record<string, unknown>);
    }

    /**
     * Convenience method: Subscribe to symbol quotes
     */
    async subscribeToSymbol(symbol: string): Promise<unknown> {
        return this.subscribeToQuotes(symbol, true);
    }

    /**
     * Convenience method: Unsubscribe from symbol quotes
     */
    async unsubscribeFromSymbol(symbol: string): Promise<unknown> {
        return this.unsubscribeFromQuotes(symbol);
    }
}
