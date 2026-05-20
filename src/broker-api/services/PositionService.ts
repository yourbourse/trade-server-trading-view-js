import { Position } from '../../../charting_library/charting_library';
import type { Position as TradeServerPosition, PositionsCollection, PlaceOrder } from '../../schema/public-api';
import { TradeServerClient } from '@/trade-server-api/TradeServerClient';
import { transformPositions } from '../type-mappings';
import { handleApiError } from '@/utils/apiError';
import { Side } from '../types';
import { createLogger } from '@/utils/logger.js';

const logger = createLogger({ prefix: '[PositionService]' });

export class PositionService {
    private api: TradeServerClient;
    private cachedPositions: Position[];

    constructor(api: TradeServerClient) {
        this.api = api;
        this.cachedPositions = [];
    }

    getCachedPositions(): Position[] {
        return this.cachedPositions;
    }

    setCachedPositions(positions: Position[]): void {
        this.cachedPositions = positions;
    }

    clearCache(): void {
        this.cachedPositions = [];
    }

    async getAllPositions(): Promise<Position[]> {
        logger.debug('getAllPositions');

        try {
            if (this.cachedPositions.length > 0) {
                return this.cachedPositions;
            }

            logger.debug('Cache empty, fetching from server');
            const positionsResult = await this.api.trading.getPositions({});
            const positions = (positionsResult as PositionsCollection).positions || [];
            this.cachedPositions = transformPositions(positions) as Position[];
            logger.info('Fetched', this.cachedPositions.length, 'positions from server');
            return this.cachedPositions;
        } catch (error) {
            handleApiError(error, 'Error getting positions');
        }
    }

    async editPositionBrackets(
        positionId: string,
        brackets: { stopLoss?: number; takeProfit?: number }
    ): Promise<void> {
        logger.debug('editPositionBrackets', positionId, brackets);

        try {
            await this.api.trading.modifyPositionSLTP(
                parseInt(positionId),
                brackets.stopLoss ?? null,
                brackets.takeProfit ?? null
            );

            const index = this.cachedPositions.findIndex((p) => p.id === positionId);
            if (index >= 0) {
                const updated = { ...this.cachedPositions[index]! };
                if (brackets.stopLoss !== undefined) {
                    updated.stopLoss = brackets.stopLoss;
                }
                if (brackets.takeProfit !== undefined) {
                    updated.takeProfit = brackets.takeProfit;
                }
                this.cachedPositions[index] = updated;
            }

            logger.info('Position brackets modified successfully:', positionId);
        } catch (error) {
            handleApiError(error, 'Error modifying position brackets');
        }
    }

    async closePosition(positionId: string, amount?: number): Promise<void> {
        logger.debug('closePosition', { positionId, amount });

        try {
            let position = this.cachedPositions.find((p: Position) => p.id === positionId);

            if (!position) {
                const positionsResult = await this.api.trading.getPositions({});
                const positions = (positionsResult as PositionsCollection).positions || [];
                const serverPosition = positions.find((p: TradeServerPosition) => p.id.toString() === positionId);

                if (!serverPosition) {
                    throw new Error('Position not found');
                }

                const transformedPositions = transformPositions([serverPosition]) as Position[];
                if (transformedPositions.length > 0 && transformedPositions[0]) {
                    this.cachedPositions.push(transformedPositions[0]);
                    position = transformedPositions[0];
                }
            }

            if (!position) {
                throw new Error('Position not found after caching');
            }

            const closeQty = amount || position.qty;

            const closeOrder: PlaceOrder = {
                s: position.symbol,
                q: closeQty,
                S: position.side === Side.Buy ? 'sell' : 'buy',
                t: 'Market',
                tif: 'FOK',
                pi: parseInt(positionId),
            };

            await this.api.trading.placeOrder(closeOrder);
        } catch (error) {
            handleApiError(error, 'Error closing position');
        }
    }

    async reversePosition(positionId: string): Promise<void> {
        logger.debug('reversePosition', { positionId });

        try {
            const positionsResult = await this.api.trading.getPositions({});
            const positions = (positionsResult as PositionsCollection).positions || [];
            const position = positions.find((p: TradeServerPosition) => p.id.toString() === positionId);

            if (!position) {
                throw new Error('Position not found');
            }

            const reverseOrder: PlaceOrder = {
                s: position.s,
                q: position.q * 2,
                S: position.S === 'buy' ? 'sell' : 'buy',
                t: 'Market',
                tif: 'IOC',
                pi: position.id,
            };

            await this.api.trading.placeOrder(reverseOrder);
        } catch (error) {
            handleApiError(error, 'Error reversing position');
        }
    }
}
