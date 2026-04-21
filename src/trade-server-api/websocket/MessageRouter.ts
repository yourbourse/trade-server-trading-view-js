/**
 * Message Router
 * Routes incoming WebSocket messages to appropriate handlers
 */

import type { WebSocketMessage, ResponseType, QuoteData, BookData } from '../types/index.js';
import type {
    Order,
    Position,
    Balance,
    AccountState,
    Trade,
    TransferHistory,
} from '../../schema/public-api/types.gen.js';
import { SubscriptionManager } from './SubscriptionManager.js';
import { logger } from '../../utils/logger.js';

export class MessageRouter {
    private subscriptions: SubscriptionManager;
    private log = logger.child('MessageRouter');

    constructor(subscriptions: SubscriptionManager) {
        this.subscriptions = subscriptions;
    }

    /**
     * Route incoming WebSocket message to appropriate handler
     * @param message - WebSocket message
     */
    route(message: WebSocketMessage): void {
        const { c: channel, m: method, t: type, d: data } = message;

        // Handle pong responses
        if (method === 'pong') {
            this.log.debug('Received pong');
            this.subscriptions.notify('pong', message);
            return;
        }

        // Handle subscription acknowledgements
        if (method === 'subscribe' || method === 'unsubscribe') {
            this.log.debug(`Received ${method} acknowledgement for channel: ${channel}`);
            return; // These are handled by WebSocketClient
        }

        // Handle heartbeat
        if (channel === 'heartbeat') {
            this.subscriptions.notify('heartbeat', message);
            return;
        }

        // Route data updates by channel
        switch (channel) {
            case 'orders':
                this.handleOrdersUpdate(type!, data as Order[]);
                break;
            case 'positions':
                this.handlePositionsUpdate(type!, data as Position[]);
                break;
            case 'balances':
                this.handleBalancesUpdate(type!, data as Balance[]);
                break;
            case 'states':
                this.handleAccountStatesUpdate(type!, data as AccountState[]);
                break;
            case 'trades':
                this.handleTradesUpdate(data as Trade[]);
                break;
            case 'transfers':
                this.handleTransfersUpdate(type!, data as TransferHistory[]);
                break;
            case 'ohlc':
                this.handleCandlesUpdate(type!, data);
                break;
            case 'L1':
                this.handleQuotesUpdate(type!, data);
                break;
            case 'L2':
                this.handleBookUpdate(type!, data);
                break;
            default:
                this.log.warn('Unknown channel:', channel, message);
        }
    }

    /**
     * Handle orders updates
     */
    private handleOrdersUpdate(type: ResponseType, data: Order[]): void {
        this.subscriptions.notify('orders', { type, data });
        this.subscriptions.notify('order_update', { type, data });
    }

    /**
     * Handle positions updates
     */
    private handlePositionsUpdate(type: ResponseType, data: Position[]): void {
        this.subscriptions.notify('positions', { type, data });
        this.subscriptions.notify('position_update', { type, data });
    }

    /**
     * Handle balances updates
     */
    private handleBalancesUpdate(type: ResponseType, data: Balance[]): void {
        this.subscriptions.notify('balances', { type, data });
        this.subscriptions.notify('balance_update', { type, data });
    }

    /**
     * Handle account states updates
     */
    private handleAccountStatesUpdate(type: ResponseType, data: AccountState[]): void {
        this.subscriptions.notify('states', { type, data });
        this.subscriptions.notify('account_state_update', { type, data });
    }

    /**
     * Handle trades updates
     */
    private handleTradesUpdate(data: Trade[]): void {
        this.subscriptions.notify('trades', { data });
        this.subscriptions.notify('trade', { data });
    }

    /**
     * Handle transfers updates
     */
    private handleTransfersUpdate(type: ResponseType, data: TransferHistory[]): void {
        this.subscriptions.notify('transfers', { type, data });
    }

    /**
     * Handle candles (OHLC) updates
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private handleCandlesUpdate(type: ResponseType, data: any): void {
        // Data can be an object with s (symbol) property or an array
        const candles = Array.isArray(data) ? data : [data];

        candles.forEach((candle: { s: string; [key: string]: unknown }) => {
            this.subscriptions.notify(`candles_${candle.s}`, { type, candle });
            this.subscriptions.notify('candles', { type, candle });
        });
    }

    /**
     * Handle quotes (L1) updates
     */
    private handleQuotesUpdate(type: ResponseType, data: QuoteData[]): void {
        data.forEach((quote) => {
            this.subscriptions.notify(`quote_${quote.s}`, { type, quote });
            this.subscriptions.notify('quotes', { type, quote });
            this.subscriptions.notify('ticker', {
                symbol: quote.s,
                bid: quote.bp,
                ask: quote.ap,
                bidSize: quote.bs,
                askSize: quote.as,
                timestamp: quote.t,
            });
        });
    }

    /**
     * Handle order book (L2) updates
     */
    private handleBookUpdate(type: ResponseType, data: BookData | BookData[]): void {
        const books = Array.isArray(data) ? data : [data];

        books.forEach((book) => {
            this.subscriptions.notify(`book_${book.s}`, { type, book });
            this.subscriptions.notify('book', { type, book });
        });
    }
}
