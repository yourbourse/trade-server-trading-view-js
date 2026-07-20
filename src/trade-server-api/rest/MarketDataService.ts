/**
 * Market Data Service
 * Handles market data API calls (symbols, candles, quotes, order book)
 */

import { CandleInterval } from '../../schema/public-api/types.gen.js';
import type {
    Symbol,
    SymbolCollection,
    Book,
    TradeCollection,
    ConversionRate,
    Quote,
} from '../../schema/public-api/types.gen.js';
import {
    getSymbols,
    getSymbol,
    getCharts,
    getDepth,
    getTob,
    getTrades,
    getConversionRateSingle,
} from '../../schema/public-api/sdk.gen.js';
import { client } from '../../schema/public-api/client.gen.js';
import { getGETHeaders, executeAuthenticatedRequest } from '../../utils/api.js';
import type { TracingHeaders } from '../../utils/traceContext.js';
import { AuthUser } from '../../types/AuthUser.js';
import { logger } from '../../utils/logger.js';

/** Symbol specs are stable for a session; keep long enough to collapse TV's parallel lookups. */
const SYMBOL_INFO_CACHE_TTL_MS = 5 * 60_000;

/** Quotes move fast; short TTL only collapses TV's parallel getQuotes bursts at startup. */
const TICKER_CACHE_TTL_MS = 2_000;

interface SymbolInfoCacheEntry {
    data: Symbol;
    expiresAt: number;
}

interface TickerCacheEntry {
    data: Quote;
    expiresAt: number;
}

export class MarketDataService {
    private user: AuthUser;
    private log = logger.child('MarketDataService');
    private readonly symbolInfoCache = new Map<string, SymbolInfoCacheEntry>();
    private readonly symbolInfoInFlight = new Map<string, Promise<Symbol>>();
    private readonly tickerCache = new Map<string, TickerCacheEntry>();
    private readonly tickerInFlight = new Map<string, Promise<Quote>>();

    constructor(user: AuthUser) {
        this.user = user;
    }

    /**
     * Get symbol configuration
     * GET /symbols/get/{symbolName}
     *
     * Shared across datafeed + broker callers. Concurrent requests for the same
     * symbol/locale coalesce onto one in-flight HTTP call.
     */
    async getSymbolInfo(symbol: string, locale: string = 'en', ifNoneMatch: string | null = null): Promise<Symbol> {
        // Conditional requests must hit the network; skip shared cache.
        if (ifNoneMatch) {
            return this.fetchSymbolInfo(symbol, locale, ifNoneMatch);
        }

        const cacheKey = `${locale}:${symbol}`;
        const cached = this.symbolInfoCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            this.log.debug(`Symbol info cache hit: ${symbol}`);
            return cached.data;
        }

        const existingRequest = this.symbolInfoInFlight.get(cacheKey);
        if (existingRequest) {
            this.log.debug(`Symbol info in-flight reuse: ${symbol}`);
            return existingRequest;
        }

        const request = this.fetchSymbolInfo(symbol, locale, null)
            .then((data) => {
                this.symbolInfoCache.set(cacheKey, {
                    data,
                    expiresAt: Date.now() + SYMBOL_INFO_CACHE_TTL_MS,
                });
                return data;
            })
            .finally(() => {
                this.symbolInfoInFlight.delete(cacheKey);
            });

