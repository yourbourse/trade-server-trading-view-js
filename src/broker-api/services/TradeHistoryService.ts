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
    private cachedTrades: Trade[];
    private fetchPromise: Promise<Trade[]> | null;

    constructor(api: TradeServerClient) {
        this.api = api;
        this.cachedTrades = [];
        this.fetchPromise = null;
    }

    async getTrades(): Promise<Trade[]> {
        if (this.cachedTrades.length > 0) {
            return this.cachedTrades;
        }

        if (!this.fetchPromise) {
            this.fetchPromise = this.fetchTradesFromApi();
        }

        try {
            return await this.fetchPromise;
        } catch (error) {
            this.fetchPromise = null;
            handleApiError(error, 'Error getting trade history');
        }
    }

    async getTradeHistoryRows() {
        const trades = await this.getTrades();
        return transformTradeHistory(trades);
    }

    async getExecutions(symbol: string): Promise<Execution[]> {
        logger.debug('getExecutions for', symbol);

        const trades = await this.getTrades();

        return trades
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

    private async fetchTradesFromApi(): Promise<Trade[]> {
        logger.debug('Cache empty, fetching trade history from server');
        const result = await this.api.trading.getTradeHistory(TRADE_HISTORY_FILTER);
        this.cachedTrades = result.trades || [];
        logger.info('Fetched', this.cachedTrades.length, 'trades from server');
        return this.cachedTrades;
    }
}
