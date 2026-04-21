/**
 * Type mapping utilities for converting between Trade Server and TradingView formats
 */

import type { Order, Position } from '../../charting_library/charting_library';
import { Side } from './types';
import type {
    Order as TradeServerOrder,
    OrderStatus,
    OrderType,
    Position as TradeServerPosition,
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
export function mapOrderType(type: OrderType): number {
    const typeMap: Record<OrderType, number> = {
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
export function unmapOrderType(type: number): OrderType {
    const typeMap: Record<number, OrderType> = {
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
export function mapTimeInForce(tif: TimeInForce): { type: string } {
    const tifMap: Record<TimeInForce, { type: string }> = {
        GTC: { type: 'gtc' },
        Day: { type: 'day' },
        IOC: { type: 'ioc' },
        FOK: { type: 'fok' },
        GTD: { type: 'gtd' },
        Ms: { type: 'gtc' },
    };
    return tifMap[tif] || { type: 'gtc' };
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

/**
 * Transform Trade Server orders to TradingView format
 * @param orders - Array of Trade Server orders
 * @returns Array of TradingView Order objects
 */
export function transformOrders(orders: TradeServerOrder[]): Order[] {
    return orders.map((order) => ({
        id: order.id.toString(),
        symbol: order.s,
        brokerSymbol: order.s,
        type: mapOrderType(order.t),
        side: order.S === 'buy' ? Side.Buy : Side.Sell,
        qty: order.q,
        status: mapOrderStatus(order.st),
        limitPrice: order.lp,
        stopPrice: order.sp,
        avg: order.ap || 0,
        filledQty: order.fq || 0,
        parentId: order.poi,
        duration: mapTimeInForce(order.tif),
        time: formatTimestamp(order.C),
    }));
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
        ...(position.sl !== undefined && { stopLoss: position.sl }),
        ...(position.tp !== undefined && { takeProfit: position.tp }),
        time: formatTimestamp(position.C),
    }));
}
