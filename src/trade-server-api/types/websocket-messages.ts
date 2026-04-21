/**
 * WebSocket Message Type Definitions
 * Based on asyncapi.yaml specification
 */

import type {
    Order,
    Position,
    Trade,
    Balance,
    AccountState,
    Candle,
    TransferHistory,
} from '../../schema/public-api/types.gen.js';
import { CandleInterval } from '../../schema/public-api/types.gen.js';

/**
 * WebSocket method types
 */
export type WebSocketMethod = 'subscribe' | 'unsubscribe' | 'ping' | 'pong';

/**
 * WebSocket channel types
 */
export type WebSocketChannel =
    | 'orders'
    | 'positions'
    | 'balances'
    | 'states'
    | 'trades'
    | 'transfers'
    | 'ohlc'
    | 'L1'
    | 'L2'
    | 'heartbeat';

/**
 * Response types: snapshot, update, or delete
 */
export type ResponseType = 's' | 'u' | 'd';

/**
 * Base WebSocket message structure
 */
export interface BaseWebSocketMessage {
    /** Method (subscribe, unsubscribe, ping, pong) */
    m?: WebSocketMethod;
    /** Channel name */
    c?: WebSocketChannel;
    /** Response type (snapshot, update, delete) */
    t?: ResponseType;
    /** Message data payload */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    d?: any;
    /** Success flag */
    s?: boolean;
    /** Error message */
    e?: string;
    /** Request ID for tracking */
    reqId?: string;
}

/**
 * Subscription acknowledgement message
 */
export interface SubscriptionAckMessage extends BaseWebSocketMessage {
    m: 'subscribe' | 'unsubscribe';
    c: WebSocketChannel;
    s: boolean;
    e?: string;
    reqId: string;
}

/**
 * Orders channel update message
 */
export interface OrdersUpdateMessage extends BaseWebSocketMessage {
    c: 'orders';
    t: ResponseType;
    d: Order[];
}

/**
 * Positions channel update message
 */
export interface PositionsUpdateMessage extends BaseWebSocketMessage {
    c: 'positions';
    t: ResponseType;
    d: Position[];
}

/**
 * Balances channel update message
 */
export interface BalancesUpdateMessage extends BaseWebSocketMessage {
    c: 'balances';
    t: ResponseType;
    d: Balance[];
}

/**
 * Account states channel update message
 */
export interface AccountStatesUpdateMessage extends BaseWebSocketMessage {
    c: 'states';
    t: ResponseType;
    d: AccountState[];
}

/**
 * Trades channel update message
 */
export interface TradesUpdateMessage extends BaseWebSocketMessage {
    c: 'trades';
    d: Trade[];
}

/**
 * Candles (OHLC) channel update message
 */
export interface CandlesUpdateMessage extends BaseWebSocketMessage {
    c: 'ohlc';
    t: ResponseType;
    d: {
        /** Symbol name */
        s: string;
        /** Candle interval */
        i: CandleInterval;
        /** Candle data array */
        d: Candle[];
    };
}

/**
 * Quote data structure (L1)
 */
export interface QuoteData {
    /** Symbol name */
    s: string;
    /** Bid price */
    bp?: number;
    /** Ask price */
    ap?: number;
    /** Bid size */
    bs?: number;
    /** Ask size */
    as?: number;
    /** Timestamp */
    t?: number;
}

/**
 * Quotes (L1) channel update message
 */
export interface QuotesUpdateMessage extends BaseWebSocketMessage {
    c: 'L1';
    t: ResponseType;
    d: QuoteData[];
}

/**
 * Order book data structure (L2)
 */
export interface BookData {
    /** Symbol name */
    s: string;
    /** Bids [price, size][] */
    b?: Array<[number, number]>;
    /** Asks [price, size][] */
    a?: Array<[number, number]>;
}

/**
 * Order book (L2) channel update message
 */
export interface BookUpdateMessage extends BaseWebSocketMessage {
    c: 'L2';
    t: ResponseType;
    d: BookData;
}

/**
 * Transfers channel update message
 */
export interface TransfersUpdateMessage extends BaseWebSocketMessage {
    c: 'transfers';
    t: ResponseType;
    d: TransferHistory[];
}

/**
 * Heartbeat message
 */
export interface HeartbeatMessage extends BaseWebSocketMessage {
    c: 'heartbeat';
}

/**
 * Pong response message
 */
export interface PongMessage extends BaseWebSocketMessage {
    m: 'pong';
}

/**
 * Union type of all possible WebSocket messages
 */
export type WebSocketMessage =
    | BaseWebSocketMessage
    | SubscriptionAckMessage
    | OrdersUpdateMessage
    | PositionsUpdateMessage
    | BalancesUpdateMessage
    | AccountStatesUpdateMessage
    | TradesUpdateMessage
    | CandlesUpdateMessage
    | QuotesUpdateMessage
    | BookUpdateMessage
    | TransfersUpdateMessage
    | HeartbeatMessage
    | PongMessage;

/**
 * Subscription parameters for orders channel
 */
export interface OrdersSubscriptionParams {
    snapshot?: boolean;
}

/**
 * Subscription parameters for positions channel
 */
export interface PositionsSubscriptionParams {
    snapshot?: boolean;
    sendPriceUpdates?: boolean;
}

/**
 * Subscription parameters for balances channel
 */
export interface BalancesSubscriptionParams {
    snapshot?: boolean;
}

/**
 * Subscription parameters for account states channel
 */
export interface AccountStatesSubscriptionParams {
    snapshot?: boolean;
}

/**
 * Subscription parameters for transfers channel
 */
export interface TransfersSubscriptionParams {
    types?: string[];
}

/**
 * Subscription parameters for candles (OHLC) channel
 */
export interface CandlesSubscriptionParams {
    /** Symbol name */
    s: string;
    /** Candle interval */
    i: CandleInterval;
    /** Include last candle in snapshot */
    snapshot?: boolean;
}

/**
 * Subscription parameters for quotes (L1) channel
 */
export interface QuotesSubscriptionParams {
    /** Symbol name */
    s: string;
    /** True for snapshot + updates, false for snapshot only */
    streaming?: boolean;
}

/**
 * Subscription parameters for order book (L2) channel
 */
export interface OrderBookSubscriptionParams {
    /** Symbol name */
    s: string;
    /** Number of price levels */
    d?: number;
    /** True for snapshot + updates, false for snapshot only */
    streaming?: boolean;
}
