/**
 * WebSocket Client
 * Manages WebSocket connection, reconnection, and message handling
 */

import type { WebSocketMessage, WebSocketChannel } from '../types/index.js';
import { SubscriptionManager } from './SubscriptionManager.js';
import { MessageRouter } from './MessageRouter.js';
import { WebSocketConnectionError, SubscriptionTimeoutError, SubscriptionError } from '../errors/index.js';
import { logger } from '../../utils/logger.js';

export interface WebSocketClientOptions {
    /** WebSocket URL */
    url: string;
    /** API key for authentication */
    apiKey: string;
    /** Auto-reconnect on disconnect */
    autoReconnect?: boolean;
    /** Reconnect delay in milliseconds */
    reconnectDelay?: number;
    /** Maximum reconnect attempts (0 = infinite) */
    maxReconnectAttempts?: number;
    /** Heartbeat interval in milliseconds */
    heartbeatInterval?: number;
    /** Subscription timeout in milliseconds */
    subscriptionTimeout?: number;
}

interface PendingRequest {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timeout?: ReturnType<typeof setTimeout>;
}

export class WebSocketClient {
    private ws: WebSocket | null = null;
    private options: Required<WebSocketClientOptions>;
    private subscriptions: SubscriptionManager;
    private router: MessageRouter;
    private reqIdCounter = 0;
    private pendingRequests: Map<string, PendingRequest> = new Map();
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempts = 0;
    private log = logger.child('WebSocketClient');
    private isConnecting = false;

    constructor(options: WebSocketClientOptions) {
        this.options = {
            autoReconnect: true,
            reconnectDelay: 5000,
            maxReconnectAttempts: 10,
            heartbeatInterval: 30000,
            subscriptionTimeout: 10000,
            ...options,
        };

        this.subscriptions = new SubscriptionManager();
        this.router = new MessageRouter(this.subscriptions);
    }

    /**
     * Get subscription manager
     */
    getSubscriptions(): SubscriptionManager {
        return this.subscriptions;
    }

    /**
     * Check if WebSocket is connected
     */
    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    /**
     * Connect to WebSocket
     */
    async connect(): Promise<void> {
        if (this.isConnected()) {
            this.log.info('WebSocket already connected');
            return;
        }

        if (this.isConnecting) {
            this.log.warn('Connection already in progress');
            return;
        }

        this.isConnecting = true;

        return new Promise((resolve, reject) => {
            try {
                this.log.info(`Connecting to WebSocket: ${this.options.url}`);
                this.ws = new WebSocket(this.options.url);

                this.ws.onopen = () => {
                    this.log.info('WebSocket connected');
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    this.startHeartbeat();
                    this.subscriptions.notify('connected', {});
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message: WebSocketMessage = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (error) {
                        this.log.error('Failed to parse WebSocket message', error);
                    }
                };

                this.ws.onerror = (error) => {
                    this.log.error('WebSocket error', error);
                    this.isConnecting = false;
                    this.subscriptions.notify('error', error);
                };

                this.ws.onclose = (event) => {
                    this.log.info(`WebSocket disconnected (code: ${event.code}, reason: ${event.reason})`);
                    this.isConnecting = false;
                    this.stopHeartbeat();
                    this.subscriptions.notify('disconnected', { code: event.code, reason: event.reason });

                    if (this.options.autoReconnect) {
                        this.scheduleReconnect();
                    }
                };

                // Connection timeout
                setTimeout(() => {
                    if (this.isConnecting) {
                        this.isConnecting = false;
                        this.ws?.close();
                        reject(new WebSocketConnectionError('Connection timeout'));
                    }
                }, 10000);
            } catch (error) {
                this.isConnecting = false;
                this.log.error('Failed to create WebSocket connection', error);
                reject(new WebSocketConnectionError('Failed to create WebSocket connection', error));
            }
        });
    }

    /**
     * Disconnect from WebSocket
     */
    disconnect(): void {
        this.stopHeartbeat();
        this.cancelReconnect();

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.pendingRequests.clear();
        this.log.info('WebSocket disconnected');
    }

