/**
 * REST API-specific error class
 */
import { TradeServerError } from './TradeServerError.js';

export class ApiError extends TradeServerError {
    constructor(message: string, code: string = 'API_ERROR', statusCode?: number, details?: unknown) {
        super(message, code, statusCode, details);
        this.name = 'ApiError';
    }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends ApiError {
    constructor(message: string = 'Authentication failed', details?: unknown) {
        super(message, 'AUTHENTICATION_ERROR', 401, details);
        this.name = 'AuthenticationError';
    }
}

/**
 * Error thrown when authorization fails
 */
export class AuthorizationError extends ApiError {
    constructor(message: string = 'Insufficient permissions', details?: unknown) {
        super(message, 'AUTHORIZATION_ERROR', 403, details);
        this.name = 'AuthorizationError';
    }
}

/**
 * Error thrown when resource is not found
 */
export class NotFoundError extends ApiError {
    constructor(resource: string, details?: unknown) {
        super(`Resource not found: ${resource}`, 'NOT_FOUND', 404, details);
        this.name = 'NotFoundError';
    }
}

/**
 * Error thrown when request validation fails
 */
export class ValidationError extends ApiError {
    constructor(message: string, details?: unknown) {
        super(message, 'VALIDATION_ERROR', 400, details);
        this.name = 'ValidationError';
    }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends ApiError {
    constructor(message: string = 'Rate limit exceeded', details?: unknown) {
        super(message, 'RATE_LIMIT_ERROR', 429, details);
        this.name = 'RateLimitError';
    }
}
