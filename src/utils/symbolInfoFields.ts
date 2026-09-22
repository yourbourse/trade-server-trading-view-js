/**
 * Formatters for the curated symbol fields surfaced in the TradingView
 * Security Info dialog via `additional_symbol_info_fields`.
 */

import type { Symbol } from '../schema/public-api/types.gen';

export function formatOrDash(value: unknown): string {
    if (value === undefined || value === null || value === '') {
        return '—';
    }
    return String(value);
}

export function formatAllowedOrderTypes(symbol: Symbol): string {
    const types: string[] = [];
    if (symbol.M) types.push('Market');
    if (symbol.L) types.push('Limit');
    if (symbol.S) types.push('Stop');
    if (symbol.SLi) types.push('Stop Limit');
    return types.length > 0 ? types.join(', ') : '—';
}

export function formatAllowedTimeInForce(symbol: Symbol): string {
    const durations: string[] = [];
    if (symbol.fok) durations.push('FOK');
    if (symbol.ioc) durations.push('IOC');
    if (symbol.gtc) durations.push('GTC');
    if (symbol.gtd) durations.push('GTD');
    if (symbol.day) durations.push('Day');
    if (symbol.ms) durations.push('Valid For Milliseconds');
    return durations.length > 0 ? durations.join(', ') : '—';
}
