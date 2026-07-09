/**
 * W3C Trace Context helpers for outbound Trade Server requests.
 * @see https://www.w3.org/TR/trace-context/
 */

import type { InternalAxiosRequestConfig } from 'axios';
import { getAppVersion } from './version';
import { createLogger } from './logger.js';

const log = createLogger({ prefix: '[TraceContext]' });

export type TracingHeaders = {
    traceparent: string;
    'X-YB-APP-NAME': string;
    'X-YB-APP-VERSION': string;
    'X-YB-Trace-Code': string;
    'X-YB-TA-ID'?: string;
};

/** W3C Trace Context format version. */
const TRACE_VERSION = '00';

/** Sampled flag — backend stores traceparent for log correlation. */
const TRACE_FLAGS = '01';

/** Client identifier sent on every Trade Server request. */
export const APP_NAME = 'YB-TVJS';

const TRACE_CODE_LENGTH = 6;

let warnedAboutInsecureRandom = false;

/**
 * Fill a byte buffer with cryptographically strong random values when available.
 * Falls back to Math.random() outside secure contexts (non-HTTPS) so tracing
 * headers never break outbound requests. W3C Trace Context allows
 * pseudo-random generation for trace-id / parent-id.
 */
function fillRandomBytes(bytes: Uint8Array): void {
    try {
        const cryptoApi = globalThis.crypto;
        if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
            // TS DOM typings require ArrayBufferView<ArrayBuffer>; Uint8Array is fine at runtime.
            cryptoApi.getRandomValues(bytes as Parameters<Crypto['getRandomValues']>[0]);
            return;
        }
    } catch {
        // Secure-context / crypto failures fall through to Math.random().
    }

    if (!warnedAboutInsecureRandom) {
        warnedAboutInsecureRandom = true;
        log.warn(
            'crypto.getRandomValues unavailable; using Math.random() for trace IDs. ' +
                'Serve this app over HTTPS (or localhost) in production.'
        );
    }

    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
    }
}

function randomHex(byteLength: number): string {
    const bytes = new Uint8Array(byteLength);
    fillRandomBytes(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** W3C forbids all-zero trace-id and parent-id; regenerate if that edge case occurs. */
function randomNonZeroHex(byteLength: number): string {
    const invalid = '0'.repeat(byteLength * 2);
    let id = randomHex(byteLength);
    while (id === invalid) {
        id = randomHex(byteLength);
    }
    return id;
}

/** 16 bytes → 32 lowercase hex chars (W3C trace-id). */
export function generateTraceId(): string {
    return randomNonZeroHex(16);
}

/** 8 bytes → 16 lowercase hex chars (W3C parent-id / span-id). */
export function generateSpanId(): string {
    return randomNonZeroHex(8);
}

/** W3C traceparent format: 00-{trace_id}-{span_id}-{flags} */
export function generateTraceparent(traceId: string = generateTraceId(), spanId: string = generateSpanId()): string {
    return `${TRACE_VERSION}-${traceId}-${spanId}-${TRACE_FLAGS}`;
}

/** First 6 hex chars of trace_id — used in X-YB-Trace-Code and notifications. */
export function formatTraceCode(traceId: string): string {
    return traceId.slice(0, TRACE_CODE_LENGTH);
}

/**
 * Fresh tracing headers for one outbound request (Option 1: new trace_id and
 * span_id per call). traceparent and X-YB-Trace-Code are derived from the same
 * trace_id so they always match.
 */
export function createTracingHeaders(tradingAccountId?: number | null): TracingHeaders {
    const traceId = generateTraceId();
    const headers: TracingHeaders = {
        traceparent: generateTraceparent(traceId),
        'X-YB-APP-NAME': APP_NAME,
        'X-YB-APP-VERSION': getAppVersion(),
        'X-YB-Trace-Code': formatTraceCode(traceId),
    };

    if (tradingAccountId != null && tradingAccountId > 0) {
        headers['X-YB-TA-ID'] = String(tradingAccountId);
    }

    return headers;
}

function readHeaderFromRequestConfig(
    config: InternalAxiosRequestConfig | undefined,
    headerName: string
): string | undefined {
    if (!config?.headers) {
        return undefined;
    }

    const headers = config.headers;
    const lowerName = headerName.toLowerCase();

    if (typeof (headers as { get?: (name: string) => unknown }).get === 'function') {
        const value =
            (headers as { get: (name: string) => unknown }).get(headerName) ??
            (headers as { get: (name: string) => unknown }).get(lowerName);
        if (typeof value === 'string' && value.length > 0) {
            return value;
        }
    }

    const record = headers as Record<string, unknown>;
    const raw = record[headerName] ?? record[lowerName];
    return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

/** Read traceparent from an outgoing axios request config. */
export function extractTraceparentFromRequestConfig(
    config: InternalAxiosRequestConfig | undefined
): string | undefined {
    return readHeaderFromRequestConfig(config, 'traceparent');
}

/** Read X-YB-Trace-Code from an outgoing axios request config. */
export function extractTraceCodeFromRequestConfig(
    config: InternalAxiosRequestConfig | undefined
): string | undefined {
    return readHeaderFromRequestConfig(config, 'X-YB-Trace-Code');
}

export type RequestTraceReference = {
    traceparent?: string;
    traceCode?: string;
};

/** Read tracing headers sent on a failed outbound request. */
export function extractRequestTraceReference(
    config: InternalAxiosRequestConfig | undefined
): RequestTraceReference {
    return {
        traceparent: extractTraceparentFromRequestConfig(config),
        traceCode: extractTraceCodeFromRequestConfig(config),
    };
}

/** Parse trace_id from a W3C traceparent header value. */
export function extractTraceIdFromTraceparent(traceparent: string): string | undefined {
    const match = /^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/i.exec(traceparent.trim());
    return match?.[1]?.toLowerCase();
}

/** Resolve the trace reference for notifications from request headers. */
export function resolveTraceReference(
    traceparent?: string,
    traceCode?: string
): string | undefined {
    if (traceCode) {
        return traceCode;
    }

    if (!traceparent) {
        return undefined;
    }

    const traceId = extractTraceIdFromTraceparent(traceparent);
    return traceId ? formatTraceCode(traceId) : undefined;
}

/** Append a short trace reference for support / log lookup in TradingView notifications. */
export function formatNotificationWithTraceparent(
    text: string,
    traceparent?: string,
    traceCode?: string
): string {
    const reference = resolveTraceReference(traceparent, traceCode);
    if (!reference) {
        return text;
    }

    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return `Ref: ${reference}`;
    }

    const message = ensureSentenceEnding(trimmed);

    // TradingView toast notifications collapse whitespace and ignore newlines.
    return `${message} Ref: ${reference}`;
}

function ensureSentenceEnding(text: string): string {
    if (/[.!?]$/.test(text)) {
        return text;
    }

    return `${text}.`;
}
