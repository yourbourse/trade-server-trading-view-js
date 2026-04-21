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
    }

    /**
     * Disconnect WebSocket
     */
    disconnect(): void {
        if (this.wsClient) {
            this.wsClient.disconnect();
            this.wsClient = null;
            this.log.info('WebSocket disconnected');
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
