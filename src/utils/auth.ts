/**
 * Authentication Utilities
 * Helper functions for authentication management
 */

import type { TradeServerConfig } from '../types/TradeServerConfig';
import type { ApiToken } from '../schema/public-api/types.gen.js';
import { createLogger } from './logger.js';

const logger = createLogger({ prefix: '[Auth]' });

const TOKEN_KEYS = {
    apiKey: 'apiKey',
    signingToken: 'signingToken',
    expiration: 'tokenExpiration',
} as const;

/**
 * Persist a fresh ApiToken to sessionStorage. Single source of truth for
 * writing apiKey / signingToken / expiration — all callers (signin, re-auth,
 * scheduled refresh) go through here.
 *
 * Token rotation is atomic by contract: all three fields are required per the
 * OpenAPI spec, and HMAC signing combines apiKey + signingToken, so a partial
 * write would leave us with a half-rotated state where every subsequent
 * request silently fails signature verification. If the server ever violates
 * the contract, refuse the whole write and let the caller's error path run
 * (which for the scheduled refresh signs the user out).
 */
export function persistApiToken(token: ApiToken): void {
    if (!token.token || !token.signingToken || !token.expiration) {
        throw new Error('Malformed ApiToken from server; refusing to persist partial state');
    }
    sessionStorage.setItem(TOKEN_KEYS.apiKey, token.token);
    sessionStorage.setItem(TOKEN_KEYS.signingToken, token.signingToken);
    sessionStorage.setItem(TOKEN_KEYS.expiration, String(token.expiration));
}

/**
 * Read the persisted token expiration (microseconds since Unix epoch).
 * Returns null for missing or tampered values — server is the sole authority,
 * so invalid input here just means "do not schedule a proactive refresh".
 */
export function getTokenExpiration(): number | null {
    const raw = sessionStorage.getItem(TOKEN_KEYS.expiration);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Clear all persisted tokens. Counterpart to persistApiToken.
 */
export function clearStoredTokens(): void {
    sessionStorage.removeItem(TOKEN_KEYS.apiKey);
    sessionStorage.removeItem(TOKEN_KEYS.signingToken);
    sessionStorage.removeItem(TOKEN_KEYS.expiration);
}

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
        const apiKey = sessionStorage.getItem(TOKEN_KEYS.apiKey) || '';
        const signingToken = sessionStorage.getItem(TOKEN_KEYS.signingToken) || '';

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

    sessionStorage.removeItem('userCredentials');
    clearStoredTokens();
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
