/**
 * Trade Server API
 * Main entry point - exports the new modular architecture
 */

// Main client
export { TradeServerClient } from './TradeServerClient.js';

// Service modules
export * from './rest/index.js';

// WebSocket modules
export * from './websocket/index.js';

// Types
export * from './types/index.js';

// Errors
export * from './errors/index.js';

// Backward compatibility: export TradeServerClient as default
export { TradeServerClient as default } from './TradeServerClient.js';
