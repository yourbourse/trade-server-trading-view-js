/**
 * Market Data Service
 * Handles market data API calls (symbols, candles, quotes, order book)
 */

import { CandleInterval } from '../../schema/public-api/types.gen.js';
import type { Symbol, SymbolCollection, Book, TradeCollection } from '../../schema/public-api/types.gen.js';
import { getSymbols, getSymbol, getCharts, getDepth, getTob, getTrades } from '../../schema/public-api/sdk.gen.js';
import { client } from '../../schema/public-api/client.gen.js';
import { getGETHeaders, executeAuthenticatedRequest } from '../../utils/api.js';
import type { TracingHeaders } from '../../utils/traceContext.js';
import { AuthUser } from '../../types/AuthUser.js';
import { logger } from '../../utils/logger.js';

export class MarketDataService {
    private user: AuthUser;
    private log = logger.child('MarketDataService');

    constructor(user: AuthUser) {
        this.user = user;
    }

    /**
     * Get symbol configuration
     * GET /symbols/get/{symbolName}
     */
    async getSymbolInfo(symbol: string, locale: string = 'en', ifNoneMatch: string | null = null): Promise<Symbol> {
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
     */
    async getTicker(symbol: string) {
        this.log.debug(`Fetching ticker: ${symbol}`);
        const headers = getGETHeaders(this.user);
        const response = await getTob({
            client,
            headers,
            path: { symbolName: symbol },
        });
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
