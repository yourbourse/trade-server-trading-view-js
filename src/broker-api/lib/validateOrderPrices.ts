/**
 * Guards against non-finite (NaN/Infinity) order/bracket price fields before they're serialized.
 *
 * All real business-rule enforcement (direction vs. bid/ask, sign, distance-from-market) is left
 * entirely to Trade Server's rejection plus the existing error-surfacing pipeline
 * (src/utils/apiError.ts's extractErrorMessage -> handleMutationError -> notificationService),
 * the same pattern already used for quantity/decimal-precision/stops-level checks, which have
 * never been duplicated client-side. Duplicating Trade Server's directional rules here risks
 * exactly the kind of mismatch this ticket exists to fix.
 *
 * This check exists only because a non-finite number silently serializes to JSON `null`
 * (`JSON.stringify(NaN) === 'null'`), and this API already treats `null` as "field not provided /
 * clear this field" rather than an error — the one failure mode "let the server reject it" can't
 * catch, since the server never receives evidence anything was wrong.
 */

export interface OrderPriceFields {
    limitPrice?: number;
    stopPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
}

const PRICE_FIELD_LABELS: Record<keyof OrderPriceFields, string> = {
    limitPrice: 'Limit price',
    stopPrice: 'Stop price',
    stopLoss: 'Stop loss',
    takeProfit: 'Take profit',
};

/**
 * Returns an error message for the first present field that is not a finite number, or `null` if
 * every present field is valid. Fields that are `undefined` are treated as legitimately omitted
 * (e.g. clearing a bracket) and are not validated.
 */
export function validateOrderPrices(fields: OrderPriceFields): string | null {
    for (const field of Object.keys(PRICE_FIELD_LABELS) as (keyof OrderPriceFields)[]) {
        const value = fields[field];
        if (value !== undefined && !Number.isFinite(value)) {
            return `${PRICE_FIELD_LABELS[field]} must be a valid number`;
        }
    }

    return null;
}
