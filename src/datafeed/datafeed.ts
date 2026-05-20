/**
 * TradingView Datafeed Implementation
 * Provides market data to TradingView charts
 */

import CONFIG from '../config.js';
import type { Symbol, SymbolCollection, Candle } from '../schema/public-api/types.gen';
import type {
    DatafeedConfiguration,
    LibrarySymbolInfo,
    IDatafeedChartApi,
    IDatafeedQuotesApi,
    ResolutionString,
    PeriodParams,
    HistoryCallback,
    SearchSymbolsCallback,
    ResolveCallback,
    DatafeedErrorCallback,
    SubscribeBarsCallback,
    QuotesCallback,
    QuotesErrorCallback,
    QuoteOkData,
} from '../../charting_library/datafeed-api';
import { SubscriberInfo } from './SubscriberInfo';
import { TradeServerClient } from '../trade-server-api/TradeServerClient.js';
import { CandleInterval } from '../schema/public-api/types.gen.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger({ prefix: '[Datafeed]' });

interface QuoteSubscription {
    symbols: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wsCallback: (data: any) => void;
}

class Datafeed implements IDatafeedChartApi, IDatafeedQuotesApi {
    api: TradeServerClient;
    subscribers: Record<string, SubscriberInfo>;
    configurationData: DatafeedConfiguration;
    // Quote-related properties
    private quoteSubscriptions: Map<string, QuoteSubscription>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private quotesCache: Map<string, any>;
    // Per-symbol L1 listener tracking. Wire subscribe fires only on 0→1,
    // wire unsubscribe only on 1→0. This is the dedupe that prevents the
    // server's "Already exists" rejection when multiple widgets watch the
    // same symbol.
    private l1Listeners: Map<string, Set<string>>;
    private reconnectRegistered: boolean;

    constructor(tradeServerClient: TradeServerClient) {
        logger.info('🏭️ Constructor called - initializing datafeed with quotes support');
        this.api = tradeServerClient;
        this.subscribers = {};
        this.quoteSubscriptions = new Map();
        this.quotesCache = new Map();
        this.l1Listeners = new Map();
        this.reconnectRegistered = false;
        logger.debug('✅ Datafeed implements:', {
            hasOnReady: typeof this.onReady === 'function',
            hasGetQuotes: typeof this.getQuotes === 'function',
            hasSubscribeQuotes: typeof this.subscribeQuotes === 'function',
            hasUnsubscribeQuotes: typeof this.unsubscribeQuotes === 'function',
        });
        this.configurationData = {
            supported_resolutions: CONFIG.marketData.historyResolutions as ResolutionString[],
            exchanges: [
                {
                    value: 'YourBourse',
                    name: 'YourBourse',
                    desc: 'YourBourse Exchange',
                },
            ],
            symbols_types: [],
        };
    }

    /**
     * TradingView calls this method to get configuration
     */
    onReady(callback: (config: DatafeedConfiguration) => void): void {
        logger.debug('⚙️ onReady called by TradingView');
        logger.debug('Configuration data:', this.configurationData);
        setTimeout(() => {
            callback(this.configurationData);
            logger.debug('✅ Configuration provided to TradingView');
        }, 0);
    }

    /**
     * TradingView calls this to search symbols
     */
    searchSymbols(
        userInput: string,
        _exchange: string,
        _symbolType: string,
        onResultReadyCallback: SearchSymbolsCallback
    ): void {
        logger.debug('searchSymbols:', userInput);

        // Use TradeServerClient method which internally uses SDK
        this.api.marketData
            .getSymbols()
            .then((response: SymbolCollection) => {
                // Extract symbols array from response object
                const symbolsArray = response?.symbols || [];

                const filteredSymbols = symbolsArray
                    .filter((symbol: Symbol) => {
                        const searchTerm = userInput.toLowerCase();
                        return (
                            symbol.n?.toLowerCase().includes(searchTerm) || symbol.d?.toLowerCase().includes(searchTerm)
                        );
                    })
                    .map((symbol: Symbol) => ({
                        symbol: symbol.n,
                        full_name: symbol.n,
                        description: symbol.d,
                        //TODO: these 2 below field should be got from public api in the future
                        exchange: '',
                        type: '',
                    }));

                onResultReadyCallback(filteredSymbols);
            })
            .catch((error: unknown) => {
                logger.error('Error searching symbols:', error);
                onResultReadyCallback([]);
            });
    }

