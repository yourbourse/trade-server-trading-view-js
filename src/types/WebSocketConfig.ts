import type { Interval } from '@/schema/public-api';
import { ResolutionString } from 'charting_library/charting_library';

export interface WebSocketConfig {
    intervalMapping: Record<ResolutionString, Interval>;
    autoSubscribe: {
        orders: boolean;
        positions: boolean;
        balances: boolean;
        accountStates: boolean;
        trades: boolean;
    };
    reconnect: {
        enabled: boolean;
        delay: number;
    };
}
