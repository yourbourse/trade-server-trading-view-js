/**
 * TTL cache with in-flight request coalescing for idempotent API reads.
 *
 * Concurrent callers for the same key share one promise; successful results
 * are served from cache until the TTL elapses. Rejections are never cached,
 * so the next caller retries.
 */

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

export class RequestCache<T> {
    private readonly cache = new Map<string, CacheEntry<T>>();
    private readonly inFlight = new Map<string, Promise<T>>();

    /**
     * @param ttlMs How long successful results stay fresh. `0` coalesces
     *              concurrent callers only and never serves completed results.
     * @param shouldCache Optional filter to skip caching specific resolved
     *                    values (e.g. `undefined` from a swallowed HTTP error).
     */
    constructor(
        private readonly ttlMs: number,
        private readonly shouldCache: (data: T) => boolean = () => true
    ) {}

    async get(key: string, fetch: () => Promise<T>): Promise<T> {
        if (this.ttlMs > 0) {
            const cached = this.cache.get(key);
            if (cached) {
                if (cached.expiresAt > Date.now()) {
                    return cached.data;
                }
                this.cache.delete(key);
            }
        }

        const existing = this.inFlight.get(key);
        if (existing) {
            return existing;
        }

        const request = fetch()
            .then((data) => {
                if (this.ttlMs > 0 && this.shouldCache(data)) {
                    this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs });
                }
                return data;
            })
            .finally(() => {
                this.inFlight.delete(key);
            });

        this.inFlight.set(key, request);
        return request;
    }

    /** Drop all cached results. In-flight requests are unaffected. */
    clear(): void {
        this.cache.clear();
    }
}
