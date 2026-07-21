/**
 * Positive-floor validation for order/bracket price fields.
 *
 * TradingView's Order Ticket only enforces directional checks (e.g. a buy limit must be below
 * ask), mirroring gaps in the shared trade-server validators: several order-type/side/field
 * combinations never enforce a positive floor, and `0` is treated as "no value". This helper
 * closes all of them with a single rule: any provided price field must be a finite number > 0.
 */

export interface OrderPriceFields {
    limitPrice?: number;
    stopPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
}

export interface OrderPriceValidationError {
    field: keyof OrderPriceFields;
    message: string;
}

const FIELD_LABELS: Record<keyof OrderPriceFields, string> = {
    limitPrice: 'Limit price',
    stopPrice: 'Stop price',
    stopLoss: 'Stop loss',
    takeProfit: 'Take profit',
};

/**
 * Returns the first present field that is not a positive finite number, or `null` if every
 * present field is valid. Fields that are `undefined` are treated as legitimately omitted
 * (e.g. clearing a bracket) and are not validated.
 */
export function validateOrderPrices(fields: OrderPriceFields): OrderPriceValidationError | null {
    for (const field of Object.keys(FIELD_LABELS) as (keyof OrderPriceFields)[]) {
        const value = fields[field];
        if (value === undefined) {
            continue;
        }

        if (!Number.isFinite(value) || value <= 0) {
            return { field, message: `${FIELD_LABELS[field]} must be greater than 0` };
        }
    }

    return null;
}
