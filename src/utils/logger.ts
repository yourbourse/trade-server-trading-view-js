/**
 * Simple Logging Utility
 * Provides structured logging with different levels
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
    /** Minimum log level to display */
    level?: LogLevel;
    /** Prefix for all log messages */
    prefix?: string;
    /** Enable/disable logging */
    enabled?: boolean;
}

class Logger {
    private level: LogLevel;
    private prefix: string;
    private enabled: boolean;
    private readonly levels: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
    };

    constructor(options: LoggerOptions = {}) {
        this.level = options.level || 'info';
        this.prefix = options.prefix || '[TradeServer]';
        this.enabled = options.enabled !== false;
    }

    /**
     * Set minimum log level
     */
    setLevel(level: LogLevel): void {
        this.level = level;
    }

    /**
     * Enable or disable logging
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /**
     * Check if a log level should be displayed
     */
    private shouldLog(level: LogLevel): boolean {
        return this.enabled && this.levels[level] >= this.levels[this.level];
    }

    /**
     * Format log message with prefix and timestamp
     */
    private formatMessage(level: LogLevel, message: string): string {
        const timestamp = new Date().toISOString();
        return `${this.prefix} [${level.toUpperCase()}] ${timestamp} - ${message}`;
    }

    /**
     * Log debug message
     */
    debug(message: string, ...args: unknown[]): void {
        if (this.shouldLog('debug')) {
            console.debug(this.formatMessage('debug', message), ...args);
        }
    }

    /**
     * Log info message
     */
    info(message: string, ...args: unknown[]): void {
        if (this.shouldLog('info')) {
            console.info(this.formatMessage('info', message), ...args);
        }
    }

    /**
     * Log warning message
     */
    warn(message: string, ...args: unknown[]): void {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message), ...args);
        }
    }

    /**
     * Log error message
     */
    error(message: string, ...args: unknown[]): void {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message), ...args);
        }
    }

    /**
     * Create a child logger with additional prefix
     */
    child(prefix: string): Logger {
        return new Logger({
            level: this.level,
            prefix: `${this.prefix}:${prefix}`,
            enabled: this.enabled,
        });
    }
}

// Default logger instance
export const logger = new Logger({ level: 'info', prefix: '[TradeServer]' });

// Export factory function for creating custom loggers
export function createLogger(options: LoggerOptions): Logger {
    return new Logger(options);
}
