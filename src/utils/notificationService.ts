/**
 * Notification Service
 * Centralized notification system that integrates with TradingView's notification log
 */

import { logger } from './logger.js';
import { formatNotificationWithTraceparent, type RequestTraceReference } from './traceContext';

export enum NotificationType {
    Error = 0,
    Success = 1,
}

type ShowNotificationFn = (title: string, text: string, notificationType?: NotificationType) => void;

const DEDUP_WINDOW_MS = 5000;

interface PendingNotification {
    title: string;
    text: string;
    type: NotificationType;
    trace?: RequestTraceReference;
}

class NotificationService {
    private showNotificationFn: ShowNotificationFn | null = null;
    private log = logger.child('NotificationService');
    private pendingNotifications: Array<PendingNotification> = [];
    private recentKeys = new Map<string, number>();

    /**
     * Initialize notification service with TradingView host's showNotification method
     */
    initialize(showNotificationFn: ShowNotificationFn): void {
        this.showNotificationFn = showNotificationFn;
        this.log.info('Notification service initialized');

        // Send any pending notifications
        if (this.pendingNotifications.length > 0) {
            this.log.debug(`Sending ${this.pendingNotifications.length} pending notifications`);
            this.pendingNotifications.forEach(({ title, text, type, trace }) => {
                this.showNotification(title, text, type, trace);
            });
            this.pendingNotifications = [];
        }
    }

    /**
     * Show a notification. Identical title+text+type within DEDUP_WINDOW_MS are suppressed.
     * Trace reference fields are appended to the displayed text but excluded from the dedup
     * key, so concurrent identical errors still collapse into a single toast.
     */
    showNotification(
        title: string,
        text: string,
        type: NotificationType = NotificationType.Error,
        trace?: RequestTraceReference
    ): void {
        const key = JSON.stringify([type, title, text]);
        const now = Date.now();
        const last = this.recentKeys.get(key);
        if (last !== undefined && now - last < DEDUP_WINDOW_MS) {
            this.log.debug(`Suppressing duplicate notification: ${title}`);
            return;
        }

        if (!this.showNotificationFn) {
            // Queue notification if service not initialized yet — dedup applies on flush too.
            // Don't record the key here: recording it now (before the notification is ever
            // actually shown) would make initialize()'s flush see it as a "duplicate" of
            // itself and suppress the only delivery.
            this.log.warn('Notification service not initialized, queuing notification');
            this.pendingNotifications.push({ title, text, type, trace });
            return;
        }

        this.pruneRecentKeys(now);
        this.recentKeys.set(key, now);

        this.log.debug(`Showing ${NotificationType[type]} notification: ${title}`);
        this.showNotificationFn(
            title,
            formatNotificationWithTraceparent(text, trace?.traceparent, trace?.traceCode),
            type
        );
    }

    /**
     * Drop dedup keys whose window has elapsed so the cache can't grow
     * unbounded in a long-lived tab (notification text can carry dynamic
     * content, producing unique keys). Bounds the map to the distinct
     * notifications seen within a single DEDUP_WINDOW_MS window.
     */
    private pruneRecentKeys(now: number): void {
        for (const [key, ts] of this.recentKeys) {
            if (now - ts >= DEDUP_WINDOW_MS) {
                this.recentKeys.delete(key);
            }
        }
    }

    /**
     * Show error notification
     */
    error(title: string, text: string, trace?: RequestTraceReference): void {
        this.showNotification(title, text, NotificationType.Error, trace);
    }

    /**
     * Show success notification
     */
    success(title: string, text: string): void {
        this.showNotification(title, text, NotificationType.Success);
    }

    /**
     * Check if service is initialized
     */
    isInitialized(): boolean {
        return this.showNotificationFn !== null;
    }
}

// Export singleton instance
export const notificationService = new NotificationService();
