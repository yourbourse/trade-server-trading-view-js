import type {
    SymbolCollection,
    Candle,
    Quote,
    AccountState,
    PositionsCollection,
    Order,
    PlaceOrder,
    ModifyOrder,
    ModifySltpResult,
    TradeCollection,
    TransferCollection,
    TransferRequestFilter,
    Trade,
    TradeHistoryPageRequestFilter,
} from '@/schema/public-api';
import type { Symbol } from '@/types';
import type { ResolutionString } from 'charting_library/datafeed-api';
import type { AuthUser } from '@/types/AuthUser';

export interface ITradeServerApi {
    // Symbol & Market Data
    getSymbols(): Promise<SymbolCollection>;
    getSymbolInfo(symbolName: string): Promise<Symbol>;
    getTicker(symbol: string): Promise<Quote>;
    getHistoricalBars(
        symbol: string,
        resolution: string,
        from: number,
        to: number
    ): Promise<{ s: string; i: string; d: Candle[] }>;

    // WebSocket Subscriptions
    subscribeToBars(symbol: string, resolution: ResolutionString): Promise<void>;
    subscribeToCandles(symbol: string, interval: string, snapshot?: boolean): Promise<void>;
    unsubscribeFromCandles(symbol: string, interval: string): Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscribe(topic: string, callback: (data: any) => void): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    unsubscribe(topic: string, callback: (data: any) => void): void;

    // Trading Operations
    placeOrder(order: PlaceOrder): Promise<Order>;
    modifyOrder(modifications: ModifyOrder): Promise<unknown>;
    cancelOrder(orderId: number): Promise<unknown>;
    modifyOrderSLTP(orderId: number, stopLoss: number | null, takeProfit: number | null): Promise<ModifySltpResult>;
    modifyPositionSLTP(
        positionId: number,
        stopLoss: number | null,
        takeProfit: number | null
    ): Promise<ModifySltpResult>;

    // Account & Orders
    getAccountInfo(): Promise<AccountState>;
    getPositions(filter?: Record<string, unknown>, nextToken?: string | null): Promise<PositionsCollection>;
    getAllOrders(filter?: Record<string, unknown>): Promise<Order[]>;
    getAllOrderHistory(filter?: Record<string, unknown>): Promise<Order[]>;
    getTradeHistory(filter?: TradeHistoryPageRequestFilter, nextToken?: string | null): Promise<TradeCollection>;
    getAllTradeHistory(filter?: TradeHistoryPageRequestFilter): Promise<Trade[]>;
    getTransfersHistory(filter?: TransferRequestFilter, nextToken?: string | null): Promise<TransferCollection>;

    // User info
    readonly user: AuthUser;
    readonly baseUrl: string;
}
