import {
    AccountId,
    AccountManagerInfo,
    AccountMetainfo,
    ActionMetaInfo,
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
import { ConnectionStatus, Side } from './types';

import { TradeServerClient } from '@/trade-server-api/TradeServerClient';
import { notificationService } from '@/utils/notificationService';
import {
    OrderService,
    PositionService,
    TradeHistoryService,
    AccountService,
    BracketService,
    UpdateService,
} from './services/index.js';
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
    private tradeHistoryService: TradeHistoryService;
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
        this.tradeHistoryService = new TradeHistoryService(this.api);
        this.accountService = new AccountService(this.api, this.host, this.tradeHistoryService);
        this.bracketService = new BracketService(this.api);
        this.updateService = new UpdateService(this.api, this.host, {
            onGetCachedOrders: () => this.orderService.getCachedOrders(),
            onGetCachedPositions: () => this.positionService.getCachedPositions(),
            onOrderCacheUpdate: (orders) => this.orderService.setCachedOrders(orders),
            onPositionCacheUpdate: (positions) => this.positionService.setCachedPositions(positions),
            onAccountStateUpdate: (data) => this.accountService.handleAccountStateUpdate(data),
            onRecalculateAMData: () => this.accountService.recalculateAMData(this.positionService.getCachedPositions()),
            onBracketActivation: (orderId) => this.bracketService.activateBracketsForFilledOrder(orderId),
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
        return this.tradeHistoryService.getExecutions(symbol);
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
        await this.orderService.modifyOrder(order);
    }

    public async editPositionBrackets(
        positionId: string,
        brackets: { stopLoss?: number; takeProfit?: number }
    ): Promise<void> {
        await this.positionService.editPositionBrackets(positionId, brackets);
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
