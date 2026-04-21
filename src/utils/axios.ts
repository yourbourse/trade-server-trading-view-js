import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import axios, { AxiosError } from 'axios';

import type { ApiError } from '../utils/apiError';
import { extractErrorMessage } from '../utils/apiError';

import type { ProblemDetails } from '../schema/public-api';
import type { SkipUserMessage } from '../types/SkipUserMessage';
import { notificationService } from './notificationService';

import { client as publicAxiosClient } from '../schema/public-api/client.gen';

// Use the singleton client instance that gets configured by TradeServerClient

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

const handleNetworkError = (error: AxiosError, problemDetails: ProblemDetails): Promise<ApiError> => {
    if (shouldIgnoreNetworkErrors(error.config)) {
        return Promise.reject({
            status: getAxiosErrorCode(error.response),
            ...problemDetails,
        } as ApiError);
    }

    const errorMessage = extractErrorMessage({ ...problemDetails, message: error.message });

    // Show network error notification
    notificationService.error('Network Error', errorMessage);

    return Promise.reject({
        status: getAxiosErrorCode(error.response),
        ...problemDetails,
    } as ApiError);
};

const handleHttpStatusError = async (error: AxiosError, problemDetails: ProblemDetails): Promise<ApiError> => {
    const ignoredStatusCodes = getIgnoredStatusCodes(error.config);
    const shouldSkipUserMessage = error.response?.status && ignoredStatusCodes.includes(error.response.status);

    if (!shouldSkipUserMessage) {
        const errorMessage = extractErrorMessage({
            ...problemDetails,
            message: error.message,
            statusText: error.response?.statusText,
        });
        const statusCode = error.response?.status || 500;

        if (statusCode >= 400 && statusCode < 500) {
            // 4xx errors - Client errors (including 400 Bad Request)
            const title = problemDetails.title || `Error ${statusCode}`;
            notificationService.error(title, errorMessage);
        } else {
            // 5xx errors - Server errors
            notificationService.error('Server Error', errorMessage);
        }
    }

    return Promise.reject({
        status: getAxiosErrorCode(error.response),
        ...problemDetails,
    } as ApiError);
};

const isNetworkError = (error: AxiosError): boolean => {
    return error?.code === AxiosError.ERR_NETWORK || error?.message === 'Network Error';
};

const onFulfilled = (response: AxiosResponse) => {
    if (response.status < 200 || response.status >= 300) {
        const errorMessage = 'Unable to perform operation';

        // Show error notification for non-2xx responses
        notificationService.error(`Error ${response.status}`, errorMessage);

        return Promise.reject({
            status: getAxiosErrorCode(response),
            detail: errorMessage,
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
