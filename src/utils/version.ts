/**
 * Application version information
 */

import { createLogger } from './logger.js';

const logger = createLogger({ prefix: '[Version]' });

export function displayVersion(elementId: string): void {
    const element = document.getElementById(elementId);
    if (!element) {
        logger.warn(`Version element #${elementId} not found`);
        return;
    }

    element.textContent = `v${__APP_VERSION__}`;
    element.title = 'Build version';
}
