import {
    AccountId,
    AccountManagerInfo,
    AccountMetainfo,
    ActionMetaInfo,
    Brackets,
    CustomInputFieldsValues,
    DefaultContextMenuActionsParams,
    Execution,
    IBrokerConnectionAdapterHost,
    InstrumentInfo,
    IsTradableResult,
    IWatchedValue,
    Order,
    PlaceOrderResult,
    Position,
    PreOrder,
    TradeContext,
} from '../../charting_library/charting_library';

import { IDatafeedQuotesApi } from '../../charting_library/datafeed-api';

import { AbstractBrokerMinimal } from './abstract-broker-minimal';
import { ConnectionStatus, OrderType, ParentType, Side } from './types';

import { TradeServerClient } from '@/trade-server-api/TradeServerClient';
import { notificationService } from '@/utils/notificationService';
import {
    OrderService,
    PositionService,
    TradeHistoryService,
    AccountService,
    UpdateService,
    CurrencyConversionService,
} from './services/index.js';
import { createLogger } from '@/utils/logger.js';
import {
    applyDurationDefaults,
    applyMarketOrderTypeDefault,
} from '@/utils/tradingOrderDefaults.js';
import { expandAllowedDurations } from '@/utils/orderDurationConfig.js';

const logger = createLogger({ prefix: '[BrokerAPI]' });

/**
 * Broker API implementation for TradingView Trading Terminal
 *
 * **Account Details Features:**
 * - Real-time account balance, equity, P/L, margin, credit, and collateral updates
 * - Account Details tab in Account Manager showing comprehensive account information
 * - Summary bar at the top displaying key metrics (Balance, Equity, P/L, Margin)
 *
 * **Data Sources:**
 * - Initial data: Fetched via REST API (TradeServerAPI.getAccountInfo())
 * - Real-time updates: WebSocket 'states' channel (configured in app.ts with autoSubscribe.accountStates)
 *
 * **Implementation Details:**
 * - Uses IWatchedValue objects for reactive updates
 * - Account state updates automatically refresh the Account Details table
 * - WebSocket updates are handled by UpdateService
 */
export class BrokerApi extends AbstractBrokerMinimal {
    private api: TradeServerClient;
    private orderService: OrderService;
    private positionService: PositionService;
    private tradeHistoryService: TradeHistoryService;
    private accountService: AccountService;
    private updateService: UpdateService;
    /** Watched value instance we subscribed to (must match for reliable unsubscribe). */
    private orderPanelVisibility: IWatchedValue<boolean> | null = null;
    private orderPanelVisibilityHandler: ((visible: boolean) => void) | null = null;
    private currencyConversionService: CurrencyConversionService;

    public constructor(
        tradeServerClient: TradeServerClient,
        host: IBrokerConnectionAdapterHost,
        quotesProvider: IDatafeedQuotesApi
    ) {
        super(host, quotesProvider);

        this.api = tradeServerClient;

        notificationService.initialize((title: string, text: string, notificationType?: number) => {
            this.host.showNotification(title, text, notificationType);
        });

        this.orderService = new OrderService(this.api);
        this.positionService = new PositionService(this.api);
        this.tradeHistoryService = new TradeHistoryService(this.api);
        this.accountService = new AccountService(this.api, this.host, this.tradeHistoryService);
        this.currencyConversionService = new CurrencyConversionService(this.api);
        this.updateService = new UpdateService(this.api, this.host, {
            onGetCachedOrders: () => this.orderService.getCachedOrders(),
            onGetCachedPositions: () => this.positionService.getCachedPositions(),
            onOrderCacheUpdate: (orders) => this.orderService.setCachedOrders(orders),
            onPositionCacheUpdate: (positions) => this.positionService.setCachedPositions(positions),
            onAccountStateUpdate: (data) => this.accountService.handleAccountStateUpdate(data),
            onRecalculateAMData: () => this.accountService.recalculateAMData(this.positionService.getCachedPositions()),
            onMergeOrderUpdate: (existing, incoming, positions) =>
                this.orderService.mergeWebSocketOrderUpdate(existing, incoming, positions),
            onApplyServerPositionUpdate: (incoming) => this.positionService.applyServerPositionUpdate(incoming),
            onSyncBracketOrdersFromPosition: (position) => this.orderService.syncBracketOrdersFromPosition(position),
            onRefreshOrdersCache: () => this.orderService.refreshCachedOrders(),
        });

        this.updateService.subscribeToUpdates();
    }

