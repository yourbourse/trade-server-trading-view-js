/**
 * WebSocket-specific error class
 */
import { TradeServerError } from './TradeServerError.js';

export class WebSocketError extends TradeServerError {
    constructor(message: string, code: string = 'WEBSOCKET_ERROR', details?: unknown) {
        super(message, code, undefined, details);
        this.name = 'WebSocketError';
    }
}

/**
 * Error thrown when WebSocket connection fails
 */
export class WebSocketConnectionError extends WebSocketError {
    constructor(message: string = 'Failed to connect to WebSocket', details?: unknown) {
        super(message, 'WEBSOCKET_CONNECTION_ERROR', details);
        this.name = 'WebSocketConnectionError';
    }
}

/**
 * Error thrown when subscription request times out
 */
export class SubscriptionTimeoutError extends WebSocketError {
    constructor(channel: string, details?: unknown) {
        super(`Subscription to channel '${channel}' timed out`, 'SUBSCRIPTION_TIMEOUT', details);
        this.name = 'SubscriptionTimeoutError';
    }
}

/**
 * Error thrown when subscription request fails
 */
export class SubscriptionError extends WebSocketError {
    constructor(channel: string, errorMessage?: string, details?: unknown) {
        super(
            `Failed to subscribe to channel '${channel}'${errorMessage ? `: ${errorMessage}` : ''}`,
            'SUBSCRIPTION_ERROR',
            details
        );
        this.name = 'SubscriptionError';
    }
}
