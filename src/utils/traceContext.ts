/**
 * W3C Trace Context helpers for outbound Trade Server requests.
 * @see https://www.w3.org/TR/trace-context/
 */

import type { InternalAxiosRequestConfig } from 'axios';

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

/** Read traceparent from an outgoing axios request config. */
export function extractTraceparentFromRequestConfig(
    config: InternalAxiosRequestConfig | undefined
): string | undefined {
    if (!config?.headers) {
        return undefined;
    }

    const headers = config.headers;

    if (typeof (headers as { get?: (name: string) => unknown }).get === 'function') {
        const value = (headers as { get: (name: string) => unknown }).get('traceparent');
        if (typeof value === 'string' && value.length > 0) {
            return value;
        }
    }

    const raw =
        (headers as Record<string, unknown>)['traceparent'] ??
        (headers as Record<string, unknown>)['Traceparent'];

    return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

/** Parse trace_id from a W3C traceparent header value. */
export function extractTraceIdFromTraceparent(traceparent: string): string | undefined {
    const match = /^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/i.exec(traceparent.trim());
    return match?.[1]?.toLowerCase();
}

/** Short trace_id prefix shown in user-facing notifications. */
export function formatTraceIdForNotification(traceId: string): string {
    return traceId.slice(0, 6);
}

/** Append a short trace reference for support / log lookup in TradingView notifications. */
export function formatNotificationWithTraceparent(text: string, traceparent?: string): string {
    if (!traceparent) {
        return text;
    }

    const traceId = extractTraceIdFromTraceparent(traceparent);
    if (!traceId) {
        return text;
    }

    const trimmed = text.trim();
    const message = trimmed.length === 0 ? trimmed : ensureSentenceEnding(trimmed);

    // TradingView toast notifications collapse whitespace and ignore newlines.
    return `${message} Reference: ${formatTraceIdForNotification(traceId)}`;
}

function ensureSentenceEnding(text: string): string {
    if (/[.!?]$/.test(text)) {
        return text;
    }

    return `${text}.`;
}