    public connectionStatus(): ConnectionStatus {
        return ConnectionStatus.Connected;
    }

    public currentAccount(): AccountId {
        return this.accountService.getCurrentAccount();
    }

    async isTradable(symbol: string): Promise<boolean | IsTradableResult> {
        logger.debug('isTradable for', symbol);

        try {
            await this.api.marketData.getSymbolInfo(symbol);
            return true;
        } catch {
            return {
                tradable: false,
                reason: 'Symbol not found or not available for trading',
            };
        }
    }

    public async symbolInfo(symbol: string): Promise<InstrumentInfo> {
        const symbolConfig = await this.api.marketData.getSymbolInfo(symbol);

        // tz is explicit tick size; fallback derives it from decimal precision
        const mintick = symbolConfig.tz ?? 1 / Math.pow(10, symbolConfig.dp);

        const pipSize = mintick;

        // tv = monetary value of 1 tick move per lot, expressed in the symbol's
        // *profit* currency (symbolConfig.p). Divide by lotSize to get per-unit value.
        const lotSize = symbolConfig.l;
        // Fallback follows TradingView's formula: pipSize * pointValue * accountCurrencyRate
        // with pointValue=1, accountCurrencyRate=1 → pipValue = pipSize = mintick.
        // Using 1 as fallback causes TradingView to display astronomical P&L on brackets
        // because it multiplies pipValue × qty × lotSize internally.
        const rawPipValue = symbolConfig.tv ? symbolConfig.tv / lotSize : mintick;

        // TradingView InstrumentInfo spec:
        // - pipValue: account currency (used for bracket P&L / Order Ticket)
        // - bigPointValue: contract currency (used for "Total Value (symbol currency)")
        // When profit currency differs from account currency, convert pipValue only.
        const profitCurrency = symbolConfig.p;
        await this.accountService.ensureAccountDataLoaded();
        const accountCurrency = this.accountService.getAccountCurrency();
        const accountCurrencyRate = await this.currencyConversionService.getRate(profitCurrency, accountCurrency);

        const pipValue = rawPipValue * accountCurrencyRate;

        const allowedOrderTypes: OrderType[] = [];
        if (symbolConfig.M) {
            allowedOrderTypes.push(OrderType.Market);
        }
        if (symbolConfig.L) {
            allowedOrderTypes.push(OrderType.Limit);
        }
        if (symbolConfig.S) {
            allowedOrderTypes.push(OrderType.Stop);
        }
        if (symbolConfig.SLi) {
            allowedOrderTypes.push(OrderType.StopLimit);
        }

        const allowedDurations: string[] = [];
        if (symbolConfig.day) {
            allowedDurations.push('day');
        }
        if (symbolConfig.gtc) {
            allowedDurations.push('gtc');
        }
        if (symbolConfig.gtd) {
            allowedDurations.push('gtd');
        }
        if (symbolConfig.ioc) {
            allowedDurations.push('ioc');
        }
        if (symbolConfig.fok) {
            allowedDurations.push('fok');
        }

        const expandedAllowedDurations =
            allowedDurations.length > 0 ? expandAllowedDurations(allowedDurations) : allowedDurations;

        return {
            qty: {
                min: symbolConfig.min ,
                max: symbolConfig.max || 1e12,
                step: symbolConfig.i,
            },
            pipValue,
            pipSize,
            minTick: mintick,
            lotSize,
            description: symbolConfig.d,
            brokerSymbol: symbolConfig.n,
            //type: 'forex',
            currency: symbolConfig.p,
            baseCurrency: symbolConfig.b,
            quoteCurrency: symbolConfig.p,
            // bigPointValue stays in contract/profit currency per InstrumentInfo spec
            // ("Total Value (symbol currency)" in the Order Ticket).
            bigPointValue: symbolConfig.tv ? symbolConfig.tv / mintick / lotSize : undefined,
            ...(allowedOrderTypes.length > 0 && { allowedOrderTypes }),
            ...(expandedAllowedDurations.length > 0 && { allowedDurations: expandedAllowedDurations }),
        };
    }

