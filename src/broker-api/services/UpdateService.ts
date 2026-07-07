import { IBrokerConnectionAdapterHost, Order, Position } from '../../../charting_library/charting_library';
import type { Order as TradeServerOrder, Position as TradeServerPosition, AccountState } from '../../schema/public-api';
import { TradeServerClient } from '@/trade-server-api/TradeServerClient';
import { enrichPositionBracketOrders, transformOrders, transformPosition, transformPositions } from '../type-mappings';
import { OrderStatus } from '../types';
import { createLogger } from '@/utils/logger.js';

const logger = createLogger({ prefix: '[UpdateService]' });

export class UpdateService {
    private api: TradeServerClient;
    private host: IBrokerConnectionAdapterHost;
    private orderUpdateChain: Promise<void> = Promise.resolve();
    private onGetCachedOrders: () => Order[];
    private onGetCachedPositions: () => Position[];
    private onOrderCacheUpdate: (orders: Order[]) => void;
    private onPositionCacheUpdate: (positions: Position[]) => void;
    private onAccountStateUpdate: (data: { data: AccountState[] }) => void;
    private onRecalculateAMData: () => void;
    private onMergeOrderUpdate: (existing: Order | undefined, incoming: Order, positions: Position[]) => Order;
    private onApplyServerPositionUpdate: (incoming: Position) => Position;
    private onSyncBracketOrdersFromPosition: (position: Position) => Order[];
    private onRefreshOrdersCache: () => Promise<Order[]>;

    constructor(
        api: TradeServerClient,
        host: IBrokerConnectionAdapterHost,
        callbacks: {
            onGetCachedOrders: () => Order[];
            onGetCachedPositions: () => Position[];
            onOrderCacheUpdate: (orders: Order[]) => void;
            onPositionCacheUpdate: (positions: Position[]) => void;
            onAccountStateUpdate: (data: { data: AccountState[] }) => void;
            onRecalculateAMData: () => void;
            onMergeOrderUpdate: (existing: Order | undefined, incoming: Order, positions: Position[]) => Order;
            onApplyServerPositionUpdate: (incoming: Position) => Position;
            onSyncBracketOrdersFromPosition: (position: Position) => Order[];
            onRefreshOrdersCache: () => Promise<Order[]>;
        }
    ) {
        this.api = api;
        this.host = host;
        this.onGetCachedOrders = callbacks.onGetCachedOrders;
        this.onGetCachedPositions = callbacks.onGetCachedPositions;
        this.onOrderCacheUpdate = callbacks.onOrderCacheUpdate;
        this.onPositionCacheUpdate = callbacks.onPositionCacheUpdate;
        this.onAccountStateUpdate = callbacks.onAccountStateUpdate;
        this.onRecalculateAMData = callbacks.onRecalculateAMData;
        this.onMergeOrderUpdate = callbacks.onMergeOrderUpdate;
        this.onApplyServerPositionUpdate = callbacks.onApplyServerPositionUpdate;
        this.onSyncBracketOrdersFromPosition = callbacks.onSyncBracketOrdersFromPosition;
        this.onRefreshOrdersCache = callbacks.onRefreshOrdersCache;
    }

    subscribeToUpdates(): void {
        this.api.subscriptions.subscribe('order_update', (data) => {
            this.handleOrderUpdate(data as { type: string; data: TradeServerOrder[] });
        });

        this.api.subscriptions.subscribe('position_update', (data) => {
            this.handlePositionUpdate(data as { type: string; data: TradeServerPosition[] });
        });

        this.api.subscriptions.subscribe('account_state_update', (data) => {
            this.handleAccountStateUpdate(data as { data: AccountState[] });
        });

        logger.info('Registered event listeners for WebSocket updates');
    }

    private handleOrderUpdate(data: { type: string; data: TradeServerOrder[] }): void {
        this.orderUpdateChain = this.orderUpdateChain
            .then(() => this.processOrderUpdate(data))
            .catch((error) => {
                logger.error('Error processing order update:', error);
            });
    }

    private async processOrderUpdate(data: { type: string; data: TradeServerOrder[] }): Promise<void> {
        const { type, data: orders } = data;
        const cachedOrders = this.onGetCachedOrders();

        const ordersToNotify: Order[] = [];
        let hasTerminalOrders = false;

        if (type === 's') {
            await this.applyEnrichedOrderSnapshot(orders);
            return;
        } else if (type === 'u') {
            const cachedPositions = this.onGetCachedPositions();
            const updatedOrders = transformOrders(orders) as Order[];
            updatedOrders.forEach((order) => {
                const index = cachedOrders.findIndex((o) => o.id === order.id);
                const existing = index >= 0 ? cachedOrders[index] : undefined;
                const merged = this.onMergeOrderUpdate(existing, order, cachedPositions);

                if (index >= 0) {
                    cachedOrders[index] = merged;
                } else {
                    cachedOrders.push(merged);
                }

                if (
                    merged.status === OrderStatus.Filled ||
                    merged.status === OrderStatus.Canceled ||
                    merged.status === OrderStatus.Rejected
                ) {
                    hasTerminalOrders = true;
                    logger.info('Order reached terminal status:', merged.id, 'status:', merged.status);
                } else {
                    ordersToNotify.push(merged);
                }
            });
        }

        if (hasTerminalOrders) {
            logger.info('Terminal order(s) detected, refreshing orders before full update');
            await this.onRefreshOrdersCache();
            if (this.host?.ordersFullUpdate) {
                this.host.ordersFullUpdate();
            }
        } else {
            if (this.host?.orderUpdate) {
                ordersToNotify.forEach((order) => {
                    if (this.host?.orderUpdate) {
                        this.host.orderUpdate(order);
                    }
                });
            }
        }
    }

