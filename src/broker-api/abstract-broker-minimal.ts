import {
    AccountId,
    AccountManagerInfo,
    AccountMetainfo,
    ActionMetaInfo,
    ConnectionStatus,
    DefaultContextMenuActionsParams,
    Execution,
    IBrokerConnectionAdapterHost,
    IBrokerTerminal,
    InstrumentInfo,
    IsTradableResult,
    Order,
    PlaceOrderResult,
    Position,
    PreOrder,
    TradeContext,
} from '../../charting_library/charting_library';

import { IDatafeedQuotesApi } from '../../charting_library/datafeed-api';

export abstract class AbstractBrokerMinimal implements IBrokerTerminal {
    protected readonly host: IBrokerConnectionAdapterHost;
    protected readonly quotesProvider: IDatafeedQuotesApi;

    public constructor(host: IBrokerConnectionAdapterHost, quotesProvider: IDatafeedQuotesApi) {
        this.host = host;
        this.quotesProvider = quotesProvider;
    }

    public abstract connectionStatus(): ConnectionStatus;

    public abstract currentAccount(): AccountId;

    public abstract isTradable(symbol: string): Promise<boolean | IsTradableResult>;

    public abstract symbolInfo(symbol: string): Promise<InstrumentInfo>;

    public abstract orders(): Promise<Order[]>;

    public abstract positions(): Promise<Position[]>;

    public abstract executions(symbol: string): Promise<Execution[]>;

    public abstract placeOrder(order: PreOrder): Promise<PlaceOrderResult>;

    public abstract modifyOrder(order: Order, confirmId?: string): Promise<void>;

    public abstract cancelOrder(orderId: string): Promise<void>;

    public abstract accountManagerInfo(): AccountManagerInfo;

    public abstract accountsMetainfo(): Promise<AccountMetainfo[]>;

    public abstract chartContextMenuActions(
        context: TradeContext,
        options?: DefaultContextMenuActionsParams
    ): Promise<ActionMetaInfo[]>;
}