    async orders(): Promise<Order[]> {
        return this.orderService.getAllOrders();
    }

    async positions(): Promise<Position[]> {
        return this.positionService.getAllPositions();
    }

    async executions(symbol: string): Promise<Execution[]> {
        return this.tradeHistoryService.getExecutions(symbol);
    }

    public async placeOrder(preOrder: PreOrder): Promise<PlaceOrderResult> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.host.setAccountManagerVisibilityMode('normal' as any);

        const result = await this.orderService.placeOrder(preOrder);

        if (result.orderId) {
            const order = this.orderService.getCachedOrders().find((o) => o.id === result.orderId);
            if (order) {
                this.host.orderUpdate?.(order);
            }
        }

        return result;
    }

    public async modifyOrder(order: Order, _confirmId?: string | undefined): Promise<void> {
        void _confirmId;

        const bracketOrder = order as Order & { parentId?: string; parentType?: number };
        if (
            bracketOrder.parentType === ParentType.Position &&
            bracketOrder.parentId &&
            (order.stopPrice !== undefined || order.limitPrice !== undefined)
        ) {
            const brackets: Brackets = {};
            if (order.stopPrice !== undefined) {
                brackets.stopLoss = order.stopPrice;
            }
            if (order.limitPrice !== undefined) {
                brackets.takeProfit = order.limitPrice;
            }
            await this.editPositionBrackets(bracketOrder.parentId, brackets);
            return;
        }

        await this.orderService.modifyOrder(order);

        const cachedOrders = this.orderService.getCachedOrders();
        const index = cachedOrders.findIndex((o) => o.id === order.id);
        if (index >= 0) {
            cachedOrders[index] = { ...cachedOrders[index]!, ...order };
            this.orderService.setCachedOrders(cachedOrders);
            this.host.orderUpdate?.(cachedOrders[index]!);
        }
    }

    public async editPositionBrackets(
        positionId: string,
        brackets: Brackets,
        _customFields?: CustomInputFieldsValues
    ): Promise<void> {
        void _customFields;

        const resolvedBrackets = await this.resolvePositionBrackets(positionId, brackets);
        await this.positionService.editPositionBrackets(positionId, resolvedBrackets);

        const updatedPosition = this.positionService.getCachedPositions().find((p) => p.id === positionId);
        if (!updatedPosition) {
            return;
        }

        this.host.positionUpdate(updatedPosition);

        const addedOrders = this.orderService.ensurePositionBracketOrders(updatedPosition);
        addedOrders.forEach((order) => this.host.orderUpdate?.(order));

        const syncedOrders = this.orderService.syncBracketOrdersFromPosition(updatedPosition);
        syncedOrders.forEach((order) => this.host.orderUpdate?.(order));
    }

    /**
     * Merge partial bracket updates with cached state. Omitted fields are preserved;
     * fields explicitly set to undefined are treated as cancel requests.
     */
    private async resolvePositionBrackets(positionId: string, brackets: Brackets): Promise<Brackets> {
        const position = await this.positionService.ensureCachedPosition(positionId);
        if (!position) {
            const message = `Position ${positionId} not found`;
            notificationService.error('Unable to modify position brackets', message);
            throw new Error(message);
        }

        const orderBrackets = this.orderService.getPositionBracketPrices(positionId);

        const stopLoss =
            'stopLoss' in brackets ? brackets.stopLoss : (position.stopLoss ?? orderBrackets.stopLoss);
        const takeProfit =
            'takeProfit' in brackets ? brackets.takeProfit : (position.takeProfit ?? orderBrackets.takeProfit);

        const siblingStopKnown =
            !('stopLoss' in brackets) && (position.stopLoss !== undefined || orderBrackets.stopLoss !== undefined);
        const siblingTakeProfitKnown =
            !('takeProfit' in brackets) &&
            (position.takeProfit !== undefined || orderBrackets.takeProfit !== undefined);

        if (siblingStopKnown && stopLoss === undefined) {
            const message = `Unable to resolve stop loss for position ${positionId}`;
            notificationService.error('Unable to modify position brackets', message);
            throw new Error(message);
        }

        if (siblingTakeProfitKnown && takeProfit === undefined) {
            const message = `Unable to resolve take profit for position ${positionId}`;
            notificationService.error('Unable to modify position brackets', message);
            throw new Error(message);
        }

        return { stopLoss, takeProfit };
    }

    public subscribeEquity(): void {
        this.accountService.setEquityUpdateSubscribed(true);
        const equity = this.accountService.getEquity();
        setTimeout(() => this.host.equityUpdate(equity), 5);
    }

    public unsubscribeEquity(): void {
        this.accountService.setEquityUpdateSubscribed(false);
    }

    public async cancelOrder(orderId: string): Promise<void> {
        await this.orderService.cancelOrder(orderId);
    }

    accountManagerInfo(): AccountManagerInfo {
        return this.accountService.getAccountManagerInfo();
    }

    public async accountsMetainfo(): Promise<AccountMetainfo[]> {
        return this.accountService.getAccountsMetainfo();
    }

    /**
     * Reset persisted order ticket defaults for the symbol:
     * order type → Market; Time in Force → IOC for Market, GTC otherwise
     * (falling back to the next symbol-allowed, order-type-compatible duration).
     */
    public resetOrderTypeToMarket(symbol: string): void {
        applyMarketOrderTypeDefault(symbol, this.host);
        // Apply preferred TIFs immediately so the ticket does not briefly show a stale duration
        // while symbolInfo (allowedDurations) is loading; refine when the symbol filter arrives.
        applyDurationDefaults(symbol, undefined, this.host);
        void this.refineDurationDefaultsForSymbol(symbol);
    }

    private async refineDurationDefaultsForSymbol(symbol: string): Promise<void> {
        try {
            const info = await this.symbolInfo(symbol);
            if (info.allowedDurations?.length) {
                applyDurationDefaults(symbol, info.allowedDurations, this.host);
            }
        } catch {
            // Keep the sync broker-config defaults already applied above.
        }
    }

    /**
     * Keep the order ticket on Market + preferred TIF by default
     * (TradingView otherwise remembers the last selections).
     * Idempotent: a second call tears down the previous subscription before re-subscribing.
     */
    public setupMarketOrderTypeDefaults(getSymbol: () => string | undefined): void {
        this.teardownMarketOrderTypeDefaults();

        const applyForActiveSymbol = () => {
            const symbol = getSymbol();
            if (symbol) {
                this.resetOrderTypeToMarket(symbol);
            }
        };

        applyForActiveSymbol();

        const orderPanelVisibility = this.host.orderPanelVisibility?.() ?? null;
        if (orderPanelVisibility) {
            this.orderPanelVisibilityHandler = (visible: boolean) => {
                if (visible) {
                    applyForActiveSymbol();
                }
            };
            this.orderPanelVisibility = orderPanelVisibility;
            orderPanelVisibility.subscribe(this.orderPanelVisibilityHandler);
        }
    }

    /** Tear down subscriptions set up by {@link setupMarketOrderTypeDefaults}. */
    public teardownMarketOrderTypeDefaults(): void {
        if (this.orderPanelVisibility && this.orderPanelVisibilityHandler) {
            this.orderPanelVisibility.unsubscribe(this.orderPanelVisibilityHandler);
        }
        this.orderPanelVisibility = null;
        this.orderPanelVisibilityHandler = null;
    }

    public chartContextMenuActions(
        context: TradeContext,
        options?: DefaultContextMenuActionsParams | undefined
    ): Promise<ActionMetaInfo[]> {
        if (context.symbol) {
            this.resetOrderTypeToMarket(context.symbol);
        }
        return this.host.defaultContextMenuActions(context, options);
    }

    async closePosition(positionId: string, amount?: number, confirmId?: string): Promise<void> {
        void confirmId;
        await this.positionService.closePosition(positionId, amount);
    }

    async reversePosition(positionId: string): Promise<void> {
        await this.positionService.reversePosition(positionId);
    }

    public async cancelOrders(_symbol: string, _side: Side | undefined, ordersIds: string[]): Promise<void> {
        await this.orderService.cancelOrders(ordersIds);
    }
}