        this.symbolInfoInFlight.set(cacheKey, request);
        return request;
    }

    private async fetchSymbolInfo(
        symbol: string,
        locale: string,
        ifNoneMatch: string | null
    ): Promise<Symbol> {
        this.log.debug(`Fetching symbol info: ${symbol}`);
        const headers: Record<string, unknown> = {
            ...getGETHeaders(this.user),
            'X-YB-Locale': locale,
        };
        if (ifNoneMatch) {
            headers['If-None-Match'] = ifNoneMatch;
        }

        const response = await getSymbol({
            client,
            headers: headers as { 'X-YB-API-Key': string } & TracingHeaders & {
                'X-YB-Locale'?: 'en';
                'If-None-Match'?: string;
            },
            path: {
                symbolName: symbol,
            },
        });

        if (!response.data) {
            throw new Error(`Failed to fetch symbol info for ${symbol}`);
        }

        return response.data;
    }

    /**
     * Get all available symbols
     * GET /symbols/query
     */
    async getSymbols(
        locale: string = 'en',
        maxResults: number | null = null,
        nextToken: string | null = null,
        ifNoneMatch: string | null = null
    ): Promise<SymbolCollection> {
        this.log.debug('Fetching symbols');
        const headers: Record<string, unknown> = {
            ...getGETHeaders(this.user),
            'X-YB-Locale': locale,
        };
        if (nextToken) {
            headers['X-YB-NEXT-TOKEN'] = nextToken;
        }
        if (ifNoneMatch) {
            headers['If-None-Match'] = ifNoneMatch;
        }

        const query: { maxResults?: number } = {};
        if (maxResults) {
            query.maxResults = maxResults;
        }

        const response = await getSymbols({
            client,
            headers: headers as { 'X-YB-API-Key': string } & TracingHeaders & {
                'X-YB-NEXT-TOKEN'?: string;
                'X-YB-Locale'?: 'en';
                'If-None-Match'?: string;
            },
            query,
        });

        if (!response.data) {
            throw new Error('Failed to fetch symbols');
        }
        return response.data;
    }

    /**
     * Get current ticker/quote (top of the book)
     * GET /quote/{symbolName}
     *
     * Concurrent requests for the same symbol coalesce onto one in-flight HTTP call.
     */
    async getTicker(symbol: string): Promise<Quote> {
        const cached = this.tickerCache.get(symbol);
        if (cached && cached.expiresAt > Date.now()) {
            this.log.debug(`Ticker cache hit: ${symbol}`);
            return cached.data;
        }

        const existingRequest = this.tickerInFlight.get(symbol);
        if (existingRequest) {
            this.log.debug(`Ticker in-flight reuse: ${symbol}`);
            return existingRequest;
        }

        const request = this.fetchTicker(symbol)
            .then((data) => {
                this.tickerCache.set(symbol, {
                    data,
                    expiresAt: Date.now() + TICKER_CACHE_TTL_MS,
                });
                return data;
            })
            .finally(() => {
                this.tickerInFlight.delete(symbol);
            });

        this.tickerInFlight.set(symbol, request);
        return request;
    }

    private async fetchTicker(symbol: string): Promise<Quote> {
        this.log.debug(`Fetching ticker: ${symbol}`);
        const headers = getGETHeaders(this.user);
        const response = await getTob({
            client,
            headers,
            path: { symbolName: symbol },
        });

        if (!response.data) {
            throw new Error(`Failed to fetch ticker for ${symbol}`);
        }

        return response.data;
    }

    /**
     * Get historical bars (OHLCV data)
     * POST /charts
     */
    async getHistoricalBars(
        symbol: string,
        interval: CandleInterval,
        from: number,
        to: number,
        maxResults = 1000,
        sortOrder: 'asc' | 'desc' = 'asc'
    ) {
        this.log.debug(`Fetching historical bars: ${symbol} ${interval} from ${from} to ${to}`);
        const body: {
            symbolName: string;
            interval: CandleInterval;
            from?: number;
            to?: number;
            maxResults?: number;
            sortOrder?: 'asc' | 'desc';
        } = {
            symbolName: symbol,
            interval: interval,
        };

        if (from) {
            body.from = from;
        }
        if (to) {
            body.to = to;
        }
        if (maxResults) {
            body.maxResults = maxResults;
        }
        if (sortOrder) {
            body.sortOrder = sortOrder;
        }

        this.log.debug('Calling getCharts API with body:', body);

        try {
            const response = await getCharts({
                client,
                headers: getGETHeaders(this.user),
                body,
            });

            this.log.debug('getCharts response:', {
                hasData: !!response.data,
                dataKeys: Object.keys(response.data || {}),
                candleCount: response.data?.d?.length || 0,
            });

            return response.data;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            this.log.error('getCharts failed:', {
                message: error?.message,
                response: error?.response,
                data: error?.response?.data,
                status: error?.response?.status,
                body: body,
            });
            throw error;
        }
    }

    /**
     * Get conversion rate between two currencies (how many units of `to` per 1 unit of `from`)
     * POST /conversion-rate/single
     */
    async getConversionRate(from: string, to: string): Promise<ConversionRate> {
        this.log.debug(`Fetching conversion rate: ${from} -> ${to}`);
        const response = await getConversionRateSingle({
            client,
            headers: {
                'X-YB-API-Key': this.user.apiKey,
            },
            body: { from, to },
        });

        if (!response.data) {
            throw new Error(`Failed to fetch conversion rate for ${from} -> ${to}`);
        }

        return response.data;
    }

    /**
     * Get order book / depth of market
     * GET /depth/{symbolName}
     */
    async getOrderBook(symbol: string, limit: number = 20): Promise<Book> {
        this.log.debug(`Fetching order book: ${symbol} (limit: ${limit})`);
        const headers = getGETHeaders(this.user);

        // Map limit to the closest valid depth value
        const validDepths = [5, 10, 25, 100, 250, 1000] as const;
        const depth = validDepths.find((d) => d >= limit) || 25;

        const response = await getDepth({
            client,
            headers,
            path: {
                symbolName: symbol,
            },
            query: {
                depth,
            },
        });

        if (!response.data) {
            throw new Error(`Failed to fetch order book for ${symbol}`);
        }
        return response.data;
    }

    /**
     * Get recent trades
     * POST /trades
     */
    async getRecentTrades(symbol: string): Promise<TradeCollection> {
        this.log.debug(`Fetching recent trades: ${symbol}`);
        // Use current time and go back enough to get recent trades
        const to = Date.now() * 1000; // microseconds
        const from = to - 3600 * 1000 * 1000; // 1 hour ago

        const body = {
            symbol,
            from,
            to,
            sortOrder: 'desc' as const,
        };

        const result = await executeAuthenticatedRequest<TradeCollection>(this.user, getTrades, body);
        if (!result) {
            throw new Error(`Failed to fetch recent trades for ${symbol}`);
        }
        return result;
    }
}
