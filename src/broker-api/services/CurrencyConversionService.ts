import { TradeServerClient } from '@/trade-server-api/TradeServerClient';
import { createLogger } from '@/utils/logger.js';

const logger = createLogger({ prefix: '[CurrencyConversionService]' });

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
    rate: number;
    expiresAt: number;
}

/**
 * Resolves profit-currency -> account-currency conversion rates.
 *
 * TradingView requires `InstrumentInfo.pipValue` to be expressed in the account
 * currency. (`bigPointValue` is intentionally left in the contract/profit currency
 * per TradingView’s spec.)
 * account), the raw tick value from the symbol config is in the profit
 * currency and must be converted before being handed to TradingView -
 * otherwise chart bracket (SL/TP) "Amount" badges show the unconverted
 * profit-currency figure labeled with the account currency.
 */
export class CurrencyConversionService {
    private api: TradeServerClient;
    private cache = new Map<string, CacheEntry>();
    private inFlight = new Map<string, Promise<number>>();

    constructor(api: TradeServerClient) {
        this.api = api;
    }

    /**
     * Returns how many units of `to` currency equal 1 unit of `from` currency.
     * Falls back to `1` (logging the error) if the rate can't be fetched, so
     * callers degrade to the pre-conversion behavior instead of throwing.
     */
    async getRate(from: string, to: string): Promise<number> {
        if (!from || !to || from === to) {
            return 1;
        }

        const key = `${from}:${to}`;
        const cached = this.cache.get(key);
        if (cached) {
            if (cached.expiresAt > Date.now()) return cached.rate;
            this.cache.delete(key);
        }

        const existingRequest = this.inFlight.get(key);
        if (existingRequest) {
            return existingRequest;
        }

        const request = this.fetchRate(from, to)
            .then((rate) => {
                this.cache.set(key, { rate, expiresAt: Date.now() + CACHE_TTL_MS });
                return rate;
            })
            .catch((error) => {
                logger.error(`Failed to fetch conversion rate ${from}->${to}, falling back to 1:`, error);
                return 1;
            })
            .finally(() => {
                this.inFlight.delete(key);
            });

        this.inFlight.set(key, request);
        return request;
    }

    private async fetchRate(from: string, to: string): Promise<number> {
        const { rate } = await this.api.marketData.getConversionRate(from, to);
        if (!rate || !Number.isFinite(rate) || rate <= 0) {
            throw new Error(`Invalid conversion rate received for ${from}->${to}: ${rate}`);
        }
        return rate;
    }
}
