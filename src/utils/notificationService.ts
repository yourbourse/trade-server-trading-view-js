/**
 * Notification Service
 * Centralized notification system that integrates with TradingView's notification log
 */

import { logger } from './logger.js';

export enum NotificationType {
    Error = 0,
    Success = 1,
}

type ShowNotificationFn = (title: string, text: string, notificationType?: NotificationType) => void;

class NotificationService {
    private showNotificationFn: ShowNotificationFn | null = null;
    private log = logger.child('NotificationService');
    private pendingNotifications: Array<{ title: string; text: string; type: NotificationType }> = [];

    /**
     * Initialize notification service with TradingView host's showNotification method
     */
    initialize(showNotificationFn: ShowNotificationFn): void {
        this.showNotificationFn = showNotificationFn;
        this.log.info('Notification service initialized');

        // Send any pending notifications
        if (this.pendingNotifications.length > 0) {
            this.log.debug(`Sending ${this.pendingNotifications.length} pending notifications`);
            this.pendingNotifications.forEach(({ title, text, type }) => {
                this.showNotification(title, text, type);
            });
            this.pendingNotifications = [];
        }
    }

    /**
     * Show a notification
     */
    showNotification(title: string, text: string, type: NotificationType = NotificationType.Error): void {
        if (!this.showNotificationFn) {
            // Queue notification if service not initialized yet
            this.log.warn('Notification service not initialized, queuing notification');
            this.pendingNotifications.push({ title, text, type });
            return;
        }

        this.log.debug(`Showing ${NotificationType[type]} notification: ${title}`);
        this.showNotificationFn(title, text, type);
    }

    /**
     * Show error notification
     */
    error(title: string, text: string): void {
        this.showNotification(title, text, NotificationType.Error);
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
