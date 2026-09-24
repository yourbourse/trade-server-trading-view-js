import type { CandleInterval } from '@/schema/public-api';
import { ResolutionString } from 'charting_library/charting_library';

export interface WebSocketConfig {
    intervalMapping: Record<ResolutionString, CandleInterval>;
    autoSubscribe: {
        orders: boolean;
        positions: boolean;
        accountStates: boolean;
        trades: boolean;
    };
    reconnect: {
        enabled: boolean;
        delay: number;
    };
}
