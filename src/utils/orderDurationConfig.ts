/**
 * Broker Time in Force (duration) options and preferred defaults per order type.
 * Kept in one place so Order Ticket UI config and persisted defaults stay aligned.
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

/**
 * Duration options for `broker_config.durations`.
 * IOC/FOK are Market-only so switching away from Market drops them and TV picks GTC.
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
        value: 'ioc',
        name: 'IOC',
        description: 'Immediate or Cancel',
        supportedOrderTypes: [OrderType.Market],
    },
    {
        value: 'fok',
        name: 'FOK',
        description: 'Fill or Kill',
        supportedOrderTypes: [OrderType.Market],
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
