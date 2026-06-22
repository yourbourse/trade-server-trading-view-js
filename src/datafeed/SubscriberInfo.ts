import type { Bar, LibrarySymbolInfo, ResolutionString, SubscribeBarsCallback } from 'charting_library/datafeed-api';
import type { SubscriptionCallback } from '../trade-server-api/websocket/SubscriptionManager.js';
import type { CandleInterval } from '../schema/public-api/types.gen.js';

export interface SubscriberInfo {
    symbolInfo: LibrarySymbolInfo;
    resolution: ResolutionString;
    interval: CandleInterval;
    barDurationMs?: number;
    callback: SubscribeBarsCallback;
    candleCallback?: SubscriptionCallback;
    quoteCallback?: SubscriptionCallback;
    latestOfficialBar?: Bar;
    latestQuoteTimestampMs?: number;
}
