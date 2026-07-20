/**
 * TradingView persists the last selected order type and duration (TIF) per symbol
 * in broker trading settings. These helpers reset those preferences so the order
 * ticket opens with Market + the preferred Time in Force for that order type.
 */

import type { IBrokerConnectionAdapterHost } from '../../charting_library/charting_library';

import { OrderType } from '../broker-api/types.js';
import {
    DURATION_FALLBACK_ORDER,
    isDurationCompatibleWithOrderType,
    PREFERRED_DURATION_BY_ORDER_TYPE,
} from './orderDurationConfig.js';

const BROKER_TRADING_SETTINGS_KEY = 'trading.Broker';

interface OrderDurationValue {
    type: string;
    datetime?: number;
}

interface TradingSettingsStorage {
    setOrderType(symbol: string, type: number): void;
    setDuration?(symbol: string, orderType: number, duration: OrderDurationValue | null): void;
}

interface TradingHostWithSettings {
    getBrokerTradingSettingsStorage?: () => TradingSettingsStorage | null;
}

type BrokerAdapterHost = IBrokerConnectionAdapterHost & {
    _trading?: TradingHostWithSettings;
};

interface TradingBrokerSettings {
    orderType?: Record<string, number>;
    duration?: Record<string, Record<string, OrderDurationValue>>;
    [key: string]: unknown;
}

interface TvSettingsApi {
    getJSON: (key: string, defaultValue: unknown) => unknown;
    setJSON: (key: string, value: unknown) => void;
}

function getTvSettings(): TvSettingsApi | undefined {
    return (window as unknown as { TVSettings?: TvSettingsApi }).TVSettings;
}

/**
 * Pick preferred duration if allowed and compatible with the order type;
 * otherwise the first compatible value from `allowedDurations` (or broker config order).
 */
export function pickDefaultDuration(
    preferred: string,
    allowedDurations: string[] | undefined,
    orderType: OrderType
): string | null {
    const pool =
        allowedDurations && allowedDurations.length > 0
            ? allowedDurations
            : [...DURATION_FALLBACK_ORDER];

    const compatible = pool.filter((d) => isDurationCompatibleWithOrderType(d, orderType));

    if (compatible.length === 0) {
        return null;
    }

    if (compatible.includes(preferred)) {
        return preferred;
    }

    return compatible[0] ?? null;
}

function applyOrderTypeViaTvSettings(symbol: string): void {
    const tvSettings = getTvSettings();
    if (!tvSettings) {
        return;
    }

    const settings = tvSettings.getJSON(BROKER_TRADING_SETTINGS_KEY, {}) as TradingBrokerSettings;
    if (settings.orderType?.[symbol] === OrderType.Market) {
        return;
    }

    settings.orderType = { ...settings.orderType, [symbol]: OrderType.Market };
    tvSettings.setJSON(BROKER_TRADING_SETTINGS_KEY, settings);
}

function applyDurationsViaTvSettings(
    symbol: string,
    durationsByOrderType: Partial<Record<number, string>>
): void {
    const tvSettings = getTvSettings();
    if (!tvSettings) {
        return;
    }

    const settings = tvSettings.getJSON(BROKER_TRADING_SETTINGS_KEY, {}) as TradingBrokerSettings;
    const existingForSymbol = settings.duration?.[symbol] ?? {};
    const nextForSymbol: Record<string, OrderDurationValue> = { ...existingForSymbol };
    let changed = false;

    for (const [orderTypeKey, durationType] of Object.entries(durationsByOrderType)) {
        if (!durationType) {
            continue;
        }
        const current = nextForSymbol[orderTypeKey];
        if (current?.type === durationType && current.datetime === undefined) {
            continue;
        }
        nextForSymbol[orderTypeKey] = { type: durationType };
        changed = true;
    }

    if (!changed) {
        return;
    }

    settings.duration = { ...settings.duration, [symbol]: nextForSymbol };
    tvSettings.setJSON(BROKER_TRADING_SETTINGS_KEY, settings);
}

/**
 * Set the saved order type for a symbol to Market so the order ticket defaults to Market.
 */
export function applyMarketOrderTypeDefault(symbol: string, host?: IBrokerConnectionAdapterHost): void {
    if (!symbol) {
        return;
    }

    const storage = (host as BrokerAdapterHost | undefined)?._trading?.getBrokerTradingSettingsStorage?.();
    if (storage) {
        storage.setOrderType(symbol, OrderType.Market);
        return;
    }

    applyOrderTypeViaTvSettings(symbol);
}

/**
 * Set saved Time in Force per order type for a symbol.
 * Market → IOC (or next allowed Market-compatible value);
 * Limit/Stop/StopLimit → GTC (or next allowed resting-order value).
 */
export function applyDurationDefaults(
    symbol: string,
    allowedDurations: string[] | undefined,
    host?: IBrokerConnectionAdapterHost
): void {
    if (!symbol) {
        return;
    }

    const durationsByOrderType: Partial<Record<number, string>> = {};
    for (const [orderTypeKey, preferred] of Object.entries(PREFERRED_DURATION_BY_ORDER_TYPE)) {
        const orderType = Number(orderTypeKey) as OrderType;
        const picked = pickDefaultDuration(preferred, allowedDurations, orderType);
        if (picked) {
            durationsByOrderType[orderType] = picked;
        }
    }

    if (Object.keys(durationsByOrderType).length === 0) {
        return;
    }

    const storage = (host as BrokerAdapterHost | undefined)?._trading?.getBrokerTradingSettingsStorage?.();
    if (storage?.setDuration) {
        for (const [orderTypeKey, durationType] of Object.entries(durationsByOrderType)) {
            if (!durationType) {
                continue;
            }
            storage.setDuration(symbol, Number(orderTypeKey), { type: durationType });
        }
        return;
    }

    applyDurationsViaTvSettings(symbol, durationsByOrderType);
}
