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
    Order,
    PlaceOrderResult,
    Position,
    PreOrder,
    TradeContext,
} from '../../charting_library/charting_library';

import { IDatafeedQuotesApi } from '../../charting_library/datafeed-api';

import { AbstractBrokerMinimal } from './abstract-broker-minimal';
import { ConnectionStatus, ParentType, Side } from './types';
import type { Trade, TradeHistoryPageRequestFilter } from '../schema/public-api';

import { TradeServerClient } from '@/trade-server-api/TradeServerClient';
import { notificationService } from '@/utils/notificationService';
import { handleApiError } from '@/utils/apiError';
import { OrderService, PositionService, AccountService, BracketService, UpdateService } from './services/index.js';
import { createLogger } from '@/utils/logger.js';

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
    private accountService: AccountService;
    private bracketService: BracketService;
    private updateService: UpdateService;

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
        this.accountService = new AccountService(this.api, this.host);
        this.bracketService = new BracketService(this.api);
        this.updateService = new UpdateService(this.api, this.host, {
            onGetCachedOrders: () => this.orderService.getCachedOrders(),
            onGetCachedPositions: () => this.positionService.getCachedPositions(),
            onOrderCacheUpdate: (orders) => this.orderService.setCachedOrders(orders),
            onPositionCacheUpdate: (positions) => this.positionService.setCachedPositions(positions),
            onAccountStateUpdate: (data) => this.accountService.handleAccountStateUpdate(data),
            onRecalculateAMData: () => this.accountService.recalculateAMData(this.positionService.getCachedPositions()),
            onBracketActivation: (orderId) => this.bracketService.activateBracketsForFilledOrder(orderId),
            onMergeOrderUpdate: (existing, incoming, positions) =>
                this.orderService.mergeWebSocketOrderUpdate(existing, incoming, positions),
            onApplyServerPositionUpdate: (incoming) => this.positionService.applyServerPositionUpdate(incoming),
            onSyncBracketOrdersFromPosition: (position) => this.orderService.syncBracketOrdersFromPosition(position),
        });

        this.accountService.initializeAccountData();
        this.bracketService.checkOrphanedBrackets();
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
        const mintick = await this.host.getSymbolMinTick(symbol);
        const pipSize = mintick;
        const accountCurrencyRate = 1;
        const pointValue = 1;

        return {
            qty: {
                min: 1,
                max: 1e12,
                step: 1,
            },
            pipValue: pipSize * pointValue * accountCurrencyRate || 1,
            pipSize: pipSize,
            minTick: mintick,
            description: '',
        };
    }

    async orders(): Promise<Order[]> {
        return this.orderService.getAllOrders();
    }

    async positions(): Promise<Position[]> {
        return this.positionService.getAllPositions();
    }

    async executions(symbol: string): Promise<Execution[]> {
        logger.debug('executions for', symbol);

        try {
            const result = await this.api.trading.getTradeHistory({
                symbolName: symbol,
            } as TradeHistoryPageRequestFilter);
            const trades = result.trades || [];

            return trades.map((trade: Trade) => ({
                id: trade.id.toString(),
                symbol: trade.s,
                brokerSymbol: trade.s,
                price: trade.p,
                qty: trade.q,
                side: trade.S === 'buy' ? Side.Buy : Side.Sell,
                time: Math.floor(trade.t / 1000),
            }));
        } catch (error) {
            handleApiError(error, 'Error getting executions');
        }
    }

    public async placeOrder(preOrder: PreOrder): Promise<PlaceOrderResult> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.host.setAccountManagerVisibilityMode('normal' as any);

        const result = await this.orderService.placeOrder(preOrder);
        if (result.orderId) {
            this.bracketService.storeBracketsForOrder(result.orderId, preOrder);
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
            const position = this.positionService.getCachedPositions().find((p) => p.id === bracketOrder.parentId);
            const brackets: Brackets = {
                stopLoss: order.stopPrice ?? position?.stopLoss,
                takeProfit: order.limitPrice ?? position?.takeProfit,
            };
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

        await this.positionService.editPositionBrackets(positionId, brackets);

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

    public chartContextMenuActions(
        _context: TradeContext,
        _options?: DefaultContextMenuActionsParams | undefined
    ): Promise<ActionMetaInfo[]> {
        void _options;
        return this.host.defaultContextMenuActions(_context);
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
