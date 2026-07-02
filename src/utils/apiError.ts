import type { ProblemDetails } from '../schema/public-api';
import { notificationService } from './notificationService';
import { createLogger } from './logger.js';

const logger = createLogger({ prefix: '[API]' });

export type ApiError = ProblemDetails & {
    /// <summary>
    /// HTTP status code
    /// </summary>
    /// <example>400</example>
    /// <example>500</example>
    status: number;
};

/**
 * Extracts a human-readable error message from API error or ProblemDetails
 * This is the core message extraction logic used by axios interceptor and error handlers
 * Priority: detail > title > message > description > 'Unknown error'
 */
export function extractErrorMessage(error: unknown): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorData = error as any;

    return errorData?.detail || errorData?.title || errorData?.message || errorData?.description || 'Unknown error';
}

/**
 * Gets the HTTP status code from an API error
 */
export function getErrorStatus(error: unknown): number | undefined {
    const apiError = error as { status?: number };
    return apiError.status;
}

/**
 * Handles API errors uniformly across the application
 * Extracts meaningful error message, logs it, shows notification, and re-throws
 *
 * @param error - The error object from API call
 * @param context - Context description for logging (e.g., 'Error placing order')
 * @throws Always throws an Error with the extracted message
 */
export function handleApiError(error: unknown, context: string): never {
    const errorMessage = extractErrorMessage(error);
    const statusCode = getErrorStatus(error);

    logger.error(`${context}:`, errorMessage, `(${statusCode || 'unknown'})`);
    notificationService.error('Request failed', errorMessage);
    throw new Error(errorMessage);
}

/**
 * Handles mutation (write) errors uniformly: a distinct `notifyTitle` per
 * call site gives each operation its own notification dedup key, so two
 * different failed mutations within the dedup window both surface instead
 * of the second being suppressed as a "duplicate" of the first.
 *
 * @throws Always throws an Error with the extracted message (or `throwFallback`)
 */
export function handleMutationError(
    error: unknown,
    opts: { logContext: string; notifyTitle: string; throwFallback: string }
): never {
    const status = getErrorStatus(error);
    if (status !== undefined && status >= 500) {
        notificationService.error(opts.notifyTitle, 'Check your orders before retrying');
    }
    const msg = extractErrorMessage(error);
    logger.error(`${opts.logContext}:`, msg, `(${status ?? 'unknown'})`);
    throw new Error(msg || opts.throwFallback);
}
