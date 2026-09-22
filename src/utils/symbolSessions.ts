/**
 * Converts Trade Server trading-session entries into a TradingView session string
 * (e.g. "0900-1700:23456"). See:
 * https://www.tradingview.com/charting-library-docs/latest/connecting_data/time-and-sessions/Trading-Sessions
 */

import type { Session } from '../schema/public-api/types.gen';

const DAY_NUMBERS: Record<Session['d'], number> = {
    Sun: 1,
    Mon: 2,
    Tue: 3,
    Wed: 4,
    Thu: 5,
    Fri: 6,
    Sat: 7,
};

function toTradingViewTime(time: string): string {
    // Strip all colons in case the source time includes seconds (HH:MM:SS).
    return time.replace(/:/g, '').slice(0, 4).padStart(4, '0');
}

export function buildSessionString(sessions: Session[] | undefined): string {
    if (!sessions || sessions.length === 0) {
        return '—';
    }

    const rangesByDay = new Map<number, string[]>();
    for (const { d, s, e } of sessions) {
        const day = DAY_NUMBERS[d];
        const range = `${toTradingViewTime(s)}-${toTradingViewTime(e)}`;
        const ranges = rangesByDay.get(day);
        if (ranges) {
            ranges.push(range);
        } else {
            rangesByDay.set(day, [range]);
        }
    }

    // Group days that share the exact same set of time ranges into one segment,
    // so e.g. Mon-Fri with identical hours collapse to a single "HHMM-HHMM:23456" chunk.
    const daysByRangesKey = new Map<string, number[]>();
    for (const [day, ranges] of rangesByDay) {
        const key = ranges.join(',');
        const days = daysByRangesKey.get(key);
        if (days) {
            days.push(day);
        } else {
            daysByRangesKey.set(key, [day]);
        }
    }

    return Array.from(daysByRangesKey.entries())
        .map(([rangesKey, days]) => `${rangesKey}:${days.sort((a, b) => a - b).join('')}`)
        .join('|');
}