    /**
     * TradingView calls this to get symbol details
     */
    resolveSymbol(
        symbolName: string,
        onSymbolResolvedCallback: ResolveCallback,
        onResolveErrorCallback: DatafeedErrorCallback
    ): void {
        logger.debug('resolveSymbol:', symbolName);

        // Use TradeServerClient method which internally uses SDK
        this.api.marketData
            .getSymbolInfo(symbolName)
            .then((symbolInfo: { n: string; d: string; dp?: number }) => {
                // Calculate pricescale from decimal precision (dp)
                // dp is the number of decimal places, pricescale = 10^dp
                const pricescale = Math.pow(10, symbolInfo.dp || 5);

                const symbolData: LibrarySymbolInfo = {
                    name: symbolInfo.n,
                    description: symbolInfo.d,
                    type: 'forex',
                    session: '24x7',
                    timezone: 'Etc/UTC',
                    // TODO: these 2 below field should be got from public api in the future
                    exchange: 'YourBourse',
                    listed_exchange: 'YourBourse',
                    minmov: 1,
                    pricescale: pricescale,
                    format: 'price',
                    has_intraday: true,
                    has_weekly_and_monthly: true,
                    supported_resolutions: CONFIG.marketData.historyResolutions as ResolutionString[],
                };

                onSymbolResolvedCallback(symbolData);
            })
            .catch((error: unknown) => {
                logger.error('Error resolving symbol:', error);
                onResolveErrorCallback('Symbol not found');
            });
    }

    /**
     * TradingView calls this to get historical bars
     */
    getBars(
        symbolInfo: LibrarySymbolInfo,
        resolution: ResolutionString,
        periodParams: PeriodParams,
        onHistoryCallback: HistoryCallback,
        onErrorCallback: DatafeedErrorCallback
    ): void {
        const { from, to } = periodParams;
        logger.debug('getBars:', symbolInfo.name, resolution, new Date(from * 1000), new Date(to * 1000));

        // Map TradingView resolution to API interval
        const interval = (CONFIG.websocket.intervalMapping[resolution] || resolution) as CandleInterval;

        // Use TradeServerClient method which internally uses SDK
        this.api.marketData
            .getHistoricalBars(
                symbolInfo.name,
                interval,
                from * 1000000, // Convert seconds to microseconds
                to * 1000000 // Convert seconds to microseconds
            )
            .then((response) => {
                logger.debug('getBars response:', {
                    symbol: response?.s,
                    interval: response?.i,
                    candleCount: response?.d?.length || 0,
                    firstCandle: response?.d?.[0],
                    lastCandle: response?.d?.[response.d.length - 1],
                });

                const candles = response?.d || [];

                if (candles.length > 0) {
                    // Convert candles to TradingView bar format
                    const bars = candles.map((candle: Candle) => ({
                        time: Math.floor(candle.t / 1000), // Convert microseconds to milliseconds
                        open: candle.o,
                        high: candle.h,
                        low: candle.l,
                        close: candle.c,
                        volume: candle.v || 0,
                    }));
                    logger.debug('Returning bars:', bars.length, 'first:', bars[0], 'last:', bars[bars.length - 1]);
                    onHistoryCallback(bars, { noData: false });
                } else {
                    logger.debug('No candles returned, sending noData');
                    onHistoryCallback([], { noData: true });
                }
            })
            .catch((error: unknown) => {
                logger.error('getBars error:', error);
                onErrorCallback(error instanceof Error ? error.message : String(error));
            });
    }

