/**
 * Subscription Manager
 * Implements pub/sub pattern for WebSocket event handling
 */

import { logger } from '../../utils/logger.js';

export type SubscriptionCallback = (data: unknown) => void;

export class SubscriptionManager {
    private callbacks: Map<string, SubscriptionCallback[]>;
    private log = logger.child('SubscriptionManager');

    constructor() {
        this.callbacks = new Map();
    }

    /**
     * Subscribe to an event
     * @param event - Event name
     * @param callback - Callback function to execute when event is triggered
     */
    subscribe(event: string, callback: SubscriptionCallback): void {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, []);
        }
        const eventCallbacks = this.callbacks.get(event)!;
        eventCallbacks.push(callback);
        this.log.debug(`Subscribed to event: ${event} (${eventCallbacks.length} callbacks)`);
    }

    /**
     * Unsubscribe from an event
     * @param event - Event name
     * @param callback - Callback function to remove
     */
    unsubscribe(event: string, callback: SubscriptionCallback): void {
        if (this.callbacks.has(event)) {
            const eventCallbacks = this.callbacks.get(event)!;
            const index = eventCallbacks.indexOf(callback);
            if (index > -1) {
                eventCallbacks.splice(index, 1);
                this.log.debug(`Unsubscribed from event: ${event} (${eventCallbacks.length} callbacks remaining)`);
            }
        }
    }

    /**
     * Notify all callbacks for an event
     * @param event - Event name
     * @param data - Data to pass to callbacks
     */
    notify(event: string, data: unknown): void {
        if (this.callbacks.has(event)) {
            const eventCallbacks = this.callbacks.get(event)!;
            this.log.debug(`Notifying ${eventCallbacks.length} callbacks for event: ${event}`);
            eventCallbacks.forEach((callback) => {
                try {
                    callback(data);
                } catch (error) {
                    this.log.error(`Error in callback for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Check if there are any subscribers for an event
     * @param event - Event name
     * @returns True if there are subscribers
     */
    hasSubscribers(event: string): boolean {
        return this.callbacks.has(event) && this.callbacks.get(event)!.length > 0;
    }

    /**
     * Get the number of subscribers for an event
     * @param event - Event name
     * @returns Number of subscribers
     */
    getSubscriberCount(event: string): number {
        return this.callbacks.get(event)?.length || 0;
    }

    /**
     * Clear all callbacks for an event
     * @param event - Event name
     */
    clearEvent(event: string): void {
        if (this.callbacks.has(event)) {
            this.callbacks.delete(event);
            this.log.debug(`Cleared all callbacks for event: ${event}`);
        }
    }

    /**
     * Clear all subscriptions
     */
    clearAll(): void {
        this.callbacks.clear();
        this.log.debug('Cleared all subscriptions');
    }

    /**
     * Get all event names
     * @returns Array of event names
     */
    getEventNames(): string[] {
        return Array.from(this.callbacks.keys());
    }
}
