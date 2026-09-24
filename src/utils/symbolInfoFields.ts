/**
 * Formatters for the curated symbol fields surfaced in the TradingView
 * Security Info dialog via `additional_symbol_info_fields`.
 */

import type { Symbol } from '../schema/public-api/types.gen';

type FieldValue = string | number | null | undefined;

export function formatOrDash(value: FieldValue): string {
    if (value === undefined || value === null || value === '') {
        return '—';
    }
    return String(value);
}

/**
 * Same as `formatOrDash`, but for fields where the API treats `0` or a missing
 * value as "no cap" (e.g. `max`; see broker-api.ts's `|| 1e12` fallback).
 */
export function formatOrUnlimited(value: FieldValue): string {
    if (value === 0 || value === undefined || value === null) {
        return 'Unlimited';
    }
    return formatOrDash(value);
}

export function formatAllowedOrderTypes(symbol: Symbol): string {
    const types: string[] = [];
    if (symbol.M) types.push('Market');
    if (symbol.L) types.push('Limit');
    if (symbol.S) types.push('Stop');
    if (symbol.SLi) types.push('Stop Limit');
    // Flags are always present; all-false means nothing is allowed, not missing data.
    return types.length > 0 ? types.join(', ') : 'None';
}

export function formatAllowedTimeInForce(symbol: Symbol): string {
    const durations: string[] = [];
    if (symbol.fok) durations.push('FOK');
    if (symbol.ioc) durations.push('IOC');
    if (symbol.gtc) durations.push('GTC');
    if (symbol.gtd) durations.push('GTD');
    if (symbol.day) durations.push('Day');
    if (symbol.ms) durations.push('Valid For Milliseconds');
    return durations.length > 0 ? durations.join(', ') : 'None';
}
