/**
 * Trading Service
 * Handles trading-related API calls (orders, positions, trades)
 */

import type {
    Order,
    Position,
    Trade,
    PlaceOrder,
    ModifyOrder,
    ModifyOrderSltp,
    ModifyPositionSltp,
    ModifySltpResult,
    WorkingOrdersCollection,
    PositionsCollection,
    TradeCollection,
    OrdersHistoryCollection,
    OpenOrderRequestFilter,
    OpenPositionRequestFilter,
    OrderHistoryPageRequestFilter,
    TradeHistoryPageRequestFilter,
} from '../../schema/public-api/types.gen.js';
import {
    placeOrder as sdkPlaceOrder,
    modifyOrder as sdkModifyOrder,
    cancelOrder as sdkCancelOrder,
    modifyOrderSltp,
    modifyPositionSltp,
    getOrders as sdkGetOrders,
    getOrder as sdkGetOrder,
    getOrdersHistory,
    getHistoryOrder,
    getPositions as sdkGetPositions,
    getTrades,
} from '../../schema/public-api/sdk.gen.js';
import { executeAuthenticatedRequest, executeAuthenticatedDeleteWithPath } from '../../utils/api.js';
import { AuthUser } from '../../types/AuthUser.js';
import { logger } from '../../utils/logger.js';
import { RequestCache } from '../../utils/requestCache.js';

/** Positions change via WS; short TTL only collapses parallel broker init fetches. */
const POSITIONS_CACHE_TTL_MS = 2_000;

export class TradingService {
    private user: AuthUser;
    private log = logger.child('TradingService');
    // undefined means the request failed and the error was swallowed by the
    // interceptor; don't cache it, let the next caller retry.
    private readonly positionsCache = new RequestCache<PositionsCollection | undefined>(
        POSITIONS_CACHE_TTL_MS,
        (data) => data !== undefined
    );

    constructor(user: AuthUser) {
        this.user = user;
    }

    // ==================== ORDERS ====================

    // Options shared by all write operations: the SDK will throw on HTTP error
    // (so broker catch blocks see the real status), and the interceptor's generic
    // 5xx toast is suppressed so the broker can show a mutation-specific message.
    // 502 is deliberately excluded — the interceptor already shows no toast for it
    // (401/403/502 are reserved for the refresh probe), and including it here would
    // also suppress that probe, leaving mutations unable to recover from a stale session.
    private static readonly MUTATION_OPTS = {
        throwOnError: true,
        __ignoreStatusCodes: [500, 503, 504],
    };

    /**
     * Place a new order
     * POST /order
     */
    async placeOrder(order: PlaceOrder): Promise<Order | undefined> {
        this.log.info(`Placing order:`, order);
        try {
            return await executeAuthenticatedRequest<Order>(this.user, sdkPlaceOrder, order, undefined, TradingService.MUTATION_OPTS);
        } finally {
            // After the mutation attempt: drop snapshots so a concurrent fetch that
            // spanned the trade cannot keep serving pre-trade positions.
            this.invalidatePositionsCache();
        }
    }

    /**
     * Modify an existing order
     * PUT /order
     */
    async modifyOrder(modifications: ModifyOrder): Promise<unknown> {
        this.log.info(`Modifying order: ${modifications.id}`);
        return await executeAuthenticatedRequest(this.user, sdkModifyOrder, modifications, undefined, TradingService.MUTATION_OPTS);
    }

    /**
     * Cancel an order
     * DELETE /order/{orderId}
     */
    async cancelOrder(orderId: number): Promise<unknown> {
        this.log.info(`Canceling order: ${orderId}`);
        return await executeAuthenticatedDeleteWithPath(this.user, sdkCancelOrder, { orderId: orderId.toString() }, TradingService.MUTATION_OPTS);
    }

