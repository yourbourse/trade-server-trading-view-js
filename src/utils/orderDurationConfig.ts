/**
 * Broker Time in Force (duration) options and preferred defaults per order type.
 * Kept in one place so Order Ticket UI config and persisted defaults stay aligned.
 *
 * TradingView keeps the current TIF when switching order types if that TIF value is
 * still in the new type's supported list. Market and resting orders therefore use
 * distinct IOC/FOK duration values so Market → Limit/Stop/StopLimit falls back to GTC,
 * while IOC/FOK remain manually selectable on resting orders.
 */

import type { OrderDurationMetaInfo } from '../../charting_library/charting_library';

import { OrderType } from '../broker-api/types.js';

/** Preferred TIF by order type: Market → IOC, resting orders → GTC. */
export const PREFERRED_DURATION_BY_ORDER_TYPE: Readonly<Record<OrderType, string>> = {
    [OrderType.Market]: 'ioc',
    [OrderType.Limit]: 'gtc',
    [OrderType.Stop]: 'gtc',
    [OrderType.StopLimit]: 'gtc',
};

const RESTING_ORDER_TYPES = [OrderType.Limit, OrderType.Stop, OrderType.StopLimit] as const;

/** Duration value used for IOC on Market orders. */
export const DURATION_IOC_MARKET = 'ioc';
/** Duration value used for IOC on Limit/Stop/StopLimit (distinct so Market→resting resets to GTC). */
export const DURATION_IOC_RESTING = 'ioc-resting';
/** Duration value used for FOK on Market orders. */
export const DURATION_FOK_MARKET = 'fok';
/** Duration value used for FOK on Limit/Stop/StopLimit. */
export const DURATION_FOK_RESTING = 'fok-resting';

/**
 * Duration options for `broker_config.durations`.
 * Preferred defaults stay Market → IOC and Limit/Stop/StopLimit → GTC
 * (`PREFERRED_DURATION_BY_ORDER_TYPE`); IOC/FOK are selectable on resting orders
 * via distinct duration values.
 */
export const BROKER_ORDER_DURATIONS: OrderDurationMetaInfo[] = [
    {
        value: 'day',
        name: 'DAY',
        description: 'Day Order',
        supportedOrderTypes: [...RESTING_ORDER_TYPES],
    },
    {
        value: 'gtc',
        name: 'GTC',
        description: 'Good Till Cancelled',
        default: true,
        supportedOrderTypes: [...RESTING_ORDER_TYPES],
    },
    {
        value: DURATION_IOC_MARKET,
        name: 'IOC',
        description: 'Immediate or Cancel',
        supportedOrderTypes: [OrderType.Market],
    },
    {
        value: DURATION_FOK_MARKET,
        name: 'FOK',
        description: 'Fill or Kill',
        supportedOrderTypes: [OrderType.Market],
    },
    {
        value: DURATION_IOC_RESTING,
        name: 'IOC',
        description: 'Immediate or Cancel',
        supportedOrderTypes: [...RESTING_ORDER_TYPES],
    },
    {
        value: DURATION_FOK_RESTING,
        name: 'FOK',
        description: 'Fill or Kill',
        supportedOrderTypes: [...RESTING_ORDER_TYPES],
    },
    {
        value: 'gtd',
        name: 'GTD',
        hasDatePicker: true,
        hasTimePicker: true,
        supportedOrderTypes: [...RESTING_ORDER_TYPES],
    },
] as OrderDurationMetaInfo[];

/** Duration values in broker_config display order (used as fallback pool). */
export const DURATION_FALLBACK_ORDER: readonly string[] = BROKER_ORDER_DURATIONS.map((d) => d.value);

const SUPPORTED_ORDER_TYPES_BY_DURATION: ReadonlyMap<string, readonly OrderType[]> = new Map(
    BROKER_ORDER_DURATIONS.map((d) => [
        d.value,
        d.supportedOrderTypes ?? [...RESTING_ORDER_TYPES],
    ])
);

export function isDurationCompatibleWithOrderType(duration: string, orderType: OrderType): boolean {
    const supported = SUPPORTED_ORDER_TYPES_BY_DURATION.get(duration);
    if (!supported) {
        // Unknown duration from symbol config — allow and let TV filter.
        return true;
    }
    return supported.includes(orderType);
}

/** Expand symbol-allowed TIF flags to include resting IOC/FOK duration aliases. */
export function expandAllowedDurations(allowedDurations: string[]): string[] {
    const expanded = new Set(allowedDurations);
    if (expanded.has(DURATION_IOC_MARKET)) {
        expanded.add(DURATION_IOC_RESTING);
    }
    if (expanded.has(DURATION_FOK_MARKET)) {
        expanded.add(DURATION_FOK_RESTING);
    }
    return [...expanded];
}