    /**
     * TradingView calls this to subscribe to real-time updates
     */
    subscribeBars(
        symbolInfo: LibrarySymbolInfo,
        resolution: ResolutionString,
        onRealtimeCallback: SubscribeBarsCallback,
        subscriberUID: string
    ): void {
        logger.debug('subscribeBars:', symbolInfo.name, resolution, subscriberUID);
        this.ensureReconnectHandler();

        this.subscribers[subscriberUID] = {
            symbolInfo,
            resolution,
            callback: onRealtimeCallback,
        };

        // Map TradingView resolution to API interval
        const interval = (CONFIG.websocket.intervalMapping[resolution] || resolution) as CandleInterval;

        // Subscribe to candle updates from the Trade Server API
        this.api
            .subscribeToCandles(symbolInfo.name, interval, true)
            .then(() => {
                logger.info(`Subscribed to candles: ${symbolInfo.name} ${interval}`);
            })
            .catch((error: unknown) => {
                logger.error(`Failed to subscribe to candles: ${symbolInfo.name} ${interval}`, error);
            });

        // Handle real-time candle updates via subscription manager
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const candleCallback = (data: any) => {
            const subscriber = this.subscribers[subscriberUID];
            if (!subscriber) {
                return; // Subscriber was removed
            }

            const { candle } = data;

            // Filter by interval - only process candles matching our subscribed interval
            // This prevents mixing data from different intervals during interval changes
            if (candle.i !== interval) {
                return;
            }

            // Convert to TradingView bar format
            const barTime = Math.floor(candle.t / 1000); // Convert microseconds to milliseconds

            const bar = {
                time: barTime,
                open: candle.o,
                high: candle.h,
                low: candle.l,
                close: candle.c,
                volume: candle.v,
            };

            onRealtimeCallback(bar);
        };

        // Subscribe to symbol-specific candle updates
        this.api.subscriptions.subscribe(`candles_${symbolInfo.name}`, candleCallback);

        // Store callback reference for cleanup
        const subscriber = this.subscribers[subscriberUID];
        if (subscriber) {
            subscriber.candleCallback = candleCallback;
        }
    }

    /**
     * TradingView calls this to unsubscribe from real-time updates
     */
    unsubscribeBars(subscriberUID: string): void {
        logger.debug('unsubscribeBars:', subscriberUID);

        const subscriber = this.subscribers[subscriberUID];
        if (!subscriber) {
            return;
        }

        const { symbolInfo, resolution, candleCallback } = subscriber;
        delete this.subscribers[subscriberUID];

        const interval = (CONFIG.websocket.intervalMapping[resolution] || resolution) as CandleInterval;

        // Unhook the local pub/sub callback unconditionally. During a transient
        // disconnect (auto-reconnect mid-flight) wsClient still exists and the
        // SubscriptionManager is live — if we skipped this, the callback would
        // resume firing on a destroyed widget once reconnect lands. The getter
        // throws only when wsClient is null (post-disconnect), which we treat
        // as already-cleaned-up.
        if (candleCallback) {
            try {
                this.api.subscriptions.unsubscribe(`candles_${symbolInfo.name}`, candleCallback);
            } catch {
                // wsClient torn down — nothing to unhook.
            }
        }

        if (!this.api.isConnected()) {
            logger.debug('unsubscribeBars: WS not connected, skipping wire unsubscribe');
            return;
        }

        this.api
            .unsubscribeFromCandles(symbolInfo.name, interval)
            .then(() => {
                logger.info(`Unsubscribed from candles: ${symbolInfo.name} ${interval}`);
            })
            .catch((error: unknown) => {
                logger.error(`Failed to unsubscribe from candles:`, error);
            });
    }

    /**
     * IDatafeedQuotesApi Implementation
     * Required for trading features to work
     */