    /**
     * Modify stop loss and/or take profit of an order
     * PUT /order/sltp
     */
    async modifyOrderSLTP(
        orderId: number,
        stopLoss: number | null = null,
        takeProfit: number | null = null
    ): Promise<ModifySltpResult | undefined> {
        this.log.info(`Modifying order SL/TP: ${orderId}`);
        const body: ModifyOrderSltp = { id: orderId };
        if (stopLoss !== null) {
            body.sl = stopLoss;
        }
        if (takeProfit !== null) {
            body.tp = takeProfit;
        }

        return await executeAuthenticatedRequest<ModifySltpResult>(this.user, modifyOrderSltp, body, undefined, TradingService.MUTATION_OPTS);
    }

    /**
     * Get open (working and inactive) orders
     * POST /orders/open
     */
    async getOrders(
        filter: OpenOrderRequestFilter = {},
        nextToken: string | null = null
    ): Promise<WorkingOrdersCollection | undefined> {
        const extraHeaders = nextToken ? { 'X-YB-NEXT-TOKEN': nextToken } : undefined;
        return await executeAuthenticatedRequest(this.user, sdkGetOrders, filter, extraHeaders);
    }

    /**
     * Get a single open order by ID
     * POST /orders/open/single
     */
    async getOrder(orderId: number): Promise<Order | undefined> {
        return await executeAuthenticatedRequest(this.user, sdkGetOrder, { orderId });
    }

    /**
     * Get ALL open orders with automatic pagination
     */
    async getAllOrders(filter: OpenOrderRequestFilter = {}): Promise<Order[]> {
        let allOrders: Order[] = [];
        let nextToken: string | undefined = undefined;

        do {
            const result: WorkingOrdersCollection | undefined = await this.getOrders(filter, nextToken ?? null);
            const orders = result?.orders || [];
            allOrders = allOrders.concat(orders);
            nextToken = result?.nextToken;
        } while (nextToken);

        return allOrders;
    }

    /**
     * Get order history (completed orders)
     * POST /orders/completed
     */
    async getOrderHistory(
        filter: OrderHistoryPageRequestFilter = {},
        nextToken: string | null = null
    ): Promise<OrdersHistoryCollection | undefined> {
        const extraHeaders = nextToken ? { 'X-YB-NEXT-TOKEN': nextToken } : undefined;
        return await executeAuthenticatedRequest(this.user, getOrdersHistory, filter, extraHeaders);
    }

    /**
     * Get a single historical order by ID
     * POST /orders/completed/single
     */
    async getHistoricalOrder(orderId: number): Promise<Order | undefined> {
        return await executeAuthenticatedRequest(this.user, getHistoryOrder, { orderId });
    }

    /**
     * Get ALL order history with automatic pagination
     */
    async getAllOrderHistory(filter: OrderHistoryPageRequestFilter = {}): Promise<Order[]> {
        let allOrders: Order[] = [];
        let nextToken: string | undefined = undefined;

        do {
            const result: OrdersHistoryCollection | undefined = await this.getOrderHistory(filter, nextToken ?? null);
            const orders = result?.orders || [];
            allOrders = allOrders.concat(orders);
            nextToken = result?.nextToken;
        } while (nextToken);

        return allOrders;
    }

    /**
     * Cancel all orders
     */
    async cancelAllOrders(symbol: string | null = null): Promise<PromiseSettledResult<unknown>[]> {
        this.log.info(`Canceling all orders${symbol ? ` for ${symbol}` : ''}`);
        const result: WorkingOrdersCollection | undefined = await this.getOrders(symbol ? { symbolName: symbol } : {});
        const orders = result?.orders || [];
        const cancelPromises = orders
            .filter((order) => order.st === 'Working' || order.st === 'Inactive')
            .map((order) => this.cancelOrder(order.id));

        return await Promise.allSettled(cancelPromises);
    }

    // ==================== POSITIONS ====================

    /**
     * Get open positions
     * POST /positions
     *
     * Concurrent requests with the same filter/token coalesce onto one in-flight HTTP call.
     */
    async getPositions(
        filter: OpenPositionRequestFilter = {},
        nextToken: string | null = null
    ): Promise<PositionsCollection | undefined> {
        const cacheKey = JSON.stringify([
            filter.symbolName ?? null,
            filter.sortOrder ?? null,
            filter.maxResults ?? null,
            nextToken,
        ]);
        return this.positionsCache.get(cacheKey, () => this.fetchPositions(filter, nextToken));
    }

