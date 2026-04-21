import { PreOrder } from '../../../charting_library/charting_library';
import { TradeServerClient } from '@/trade-server-api/TradeServerClient';
import { Side } from '../types';
import { createLogger } from '@/utils/logger.js';

const logger = createLogger({ prefix: '[BracketService]' });

interface BracketInfo {
    symbol: string;
    side: string;
    sl?: number;
    tp?: number;
}

export class BracketService {
    private api: TradeServerClient;
    private orderBrackets: Map<string, BracketInfo>;

    constructor(api: TradeServerClient) {
        this.api = api;
        this.orderBrackets = new Map();
    }

    storeBracketsForOrder(orderId: string, preOrder: PreOrder): void {
        if (preOrder.stopLoss || preOrder.takeProfit) {
            this.orderBrackets.set(orderId, {
                symbol: preOrder.symbol,
                side: preOrder.side === Side.Buy ? 'buy' : 'sell',
                sl: preOrder.stopLoss,
                tp: preOrder.takeProfit,
            });
            logger.debug('Stored bracket info for order', orderId);
        }
    }

    async activateBracketsForFilledOrder(orderId: string): Promise<void> {
        const bracketInfo = this.orderBrackets.get(orderId);
        if (!bracketInfo) {
            return;
        }

        logger.debug('Activating brackets for filled order:', orderId, bracketInfo);

        try {
            const positionsData = await this.api.trading.getPositions();
            const positions = positionsData?.positions || [];

            const matchingPosition = positions.find((p) => p.s === bracketInfo.symbol && p.S === bracketInfo.side);

            if (matchingPosition) {
                logger.info('Found matching position:', matchingPosition.id, 'Activating brackets...');

                await this.api.trading.modifyPositionSLTP(
                    matchingPosition.id,
                    bracketInfo.sl ?? null,
                    bracketInfo.tp ?? null
                );

                logger.info('Successfully activated brackets on position:', matchingPosition.id);
            } else {
                logger.warn('Could not find matching position for order:', orderId, bracketInfo);
            }
        } catch (error) {
            logger.error('Error activating brackets:', error);
        } finally {
            this.orderBrackets.delete(orderId);
        }
    }

    async checkOrphanedBrackets(): Promise<void> {
        try {
            logger.debug('Checking for orphaned bracket orders...');

            const allOrders = (await this.api.trading.getAllOrders()) || [];
            const inactiveBrackets = allOrders.filter((order) => order.st === 'Inactive' && order.poi !== undefined);

            if (inactiveBrackets.length === 0) {
                logger.debug('No orphaned bracket orders found');
                return;
            }

            logger.info('Found', inactiveBrackets.length, 'inactive bracket orders');

            const positionsData = await this.api.trading.getPositions();
            const positions = positionsData?.positions || [];

            const bracketsByParent = new Map<number, { symbol: string; sl?: number; tp?: number }>();

            for (const bracket of inactiveBrackets) {
                if (!bracket.poi) continue;

                const key = bracket.poi;
                if (!bracketsByParent.has(key)) {
                    bracketsByParent.set(key, { symbol: bracket.s });
                }

                const info = bracketsByParent.get(key)!;

                if (bracket.t === 'Stop' || bracket.t === 'StopLimit') {
                    info.sl = bracket.sp || bracket.lp;
                } else if (bracket.t === 'Limit') {
                    info.tp = bracket.lp;
                }
            }

            for (const [parentOrderId, bracketInfo] of bracketsByParent) {
                try {
                    const parentOrder = allOrders.find((o) => o.id === parentOrderId);

                    if (parentOrder && parentOrder.st === 'Filled') {
                        const matchingPosition = positions.find(
                            (p) => p.s === bracketInfo.symbol && p.S === parentOrder.S
                        );

                        if (matchingPosition) {
                            logger.info('Activating orphaned brackets for position:', matchingPosition.id, bracketInfo);

                            await this.api.trading.modifyPositionSLTP(
                                matchingPosition.id,
                                bracketInfo.sl ?? null,
                                bracketInfo.tp ?? null
                            );

                            logger.info('Successfully activated orphaned brackets on position:', matchingPosition.id);
                        }
                    }
                } catch (error) {
                    logger.error('Error activating orphaned bracket for parent order', parentOrderId, error);
                }
            }

            logger.debug('Finished checking orphaned brackets');
        } catch (error) {
            logger.error('Error during orphaned bracket check:', error);
        }
    }
}
