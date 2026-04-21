import { AuthUser } from './AuthUser';

// ============================================================================
// Configuration Types
// ============================================================================

export interface TradeServerConfig {
    server: string;
    user: AuthUser;
    timeout: number;
}
