import { TradingTerminalWidgetOptions } from 'charting_library/charting_library';
import { WebSocketConfig } from './WebSocketConfig';
import { MarketDataConfig } from './MarketDataConfig';
import { TradeServerConfig } from './TradeServerConfig';

export interface AppConfig {
    tradeServer: TradeServerConfig;
    tradingView: Partial<TradingTerminalWidgetOptions>;
    marketData: MarketDataConfig;
    websocket: WebSocketConfig;
}
