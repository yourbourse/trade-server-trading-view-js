/**
 * Application version information
 */

import { createLogger } from './logger.js';

const logger = createLogger({ prefix: '[Version]' });

/**
 * Library version from package.json (injected as __LIB_VERSION__ at build time).
 * Prefer this over __APP_VERSION__ for request headers — VERSION env is only set
 * in some deployments and otherwise falls back to 0.0.0.
 */
export function getAppVersion(): string {
    return __LIB_VERSION__;
}

export function logLibraryVersion(): void {
    console.log('================================');
    console.log(`Library version: ${__LIB_VERSION__}`);
    console.log('================================');
}

export function displayVersion(elementId: string): void {
    const element = document.getElementById(elementId);
    if (!element) {
        logger.warn(`Version element #${elementId} not found`);
        return;
    }

    element.textContent = `v${__APP_VERSION__}`;
    element.title = 'Build version';
}
