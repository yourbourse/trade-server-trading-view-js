/**
 * Temporary TradingView Broker API Type Definitions
 *
 * Based on charting-library-context.txt
 * Replace with proper .d.ts imports when TradingView types are available:
 * import type { ... } from 'tradingview-charting-library';
 */

// ==================== ENUMS ====================

export enum OrderStatus {
    Canceled = 1,
    Filled = 2,
    Inactive = 3,
    Placing = 4,
    Rejected = 5,
    Working = 6,
}

export enum OrderStatusFilter {
    All = 0,
    Canceled = 1,
    Filled = 2,
    Inactive = 3,
    Rejected = 5,
    Working = 6,
}

export enum OrderType {
    Limit = 1,
    Market = 2,
    Stop = 3,
    StopLimit = 4,
}

// ==================== LOCALLY EXPORTED (as .js library does not export them even d.ts has it) ====================

// Even though Side is declared in the .d.ts file,
// the actual JavaScript runtime doesn't export it.
// By adding Side to your local types.ts and importing from there, both the TypeScript compiler and the runtime are happy.
export enum Side {
    Buy = 1,
    Sell = -1,
}

export enum ConnectionStatus {
    Connected = 1,
    Connecting = 2,
    Disconnected = 3,
    Error = 4,
}

export enum StandardFormatterName {
    Date = 'date',
    DateOrDateTime = 'dateOrDateTime',
    Default = 'default',
    Fixed = 'fixed',
    FixedInCurrency = 'fixedInCurrency',
    VariablePrecision = 'variablePrecision',
    FormatQuantity = 'formatQuantity',
    FormatPrice = 'formatPrice',
    FormatPriceForexSup = 'formatPriceForexSup',
    FormatPriceInCurrency = 'formatPriceInCurrency',
    IntegerSeparated = 'integerSeparated',
    LocalDate = 'localDate',
    LocalDateOrDateTime = 'localDateOrDateTime',
    Percentage = 'percentage',
    Pips = 'pips',
    Profit = 'profit',
    ProfitInInstrumentCurrency = 'profitInInstrumentCurrency',
    ProfitInPercent = 'profitInPercent',
    Side = 'side',
    PositionSide = 'positionSide',
    Status = 'status',
    Symbol = 'symbol',
    Text = 'text',
    Type = 'type',
    MarginPercent = 'marginPercent',
    Empty = 'empty',
}

export enum ParentType {
    Order = 1,
    Position = 2,
    IndividualPosition = 3,
}

// ==================== TYPE ALIASES ====================

export type AccountId = string;
