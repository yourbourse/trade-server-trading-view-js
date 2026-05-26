/**
 * TradingView persists the last selected order type per symbol in broker trading settings.
 * These helpers reset that preference so the order ticket opens with Market selected.
 */

import type { IBrokerConnectionAdapterHost } from '../../charting_library/charting_library';

import { OrderType } from '../broker-api/types.js';

const BROKER_TRADING_SETTINGS_KEY = 'trading.Broker';

interface TradingSettingsStorage {
    setOrderType(symbol: string, type: number): void;
}

interface TradingHostWithSettings {
    getBrokerTradingSettingsStorage?: () => TradingSettingsStorage | null;
}

type BrokerAdapterHost = IBrokerConnectionAdapterHost & {
    _trading?: TradingHostWithSettings;
};

interface TradingBrokerSettings {
    orderType?: Record<string, number>;
    [key: string]: unknown;
}

interface TvSettingsApi {
    getJSON: (key: string, defaultValue: unknown) => unknown;
    setJSON: (key: string, value: unknown) => void;
}

function getTvSettings(): TvSettingsApi | undefined {
    return (window as unknown as { TVSettings?: TvSettingsApi }).TVSettings;
}

function applyViaTvSettings(symbol: string): void {
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

    applyViaTvSettings(symbol);
}
