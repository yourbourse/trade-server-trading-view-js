/**
 * Main Application Entry Point
 * Initializes TradingView widget with custom datafeed and broker API
 */

//import { IBrokerConnectionAdapterHost } from 'charting_library/broker-api';
import {
    ResolutionString,
    IBrokerConnectionAdapterHost,
    IBrokerTerminal,
    IChartingLibraryWidget,
} from 'charting_library/charting_library.js';
import type {
    BrokerConfigFlags,
    TradingTerminalWidgetOptions,
} from 'charting_library/charting_library.js';

import CONFIG, { POPULAR_SYMBOLS } from './config.js';
import Datafeed from './datafeed/datafeed.js';
import { TradeServerClient } from './trade-server-api/TradeServerClient.js';
// Removed adapter - using TradeServerClient directly
import { BrokerApi } from './broker-api/broker-api.js';
import { isAuthenticated, signOut, getUserCredentials, persistApiToken, clearStoredTokens } from './utils/auth.js';
import { displayVersion, logLibraryVersion } from './utils/version.js';
import { createLogger } from './utils/logger.js';
import { BROKER_ORDER_DURATIONS } from './utils/orderDurationConfig.js';
import { initConnectionIndicator } from './ui/connectionIndicator.js';

const logger = createLogger({ prefix: '[App]' });

/**
 * Check if we're on the signin page
 */
function isOnSignInPage(): boolean {
    const path = window.location.pathname;
    logger.debug('Checking if on signin page, path:', path);
    // Check for signin in the path (works for /signin, /signin.html, /some/path/signin.html, etc.)
    const onSignin = path.includes('/signin');
    logger.debug('On signin page:', onSignin);
    return onSignin;
}

/**
 * Redirect to sign-in page
 */
function redirectToSignIn(): void {
    logger.debug('redirectToSignIn() called');
    // Avoid redirect loop - only redirect if not already on signin page
    if (isOnSignInPage()) {
        logger.debug('Already on signin page, not redirecting');
        return;
    }

    logger.info('Initiating redirect to /signin.html');
    // Use replace instead of href to avoid back button issues
    window.location.replace('/signin.html');
}

/**
 * Initialize UI components (logout button, user info)
 */
async function initUI(): Promise<void> {
    logLibraryVersion();
    await displayVersion('app-version');

    // Wire up logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to sign out?')) {
                signOut();
            }
        });
    }

    // Display user login
    const userLoginElement = document.getElementById('user-login');
    const creds = getUserCredentials();
    if (userLoginElement && creds) {
        userLoginElement.textContent = `Account: ${creds.user.login}`;
    }
}

class TradingApp {
    tradeServerClient: TradeServerClient | null;
    datafeed: Datafeed | null;
    widget: IChartingLibraryWidget | null;
    brokerAPI: BrokerApi | null;
    private autoSaveHandler: (() => void) | null = null;
    private symbolChangedHandler: (() => void) | null = null;
    private disposeConnectionIndicator: (() => void) | null = null;

    constructor() {
        this.tradeServerClient = null;
        this.datafeed = null;
        this.widget = null;
        this.brokerAPI = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            logger.info('Initializing Trading Application...');

            // Validate we have credentials
            if (!CONFIG.tradeServer.user.login || !CONFIG.tradeServer.user.password) {
                throw new Error('Missing credentials');
            }

            // Initialize Trade Server Client
            this.tradeServerClient = new TradeServerClient(CONFIG);

            // Only authenticate if we don't have tokens from signin
            // (signin.html already authenticated and saved tokens)
            const hasTokens = CONFIG.tradeServer.user.apiKey || CONFIG.tradeServer.user.signingToken;
            if (!hasTokens) {
                logger.info('No tokens found, authenticating...');
                await this.authenticate(CONFIG.tradeServer.user.login);
            } else {
                logger.info('Using existing tokens from signin');
            }

            // Connect WebSocket for real-time updates (auto-subscribes to configured channels)
            await this.tradeServerClient.connect();
            this.disposeConnectionIndicator = initConnectionIndicator(this.tradeServerClient);

            // Initialize Datafeed (now includes both chart and quotes API)
            this.datafeed = new Datafeed(this.tradeServerClient);

            const storageKey = `tvChartState:${CONFIG.tradeServer.user.login}:${encodeURIComponent(CONFIG.tradeServer.server)}`;
            let savedData: object | null = null;
            try {
                const raw = localStorage.getItem(storageKey);
                if (raw) {
                    const parsed: unknown = JSON.parse(raw);
                    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                        savedData = parsed;
                    } else {
                        logger.warn('Saved chart state has invalid shape, ignoring');
                    }
                }
            } catch (err) {
                logger.warn('Failed to read saved chart state, ignoring:', err);
            }

