/**
 * W3C Trace Context helpers for outbound Trade Server requests.
 * @see https://www.w3.org/TR/trace-context/
 */

export type TracingHeaders = {
    traceparent: string;
    'X-YB-TA-ID'?: string;
};

/** W3C Trace Context format version. */
const TRACE_VERSION = '00';

/** Sampled flag — backend stores traceparent for log correlation. */
const TRACE_FLAGS = '01';

function randomHex(byteLength: number): string {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 16 bytes → 32 lowercase hex chars (W3C trace-id). */
export function generateTraceId(): string {
    return randomHex(16);
}

/** 8 bytes → 16 lowercase hex chars (W3C parent-id / span-id). */
export function generateSpanId(): string {
    return randomHex(8);
}

/** W3C traceparent format: 00-{trace_id}-{span_id}-{flags} */
export function generateTraceparent(): string {
    return `${TRACE_VERSION}-${generateTraceId()}-${generateSpanId()}-${TRACE_FLAGS}`;
}

/**
 * Fresh traceparent for one outbound request (new trace_id and span_id per call).
 *  X-YB-TA-ID is included only when a valid trading account id is known.
 */
export function createTracingHeaders(tradingAccountId?: number | null): TracingHeaders {
    const headers: TracingHeaders = {
        traceparent: generateTraceparent(),
    };

    if (tradingAccountId != null && tradingAccountId > 0) {
        headers['X-YB-TA-ID'] = String(tradingAccountId);
    }

    return headers;
}
