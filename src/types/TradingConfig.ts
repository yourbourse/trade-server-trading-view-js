export interface TradingConfig {
    supportedOrderTypes: string[];
    supportedTimeInForce: string[];
    defaultLeverage: number;
    maxLeverage: number;
}
