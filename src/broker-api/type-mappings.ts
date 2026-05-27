/**
 * Type mapping utilities for converting between Trade Server and TradingView formats
 */

import type { Order, Position } from '../../charting_library/charting_library';
import { OrderType as TradingViewOrderType, ParentType, Side } from './types';
import type {
    Order as TradeServerOrder,
    OrderStatus,
    OrderType as TradeServerOrderType,
    Position as TradeServerPosition,
    Trade as TradeServerTrade,
    TimeInForce,
} from '../schema/public-api/types.gen';

/**
 * Format microseconds timestamp to human-readable date/time
 * @param microseconds - Timestamp in microseconds since Unix epoch
 * @returns Formatted date string (MM/DD/YYYY, HH:MM:SS)
 */
export function formatTimestamp(microseconds: number): string {
    const date = new Date(Math.floor(microseconds / 1000));
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

/**
 * Map Trade Server order type to TradingView format
 * @param type - Trade Server OrderType
 * @returns TradingView order type number (1=Limit, 2=Market, 3=Stop, 4=StopLimit)
 */
export function mapOrderType(type: TradeServerOrderType): number {
    const typeMap: Record<TradeServerOrderType, number> = {
        Limit: 1,
        Market: 2,
        Stop: 3,
        StopLimit: 4,
        CloseBy: 2,
    };
    return typeMap[type] || 1;
}

/**
 * Map TradingView order type to Trade Server format
 * @param type - TradingView order type number
 * @returns Trade Server OrderType
 */
export function unmapOrderType(type: number): TradeServerOrderType {
    const typeMap: Record<number, TradeServerOrderType> = {
        1: 'Limit',
        2: 'Market',
        3: 'Stop',
        4: 'StopLimit',
    };
    return typeMap[type] || 'Limit';
}

/**
 * Map Trade Server order status to TradingView format
 * @param status - Trade Server OrderStatus
 * @returns TradingView status number (1=Canceled, 2=Filled, 3=Inactive, 4=Placing, 5=Rejected, 6=Working)
 */
export function mapOrderStatus(status: OrderStatus): number {
    const statusMap: Record<OrderStatus, number> = {
        Inactive: 3,
        Working: 6,
        PartiallyFilled: 6,
        Filled: 2,
        Rejected: 5,
        Cancelled: 1,
        Expired: 1,
    };
    return statusMap[status] || 3;
}

/**
 * Map Trade Server time in force to TradingView format
 * @param tif - Trade Server TimeInForce
 * @returns TradingView duration object
 */
export function mapTimeInForce(tif: TimeInForce, tt?: number): { type: string; datetime?: number } {
    const tifMap: Record<TimeInForce, { type: string }> = {
        GTC: { type: 'gtc' },
        Day: { type: 'day' },
        IOC: { type: 'ioc' },
        FOK: { type: 'fok' },
        GTD: { type: 'gtd' },
        Ms: { type: 'gtc' },
    };
    const result: { type: string; datetime?: number } = tifMap[tif] || { type: 'gtc' };
    if (tif === 'GTD' && tt) {
        // API tt is microseconds, TradingView datetime is milliseconds
        result.datetime = Math.floor(tt / 1000);
    }
    return result;
}

/**
 * Map TradingView time in force to Trade Server format
 * @param duration - TradingView duration object
 * @returns Trade Server TimeInForce
 */
export function unmapTimeInForce(duration?: { type: string }): TimeInForce {
    if (!duration) return 'IOC'; // Default to IOC if not provided

    const tifMap: Record<string, TimeInForce> = {
        gtc: 'GTC',
        day: 'Day',
        ioc: 'IOC',
        fok: 'FOK',
        gtd: 'GTD',
    };
    return tifMap[duration.type] || 'GTC';
}

function isPositionBracketOrderType(type: TradeServerOrderType): boolean {
    return type === 'Stop' || type === 'StopLimit' || type === 'Limit';
}

function isStopBracketOrderType(type: TradeServerOrderType): boolean {
    return type === 'Stop' || type === 'StopLimit';
}

function positionHasStopBracket(orders: TradeServerOrder[], positionId: number): boolean {
    return orders.some((order) => order.ppi === positionId && isStopBracketOrderType(order.t));
}

function positionHasTakeProfitBracket(orders: TradeServerOrder[], positionId: number): boolean {
    return orders.some((order) => order.ppi === positionId && order.t === 'Limit');
}

function buildSyntheticStopOrder(
    position: TradeServerPosition,
    oppositeSide: 'buy' | 'sell'
): TradeServerOrder {
    return {
        id: -(position.id * 10 + 1),
        s: position.s,
        q: position.q,
        S: oppositeSide,
        t: 'Stop',
        sp: position.sl,
        ppi: position.id,
        tif: 'GTC',
        st: 'Working',
        C: position.C,
        M: position.M,
    };
}

function buildSyntheticTakeProfitOrder(
    position: TradeServerPosition,
    oppositeSide: 'buy' | 'sell'
): TradeServerOrder {
    return {
        id: -(position.id * 10 + 2),
        s: position.s,
        q: position.q,
        S: oppositeSide,
        t: 'Limit',
        lp: position.tp,
        ppi: position.id,
        tif: 'GTC',
        st: 'Working',
        C: position.C,
        M: position.M,
    };
}

/**
 * Link bracket orders to open positions and synthesize missing SL/TP orders.
 *
 * Trade Server may store SL/TP on the position while bracket orders still reference
 * the entry order (`poi`) instead of the position (`ppi`). TradingView only shows
 * position bracket lines when orders have parentId = position id and parentType = Position.
 */
export function enrichPositionBracketOrders(
    orders: TradeServerOrder[],
    positions: TradeServerPosition[]
): TradeServerOrder[] {
    const positionByCreatingOrderId = new Map(positions.map((position) => [position.Ci, position]));

    const enriched = orders.map((order) => {
        if (order.ppi !== undefined || order.poi === undefined || !isPositionBracketOrderType(order.t)) {
            return order;
        }

        const position = positionByCreatingOrderId.get(order.poi);
        if (!position) {
            return order;
        }

        return { ...order, ppi: position.id };
    });

    const result = [...enriched];

    for (const position of positions) {
        const oppositeSide: 'buy' | 'sell' = position.S === 'buy' ? 'sell' : 'buy';

        if (position.sl !== undefined && !positionHasStopBracket(result, position.id)) {
            result.push(buildSyntheticStopOrder(position, oppositeSide));
        }
        if (position.tp !== undefined && !positionHasTakeProfitBracket(result, position.id)) {
            result.push(buildSyntheticTakeProfitOrder(position, oppositeSide));
        }
    }

    return result;
}

/**
 * TradingView's order edit header formats the "@ price" segment as
 * `price || avgPrice || limitPrice` and does not fall back to `stopPrice`.
 * Mirror the stop trigger into `avgPrice` for unfilled stop orders.
 */
function resolveTradingViewAvgPrice(
    order: TradeServerOrder,
    orderType: TradingViewOrderType
): number | undefined {
    if (order.ap !== undefined) {
        return order.ap;
    }

    if (orderType === TradingViewOrderType.Stop && order.sp !== undefined) {
        return order.sp;
    }

    return undefined;
}

/**
 * Transform Trade Server orders to TradingView format
 * @param orders - Array of Trade Server orders
 * @returns Array of TradingView Order objects
 */
export function transformOrders(orders: TradeServerOrder[]): Order[] {
    return orders.map((order) => {
        const parent =
            order.ppi !== undefined
                ? { parentId: order.ppi.toString(), parentType: ParentType.Position as number }
                : order.poi !== undefined
                  ? { parentId: order.poi.toString(), parentType: ParentType.Order as number }
                  : {};

        const orderType = mapOrderType(order.t) as TradingViewOrderType;
        const avgPrice = resolveTradingViewAvgPrice(order, orderType);

        return {
            id: order.id.toString(),
            symbol: order.s,
            brokerSymbol: order.s,
            type: orderType,
            side: order.S === 'buy' ? Side.Buy : Side.Sell,
            qty: order.q,
            status: mapOrderStatus(order.st),
            limitPrice: order.lp,
            stopPrice: order.sp,
            ...(avgPrice !== undefined && { avgPrice }),
            filledQty: order.fq || 0,
            ...parent,
            parentOrderId: order.poi?.toString() ?? '',
            parentPositionId: order.ppi?.toString() ?? '',
            duration: mapTimeInForce(order.tif, order.tt),
            time: formatTimestamp(order.C),
        };
    });
}

/**
 * Transform Trade Server positions to TradingView format
 * @param positions - Array of Trade Server positions
 * @returns Array of TradingView Position objects
 */
export function transformPositions(positions: TradeServerPosition[]): Position[] {
    return positions.map((position) => ({
        id: position.id.toString(),
        symbol: position.s,
        brokerSymbol: position.s,
        qty: position.q,
        side: position.S === 'buy' ? Side.Buy : Side.Sell,
        avgPrice: position.p,
        pl: position.pl,
        swap: position.sw,
        commission: position.c,
        ...(position.sl !== undefined && { stopLoss: position.sl }),
        ...(position.tp !== undefined && { takeProfit: position.tp }),
        time: formatTimestamp(position.C),
    }));
}

/**
 * Transform Trade Server trades to Account Manager trade history rows
 * @param trades - Array of Trade Server trades
 * @returns Array of trade history table row objects
 */
export function transformTradeHistory(trades: TradeServerTrade[]) {
    return trades.map((trade) => ({
        id: trade.id.toString(),
        tradeId: trade.id,
        symbol: trade.s,
        side: trade.S === 'buy' ? Side.Buy : Side.Sell,
        qty: trade.q,
        avgPrice: trade.p,
        pl: trade.pl,
        swap: trade.sw,
        commission: trade.c,
        time: formatTimestamp(trade.t),
        orderId: trade.oi.toString(),
    }));
}
