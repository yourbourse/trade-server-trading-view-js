import { Order } from '../../../charting_library/charting_library';
import type { OrderHistoryPageRequestFilter } from '../../schema/public-api';
import { TradeServerClient } from '@/trade-server-api/TradeServerClient';
import { transformOrders } from '../type-mappings';
import { handleApiError } from '@/utils/apiError';
import { createLogger } from '@/utils/logger.js';

const logger = createLogger({ prefix: '[OrderHistoryService]' });

const ORDER_HISTORY_FILTER: OrderHistoryPageRequestFilter = {
    maxResults: 100,
    sortOrder: 'desc',
};

export class OrderHistoryService {
    private api: TradeServerClient;
    private nextPageToken: string | null = null;
    private firstPageFetchPromise: Promise<Order[]> | null = null;
    private loadMorePromise: Promise<Order[]> | null = null;

    constructor(api: TradeServerClient) {
        this.api = api;
    }

    async getOrderHistory(paginationLastId?: string | number) {
        if (paginationLastId != null && paginationLastId !== '') {
            if (!this.nextPageToken) {
                logger.debug('No next page token — end of order history');
                return [];
            }

            if (!this.loadMorePromise) {
                this.loadMorePromise = this.fetchOrderHistoryPage(this.nextPageToken).finally(() => {
                    this.loadMorePromise = null;
                });
            }

            return this.loadMorePromise;
        }

        this.nextPageToken = null;

        if (!this.firstPageFetchPromise) {
            this.firstPageFetchPromise = this.fetchOrderHistoryPage(null).finally(() => {
                this.firstPageFetchPromise = null;
            });
        }

        return this.firstPageFetchPromise;
    }

    private async fetchOrderHistoryPage(nextToken: string | null) {
        try {
            logger.debug('Fetching order history page', nextToken ? '(next page)' : '(first page)');
            const result = await this.api.trading.getOrderHistory(ORDER_HISTORY_FILTER, nextToken);
            const orders = result?.orders || [];
            const rows = transformOrders(orders) as Order[];

            this.nextPageToken = result?.nextToken ?? null;
            logger.info('Order history page loaded:', rows.length, 'orders', {
                hasNextPage: Boolean(this.nextPageToken),
            });

            return rows;
        } catch (error) {
            handleApiError(error, 'Error getting order history');
        }
    }
}
