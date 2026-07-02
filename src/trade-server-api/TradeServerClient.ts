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
import { setRefreshProbeHandler } from '../utils/axios.js';

const TOKEN_REFRESH_SAFETY_MARGIN_MS = 15 * 60 * 1000;

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
    private refreshInFlight: Promise<boolean> | null = null;
    private visibilityListener: (() => void) | null = null;

    // Latched so a subscriber registered after the initial autoSubscribe()
    // (e.g. the connection indicator, wired up post-connect()) still learns
    // about a degraded state that was already emitted before it subscribed.
    private degraded = false;

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

        // Register the coalesced refresh as the 401/403/502 probe handler.
        // Done here (not in connect()) so a 401 on the very first REST call is caught.
        setRefreshProbeHandler(() => this.refreshNow());

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
            // 10s (vs the lib's 30s default): a revoked session is only detected
            // when the next heartbeat frame carries the stale API key and the
            // server closes with 1008, so this bounds worst-case sign-out latency.
            heartbeatInterval: 10000,
            subscriptionTimeout: 10000,
        });

        // Sign out on WS 1008 (policy violation = revocation / ban).
        this.wsClient.onAuthFailure(() => signOut('session_ended'));

        // Re-check subscriptions on every auto-reconnect so that a disabled
        // account (WS closes 1000, client reconnects) surfaces as 'degraded'
        // rather than staying 'connected' after the socket comes back up.
        // Only notify 'subscriptions_confirmed' (which flips the indicator to
        // 'connected') once autoSubscribe() has actually settled and nothing
        // failed — if something failed, notifySubscriptionDegraded() already
        // fired 'subscription_degraded', which drives 'degraded'.
        if (this.config.websocket.autoSubscribe) {
            this.wsClient.onReconnect(() => {
                void this.autoSubscribe().then(() => {
                    if (!this.wsClient) return; // torn down mid-flight
                    if (!this.degraded) {
                        this.wsClient.getSubscriptions().notify('subscriptions_confirmed', {});
                    }
                });
            });
        }

        await this.wsClient.connect();
        this.log.info('WebSocket connected');

        // Auto-subscribe to configured channels (initial connect only;
        // reconnects are handled by the onReconnect listener above).
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
     *
     * @param expirationMicros - Token expiration as Unix epoch in **microseconds**
     *   (as returned by `ApiToken.expiration`). Not milliseconds — do not pass
     *   `Date.now()` here.
     */
    private scheduleTokenRefresh(expirationMicros: number): void {
        const expirationMs = Math.floor(expirationMicros / 1000);
        const delayMs = Math.max(0, expirationMs - Date.now() - TOKEN_REFRESH_SAFETY_MARGIN_MS);

        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        this.refreshTimer = setTimeout(() => void this.refreshNow(), delayMs);
        this.log.info(
            `Token refresh scheduled in ${delayMs}ms (expires at ${new Date(expirationMs).toISOString()})`
        );
    }

    /**
     * Coalesced refresh entry point. All callers (scheduled timer, visibility
     * listener, 401/403/502 probe) share a single in-flight Promise<boolean>.
     * Returns true if the refresh succeeded, false if it failed (sign-out fired).
     */
    refreshNow(): Promise<boolean> {
        if (this.refreshInFlight) {
            this.log.debug('Refresh already in flight; sharing existing promise');
            return this.refreshInFlight;
        }
        this.refreshInFlight = this.doRefresh().finally(() => {
            this.refreshInFlight = null;
        });
        return this.refreshInFlight;
    }

    /**
     * Perform a single-attempt token refresh. Any error signs the user out
     * immediately — callers (the axios probe) surface a "try again" toast
     * on success rather than the original request being auto-resent.
     */
    private async doRefresh(): Promise<boolean> {
        try {
            this.log.info('Refreshing token…');
            const token = await this.auth.refreshToken();
            if (!token) {
                throw new Error('Empty response from /refresh');
            }
            persistApiToken(token);
            if (this.wsClient) {
                this.rotateWebSocketAuth();
            }
            this.scheduleTokenRefresh(token.expiration);
            this.log.info(
                `Token refreshed (new expiration ${new Date(Math.floor(token.expiration / 1000)).toISOString()})`
            );
            return true;
        } catch (err) {
            this.log.error('Token refresh failed, signing out:', err);
            signOut('session_ended');
            return false;
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
                void this.refreshNow();
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
     * Register a callback fired after the WebSocket auto-reconnects.
     * Returns a disposer that removes the listener.
     * Must be called after connect() — throws otherwise.
     */
    onReconnect(cb: () => void): () => void {
        if (!this.wsClient) {
            throw new Error('WebSocket not connected. Call connect() first.');
        }
        return this.wsClient.onReconnect(cb);
    }

    /**
     * Subscribe to live connection state changes.
     * States: 'connected' | 'reconnecting' | 'disconnected' | 'degraded'.
     * 'degraded' = socket open but one or more channel subscriptions were refused.
     * Returns a disposer. Must be called after connect().
     */
    onConnectionStateChange(
        cb: (state: 'connected' | 'reconnecting' | 'disconnected' | 'degraded') => void
    ): () => void {
        if (!this.wsClient) {
            throw new Error('WebSocket not connected. Call connect() first.');
        }
        const subs = this.wsClient.getSubscriptions();
        // Raw transport 'connected' events fire on every socket open, including
        // reconnects. On a reconnect, don't forward it yet — the socket being
        // open doesn't mean channel subscriptions succeeded (e.g. a disabled
        // account reconnects fine but every subscribe is refused). Wait for
        // 'subscriptions_confirmed', which TradeServerClient emits once
        // autoSubscribe() actually succeeds after a reconnect (see connect()).
        const onConnected = (data: unknown) => {
            const { reconnect } = (data ?? {}) as { reconnect?: boolean };
            if (!reconnect) cb('connected');
        };
        const onSubscriptionsConfirmed = () => cb('connected');
        const onReconnecting = () => cb('reconnecting');
        const onExhausted = () => cb('disconnected');
        const onDegraded = () => cb('degraded');
        subs.subscribe('connected', onConnected);
        subs.subscribe('subscriptions_confirmed', onSubscriptionsConfirmed);
        subs.subscribe('reconnecting', onReconnecting);
        subs.subscribe('reconnect_exhausted', onExhausted);
        subs.subscribe('subscription_degraded', onDegraded);

        // Replay: autoSubscribe() runs (and may already have failed a channel)
        // before connect() resolves, i.e. before any caller can have subscribed.
        if (this.degraded) cb('degraded');

        return () => {
            subs.unsubscribe('connected', onConnected);
            subs.unsubscribe('subscriptions_confirmed', onSubscriptionsConfirmed);
            subs.unsubscribe('reconnecting', onReconnecting);
            subs.unsubscribe('reconnect_exhausted', onExhausted);
            subs.unsubscribe('subscription_degraded', onDegraded);
        };
    }

    /**
     * Reset the reconnect counter and attempt a fresh connection.
     * Used by the UI after exhausted reconnect attempts.
     * Must be called after connect().
     */
    reconnect(): void {
        if (!this.wsClient) {
            throw new Error('WebSocket not connected. Call connect() first.');
        }
        this.wsClient.reconnect();
    }

    /**
     * Emit a 'subscription_degraded' event so the connection indicator can
     * show "Server is live, but there's no data" when channels are refused.
     */
    private notifySubscriptionDegraded(channel: string): void {
        this.degraded = true;
        this.wsClient?.getSubscriptions().notify('subscription_degraded', { channel });
    }

    /**
     * Auto-subscribe to configured channels
     */
    private async autoSubscribe(): Promise<void> {
        if (!this.wsClient || !this.config.websocket.autoSubscribe) {
            return;
        }

        this.degraded = false;
        const { autoSubscribe } = this.config.websocket;
        const subscriptions: Promise<unknown>[] = [];

        if (autoSubscribe.orders) {
            this.log.debug('Auto-subscribing to orders channel');
            subscriptions.push(
                this.subscribeToOrders({ snapshot: true }).catch((err) => {
                    this.log.error('Failed to subscribe to orders', err);
                    this.notifySubscriptionDegraded('orders');
                })
            );
        }

        if (autoSubscribe.positions) {
            this.log.debug('Auto-subscribing to positions channel');
            subscriptions.push(
                this.subscribeToPositions({ snapshot: true, sendPriceUpdates: true }).catch((err) => {
                    this.log.error('Failed to subscribe to positions', err);
                    this.notifySubscriptionDegraded('positions');
                })
            );
        }

        if (autoSubscribe.balances) {
            this.log.debug('Auto-subscribing to balances channel');
            subscriptions.push(
                this.subscribeToBalances({ snapshot: true }).catch((err) => {
                    this.log.error('Failed to subscribe to balances', err);
                    this.notifySubscriptionDegraded('balances');
                })
            );
        }

        if (autoSubscribe.accountStates) {
            this.log.debug('Auto-subscribing to account states channel');
            subscriptions.push(
                this.subscribeToAccountStates({ snapshot: true }).catch((err) => {
                    this.log.error('Failed to subscribe to account states', err);
                    this.notifySubscriptionDegraded('states');
                })
            );
        }

        if (autoSubscribe.trades) {
            this.log.debug('Auto-subscribing to trades channel');
            subscriptions.push(
                this.subscribeToTrades().catch((err) => {
                    this.log.error('Failed to subscribe to trades', err);
                    this.notifySubscriptionDegraded('trades');
                })
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
        return this.websocket.unsubscribeFromChannel('ohlc', params as unknown as Record<string, unknown>, false);
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
