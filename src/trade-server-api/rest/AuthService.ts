/**
 * Authentication Service
 * Handles authentication-related API calls
 */

import type { ApiToken, SuccessResponse } from '../../schema/public-api/types.gen.js';
import { postAuthorize, postRefresh, logout } from '../../schema/public-api/sdk.gen.js';
import { executeAuthenticatedRequest } from '../../utils/api.js';
import { AuthUser } from '../../types/AuthUser.js';
import { logger } from '../../utils/logger.js';

export class AuthService {
    private user: AuthUser;
    private log = logger.child('AuthService');

    constructor(user: AuthUser) {
        this.user = user;
    }

    /**
     * Authenticate user with username and password
     * POST /authorize
     * @param username - User login
     * @returns API token information
     */
    async signIn(username: string | number): Promise<ApiToken | undefined> {
        this.log.info(`Signing in user: ${username}`);
        const body = { login: username };
        const response = await executeAuthenticatedRequest<ApiToken>(this.user, postAuthorize, body, undefined, {
            // Opt out of the 401/502 refresh probe — sign-in owns its own error display.
            // throwOnError lets signin.ts's catch see err.status for better messages.
            __ignoreStatusCodes: [401, 403],
            throwOnError: true,
        });

        // Store token if returned
        if (response?.token) {
            this.user.apiKey = response.token;
            this.log.debug('API token stored');
        }
        // Store signing key if returned
        if (response?.signingToken) {
            this.user.signingToken = response.signingToken;
            this.log.debug('Signing token stored');
        }

        return response;
    }

    /**
     * Refresh API token
     * POST /refresh — authenticated by the current X-YB-API-Key header + HMAC
     * signature; the request body is unused (spec types it as `unknown`).
     * @returns New API token information
     */
    async refreshToken(): Promise<ApiToken | undefined> {
        this.log.info('Refreshing API token');
        const response = await executeAuthenticatedRequest<ApiToken>(this.user, postRefresh, {}, undefined, {
            // Opt out of the 401/403/502 refresh probe to prevent recursion.
            // throwOnError makes doRefresh's catch see the real rejection.
            __ignoreStatusCodes: [401, 403, 502],
            throwOnError: true,
        });

        if (response?.token) {
            this.user.apiKey = response.token;
            this.log.debug('API token refreshed');
        }

        if (response?.signingToken) {
            this.user.signingToken = response.signingToken;
            this.log.debug('Signing token refreshed');
        }

        return response;
    }

    /**
     * Logout user
     * POST /logout
     * @returns Success response
     */
    async logout(): Promise<SuccessResponse | undefined> {
        this.log.info('Logging out user');
        return await executeAuthenticatedRequest(this.user, logout, {});
    }

    /**
     * Get current user credentials
     */
    getUser(): AuthUser {
        return this.user;
    }
}
