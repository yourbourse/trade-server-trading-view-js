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
    private firstPageTrades: Trade[] | null = null;
    private firstPageFetchPromise: Promise<ReturnType<typeof transformTradeHistory>> | null = null;
    private loadMorePromise: Promise<ReturnType<typeof transformTradeHistory>> | null = null;

    constructor(api: TradeServerClient) {
        this.api = api;
    }

    async getTradeHistoryRows(paginationLastId?: string | number) {
        if (paginationLastId != null && paginationLastId !== '') {
            if (!this.nextPageToken) {
                logger.debug('No next page token — end of trade history');
                return [];
            }

            if (!this.loadMorePromise) {
                this.loadMorePromise = this.fetchPage(this.nextPageToken).finally(() => {
                    this.loadMorePromise = null;
                });
            }

            return this.loadMorePromise;
        }

        this.nextPageToken = null;

        if (!this.firstPageFetchPromise) {
            this.firstPageFetchPromise = this.fetchPage(null).finally(() => {
                this.firstPageFetchPromise = null;
            });
        }

        return this.firstPageFetchPromise;
    }

    async getExecutions(symbol: string): Promise<Execution[]> {
        logger.debug('getExecutions for', symbol);

        if (!this.firstPageTrades) {
            await this.getTradeHistoryRows();
        }

        return (this.firstPageTrades || [])
            .filter((trade) => trade.s === symbol)
            .map((trade) => ({
                id: trade.id.toString(),
                symbol: trade.s,
                brokerSymbol: trade.s,
                price: trade.p,
                qty: trade.q,
                side: trade.S === 'buy' ? Side.Buy : Side.Sell,
                time: Math.floor(trade.t / 1000),
            }));
    }

    private async fetchPage(apiNextToken: string | null) {
        try {
            logger.debug('Fetching trade history page', apiNextToken ? '(next page)' : '(first page)');
            const result = await this.api.trading.getTradeHistory(TRADE_HISTORY_FILTER, apiNextToken);
            const trades = result.trades || [];

            if (!apiNextToken) {
                this.firstPageTrades = trades;
            }

            const rows = transformTradeHistory(trades);

            this.nextPageToken = result.nextToken ?? null;
            logger.info('Trade history page loaded:', rows.length, 'trades', {
                hasNextPage: Boolean(this.nextPageToken),
            });

            return rows;
        } catch (error) {
            handleApiError(error, 'Error getting trade history');
        }
    }
}
