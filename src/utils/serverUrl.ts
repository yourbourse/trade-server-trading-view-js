/**
 * URL utilities for server URL handling
 */

/**
 * Derive REST API and WebSocket URLs from a server URL
 * @param server - Base server URL (e.g., "https://server.com" or "https://server.com/admin")
 * @returns Object with baseUrl (REST API) and wsUrl (WebSocket)
 */
export function deriveServerUrls(server: string): { baseUrl: string; wsUrl: string } {
    // Append /api/v1 if not already present
    const baseUrl = server.match(/\/api\/v\d+\/?$/) ? server : `${server}/api/v1`;

    // Derive WebSocket URL from REST API URL
    // Replace /api/vX with /ws/vX (preserving version number) and change protocol from http(s) to ws(s)
    const wsUrl = baseUrl
        .replace(/^https?:\/\//, (match) => match.replace('http', 'ws'))
        .replace(/\/api\/v(\d+)/, '/ws/v$1');

    return { baseUrl, wsUrl };
}
