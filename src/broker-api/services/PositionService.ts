import { Position } from '../../../charting_library/charting_library';
import type { Position as TradeServerPosition, PositionsCollection, PlaceOrder } from '../../schema/public-api';
import { TradeServerClient } from '@/trade-server-api/TradeServerClient';
import { transformPositions } from '../type-mappings';
import { handleApiError } from '@/utils/apiError';
import { Side } from '../types';
import { createLogger } from '@/utils/logger.js';

const logger = createLogger({ prefix: '[PositionService]' });

const BRACKET_EDIT_GUARD_MS = 3000;

export class PositionService {
    private api: TradeServerClient;
    private cachedPositions: Position[];
    /** Ignore stale server SL/TP briefly after a local bracket edit (drag or dialog). */
    private bracketEditGuard = new Map<string, { stopLoss?: number; takeProfit?: number; until: number }>();

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

    async ensureCachedPosition(positionId: string): Promise<Position | undefined> {
        const cached = this.cachedPositions.find((p) => p.id === positionId);
        if (cached) {
            return cached;
        }

        try {
            const positionsResult = await this.api.trading.getPositions({});
            const positions = (positionsResult as PositionsCollection).positions || [];
            const serverPosition = positions.find((p: TradeServerPosition) => p.id.toString() === positionId);

            if (!serverPosition) {
                return undefined;
            }

            const transformedPositions = transformPositions([serverPosition]) as Position[];
            const position = transformedPositions[0];
            if (position) {
                this.cachedPositions.push(position);
            }
            return position;
        } catch (error) {
            handleApiError(error, 'Error fetching position');
        }
    }

    async editPositionBrackets(
        positionId: string,
        brackets: { stopLoss?: number; takeProfit?: number }
    ): Promise<void> {
        logger.debug('editPositionBrackets', positionId, brackets);

        try {
            const position = await this.ensureCachedPosition(positionId);
            if (!position) {
                throw new Error('Position not found');
            }

            const stopLoss = 'stopLoss' in brackets ? brackets.stopLoss : position.stopLoss;
            const takeProfit = 'takeProfit' in brackets ? brackets.takeProfit : position.takeProfit;

            await this.api.trading.modifyPositionSLTP(
                parseInt(positionId),
                stopLoss ?? null,
                takeProfit ?? null
            );

            const index = this.cachedPositions.findIndex((p) => p.id === positionId);
            if (index >= 0) {
                const updated = { ...this.cachedPositions[index]! };
                if ('stopLoss' in brackets) {
                    if (brackets.stopLoss !== undefined) {
                        updated.stopLoss = brackets.stopLoss;
                    } else {
                        delete updated.stopLoss;
                    }
                }
                if ('takeProfit' in brackets) {
                    if (brackets.takeProfit !== undefined) {
                        updated.takeProfit = brackets.takeProfit;
                    } else {
                        delete updated.takeProfit;
                    }
                }
                this.cachedPositions[index] = updated;
                this.markBracketEdit(positionId, updated.stopLoss, updated.takeProfit);
            }

            logger.info('Position brackets modified successfully:', positionId);
        } catch (error) {
            handleApiError(error, 'Error modifying position brackets');
        }
    }

    async closePosition(positionId: string, amount?: number): Promise<void> {
        logger.debug('closePosition', { positionId, amount });

        try {
            const position = await this.ensureCachedPosition(positionId);

            if (!position) {
                throw new Error('Position not found');
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

    markBracketEdit(positionId: string, stopLoss?: number, takeProfit?: number): void {
        this.bracketEditGuard.set(positionId, {
            stopLoss,
            takeProfit,
            until: Date.now() + BRACKET_EDIT_GUARD_MS,
        });
    }

    /**
     * Apply a server position update while protecting recently edited SL/TP from stale WS data.
     */
    applyServerPositionUpdate(incoming: Position): Position {
        const guard = this.bracketEditGuard.get(incoming.id);
        if (!guard || Date.now() > guard.until) {
            return incoming;
        }

        const protectedPosition = { ...incoming };

        if (guard.stopLoss !== undefined && protectedPosition.stopLoss !== guard.stopLoss) {
            protectedPosition.stopLoss = guard.stopLoss;
        }

        if (guard.takeProfit !== undefined && protectedPosition.takeProfit !== guard.takeProfit) {
            protectedPosition.takeProfit = guard.takeProfit;
        }

        return protectedPosition;
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
