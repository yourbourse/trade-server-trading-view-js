/**
 * Authentication Utilities
 * Helper functions for authentication management
 */

import type { TradeServerConfig } from '../types/TradeServerConfig';
import { createLogger } from './logger.js';

const logger = createLogger({ prefix: '[Auth]' });

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
    const credsStr = sessionStorage.getItem('userCredentials');
    if (!credsStr) {
        logger.debug('No credentials in sessionStorage');
        return false;
    }

    try {
        const creds = JSON.parse(credsStr);
        const authenticated = !!(creds.login && creds.server);
        logger.debug('Credentials check:', authenticated ? 'AUTHENTICATED' : 'INVALID');
        logger.debug('Has login:', !!creds.login, 'Has server:', !!creds.server);
        return authenticated;
    } catch (error) {
        logger.error('Failed to parse credentials:', error);
        return false;
    }
}

/**
 * Get current user credentials
 */
export function getUserCredentials(): Omit<TradeServerConfig, 'timeout'> | null {
    const credsStr = sessionStorage.getItem('userCredentials');
    if (!credsStr) return null;

    try {
        const creds = JSON.parse(credsStr);
        const apiKey = sessionStorage.getItem('apiKey') || '';
        const signingToken = sessionStorage.getItem('signingToken') || '';

        return {
            server: creds.server,
            user: {
                login: creds.login,
                password: signingToken, // Use signingToken for HMAC signing
                apiKey,
                signingToken,
            },
        };
    } catch {
        return null;
    }
}

/**
 * Sign out user and clear credentials
 */
export function signOut(): void {
    logger.info('Signing out...');

    // Clear session storage
    sessionStorage.removeItem('userCredentials');
    sessionStorage.removeItem('apiKey');
    sessionStorage.removeItem('signingToken');
    logger.debug('SessionStorage cleared');

    // Avoid redirect loop - check if already on signin page
    const path = window.location.pathname;
    logger.debug('Current path:', path);
    if (path.includes('/signin')) {
        logger.debug('Already on signin page after logout');
        // Force reload to reset state
        window.location.reload();
        return;
    }

    // Redirect to sign-in page
    logger.info('Redirecting to /signin.html');
    window.location.href = '/signin.html';
}

/**
 * Add logout functionality to window for console access
 */
if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).logout = signOut;
    logger.info('💡 Tip: Call window.logout() or logout() in console to sign out');
}