    /** Drop cached snapshots after any mutation that can change open positions. */
    private invalidatePositionsCache(): void {
        this.positionsCache.clear();
    }

    private async fetchPositions(
        filter: OpenPositionRequestFilter,
        nextToken: string | null
    ): Promise<PositionsCollection | undefined> {
        const extraHeaders = nextToken ? { 'X-YB-NEXT-TOKEN': nextToken } : undefined;
        return await executeAuthenticatedRequest(this.user, sdkGetPositions, filter, extraHeaders);
    }

    /**
     * Get a single position by ID
     */
    async getPositionById(positionId: number): Promise<Position | null> {
        const result: { positions?: Position[] } | undefined = await this.getPositions({});
        const positions = result?.positions || [];
        return positions.find((p: Position) => p.id === positionId) || null;
    }

    /**
     * Check if there are any open positions
     */
    async hasOpenPositions(symbol: string | null = null): Promise<boolean> {
        const filter: OpenPositionRequestFilter = symbol ? { symbolName: symbol } : {};
        const result = await this.getPositions(filter);
        const positions = result?.positions || [];
        return positions.length > 0;
    }

    /**
     * Get ALL open positions with automatic pagination
     */
    async getAllPositions(filter: OpenPositionRequestFilter = {}): Promise<Position[]> {
        let allPositions: Position[] = [];
        let nextToken: string | undefined = undefined;

        do {
            const result: { positions?: Position[]; nextToken?: string } | undefined = await this.getPositions(
                filter,
                nextToken ?? null
            );
            const positions = result?.positions || [];
            allPositions = allPositions.concat(positions);
            nextToken = result?.nextToken;
        } while (nextToken);

        return allPositions;
    }

    /**
     * Modify stop loss and/or take profit of a position
     * PUT /sltp
     */
    async modifyPositionSLTP(
        positionId: number,
        stopLoss: number | null = null,
        takeProfit: number | null = null
    ): Promise<ModifySltpResult | undefined> {
        this.log.info(`Modifying position SL/TP: ${positionId}`);
        const body: ModifyPositionSltp = { id: positionId };
        if (stopLoss !== null) {
            body.sl = stopLoss;
        }
        if (takeProfit !== null) {
            body.tp = takeProfit;
        }

        try {
            return await executeAuthenticatedRequest<ModifySltpResult>(
                this.user,
                modifyPositionSltp,
                body,
                undefined,
                TradingService.MUTATION_OPTS
            );
        } finally {
            // SL/TP is part of the position snapshot; drop after the mutation attempt.
            this.invalidatePositionsCache();
        }
    }

    // ==================== TRADES ====================

    /**
     * Get trade history
     * POST /trades
     */
    async getTradeHistory(
        filter: TradeHistoryPageRequestFilter = {},
        nextToken: string | null = null
    ): Promise<TradeCollection | undefined> {
        const extraHeaders = nextToken ? { 'X-YB-NEXT-TOKEN': nextToken } : undefined;
        return await executeAuthenticatedRequest(this.user, getTrades, filter, extraHeaders);
    }

    /**
     * Get ALL trade history with automatic pagination
     */
    async getAllTradeHistory(filter: TradeHistoryPageRequestFilter = {}): Promise<Trade[]> {
        let allTrades: Trade[] = [];
        let nextToken: string | undefined = undefined;

        do {
            const result: TradeCollection | undefined = await this.getTradeHistory(filter, nextToken ?? null);
            const trades = result?.trades || [];
            allTrades = allTrades.concat(trades);
            nextToken = result?.nextToken;
        } while (nextToken);

        return allTrades;
    }

    /**
     * Get specific trade by ID
     */
    async getTrade(tradeId: number): Promise<Trade> {
        const result: TradeCollection | undefined = await this.getTradeHistory({});
        if (!result) {
            throw new Error(`Failed to fetch trade history`);
        }

        const trade = result.trades?.find((t) => t.id === tradeId);

        if (!trade) {
            throw new Error(`Trade ${tradeId} not found`);
        }

        return trade;
    }
}
