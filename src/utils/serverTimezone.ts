/**
 * Trade Server timezone (IANA name from GET /now). Symbol sessions come in this
 * timezone, so it is passed to TradingView as the symbol timezone.
 * Falls back to Etc/UTC when the server doesn't report one.
 */

import type { Timezone } from '../../charting_library/datafeed-api';
import type { AccountService } from '../trade-server-api/rest/AccountService.js';
import { createLogger } from './logger.js';

const logger = createLogger({ prefix: '[ServerTimezone]' });

export const DEFAULT_TIMEZONE: Timezone = 'Etc/UTC';

/**
 * Reads the server timezone from GET /now. Never throws: any failure returns the
 * Etc/UTC fallback so the chart isn't blocked.
 */
export async function fetchServerTimezone(account: AccountService): Promise<Timezone> {
    try {
        const timezone = (await account.healthCheck())?.timezone;
        if (!timezone) {
            logger.warn(`Server reported no timezone, using ${DEFAULT_TIMEZONE}`);
            return DEFAULT_TIMEZONE;
        }
        logger.info('Server timezone:', timezone);
        return timezone as Timezone;
    } catch (error: unknown) {
        logger.warn(`Failed to read server timezone from /now, using ${DEFAULT_TIMEZONE}:`, error);
        return DEFAULT_TIMEZONE;
    }
}
