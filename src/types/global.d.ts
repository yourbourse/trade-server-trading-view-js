/**
 * Global type declarations for browser globals
 */

import type { AppConfig } from './AppConfig';

declare const CONFIG: AppConfig;
declare const TradingView: unknown;
declare const CryptoJS: unknown;

declare function getGETHeaders(user: {
    username: string | number;
    password: string;
    apiKey: string;
}): Record<string, string>;
declare function getPOSTHeaders(
    user: { username: string | number; password: string; apiKey: string },
    data: unknown,
    method: string
): Record<string, string>;
