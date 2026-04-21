/**
 * Base error class for all Trade Server API errors
 */
export class TradeServerError extends Error {
    public readonly code: string;
    public readonly statusCode?: number;
    public readonly details?: unknown;

    constructor(message: string, code: string = 'TRADE_SERVER_ERROR', statusCode?: number, details?: unknown) {
        super(message);
        this.name = 'TradeServerError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        const ErrorWithCaptureStackTrace = Error as unknown as { captureStackTrace?: (t: object, c: object) => void };
        if (ErrorWithCaptureStackTrace.captureStackTrace) {
            ErrorWithCaptureStackTrace.captureStackTrace(this, TradeServerError);
        }
    }
}
