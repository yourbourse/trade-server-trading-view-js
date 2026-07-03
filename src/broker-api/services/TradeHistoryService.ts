import { Execution } from '../../../charting_library/charting_library';
import type { Trade, TradeHistoryPageRequestFilter } from '../../schema/public-api';
import { TradeServerClient } from '@/trade-server-api/TradeServerClient';
import { transformTradeHistory } from '../type-mappings';
import { handleApiError } from '@/utils/apiError';
import { Side } from '../types';
import { createLogger } from '@/utils/logger.js';

const logger = createLogger({ prefix: '[TradeHistoryService]' });

const TRADE_HISTORY_FILTER: TradeHistoryPageRequestFilter = {
    maxResults: 100,
    sortOrder: 'desc',
};

export class TradeHistoryService {
    private api: TradeServerClient;
    private nextPageToken: string | null = null;
    private firstPageFetchPromise: Promise<ReturnType<typeof transformTradeHistory>> | null = null;
    private loadMorePromise: Promise<ReturnType<typeof transformTradeHistory>> | null = null;
    private executionsCache = new Map<string, Trade[]>();

    constructor(api: TradeServerClient) {
        this.api = api;
    }

    async getTradeHistory(paginationLastId?: string | number) {
        if (paginationLastId != null && paginationLastId !== '') {
            if (!this.nextPageToken) {
                logger.debug('No next page token — end of trade history');
                return [];
            }

            if (!this.loadMorePromise) {
                this.loadMorePromise = this.fetchTradeHistoryPage(this.nextPageToken).finally(() => {
                    this.loadMorePromise = null;
                });
            }

            return this.loadMorePromise;
        }

        this.nextPageToken = null;

        if (!this.firstPageFetchPromise) {
            this.firstPageFetchPromise = this.fetchTradeHistoryPage(null).finally(() => {
                this.firstPageFetchPromise = null;
            });
        }

        return this.firstPageFetchPromise;
    }

    async getExecutions(symbol: string): Promise<Execution[]> {
        logger.debug('getExecutions for', symbol);

        try {
            const cached = this.executionsCache.get(symbol);
            if (cached) {
                return this.mapTradesToExecutions(cached);
            }

            const trades = await this.api.trading.getAllTradeHistory({
                symbolName: symbol,
                maxResults: 100,
                sortOrder: 'desc',
            });
            this.executionsCache.set(symbol, trades);
            logger.info('Executions loaded:', trades.length, 'trades for', symbol);
            return this.mapTradesToExecutions(trades);
        } catch (error) {
            handleApiError(error, 'Error getting executions');
        }
    }

    private async fetchTradeHistoryPage(nextToken: string | null) {
        try {
            logger.debug('Fetching trade history page', nextToken ? '(next page)' : '(first page)');
            const result = await this.api.trading.getTradeHistory(TRADE_HISTORY_FILTER, nextToken);
            const trades = result?.trades || [];
            const rows = transformTradeHistory(trades);

            this.nextPageToken = result?.nextToken ?? null;
            logger.info('Trade history page loaded:', rows.length, 'trades', {
                hasNextPage: Boolean(this.nextPageToken),
            });

            return rows;
        } catch (error) {
            handleApiError(error, 'Error getting trade history');
        }
    }

    private mapTradesToExecutions(trades: Trade[]): Execution[] {
        return trades.map((trade) => ({
            id: trade.id.toString(),
            symbol: trade.s,
            brokerSymbol: trade.s,
            price: trade.p,
            qty: trade.q,
            side: trade.S === 'buy' ? Side.Buy : Side.Sell,
            time: Math.floor(trade.t / 1000),
        }));
    }
}
