/**
 * Mirrors Trade Server's directional order-price validation (`validateOrderForm` in
 * `trade-server/packages/orders/src/lib/validateOrderForm/`) so TradingView accepts exactly the
 * prices Trade Server would accept — including negative and zero prices, which Trade Server allows
 * for specific field/side/order-type combinations.
 *
 * Every check below is a "reject if" condition against a single reference price (ask, bid, the
 * order's own stop/limit price, or nothing at all for StopLimit's limit price). A price of exactly
 * `0` always passes every check, matching Trade Server's `if (price && ...)` guards which treat `0`
 * as "not provided".
 */

import { OrderType, Side } from '../types';

export interface OrderPriceFields {
    side: Side;
    orderType: OrderType;
    limitPrice?: number;
    stopPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    askPrice?: number;
    bidPrice?: number;
}

type Condition = (price: number, threshold: number) => boolean;

function rejectedBy(
    price: number,
    side: Side,
    threshold: number | undefined,
    buyCondition: Condition,
    sellCondition: Condition
): boolean {
    if (price === 0 || threshold === undefined) {
        return false;
    }

    return side === Side.Buy ? buyCondition(price, threshold) : sellCondition(price, threshold);
}

function validateLimitPrice(
    price: number,
    side: Side,
    orderType: OrderType,
    askPrice?: number,
    bidPrice?: number
): string | null {
    // Trade Server skips the directional check entirely for StopLimit orders.
    if (orderType === OrderType.StopLimit) {
        return null;
    }

    const rejected = rejectedBy(
        price,
        side,
        side === Side.Buy ? askPrice : bidPrice,
        (p, ask) => p >= ask,
        (p, bid) => p <= bid
    );
    if (!rejected) {
        return null;
    }

    return side === Side.Buy
        ? 'Limit price must be less than the ask price'
        : 'Limit price must be greater than the bid price';
}

function validateStopPrice(price: number, side: Side, askPrice?: number, bidPrice?: number): string | null {
    const rejected = rejectedBy(
        price,
        side,
        side === Side.Buy ? askPrice : bidPrice,
        (p, ask) => p <= ask,
        (p, bid) => p >= bid
    );
    if (!rejected) {
        return null;
    }

    return side === Side.Buy
        ? 'Stop price must be greater than the ask price'
        : 'Stop price must be less than the bid price';
}

interface BracketReferencePrices {
    stopPrice?: number;
    limitPrice?: number;
    askPrice?: number;
    bidPrice?: number;
}

function validateStopLoss(
    price: number,
    side: Side,
    orderType: OrderType,
    { stopPrice, limitPrice, askPrice, bidPrice }: BracketReferencePrices
): string | null {
    if (orderType !== OrderType.StopLimit && stopPrice) {
        if (
            rejectedBy(
                price,
                side,
                stopPrice,
                (p, t) => p >= t,
                (p, t) => p <= t
            )
        ) {
            return side === Side.Buy
                ? 'Stop loss must be less than the stop price'
                : 'Stop loss must be greater than the stop price';
        }
    }

    if (limitPrice) {
        if (
            rejectedBy(
                price,
                side,
                limitPrice,
                (p, t) => p >= t,
                (p, t) => p <= t
            )
        ) {
            return side === Side.Buy
                ? 'Stop loss must be less than the limit price'
                : 'Stop loss must be greater than the limit price';
        }
    }

    // Trade Server only checks stop loss against the live market when the order is a Market
    // order (i.e. brackets attached directly to an open position).
    if (orderType === OrderType.Market) {
        const threshold = side === Side.Buy ? bidPrice : askPrice;
        if (
            rejectedBy(
                price,
                side,
                threshold,
                (p, t) => p >= t,
                (p, t) => p <= t
            )
        ) {
            return side === Side.Buy
                ? 'Stop loss must be less than the bid price'
                : 'Stop loss must be greater than the ask price';
        }
    }

    return null;
}

function validateTakeProfit(
    price: number,
    side: Side,
    orderType: OrderType,
    { stopPrice, limitPrice, askPrice, bidPrice }: BracketReferencePrices
): string | null {
    if (orderType !== OrderType.StopLimit && stopPrice) {
        if (
            rejectedBy(
                price,
                side,
                stopPrice,
                (p, t) => p <= t,
                (p, t) => p >= t
            )
        ) {
            return side === Side.Buy
                ? 'Take profit must be greater than the stop price'
                : 'Take profit must be less than the stop price';
        }
    }

    if (limitPrice) {
        if (
            rejectedBy(
                price,
                side,
                limitPrice,
                (p, t) => p <= t,
                (p, t) => p >= t
            )
        ) {
            return side === Side.Buy
                ? 'Take profit must be greater than the limit price'
                : 'Take profit must be less than the limit price';
        }
    }

    if (orderType === OrderType.Market) {
        const threshold = side === Side.Buy ? bidPrice : askPrice;
        if (
            rejectedBy(
                price,
                side,
                threshold,
                (p, t) => p <= t,
                (p, t) => p >= t
            )
        ) {
            return side === Side.Buy
                ? 'Take profit must be greater than the bid price'
                : 'Take profit must be less than the ask price';
        }
    }

    return null;
}

const PRICE_FIELD_LABELS = {
    limitPrice: 'Limit price',
    stopPrice: 'Stop price',
    stopLoss: 'Stop loss',
    takeProfit: 'Take profit',
} as const;

type PriceField = keyof typeof PRICE_FIELD_LABELS;

/**
 * Returns an error message for the first present field that violates Trade Server's directional
 * rules, or `null` if every present field is valid. Fields that are `undefined` are treated as
 * legitimately omitted (e.g. clearing a bracket) and are not validated.
 */
export function validateOrderPrices(fields: OrderPriceFields): string | null {
    const { side, orderType, limitPrice, stopPrice, stopLoss, takeProfit, askPrice, bidPrice } = fields;

    for (const field of Object.keys(PRICE_FIELD_LABELS) as PriceField[]) {
        const value = fields[field];
        if (value !== undefined && !Number.isFinite(value)) {
            return `${PRICE_FIELD_LABELS[field]} must be a valid number`;
        }
    }

    if (limitPrice !== undefined) {
        const error = validateLimitPrice(limitPrice, side, orderType, askPrice, bidPrice);
        if (error) {
            return error;
        }
    }

    if (stopPrice !== undefined) {
        const error = validateStopPrice(stopPrice, side, askPrice, bidPrice);
        if (error) {
            return error;
        }
    }

    if (stopLoss !== undefined) {
        const error = validateStopLoss(stopLoss, side, orderType, { stopPrice, limitPrice, askPrice, bidPrice });
        if (error) {
            return error;
        }
    }

    if (takeProfit !== undefined) {
        const error = validateTakeProfit(takeProfit, side, orderType, { stopPrice, limitPrice, askPrice, bidPrice });
        if (error) {
            return error;
        }
    }

    return null;
}