    /**
     * TradingView calls this function when it needs quote data
     */
    getQuotes(symbols: string[], onDataCallback: QuotesCallback, onErrorCallback: QuotesErrorCallback): void {
        logger.info('📊 getQuotes called - this confirms TradingView recognizes quotes API!');
        logger.debug('getQuotes:', symbols);

        const promises = symbols.map(async (symbol) => {
            try {
                // Check cache first
                if (this.quotesCache.has(symbol)) {
                    return this.quotesCache.get(symbol);
                }

                // Fetch from API
                const quote = await this.api.marketData.getTicker(symbol);

                if (!quote) {
                    throw new Error(`No quote data available for ${symbol}`);
                }

                const quoteData: QuoteOkData = {
                    s: 'ok',
                    n: symbol,
                    v: {
                        ch: 0,
                        chp: 0,
                        short_name: symbol,
                        exchange: 'YourBourse',
                        description: symbol,
                        lp: quote.bp || quote.ap || 0,
                        ask: quote.ap,
                        bid: quote.bp,
                        spread: quote.ap && quote.bp ? quote.ap - quote.bp : 0,
                        volume: 0,
                    },
                };

                this.quotesCache.set(symbol, quoteData);
                return quoteData;
            } catch (error) {
                logger.error(`Error fetching quote for ${symbol}:`, error);
                return {
                    s: 'error' as const,
                    n: symbol,
                    v: {},
                };
            }
        });

        Promise.all(promises)
            .then((quotes) => {
                onDataCallback(quotes);
            })
            .catch((error) => {
                logger.error('Error fetching quotes:', error);
                onErrorCallback(error instanceof Error ? error.message : String(error));
            });
    }

    /**
     * TradingView calls this function when it wants to receive real-time quotes
     */
    subscribeQuotes(
        symbols: string[],
        fastSymbols: string[],
        onRealtimeCallback: QuotesCallback,
        listenerGUID: string
    ): void {
        logger.debug('subscribeQuotes:', { symbols, fastSymbols, listenerGUID });
        this.ensureReconnectHandler();

        const dedupedSymbols = [...new Set([...symbols, ...fastSymbols])];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wsCallback = (data: any) => {
            const { quote } = data;
            if (!quote || !dedupedSymbols.includes(quote.s)) {
                return;
            }

            const quoteData: QuoteOkData = {
                s: 'ok',
                n: quote.s,
                v: {
                    ch: 0,
                    chp: 0,
                    short_name: quote.s,
                    exchange: 'YourBourse',
                    description: quote.s,
                    lp: quote.bp || quote.ap || 0,
                    ask: quote.ap,
                    bid: quote.bp,
                    spread: quote.ap && quote.bp ? quote.ap - quote.bp : 0,
                    volume: 0,
                },
            };

            this.quotesCache.set(quote.s, quoteData);
            onRealtimeCallback([quoteData]);
        };

        this.quoteSubscriptions.set(listenerGUID, {
            symbols: dedupedSymbols,
            wsCallback,
        });

        this.api.subscriptions.subscribe('quotes', wsCallback);
        this.api.subscriptions.subscribe('ticker', wsCallback);

        // Per-symbol dedupe: only hit the wire on 0→1 listeners. The server
        // holds one slot per (channel, symbol) and rejects duplicates with
        // "Already exists". The local 'quotes'/'ticker' bus fans the one
        // wire stream out to every registered wsCallback, so each widget
        // still gets every update.
        dedupedSymbols.forEach((symbol) => {
            this.acquireL1(symbol, listenerGUID);
        });

        logger.info(`Subscribed to quotes for ${dedupedSymbols.length} symbols`);
    }

    /**
     * TradingView calls this function when it doesn't want to receive updates anymore
     */
    unsubscribeQuotes(listenerGUID: string): void {
        logger.debug('unsubscribeQuotes:', listenerGUID);

        const subscription = this.quoteSubscriptions.get(listenerGUID);
        if (!subscription) {
            return;
        }

        this.quoteSubscriptions.delete(listenerGUID);

        // Unhook locals unconditionally so the callback can't resume firing on
        // a destroyed widget if reconnect lands after this call. Throws only
        // when wsClient is null (post-disconnect), which means nothing to do.
        try {
            this.api.subscriptions.unsubscribe('quotes', subscription.wsCallback);
            this.api.subscriptions.unsubscribe('ticker', subscription.wsCallback);
        } catch {
            // wsClient torn down — nothing to unhook.
        }

        // Always release refcounts so the dedupe map stays consistent.
        // releaseL1 guards its own wire call.
        subscription.symbols.forEach((symbol) => {
            this.releaseL1(symbol, listenerGUID);
        });

        logger.info(`Unsubscribed from quotes for listener ${listenerGUID}`);
    }