    private handlePositionUpdate(data: { type: string; data: TradeServerPosition[] }): void {
        const { type, data: positions } = data;
        const cachedPositions = this.onGetCachedPositions();

        logger.debug('handlePositionUpdate:', { type, count: positions.length, positions });

        const positionsToNotify: Position[] = [];
        let hasClosedPositions = false;

        if (type === 's') {
            const newPositions = transformPositions(positions) as Position[];
            this.onPositionCacheUpdate(newPositions);
            positionsToNotify.push(...newPositions);
            logger.debug('Snapshot: replaced all positions, will notify about', newPositions.length);
        } else if (type === 'u') {
            positions.forEach((pos) => {
                try {
                    // `s` (symbol) is required on the full "Position" schema and never present on
                    // "PositionPriceUpdate" (id/mp/pl/m only, additionalProperties: false) — its absence
                    // is the only reliable discriminator between the two message shapes.
                    if (pos.s === undefined) {
                        this.applyPositionPriceTick(pos, cachedPositions, positionsToNotify);
                    } else if (this.applyFullPositionUpdate(pos, cachedPositions, positionsToNotify)) {
                        hasClosedPositions = true;
                    }
                } catch (error) {
                    logger.error('Error processing position update for id', pos.id, error);
                }
            });
        } else if (type === 'd') {
            hasClosedPositions = true;
            positions.forEach((pos) => {
                const index = cachedPositions.findIndex((p) => p.id === pos.id.toString());
                if (index >= 0) {
                    logger.debug('Deleting position from cache:', pos.id);
                    cachedPositions.splice(index, 1);
                }
            });
        }

        if (hasClosedPositions) {
            logger.info('Position(s) closed, forcing full positions refresh');
            if (this.host?.positionsFullUpdate) {
                this.host.positionsFullUpdate();
            }
        } else {
            if (this.host?.positionUpdate) {
                logger.debug('Notifying TradingView about', positionsToNotify.length, 'positions');
                positionsToNotify.forEach((position) => {
                    if (this.host?.positionUpdate) {
                        this.host.positionUpdate(position);
                    }
                });
            }
        }

        this.onRecalculateAMData();
    }

    /**
     * Position price update: patch the existing cached position in place, never create one.
     * This shape (id/mp/pl/m only) never carries enough (symbol/qty/side) to add a new entry,
     * so an unknown id is dropped, not added.
     */
    private applyPositionPriceTick(
        pos: TradeServerPosition,
        cachedPositions: Position[],
        positionsToNotify: Position[]
    ): void {
        const index = cachedPositions.findIndex((p) => p.id === pos.id.toString());
        const cachedPosition = cachedPositions[index];
        if (!cachedPosition) {
            logger.warn('Position price update for unknown id, dropping:', pos.id);
            return;
        }
        cachedPosition['pl'] = pos.pl;
        cachedPosition['mp'] = pos.mp;
        cachedPosition['margin'] = pos.m;
        positionsToNotify.push(cachedPosition);
    }

    /**
     * Full position add/update/close message. Returns true if the position closed (qty === 0)
     * so the caller can trigger a full positions refresh.
     */
    private applyFullPositionUpdate(
        pos: TradeServerPosition,
        cachedPositions: Position[],
        positionsToNotify: Position[]
    ): boolean {
        const protectedPos = this.onApplyServerPositionUpdate(transformPosition(pos));
        const index = cachedPositions.findIndex((p) => p.id === protectedPos.id);

        if (protectedPos.qty === 0) {
            if (index >= 0) {
                logger.debug('Removing closed position from cache:', protectedPos.id);
                cachedPositions.splice(index, 1);
            }
            return true;
        }

        if (index >= 0) {
            cachedPositions[index] = protectedPos;
            logger.debug('Updated existing position:', protectedPos.id);
        } else {
            cachedPositions.push(protectedPos);
            logger.debug('Added new position:', protectedPos.id);
        }
        positionsToNotify.push(protectedPos);

        const syncedOrders = this.onSyncBracketOrdersFromPosition(protectedPos);
        syncedOrders.forEach((order) => {
            this.host?.orderUpdate?.(order);
        });
        return false;
    }

    private async applyEnrichedOrderSnapshot(orders: TradeServerOrder[]): Promise<void> {
        try {
            const positionsData = await this.api.trading.getPositions({});
            const positions = positionsData?.positions || [];
            const enrichedOrders = enrichPositionBracketOrders(orders, positions);
            const newOrders = transformOrders(enrichedOrders) as Order[];

            this.onOrderCacheUpdate(newOrders);

            if (this.host?.orderUpdate) {
                newOrders.forEach((order) => {
                    this.host?.orderUpdate?.(order);
                });
            }
        } catch (error) {
            logger.error('Failed to enrich order snapshot:', error);
            const newOrders = transformOrders(orders) as Order[];
            this.onOrderCacheUpdate(newOrders);
            if (this.host?.orderUpdate) {
                newOrders.forEach((order) => {
                    this.host?.orderUpdate?.(order);
                });
            }
        }
    }

    private handleAccountStateUpdate(data: { data: AccountState[] }): void {
        const cachedPositions = this.onGetCachedPositions();
        this.onAccountStateUpdate(data);

        if (this.host?.plUpdate) {
            cachedPositions.forEach((position) => {
                if (position['pl'] !== undefined) {
                    this.host?.plUpdate(position.id, position['pl'] || 0);
                }
            });
        }

        this.onRecalculateAMData();
    }
}