            const initialSymbol = savedData ? null : await this.pickInitialSymbol();

            // Initialize TradingView Widget
            this.initTradingViewWidget(initialSymbol, savedData, storageKey);

            logger.info('Trading Application initialized successfully');
        } catch (error: unknown) {
            logger.error('Failed to initialize application:', error);

            // Check if it's an authentication error
            let isAuthError = false;
            let errorMessage = 'Unknown error';

            if (typeof error === 'object' && error !== null) {
                const err = error as { status?: number; message?: string };
                if (
                    err.status === 401 ||
                    err.message?.toLowerCase().includes('unauthorized') ||
                    err.message?.toLowerCase().includes('credentials') ||
                    err.message === 'Missing credentials'
                ) {
                    isAuthError = true;
                }
                errorMessage = err.message || errorMessage;
            } else if (error instanceof Error) {
                errorMessage = error.message;
                if (
                    errorMessage.toLowerCase().includes('unauthorized') ||
                    errorMessage.toLowerCase().includes('credentials') ||
                    errorMessage === 'Missing credentials'
                ) {
                    isAuthError = true;
                }
            }

            if (isAuthError) {
                logger.error('Authentication failed, redirecting to sign-in page...');
                // Clear invalid credentials
                sessionStorage.removeItem('userCredentials');
                clearStoredTokens();
                // Redirect to sign-in
                redirectToSignIn();
                return;
            }

            this.showError('Failed to initialize application: ' + errorMessage);
        }
    }

    /**
     * Authenticate with Trade Server
     */
    async authenticate(username: number): Promise<void> {
        if (!this.tradeServerClient) {
            throw new Error('TradeServerClient not initialized');
        }
        try {
            const response = await this.tradeServerClient.auth.signIn(username);
            if (!response) {
                throw new Error('Invalid response from server. Authentication failed.');
            }
            logger.info('Authentication successful:', response);

            persistApiToken(response);
        } catch (error) {
            logger.error('Authentication failed:', error);
            throw error;
        }
    }

    /**
     * Pick the initial chart symbol from the broker's catalog, preferring the
     * standard FX majors in priority order. Falls back to the first symbol
     * returned by the API, then to 'EURUSD' if the API call fails.
     */
    private async pickInitialSymbol(): Promise<string> {
        if (!this.tradeServerClient) {
            throw new Error('TradeServerClient not initialized');
        }
        try {
            const { symbols } = await this.tradeServerClient.marketData.getSymbols();
            const first = symbols?.[0];
            if (!first) return 'EURUSD';
            const available = new Set(symbols.map((s) => s.n));
            const popular = POPULAR_SYMBOLS.find((p) => available.has(p));
            return popular ?? first.n;
        } catch (err) {
            logger.warn('Failed to fetch symbols for initial pick, falling back to EURUSD:', err);
            return 'EURUSD';
        }
    }

    /**
     * Initialize TradingView Widget
     */
    initTradingViewWidget(symbol: string | null, savedData: object | null, storageKey: string) {
        // Ensure datafeed is initialized
        if (!this.datafeed) {
            throw new Error('Datafeed is not initialized');
        }

        // Check if TradingView library is loaded
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tradingView = (window as any).TradingView;
        if (!tradingView) {
            throw new Error('TradingView Charting Library is not loaded');
        }

        logger.debug('📚 TradingView object:', tradingView);
        logger.debug('📚 TradingView.widget type:', typeof tradingView.widget);
        logger.debug('📚 TradingView version info:', tradingView.version?.());

        // Log our datafeed to verify it has the required methods
        logger.debug('📡 Our Datafeed instance:', this.datafeed);
        logger.debug('📡 Datafeed methods:', {
            onReady: typeof this.datafeed.onReady,
            searchSymbols: typeof this.datafeed.searchSymbols,
            resolveSymbol: typeof this.datafeed.resolveSymbol,
            getBars: typeof this.datafeed.getBars,
            subscribeBars: typeof this.datafeed.subscribeBars,
            unsubscribeBars: typeof this.datafeed.unsubscribeBars,
            getQuotes: typeof this.datafeed.getQuotes,
            subscribeQuotes: typeof this.datafeed.subscribeQuotes,
            unsubscribeQuotes: typeof this.datafeed.unsubscribeQuotes,
        });

        // Critical validation: Ensure quote methods are available BEFORE creating widget
        if (
            typeof this.datafeed.getQuotes !== 'function' ||
            typeof this.datafeed.subscribeQuotes !== 'function' ||
            typeof this.datafeed.unsubscribeQuotes !== 'function'
        ) {
            throw new Error('❌ CRITICAL: Datafeed quote methods are not available! Trading features will not work.');
        }

        logger.info('✅ Datafeed validation passed - all quote methods present');

        //new UDFCompatibleDatafeed("https://demo_feed.tradingview.com")

        // TradingView runtime also reads supportModify*Brackets from configFlags (see library Me defaults).
        const brokerConfigFlags = {
            supportClosePosition: true,
            supportModifyOrderPrice: true,
            supportReversePosition: true,
            supportNativeReversePosition: true,
            supportOrdersHistory: false,
            supportStopLimitOrders: true,
            supportModifyDuration: true,
            supportAddBracketsToExistingOrder: false,
            supportModifyBrackets: true,
            supportModifyOrderBrackets: true,
            supportModifyPositionBrackets: true,
            supportOrderBrackets: true,
            supportPositionBrackets: true,
            supportPartialClosePosition: true,
            showNotificationsLog: true,
	    
        } as BrokerConfigFlags & {
            supportModifyOrderBrackets: boolean;
            supportModifyPositionBrackets: boolean;
        };

        const widgetOptions: TradingTerminalWidgetOptions = {
            ...(symbol !== null && { symbol }),
            ...(savedData && { saved_data: savedData }),
            auto_save_delay: 5,
            datafeed: this.datafeed,
            interval: '1' as ResolutionString, // Default interval
            container: CONFIG.tradingView.container!,
            library_path: CONFIG.tradingView.library_path!,
            locale: CONFIG.tradingView.locale!,
            disabled_features: CONFIG.tradingView.disabled_features,
            enabled_features: CONFIG.tradingView.enabled_features,
            fullscreen: CONFIG.tradingView.fullscreen,
            autosize: CONFIG.tradingView.autosize,
            theme: CONFIG.tradingView.theme,
            widgetbar: CONFIG.tradingView.widgetbar,

            // Additional settings
            timezone: 'Etc/UTC',
            debug: false, // Set to true for debugging

            // Trading features
            broker_factory: (host: IBrokerConnectionAdapterHost) => {
                logger.debug('🔥 broker_factory() called by TradingView!', host);
                if (!this.tradeServerClient) {
                    throw new Error('TradeServerClient not initialized');
                }
                if (!this.datafeed) {
                    throw new Error('Datafeed not initialized');
                }
                // Create broker instance with TradeServerClient directly
                this.brokerAPI = new BrokerApi(this.tradeServerClient, host, this.datafeed);
                return this.brokerAPI as unknown as IBrokerTerminal;
            },
            broker_config: {
                configFlags: brokerConfigFlags,
                // Preferred TIF: Market → IOC; Limit/Stop/StopLimit → GTC (see orderDurationConfig).
                durations: BROKER_ORDER_DURATIONS,
            },
        };

        // Explicitly verify broker_factory is a function
        if (widgetOptions.broker_factory) {
            logger.debug('✅ broker_factory is defined and is a:', typeof widgetOptions.broker_factory);
        } else {
            logger.error('❌ broker_factory is NOT defined!');
        }

        logger.info('🚀 Creating TradingView widget...');

        this.widget = new tradingView.widget(widgetOptions);

        logger.debug('📊 TradingView widget created:', this.widget);
        logger.info('⏳ Waiting for widget initialization and broker_factory call...');

        // Widget ready callback
        this.widget!.onChartReady(() => {
            logger.info('✅ TradingView Widget is ready');
            if (!this.brokerAPI) {
                logger.error('❌ Widget is ready but broker_factory was NEVER called!');
                logger.error('This means TradingView did not recognize the datafeed as having quotes support');
            } else {
                logger.info('✅ Broker API is initialized:', this.brokerAPI);
                this.brokerAPI.setupMarketOrderTypeDefaults(() => this.widget?.activeChart()?.symbol());
                try {
                    this.symbolChangedHandler = () => {
                        const symbol = this.widget?.activeChart()?.symbol();
                        if (symbol) {
                            this.brokerAPI?.resetOrderTypeToMarket(symbol);
                        }
                    };
                    this.widget!.activeChart().onSymbolChanged().subscribe(null, this.symbolChangedHandler);
                } catch (err) {
                    logger.warn('Could not subscribe to symbol changes for order type defaults:', err);
                }
            }

            this.autoSaveHandler = () => {
                this.widget!.save((state: object) => {
                    try {
                        localStorage.setItem(storageKey, JSON.stringify(state));
                    } catch (err) {
                        logger.warn('Failed to persist chart state:', err);
                    }
                });
            };
            this.widget!.subscribe('onAutoSaveNeeded', this.autoSaveHandler);
        });
    }

    /**
     * Show error message to user
     */
    showError(message: string): void {
        const container = document.getElementById(CONFIG.tradingView.container!.toString());
        if (!container) return;

        // Create elements safely to prevent XSS
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column;';

        const heading = document.createElement('h2');
        heading.style.color = '#d32f2f';
        heading.textContent = 'Error';

        const paragraph = document.createElement('p');
        paragraph.style.color = '#666';
        paragraph.textContent = message;

        const button = document.createElement('button');
        button.style.cssText = 'margin-top: 20px; padding: 10px 20px; cursor: pointer;';
        button.textContent = 'Reload';
        button.onclick = () => location.reload();

        wrapper.appendChild(heading);
        wrapper.appendChild(paragraph);
        wrapper.appendChild(button);

        container.innerHTML = '';
        container.appendChild(wrapper);
    }

    /**
     * Cleanup on app destroy
     */
    destroy() {
        this.brokerAPI?.teardownMarketOrderTypeDefaults();

        if (this.disposeConnectionIndicator) {
            this.disposeConnectionIndicator();
            this.disposeConnectionIndicator = null;
        }
        if (this.tradeServerClient) {
            this.tradeServerClient.disconnect();
        }
        if (this.widget) {
            if (this.autoSaveHandler) {
                this.widget.unsubscribe('onAutoSaveNeeded', this.autoSaveHandler);
                this.autoSaveHandler = null;
            }
            if (this.symbolChangedHandler) {
                try {
                    this.widget.activeChart().onSymbolChanged().unsubscribe(null, this.symbolChangedHandler);
                } catch {
                    // chart may already be torn down
                }
                this.symbolChangedHandler = null;
            }
            this.widget.remove();
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        logger.debug('====== DOMContentLoaded fired ======');
        logger.debug('Current URL:', window.location.href);
        logger.debug('Current pathname:', window.location.pathname);

        // Prevent app.ts from running on signin page to avoid redirect loops
        if (isOnSignInPage()) {
            logger.info('On signin page, skipping app initialization');
            return;
        }

        logger.debug('On main app page, checking authentication...');

        // Check if user is authenticated
        if (!isAuthenticated()) {
            logger.info('User not authenticated, redirecting to sign-in page...');
            redirectToSignIn();
            return;
        }

        logger.info('User authenticated, initializing Trading Application...');

        // Initialize UI components (logout button, user info)
        await initUI();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).tradingApp = new TradingApp();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (window as any).tradingApp.init();
    } catch (error) {
        logger.error('Failed to initialize:', error);
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).tradingApp) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).tradingApp.destroy();
    }
});
