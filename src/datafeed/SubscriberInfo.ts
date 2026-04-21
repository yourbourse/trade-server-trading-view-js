import type { LibrarySymbolInfo, ResolutionString, SubscribeBarsCallback } from 'charting_library/datafeed-api';
import type { SubscriptionCallback } from '../trade-server-api/websocket/SubscriptionManager.js';

export interface SubscriberInfo {
    symbolInfo: LibrarySymbolInfo;
    resolution: ResolutionString;
    callback: SubscribeBarsCallback;
    candleCallback?: SubscriptionCallback;
}
