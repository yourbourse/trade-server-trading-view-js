import { IBrokerConnectionAdapterHost, Order, Position } from '../../../charting_library/charting_library';
import type { Order as TradeServerOrder, Position as TradeServerPosition, AccountState } from '../../schema/public-api';
import { TradeServerClient } from '@/trade-server-api/TradeServerClient';
import { enrichPositionBracketOrders, transformOrders, transformPositions } from '../type-mappings';
import { OrderStatus } from '../types';
import { createLogger } from '@/utils/logger.js';

const logger = createLogger({ prefix: '[UpdateService]' });

export class UpdateService {
    private api: TradeServerClient;
    private host: IBrokerConnectionAdapterHost;
    private onGetCachedOrders: () => Order[];
    private onGetCachedPositions: () => Position[];
    private onOrderCacheUpdate: (orders: Order[]) => void;
    private onPositionCacheUpdate: (positions: Position[]) => void;
    private onAccountStateUpdate: (data: { data: AccountState[] }) => void;
    private onRecalculateAMData: () => void;
    private onBracketActivation: (orderId: string) => Promise<void>;

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
            onBracketActivation: (orderId: string) => Promise<void>;
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
        this.onBracketActivation = callbacks.onBracketActivation;
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
        const { type, data: orders } = data;
        const cachedOrders = this.onGetCachedOrders();

        const ordersToNotify: Order[] = [];
        let hasTerminalOrders = false;

        if (type === 's') {
            void this.applyEnrichedOrderSnapshot(orders);
            return;
        } else if (type === 'u') {
            const updatedOrders = transformOrders(orders) as Order[];
            updatedOrders.forEach((order) => {
                const index = cachedOrders.findIndex((o) => o.id === order.id);
                if (index >= 0) {
                    cachedOrders[index] = order;
                } else {
                    cachedOrders.push(order);
                }

                if (
                    order.status === OrderStatus.Filled ||
                    order.status === OrderStatus.Canceled ||
                    order.status === OrderStatus.Rejected
                ) {
                    hasTerminalOrders = true;
                    logger.info('Order reached terminal status:', order.id, 'status:', order.status);

                    if (order.status === OrderStatus.Filled) {
                        this.onBracketActivation(order.id).catch((err) => {
                            logger.error('Error activating brackets for filled order:', err);
                        });
                    }
                } else {
                    ordersToNotify.push(order);
                }
            });
        }

        if (hasTerminalOrders) {
            logger.info('Terminal order(s) detected, clearing cache and forcing full refresh');
            this.onOrderCacheUpdate([]);
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
                if (pos.mp !== undefined && pos.pl !== undefined && !pos.s) {
                    const index = cachedPositions.findIndex((p) => p.id === pos.id.toString());
                    if (index >= 0 && cachedPositions[index]) {
                        cachedPositions[index]['pl'] = pos.pl;
                        const updatedPosition = cachedPositions[index];
                        if (updatedPosition) {
                            positionsToNotify.push(updatedPosition);
                        }
                    }
                } else {
                    const transformedPos = (transformPositions([pos]) as Position[])[0];
                    if (transformedPos) {
                        if (transformedPos.qty === 0) {
                            hasClosedPositions = true;

                            const index = cachedPositions.findIndex((p) => p.id === transformedPos.id);
                            if (index >= 0) {
                                logger.debug('Removing closed position from cache:', transformedPos.id);
                                cachedPositions.splice(index, 1);
                            }
                        } else {
                            const index = cachedPositions.findIndex((p) => p.id === transformedPos.id);
                            if (index >= 0) {
                                cachedPositions[index] = transformedPos;
                                logger.debug('Updated existing position:', transformedPos.id);
                            } else {
                                cachedPositions.push(transformedPos);
                                logger.debug('Added new position:', transformedPos.id);
                            }
                            positionsToNotify.push(transformedPos);
                        }
                    }
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