    /**
     * Schedule reconnection attempt
     */
    private scheduleReconnect(): void {
        if (this.reconnectTimer) {
            return; // Already scheduled
        }

        if (this.options.maxReconnectAttempts > 0 && this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            this.log.error(`Max reconnect attempts (${this.options.maxReconnectAttempts}) reached`);
            return;
        }

        this.reconnectAttempts++;
        const delay = this.options.reconnectDelay * Math.min(this.reconnectAttempts, 5); // Exponential backoff (capped at 5x)

        this.log.info(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect().catch((error) => {
                this.log.error('Reconnection failed', error);
            });
        }, delay);
    }

    /**
     * Cancel scheduled reconnection
     */
    private cancelReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /**
     * Start heartbeat/ping mechanism
     */
    private startHeartbeat(): void {
        this.stopHeartbeat(); // Clear any existing timer

        this.heartbeatTimer = setInterval(() => {
            this.sendPing();
        }, this.options.heartbeatInterval);
    }

    /**
     * Stop heartbeat/ping mechanism
     */
    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Send ping message
     */
    private sendPing(): void {
        const reqId = this.generateReqId();
        this.send({
            m: 'ping',
            h: {
                'X-YB-API-Key': this.options.apiKey,
            },
            reqId: reqId,
        });
    }

    /**
     * Generate unique request ID
     */
    private generateReqId(): string {
        return `req_${Date.now()}_${++this.reqIdCounter}`;
    }

    /**
     * Send message to WebSocket
     */
    private send(message: Record<string, unknown>): boolean {
        if (this.isConnected()) {
            this.ws!.send(JSON.stringify(message));
            return true;
        }
        this.log.warn('WebSocket not connected, cannot send message');
        return false;
    }

    /**
     * Handle incoming WebSocket message
     */
    private handleMessage(message: WebSocketMessage): void {
        const { m: method, reqId, s: success, e: error, c: channel } = message;

        // Handle subscription acknowledgements
        if ((method === 'subscribe' || method === 'unsubscribe') && reqId) {
            const pending = this.pendingRequests.get(reqId);
            if (pending) {
                if (pending.timeout) {
                    clearTimeout(pending.timeout);
                }
                this.pendingRequests.delete(reqId);

                if (success) {
                    this.log.debug(`${method} successful for channel: ${channel}`);
                    pending.resolve({ success: true, channel, message });
                } else {
                    this.log.error(`${method} failed for channel: ${channel}`, error);
                    pending.reject(new SubscriptionError(channel || 'unknown', error, message));
                }
            }
            return;
        }

        // Route message to appropriate handler
        this.router.route(message);
    }

    /**
     * Subscribe to a WebSocket channel
     */
    async subscribeToChannel(channel: WebSocketChannel, params?: Record<string, unknown>): Promise<unknown> {
        const reqId = this.generateReqId();

        const promise = new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.pendingRequests.delete(reqId);
                reject(new SubscriptionTimeoutError(channel));
            }, this.options.subscriptionTimeout);

            this.pendingRequests.set(reqId, { resolve, reject, timeout: timeoutHandle });
        });

        this.send({
            m: 'subscribe',
            c: channel,
            p: params || {},
            h: {
                'X-YB-API-Key': this.options.apiKey,
            },
            reqId: reqId,
        });

        return promise;
    }

    /**
     * Unsubscribe from a WebSocket channel
     */
    async unsubscribeFromChannel(channel: WebSocketChannel, params?: Record<string, unknown>): Promise<unknown> {
        const reqId = this.generateReqId();

        const promise = new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.pendingRequests.delete(reqId);
                reject(new SubscriptionTimeoutError(channel));
            }, this.options.subscriptionTimeout);

            this.pendingRequests.set(reqId, { resolve, reject, timeout: timeoutHandle });
        });

        this.send({
            m: 'unsubscribe',
            c: channel,
            p: params || {},
            h: {
                'X-YB-API-Key': this.options.apiKey,
            },
            reqId: reqId,
        });

        return promise;
    }
}
