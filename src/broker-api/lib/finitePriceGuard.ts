/**
 * Guards only against non-finite (NaN/Infinity) values. `JSON.stringify(NaN)` serializes to
 * `null`, which this API treats as "clear this field" — so a non-finite price would silently
 * wipe a stop loss/take profit instead of being rejected. Sign/direction/distance-from-market
 * rules are intentionally NOT checked here; that's left to Trade Server's rejection.
 */

export interface OrderPriceFields {
    limitPrice?: number;
    stopPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    guaranteedStop?: number;
    trailingStopPips?: number;
}

const PRICE_FIELD_LABELS: Record<keyof OrderPriceFields, string> = {
    limitPrice: 'Limit price',
    stopPrice: 'Stop price',
    stopLoss: 'Stop loss',
    takeProfit: 'Take profit',
    guaranteedStop: 'Guaranteed stop',
    trailingStopPips: 'Trailing stop pips',
};

/**
 * Returns an error message for the first present field that is not a finite number, or `null` if
 * every present field is finite. Fields that are `undefined` are treated as legitimately omitted
 * (e.g. clearing a bracket) and are not checked.
 */
export function findNonFinitePriceField(fields: OrderPriceFields): string | null {
    for (const field of Object.keys(PRICE_FIELD_LABELS) as (keyof OrderPriceFields)[]) {
        const value = fields[field];
        if (value !== undefined && !Number.isFinite(value)) {
            return `${PRICE_FIELD_LABELS[field]} must be a valid number`;
        }
    }

    return null;
}
