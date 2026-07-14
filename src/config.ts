/**
 * Configuration for TradingView and Trade Server Integration
 */

import type { AppConfig } from './types/AppConfig';
import type { TradingTerminalWidgetOptions } from '../charting_library/charting_library';
import { ResolutionString } from '../charting_library/datafeed-api';
import { Interval } from './schema/public-api';
import { createLogger } from './utils/logger.js';
import { TradeServerConfig } from './types/TradeServerConfig';

const logger = createLogger({ prefix: '[Config]' });

/**
 * Load user credentials from session storage
 */
function loadUserCredentials(): Omit<TradeServerConfig, 'timeout'> {
    const credsStr = sessionStorage.getItem('userCredentials');
    const apiKey = sessionStorage.getItem('apiKey') || '';
    const signingToken = sessionStorage.getItem('signingToken') || '';

    if (credsStr) {
        try {
            const creds = JSON.parse(credsStr);

            return {
                server: creds.server,
                user: {
                    login: creds.login,
                    password: signingToken, // Use signingToken for HMAC signing (not user's actual password)
                    apiKey: apiKey,
                    signingToken: signingToken,
                },
            };
        } catch (error) {
            logger.error('Failed to load credentials from session storage:', error);
        }
    }

    // Default/fallback configuration
    return {
        server: 'https://tsXXX-uat.yourbourse.trade', // Update with your Trade Server base URL
        user: {
            login: 1,
            password: '',
            apiKey: '',
            signingToken: '',
        },
    };
}

const userCreds = loadUserCredentials();

const CONFIG: AppConfig = {
    // Trade Server API Configuration
    tradeServer: {
        server: userCreds.server,
        user: userCreds.user,
        timeout: 5000,
    },

    // TradingView Configuration
    tradingView: {
        container: 'tradingview_container',
        library_path: './charting_library/',
        locale: 'en',
        disabled_features: [],
        enabled_features: [],
        // Chart storage disabled to avoid CORS issues with saveload.tradingview.com
        fullscreen: false,
        autosize: true,
        theme: 'light',
        debug: true,
        widgetbar: {
            watchlist: true,
            watchlist_settings: {
                default_symbols: [],
            },
        },
    } as Partial<TradingTerminalWidgetOptions>,

    // Market Data Configuration
    marketData: {
        // TradingView resolution format; "1M" here means one month (mapped to API "M" below).
        historyResolutions: ['1', '5', '15', '30', '60', '240', 'D', '1W', '1M'],
    },

    // WebSocket Configuration
    websocket: {
        // Candle interval mapping (TradingView → YourBourse API)
        intervalMapping: {
            '1': '1M',
            '5': '5M',
            '15': '15M',
            '30': '30M',
            '60': '1H',
            '240': '4H',
            D: 'D',
            '1D': 'D',
            W: 'W',
            '1W': 'W',
            M: 'M',
            // TradingView "1M" is one month; API "1M" is one minute — must map explicitly
            '1M': 'M',
        } as Record<ResolutionString, Interval>,
        // Auto-subscribe to channels on connection
        autoSubscribe: {
            orders: true,
            positions: true,
            balances: false,
            accountStates: true,
            trades: false,
        },
        // Reconnection settings
        reconnect: {
            enabled: true,
            delay: 5000, // 5 seconds
            maxAttempts: 10,
        },
    },
};

export default CONFIG;

export const POPULAR_SYMBOLS: readonly string[] = [
    'EURUSD',
    'USDJPY',
    'GBPUSD',
    'USDCHF',
    'AUDUSD',
    'USDCAD',
    'NZDUSD',
];
