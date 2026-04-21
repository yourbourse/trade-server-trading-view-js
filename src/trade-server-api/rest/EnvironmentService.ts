/**
 * Environment Service
 * Handles environment-related API calls (version, environment info)
 */

import axios from 'axios';
import { logger } from '../../utils/logger.js';

export interface EnvironmentInfo {
    ENVIRONMENT: string;
    VERSION: string;
}

export class EnvironmentService {
    private log = logger.child('EnvironmentService');

    /**
     * Get environment information (version, environment name)
     * GET /env
     * Returns null if endpoint is not available (expected in local development)
     */
    async getEnvironmentInfo(): Promise<EnvironmentInfo | null> {
        this.log.debug('Fetching environment info');

        try {
            const url = `${window.location.origin}/env`;

            this.log.debug(`Fetching from: ${url}`);

            const response = await axios.get<EnvironmentInfo>(url, {
                timeout: 3000, // 3 second timeout
            });

            this.log.debug('Environment info fetched successfully:', response.data);
            return response.data;
        } catch (error) {
            // /env endpoint is not available in local development, this is expected
            // Only log debug message, not error
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
                    this.log.debug('/env endpoint not available (expected in local development)');
                } else {
                    this.log.debug('Failed to fetch environment info:', error.message);
                }
            }
            return null;
        }
    }
}
