/**
 * TradingView Datafeed Implementation
 * Provides market data to TradingView charts
 */

import CONFIG from '../config.js';
import type { Symbol, SymbolCollection, Candle } from '../schema/public-api/types.gen';
import type {
    Bar,
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
import type { ResponseType } from '../trade-server-api/types/websocket-messages.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger({ prefix: '[Datafeed]' });

interface QuoteSubscription {
    symbols: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wsCallback: (data: any) => void;
}

interface RawQuoteState {
    s: string;
    bp?: number;
    ap?: number;
    bc?: number;
    t?: number;
    re?: boolean;
}

class Datafeed implements IDatafeedChartApi, IDatafeedQuotesApi {
    api: TradeServerClient;
    subscribers: Record<string, SubscriberInfo>;
    configurationData: DatafeedConfiguration;
    // Quote-related properties
    private quoteSubscriptions: Map<string, QuoteSubscription>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private quotesCache: Map<string, any>;
    private latestRawQuotes: Map<string, RawQuoteState>;
    // Per-symbol L1 listener tracking for all quote consumers. Wire subscribe fires only on 0→1,
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
        this.latestRawQuotes = new Map();
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
                            symbol.n?.toLowerCase().includes(searchTerm) ||
                            symbol.d?.toLowerCase().includes(searchTerm) ||
                            symbol.it?.toLowerCase().includes(searchTerm)
                        );
                    })
                    .map((symbol: Symbol) => ({
                        symbol: symbol.n,
                        full_name: symbol.n,
                        description: symbol.d,
                        exchange: symbol.ex ?? '',
                        type: symbol.it ?? '',
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
                    weekly_multipliers: ['1'],
                    monthly_multipliers: ['1'],
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
        const { from, to, countBack } = periodParams;
        logger.debug('getBars:', symbolInfo.name, resolution, new Date(from * 1000), new Date(to * 1000), 'countBack:', countBack);

        const interval = CONFIG.websocket.intervalMapping[resolution] as CandleInterval | undefined;
        if (!interval) {
            logger.warn(`Unsupported resolution: ${resolution}`);
            onHistoryCallback([], { noData: true });
            return;
        }

        // Per TradingView docs, countBack has higher priority than from.
        // Request countBack bars ending at 'to' using descending sort, then reverse for TV.
        this.api.marketData
            .getHistoricalBars(
                symbolInfo.name,
                interval,
                0, // Don't constrain 'from' - countBack takes priority
                to * 1000000, // Convert seconds to microseconds
                countBack,
                'desc'
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
                    // Results are in descending order, reverse to ascending for TradingView
                    bars.reverse();
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

    private getBarL1ListenerId(subscriberUID: string): string {
        return `bars:${subscriberUID}`;
    }

    /**
     * The server only repeats daily-extrema fields (e.g. `bc`) on a snapshot
     * or when `re: true` is set — ordinary updates may omit them. Merge onto
     * the cached state instead of overwriting, so those fields survive
     * subsequent ticks. On snapshot or `re: true`, replace entirely instead
     * of merging, per the protocol's reset semantics.
     */
    private mergeRawQuote(type: ResponseType | undefined, quote: RawQuoteState): RawQuoteState {
        const isReset = type === 's' || quote.re === true;
        const previous = this.latestRawQuotes.get(quote.s);

        const merged: RawQuoteState = isReset ? { ...quote } : { ...previous, ...quote };
        // `re` is a transient per-message instruction, not persisted state — strip it
        // so a later ordinary update's merge can't inherit a stale re:true forever.
        delete merged.re;

        this.latestRawQuotes.set(quote.s, merged);
        return merged;
    }

    private buildQuoteOkData(quote: RawQuoteState): QuoteOkData {
        const symbol = quote.s;
        const bid = typeof quote.bp === 'number' ? quote.bp : undefined;
        const ask = typeof quote.ap === 'number' ? quote.ap : undefined;
        const previousBidClose = typeof quote.bc === 'number' ? quote.bc : undefined;
        // TODO: fix the formula after https://yourbourse.atlassian.net/browse/TS-1773
        const hasBidAndClose = bid !== undefined && previousBidClose !== undefined && previousBidClose !== 0;
        const ch = hasBidAndClose ? bid - previousBidClose : undefined;
        const chp = hasBidAndClose ? ((bid - previousBidClose) / previousBidClose) * 100 : undefined;
        const spread = bid !== undefined && ask !== undefined ? ask - bid : 0;

        return {
            s: 'ok',
            n: symbol,
            v: {
                ch,
                chp,
                short_name: symbol,
                exchange: 'YourBourse',
                description: symbol,
                lp: bid || ask || 0,
                ask,
                bid,
                spread,
                volume: 0,
            },
        };
    }

    private getFixedIntervalDurationMs(interval: CandleInterval): number | undefined {
        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;

        switch (interval) {
            case '1M':
                return minute;
            case '5M':
                return 5 * minute;
            case '15M':
                return 15 * minute;
            case '30M':
                return 30 * minute;
            case '1H':
                return hour;
            case '4H':
                return 4 * hour;
            case 'D':
                return day;
            case 'W':
                return 7 * day;
            case 'M':
                return undefined;
        }
    }

    private isQuoteInsideLatestBarInterval(subscriber: SubscriberInfo, quoteTimeMs: number): boolean {
        const latestOfficialBar = subscriber.latestOfficialBar;
        if (!latestOfficialBar || quoteTimeMs < latestOfficialBar.time) {
            return false;
        }

        if (subscriber.interval === 'M') {
            const quoteDate = new Date(quoteTimeMs);
            const barDate = new Date(latestOfficialBar.time);
            return (
                quoteDate.getUTCFullYear() === barDate.getUTCFullYear() &&
                quoteDate.getUTCMonth() === barDate.getUTCMonth()
            );
        }

        if (!subscriber.barDurationMs) {
            return false;
        }

        return quoteTimeMs < latestOfficialBar.time + subscriber.barDurationMs;
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

        const interval = CONFIG.websocket.intervalMapping[resolution] as CandleInterval | undefined;
        if (!interval) {
            logger.warn(`Unsupported resolution for subscribeBars: ${resolution}`);
            return;
        }

        const candleCallback = (data: unknown) => {
            const subscriber = this.subscribers[subscriberUID];
            if (!subscriber) {
                return; // Subscriber was removed
            }

            const candle = (data as { candle?: Candle & { i?: CandleInterval } })?.candle;
            if (!candle) {
                return;
            }

            // Filter by interval - only process candles matching our subscribed interval
            // This prevents mixing data from different intervals during interval changes
            if (candle.i !== subscriber.interval) {
                return;
            }

            const bar: Bar = {
                time: Math.floor(candle.t / 1000), // Convert microseconds to milliseconds
                open: candle.o,
                high: candle.h,
                low: candle.l,
                close: candle.c,
                volume: candle.v,
            };

            subscriber.latestOfficialBar = bar;
            subscriber.latestQuoteTimestampMs = undefined;
            subscriber.callback(bar);
        };

        let suspiciousTimestampLogged = false;
        const quoteCallback = (data: unknown) => {
            const subscriber = this.subscribers[subscriberUID];
            if (!subscriber) {
                return;
            }

            const { type, quote } = (data as { type?: ResponseType; quote?: RawQuoteState }) ?? {};
            if (!quote) {
                return;
            }

            // Keep raw quote cache fresh for getQuotes even if this update
            // cannot be used for synthetic bar emission. quotesCache is
            // checked before latestRawQuotes in getQuotes(), so it must be
            // kept in sync here too, not just in subscribeQuotes' wsCallback.
            const merged = this.mergeRawQuote(type, quote);
            this.quotesCache.set(quote.s, this.buildQuoteOkData(merged));

            if (typeof quote.bp !== 'number' || !Number.isFinite(quote.bp)) {
                return;
            }

            if (typeof quote.t !== 'number' || !Number.isFinite(quote.t)) {
                return;
            }

            const latestOfficialBar = subscriber.latestOfficialBar;
            if (!latestOfficialBar) {
                return;
            }

            // quote.t uses microseconds since Unix epoch, same unit as candle.t.
            const quoteTimeMs = Math.floor(quote.t / 1000);
            if (quoteTimeMs < 1_000_000_000_000) {
                if (!suspiciousTimestampLogged) {
                    logger.warn(
                        `quoteCallback: suspicious quoteTimeMs=${quoteTimeMs} for ${subscriber.symbolInfo.name}; expected milliseconds after microsecond conversion`
                    );
                    suspiciousTimestampLogged = true;
                }
                return;
            }
            if (
                typeof subscriber.latestQuoteTimestampMs === 'number' &&
                quoteTimeMs <= subscriber.latestQuoteTimestampMs
            ) {
                return;
            }

            if (!this.isQuoteInsideLatestBarInterval(subscriber, quoteTimeMs)) {
                return;
            }

            const syntheticBar: Bar = {
                ...latestOfficialBar,
                close: quote.bp,
            };

            subscriber.latestQuoteTimestampMs = quoteTimeMs;
            subscriber.callback(syntheticBar);
        };

        this.subscribers[subscriberUID] = {
            symbolInfo,
            resolution,
            interval,
            barDurationMs: this.getFixedIntervalDurationMs(interval),
            callback: onRealtimeCallback,
            candleCallback,
            quoteCallback,
        };

        // Subscribe to candle updates from the Trade Server API
        this.api
            .subscribeToCandles(symbolInfo.name, interval, true)
            .then(() => {
                logger.info(`Subscribed to candles: ${symbolInfo.name} ${interval}`);
            })
            .catch((error: unknown) => {
                logger.error(`Failed to subscribe to candles: ${symbolInfo.name} ${interval}`, error);
            });

        // Subscribe to symbol-specific candle updates
        this.api.subscriptions.subscribe(`candles_${symbolInfo.name}`, candleCallback);
        this.api.subscriptions.subscribe(`quote_${symbolInfo.name}`, quoteCallback);

        this.acquireL1(symbolInfo.name, this.getBarL1ListenerId(subscriberUID));
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

        const { symbolInfo, interval, candleCallback, quoteCallback } = subscriber;
        delete this.subscribers[subscriberUID];

        // Unhook the local pub/sub callback unconditionally. During a transient
        // disconnect (auto-reconnect mid-flight) wsClient still exists and the
        // SubscriptionManager is live — if we skipped this, the callback would
        // resume firing on a destroyed widget once reconnect lands. The getter
        // throws only when wsClient is null (post-disconnect), which we treat
        // as already-cleaned-up.
        if (candleCallback) {
            try {
                this.api.subscriptions.unsubscribe(`candles_${symbolInfo.name}`, candleCallback);
            } catch (error: unknown) {
                logger.debug('unsubscribeBars: local subscription already torn down or unavailable', error);
            }
        }

        if (quoteCallback) {
            try {
                this.api.subscriptions.unsubscribe(`quote_${symbolInfo.name}`, quoteCallback);
            } catch (error: unknown) {
                logger.debug('unsubscribeBars: local quote subscription already torn down or unavailable', error);
            }
        }

        this.releaseL1(symbolInfo.name, this.getBarL1ListenerId(subscriberUID));

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
                logger.debug(`Wire unsubscribe from candles failed (non-critical):`, error);
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

                const latestRawQuote = this.latestRawQuotes.get(symbol);
                if (latestRawQuote) {
                    return this.buildQuoteOkData(latestRawQuote);
                }

                // Fetch from API
                const quote = await this.api.marketData.getTicker(symbol);

                if (!quote) {
                    throw new Error(`No quote data available for ${symbol}`);
                }

                const quoteData = this.buildQuoteOkData(quote);

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
            const { type, quote } = data ?? {};
            if (!quote || !dedupedSymbols.includes(quote.s)) {
                return;
            }

            const merged = this.mergeRawQuote(type, quote);
            const quoteData = this.buildQuoteOkData(merged);

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

        // Defense-in-depth: if a symbol is already known (e.g. another widget's
        // subscription already consumed its snapshot), hand this listener a value
        // immediately instead of making it wait for the next organic tick — which
        // acquireL1's dedupe means may not come from a fresh wire snapshot at all.
        // Check quotesCache first: getQuotes()'s REST fallback populates it without
        // ever touching latestRawQuotes, so a symbol can be "known" there only.
        const replayData = dedupedSymbols
            .map((symbol) => {
                const cached = this.quotesCache.get(symbol);
                if (cached) return cached;
                const raw = this.latestRawQuotes.get(symbol);
                return raw ? this.buildQuoteOkData(raw) : undefined;
            })
            .filter((data): data is QuoteOkData => data !== undefined);

        if (replayData.length > 0) {
            onRealtimeCallback(replayData);
        }

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
     *
     * Keep quotesCache / latestRawQuotes: Watchlist often unsubscribes then
     * resubscribes (or calls getQuotes again) when symbols are added. Clearing
     * here forced a fresh REST /quote for symbols that already had live WS data.
     * Caches are still reset on reconnect in handleReconnect().
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
        this.latestRawQuotes.clear();
        this.quotesCache.clear();

        // Replay L1 per-listener; acquireL1 re-derives the wire-call set.
        for (const [listenerGUID, sub] of this.quoteSubscriptions) {
            sub.symbols.forEach((symbol) => this.acquireL1(symbol, listenerGUID));
        }

        // Replay bar-owned L1 listeners and canonical candle subscriptions.
        for (const [subscriberUID, sub] of Object.entries(this.subscribers)) {
            sub.latestOfficialBar = undefined;
            sub.latestQuoteTimestampMs = undefined;
            this.acquireL1(sub.symbolInfo.name, this.getBarL1ListenerId(subscriberUID));

            this.api
                .subscribeToCandles(sub.symbolInfo.name, sub.interval, true)
                .catch((err: unknown) =>
                    logger.warn(`Candle re-subscribe failed: ${sub.symbolInfo.name} ${sub.interval}`, err)
                );
        }

        logger.info(
            `Reconnect replayed ${this.l1Listeners.size} L1 + ${Object.keys(this.subscribers).length} candle subscriptions`
        );
    }
}

export default Datafeed;