    /**
     * Add a listener for `symbol` and fire the wire subscribe only when the
     * listener count goes 0 → 1. Concurrent calls from multiple widgets in
     * the same tick all see the listener in the Set and skip the wire.
     */
    private acquireL1(symbol: string, listenerGUID: string): void {
        const existing = this.l1Listeners.get(symbol);
        if (existing) {
            existing.add(listenerGUID);
            return;
        }
        const ownSet = new Set([listenerGUID]);
        this.l1Listeners.set(symbol, ownSet);
        this.api
            .subscribeToQuotes(symbol, true)
            .then(() => logger.info(`Subscribed to L1: ${symbol}`))
            .catch((err: unknown) => {
                // Roll back only if our Set is still the one in the map.
                // pendingRequests survive auto-reconnect, so a pre-disconnect
                // subscribe can reject *after* handleReconnect() has cleared
                // l1Listeners and a fresh acquire has installed a new Set —
                // deleting unconditionally would wipe that valid state.
                if (this.l1Listeners.get(symbol) !== ownSet) {
                    logger.debug(`L1 subscribe rejection for ${symbol} is stale, ignoring`, err);
                    return;
                }
                logger.warn(`Failed to subscribe to L1: ${symbol}, clearing local entry to allow retry`, err);
                this.l1Listeners.delete(symbol);
            });
    }

    /**
     * Release a listener for `symbol`. Wire unsubscribe fires only on 1→0.
     */
    private releaseL1(symbol: string, listenerGUID: string): void {
        const set = this.l1Listeners.get(symbol);
        if (!set) return;
        set.delete(listenerGUID);
        if (set.size > 0) return;
        this.l1Listeners.delete(symbol);
        if (!this.api.isConnected()) return;
        this.api
            .unsubscribeFromQuotes(symbol)
            .catch((err: unknown) => logger.debug(`Failed to unsubscribe from L1: ${symbol}`, err));
    }

    /**
     * Defensive: register the WS reconnect handler on first TV subscribe call
     * rather than in the constructor. The current app awaits connect() before
     * constructing Datafeed, but as a library this class can be wired in
     * other orders — registering eagerly would throw if wsClient isn't up yet.
     */
    private ensureReconnectHandler(): void {
        if (this.reconnectRegistered) return;
        // Register first, flip the flag only on success — otherwise a throw
        // (e.g. called before TradeServerClient.connect() in non-current
        // wiring) would latch reconnectRegistered=true and silently skip
        // every later attempt, leaving replay broken.
        this.api.onReconnect(() => this.handleReconnect());
        this.reconnectRegistered = true;
    }

    /**
     * After auto-reconnect the server's subscription view is empty. Reset
     * local dedupe state and replay subscribes for every active TV listener.
     */
    private handleReconnect(): void {
        logger.info('WS reconnected — replaying subscriptions');

        // Local view must match the server's now-empty view.
        this.l1Listeners.clear();

        // Replay L1 per-listener; acquireL1 re-derives the wire-call set.
        for (const [listenerGUID, sub] of this.quoteSubscriptions) {
            sub.symbols.forEach((symbol) => this.acquireL1(symbol, listenerGUID));
        }

        // Replay candle subscriptions. Bars don't go through the dedupe map
        // (rare collision in practice) — this is a straight per-listener replay.
        for (const sub of Object.values(this.subscribers)) {
            const interval = (CONFIG.websocket.intervalMapping[sub.resolution] || sub.resolution) as CandleInterval;
            this.api
                .subscribeToCandles(sub.symbolInfo.name, interval, true)
                .catch((err: unknown) =>
                    logger.warn(`Candle re-subscribe failed: ${sub.symbolInfo.name} ${interval}`, err)
                );
        }

        logger.info(
            `Reconnect replayed ${this.l1Listeners.size} L1 + ${Object.keys(this.subscribers).length} candle subscriptions`
        );
    }
}

export default Datafeed;
