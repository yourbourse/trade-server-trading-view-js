import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import axios, { AxiosError } from 'axios';

import type { ApiError } from '../utils/apiError';
import { extractErrorMessage } from '../utils/apiError';

import type { ProblemDetails } from '../schema/public-api';
import type { SkipUserMessage } from '../types/SkipUserMessage';
import { logger } from './logger.js';
import { notificationService } from './notificationService';

import { client as publicAxiosClient } from '../schema/public-api/client.gen';

const log = logger.child('AxiosInterceptor');

// Called by the interceptor when a 401, 403, or 502 is received (unless opted out).
// TradeServerClient registers () => this.refreshNow() in its constructor.
// A no-op when no handler is registered (e.g. sign-in page).
let refreshProbeHandler: (() => Promise<boolean>) | null = null;

export function setRefreshProbeHandler(fn: () => Promise<boolean>): void {
    refreshProbeHandler = fn;
}

const shouldIgnoreNetworkErrors = (config: InternalAxiosRequestConfig | undefined): boolean => {
    return !!(
        config &&
        '__ignoreNetworkErrors' in config &&
        (config as InternalAxiosRequestConfig & SkipUserMessage).__ignoreNetworkErrors
    );
};

const getIgnoredStatusCodes = (config: InternalAxiosRequestConfig | undefined): number[] => {
    if (config && '__ignoreStatusCodes' in config) {
        return (config as InternalAxiosRequestConfig & SkipUserMessage).__ignoreStatusCodes ?? [];
    }
    return [];
};

const getRetryAfterSeconds = (error: AxiosError): number | null => {
    const header = error.response?.headers?.['retry-after'];
    if (!header) return null;
    const n = Number(header);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

const handleNetworkError = (error: AxiosError, problemDetails: ProblemDetails): Promise<ApiError> => {
    if (shouldIgnoreNetworkErrors(error.config)) {
        return Promise.reject({
            status: getAxiosErrorCode(error.response),
            ...problemDetails,
        } as ApiError);
    }

    // Anything with no readable response lands here — genuine offline, a
    // blocked/interrupted request, or a CORS-stripped error response. In the
    // overwhelming majority of cases the cause is on the client's side, not the
    // server, so we frame it as a lost connection rather than a server fault.
    // Keep the technical detail in the log for diagnostics (e.g. telling an
    // ERR_NETWORK apart from a CORS-blocked error response) — the toast is
    // deliberately generic, but this preserves what actually happened.
    log.warn('Network error (no readable response):', {
        code: error.code,
        message: error.message,
        url: error.config?.url,
    });
    notificationService.error('Connection Lost', 'Please check your connection and try again.');

    return Promise.reject({
        status: getAxiosErrorCode(error.response),
        ...problemDetails,
    } as ApiError);
};

const handleHttpStatusError = async (error: AxiosError, problemDetails: ProblemDetails): Promise<ApiError> => {
    const status = error.response?.status ?? 500;
    const ignoredStatusCodes = getIgnoredStatusCodes(error.config);
    const isIgnored = ignoredStatusCodes.includes(status);

    if (!isIgnored) {
        const retryAfter = getRetryAfterSeconds(error);

        switch (status) {
            case 401:
            case 403:
            case 502:
                // No toast — let the refresh probe determine the outcome.
                // If probe succeeds → transient, notify the user to retry.
                // If probe fails → doRefresh signs the user out.
                break;

            case 429: {
                const wait = retryAfter !== null ? ` Please wait ${retryAfter} seconds.` : ' Please slow down.';
                notificationService.error('Too Many Requests', `You are sending too many requests.${wait}`);
                break;
            }

            case 500:
            case 503:
            case 504: {
                const detail = extractErrorMessage({ ...problemDetails, message: error.message });
                notificationService.error(
                    'Connection Problem',
                    detail && detail !== 'Unknown error'
                        ? detail
                        : 'The server encountered a problem. Please try again in a moment.'
                );
                break;
            }

            default: {
                // 4xx client errors (400, 404, 412, 413, 415, …)
                const errorMessage = extractErrorMessage({
                    ...problemDetails,
                    message: error.message,
                    statusText: error.response?.statusText,
                });
                const title =
                    problemDetails.title ||
                    (status >= 400 && status < 500 ? `Error ${status}` : 'Server Error');
                notificationService.error(title, errorMessage);
                break;
            }
        }

        // Trigger the refresh probe on 401, 403, or 502 (coalesced — N concurrent
        // callers share one in-flight refresh, so they collapse to a single
        // "Reconnected" toast via the notification dedup window). The probe
        // itself signs out if /refresh fails; the original request is never
        // auto-resent, so a successful probe just asks the user to retry.
        if ((status === 401 || status === 403 || status === 502) && refreshProbeHandler) {
            void refreshProbeHandler()
                .then((ok) => {
                    if (ok) notificationService.success('Reconnected', 'Please try your last action again.');
                })
                .catch((err) => log.error('Refresh probe failed unexpectedly:', err));
        }
    }

    return Promise.reject({
        status: getAxiosErrorCode(error.response),
        ...problemDetails,
    } as ApiError);
};

const isNetworkError = (error: AxiosError): boolean => {
    // No readable response at all — genuine offline, a timeout, a blocked/interrupted
    // request, or a CORS-stripped error response. Matches handleNetworkError's intent
    // below rather than pattern-matching specific codes/messages, so a timeout
    // (ECONNABORTED) or any other no-response failure is covered too.
    return !error?.response;
};

const onFulfilled = (response: AxiosResponse) => {
    // The default validateStatus never routes non-2xx here; this branch is dead
    // code retained only for safety in case a custom validateStatus is set.
    if (response.status < 200 || response.status >= 300) {
        notificationService.error(`Error ${response.status}`, 'Unable to perform operation');
        return Promise.reject({
            status: getAxiosErrorCode(response),
            detail: 'Unable to perform operation',
        } as ApiError);
    }
    return response;
};

const onRejected = async (error: AxiosError) => {
    if (axios.isCancel(error)) {
        return Promise.reject(error);
    }

    const problemDetails = (error.response?.data ?? {}) as ProblemDetails;

    if (isNetworkError(error)) {
        return handleNetworkError(error, problemDetails);
    }

    return handleHttpStatusError(error, problemDetails);
};

publicAxiosClient.instance.interceptors.response.use(onFulfilled, onRejected);

const getAxiosErrorCode = (response: AxiosResponse | undefined): number => response?.status ?? 500;

export { publicAxiosClient };
