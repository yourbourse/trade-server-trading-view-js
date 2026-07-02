/**
 * Account Service
 * Handles account-related API calls (balance, state, limits, transfers)
 */

import type {
    Balance,
    AccountState,
    Limits,
    Now,
    TransferHistory,
    TransferCollection,
    TransferRequestFilter,
} from '../../schema/public-api/types.gen.js';
import {
    getState,
    getBalances as sdkGetBalances,
    getLimits as sdkGetLimits,
    getTransfersHistory,
    getNow,
} from '../../schema/public-api/sdk.gen.js';
import { executeAuthenticatedGet, executeAuthenticatedRequest } from '../../utils/api.js';
import { AuthUser } from '../../types/AuthUser.js';
import { logger } from '../../utils/logger.js';

export class AccountService {
    private user: AuthUser;
    private log = logger.child('AccountService');

    constructor(user: AuthUser) {
        this.user = user;
    }

    /**
     * Get trading account state
     * POST /account/state
     */
    async getAccountInfo(): Promise<AccountState | undefined> {
        this.log.debug('Fetching account info');
        return await executeAuthenticatedGet(this.user, getState);
    }

    /**
     * Get account balance(s)/collateral
     * GET /account/balances
     */
    async getBalance(): Promise<Balance[] | undefined> {
        this.log.debug('Fetching balance');
        return await executeAuthenticatedGet(this.user, sdkGetBalances);
    }

    /**
     * Get rate limits and unfilled order count limits
     * GET /limits
     */
    async getLimits(): Promise<Limits | undefined> {
        this.log.debug('Fetching limits');
        return await executeAuthenticatedGet(this.user, sdkGetLimits);
    }

    /**
     * Get cash/asset transfers history
     * POST /transfers
     */
    async getTransfersHistory(
        filter: TransferRequestFilter = {},
        nextToken: string | null = null
    ): Promise<TransferCollection | undefined> {
        const extraHeaders = nextToken ? { 'X-YB-NEXT-TOKEN': nextToken } : undefined;
        return await executeAuthenticatedRequest(this.user, getTransfersHistory, filter, extraHeaders);
    }

    /**
     * Get ALL cash/asset transfers history with automatic pagination
     */
    async getAllTransfersHistory(filter: TransferRequestFilter = {}): Promise<TransferHistory[]> {
        let allTransfers: TransferHistory[] = [];
        let nextToken: string | undefined = undefined;

        do {
            const result = await this.getTransfersHistory(filter, nextToken ?? null);
            allTransfers = allTransfers.concat(result?.transfers ?? []);
            nextToken = result?.nextToken;
        } while (nextToken);

        return allTransfers;
    }

    /**
     * Get comprehensive account summary (convenience method)
     * Fetches both account state and balances in parallel
     */
    async getAccountSummary(): Promise<{ state: AccountState; balances: Balance[] }> {
        this.log.debug('Fetching account summary');
        const [state, balances] = await Promise.all([this.getAccountInfo(), this.getBalance()]);
        if (!state || !balances) {
            throw new Error('Failed to fetch account summary');
        }
        return { state, balances };
    }

    /**
     * Health check / Get server time
     * GET /now
     */
    async healthCheck(): Promise<Now | undefined> {
        return await executeAuthenticatedGet(this.user, getNow);
    }

    /**
     * Get server time in microseconds
     */
    async getServerTime(): Promise<string> {
        const result = await this.healthCheck();
        return result?.now ?? '';
    }
}
