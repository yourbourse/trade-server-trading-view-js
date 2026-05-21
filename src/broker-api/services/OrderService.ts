import { Order, PlaceOrderResult, PreOrder } from '../../../charting_library/charting_library';
import type { Order as TradeServerOrder, PlaceOrder, ModifyOrder } from '../../schema/public-api';
import { TradeServerClient } from '@/trade-server-api/TradeServerClient';
import { transformOrders, unmapOrderType, unmapTimeInForce } from '../type-mappings';
import { handleApiError } from '@/utils/apiError';
import { Side } from '../types';
import { createLogger } from '@/utils/logger.js';

const logger = createLogger({ prefix: '[OrderService]' });

export class OrderService {
    private api: TradeServerClient;
    private cachedOrders: Order[];

    constructor(api: TradeServerClient) {
        this.api = api;
        this.cachedOrders = [];
    }

    getCachedOrders(): Order[] {
        return this.cachedOrders;
    }

    setCachedOrders(orders: Order[]): void {
        this.cachedOrders = orders;
    }

    clearCache(): void {
        this.cachedOrders = [];
    }

    async getAllOrders(): Promise<Order[]> {
        logger.debug('getAllOrders');

        try {
            if (this.cachedOrders.length > 0) {
                return this.cachedOrders;
            }

            const [workingOrders, historicalOrders] = await Promise.all([
                this.api.trading.getAllOrders({}),
                this.api.trading.getAllOrderHistory({}),
            ]);

            const workingOrdersList = workingOrders || [];
            const historicalOrdersList = historicalOrders || [];
            const allOrders = [...workingOrdersList, ...historicalOrdersList];

            this.cachedOrders = transformOrders(allOrders) as Order[];

            logger.info('Fetched ALL orders (with pagination):', {
                workingCount: workingOrdersList.length,
                historicalCount: historicalOrdersList.length,
                total: this.cachedOrders.length,
            });

            return this.cachedOrders;
        } catch (error) {
            handleApiError(error, 'Error getting orders');
        }
    }

    async placeOrder(preOrder: PreOrder): Promise<PlaceOrderResult> {
        logger.debug('placeOrder', preOrder);

        try {
            const orderParams: PlaceOrder = {
                s: preOrder.symbol,
                q: preOrder.qty,
                S: preOrder.side === Side.Buy ? 'buy' : 'sell',
                t: unmapOrderType(preOrder.type || 1),
                tif: unmapTimeInForce(preOrder.duration),
            };

            // GTD: convert TradingView datetime (milliseconds) to API tt (microseconds)
            if (orderParams.tif === 'GTD' && preOrder.duration?.datetime) {
                orderParams.tt = preOrder.duration.datetime * 1000;
            }

            if (preOrder.limitPrice) {
                orderParams.lp = preOrder.limitPrice;
            }

            if (preOrder.stopPrice) {
                orderParams.sp = preOrder.stopPrice;
            }

            if (preOrder.stopLoss) {
                orderParams.sl = preOrder.stopLoss;
            }
            if (preOrder.takeProfit) {
                orderParams.tp = preOrder.takeProfit;
            }

            const result: TradeServerOrder = await this.api.trading.placeOrder(orderParams);

            if (!result || !result.id) {
                throw new Error('Order placement failed');
            }

            this.cachedOrders = [];

            return {
                orderId: result.id.toString(),
            };
        } catch (error) {
            handleApiError(error, 'Error placing order');
        }
    }

    async modifyOrder(order: Order): Promise<void> {
        logger.debug('modifyOrder', order);

        try {
            const modifications: ModifyOrder = {
                id: parseInt(order.id),
            };

            if (order.limitPrice !== undefined) {
                modifications.lp = order.limitPrice;
            }

            if (order.stopPrice !== undefined) {
                modifications.sp = order.stopPrice;
            }

            await this.api.trading.modifyOrder(modifications);

            if (order.stopLoss !== undefined || order.takeProfit !== undefined) {
                await this.api.trading.modifyOrderSLTP(
                    parseInt(order.id),
                    order.stopLoss ?? null,
                    order.takeProfit ?? null
                );
            }

            logger.info('Order modified successfully:', order.id);
        } catch (error) {
            handleApiError(error, 'Error modifying order');
        }
    }

    async cancelOrder(orderId: string): Promise<void> {
        logger.debug('cancelOrder', orderId);

        try {
            await this.api.trading.cancelOrder(parseInt(orderId));
            logger.info('Order canceled successfully:', orderId);
        } catch (error) {
            handleApiError(error, 'Error canceling order');
        }
    }

    async cancelOrders(ordersIds: string[]): Promise<void> {
        await Promise.all(
            ordersIds.map((orderId: string) => {
                return this.cancelOrder(orderId);
            })
        );
    }
}
