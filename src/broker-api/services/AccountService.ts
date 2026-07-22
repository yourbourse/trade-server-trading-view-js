import {
    AccountId,
    AccountManagerInfo,
    AccountMetainfo,
    AccountManagerPage,
    AccountManagerTable,
    AccountManagerSummaryField,
    IWatchedValue,
    IBrokerConnectionAdapterHost,
    IDelegate,
} from '../../../charting_library/charting_library';
import type {
    AccountState as TradeServerAccountState,
    TransferHistory as TradeServerTransferHistory,
} from '../../schema/public-api';
import { TradeServerClient } from '@/trade-server-api/TradeServerClient';
import { OrderStatus, StandardFormatterName } from '../types';
import {
    ordersPageColumns,
    positionsPageColumns,
    accountProfileColumns,
    transferHistoryColumns,
    tradeHistoryColumns,
    ordersHistoryColumns,
} from '../columns';
import { formatTimestamp } from '../type-mappings';
import { TradeHistoryService } from './TradeHistoryService.js';
import { OrderHistoryService } from './OrderHistoryService.js';
import CONFIG from '@/config';
import { deriveServerUrls } from '@/utils/serverUrl.js';
import { createLogger } from '@/utils/logger.js';

const logger = createLogger({ prefix: '[AccountService]' });

interface AccountManagerData {
    title: string;
    balance: number;
    equity: number;
    pl: number;
}

export class AccountService {
    private api: TradeServerClient;
    private host: IBrokerConnectionAdapterHost;
    private tradeHistoryService: TradeHistoryService;
    private orderHistoryService: OrderHistoryService;

    private readonly accountManagerData: AccountManagerData = {
        title: 'Demo account',
        balance: 10000000,
        equity: 10000000,
        pl: 0,
    };

    private balanceWatchedValue!: IWatchedValue<number>;
    private equityWatchedValue!: IWatchedValue<number>;
    private plWatchedValue!: IWatchedValue<number>;
    private marginWatchedValue!: IWatchedValue<number>;
    private creditWatchedValue!: IWatchedValue<number>;
    private currencyWatchedValue!: IWatchedValue<string>;
    private collateralWatchedValue!: IWatchedValue<number>;

    private accountDetailsChangeDelegate!: IDelegate<(data: {}) => void>;
    private equityUpdateSubscribed = false;

    private readonly accountDataReady: Promise<void>;

    private accountProfileData: Array<{ id: string; field: string; value: string }> = [];
    private transferHistoryData: Array<{
        id: string;
        time: string;
        type: string;
        amount: number;
        currency: string;
        comment: string;
    }> = [];
    constructor(
        api: TradeServerClient,
        host: IBrokerConnectionAdapterHost,
        tradeHistoryService: TradeHistoryService,
        orderHistoryService: OrderHistoryService
    ) {
        this.api = api;
        this.host = host;
        this.tradeHistoryService = tradeHistoryService;
        this.orderHistoryService = orderHistoryService;

        this.balanceWatchedValue = this.host.factory.createWatchedValue(this.accountManagerData.balance);
        this.equityWatchedValue = this.host.factory.createWatchedValue(this.accountManagerData.equity);
        this.plWatchedValue = this.host.factory.createWatchedValue(this.accountManagerData.pl);
        this.marginWatchedValue = this.host.factory.createWatchedValue(0);
        this.creditWatchedValue = this.host.factory.createWatchedValue(0);
        this.currencyWatchedValue = this.host.factory.createWatchedValue('USD');
        this.collateralWatchedValue = this.host.factory.createWatchedValue(0);

        this.accountDataReady = this.loadInitialAccountData();
    }

    ensureAccountDataLoaded(): Promise<void> {
        return this.accountDataReady;
    }

    private async loadInitialAccountData(): Promise<void> {
        try {
            logger.info('Fetching initial account data...');

            const accountState = (await this.api.account.getAccountInfo()) as TradeServerAccountState;

            if (accountState) {
                if (accountState.b !== undefined) {
                    this.accountManagerData.balance = accountState.b;
                    this.balanceWatchedValue.setValue(accountState.b);
                }
                if (accountState.e !== undefined) {
                    this.accountManagerData.equity = accountState.e;
                    this.equityWatchedValue.setValue(accountState.e);
                }
                if (accountState.pl !== undefined) {
                    this.accountManagerData.pl = accountState.pl;
                    this.plWatchedValue.setValue(accountState.pl);
                }
                if (accountState.m !== undefined) {
                    this.marginWatchedValue.setValue(accountState.m);
                }
                if (accountState.C !== undefined) {
                    this.creditWatchedValue.setValue(accountState.C);
                }
                if (accountState.c !== undefined) {
                    this.currencyWatchedValue.setValue(accountState.c);
                }
                if (accountState.a !== undefined) {
                    this.collateralWatchedValue.setValue(accountState.a);
                }

                logger.info('Initial account data loaded:', {
                    balance: accountState.b,
                    equity: accountState.e,
                    pl: accountState.pl,
                    margin: accountState.m,
                    credit: accountState.C,
                    currency: accountState.c,
                    collateral: accountState.a,
                });
            }
        } catch (error) {
            logger.error('Error fetching initial account data:', error);
        }
    }

    handleAccountStateUpdate(data: { data: TradeServerAccountState[] }): void {
        const { data: states } = data;

        if (states && states.length > 0) {
            const state = states[0];
            if (state) {
                if (state.b !== undefined) {
                    this.accountManagerData.balance = state.b;
                    this.balanceWatchedValue.setValue(state.b);
                }
                if (state.e !== undefined) {
                    this.accountManagerData.equity = state.e;
                    this.equityWatchedValue.setValue(state.e);
                }
                if (state.pl !== undefined) {
                    this.plWatchedValue.setValue(state.pl);
                }
                if (state.m !== undefined) {
                    this.marginWatchedValue.setValue(state.m);
                }
                if (state.C !== undefined) {
                    this.creditWatchedValue.setValue(state.C);
                }
                if (state.c !== undefined) {
                    this.currencyWatchedValue.setValue(state.c);
                }
                if (state.a !== undefined) {
                    this.collateralWatchedValue.setValue(state.a);
                }

                logger.debug('Account state updated:', {
                    balance: state.b,
                    equity: state.e,
                    pl: state.pl,
                    margin: state.m,
                });

                if (this.equityUpdateSubscribed && state.e !== undefined) {
                    this.host.equityUpdate(state.e);
                }
            }
        }
    }

    setEquityUpdateSubscribed(subscribed: boolean): void {
        this.equityUpdateSubscribed = subscribed;
    }

    getEquity(): number {
        return this.equityWatchedValue.value();
    }

    getAccountCurrency(): string {
        return this.currencyWatchedValue.value();
    }

    recalculateAMData(positions: unknown[]): void {
        let totalPl = 0;
        positions.forEach((position: any) => {
            if (position.pl !== undefined) {
                totalPl += position.pl || 0;
            }
        });

        this.accountManagerData.pl = totalPl;
    }

    getAccountManagerInfo(): AccountManagerInfo {
        logger.debug('getAccountManagerInfo() called - initializing account manager');

        this.accountDetailsChangeDelegate = this.host.factory.createDelegate() as IDelegate<(data: {}) => void>;
        logger.debug('Account manager delegate created');

        const summaryFields: AccountManagerSummaryField[] = [
            {
                text: 'Balance',
                wValue: this.balanceWatchedValue,
                formatter: 'fixed' as StandardFormatterName,
                isDefault: true,
            },
            {
                text: 'Equity',
                wValue: this.equityWatchedValue,
                formatter: 'fixed' as StandardFormatterName,
                isDefault: true,
            },
            {
                text: 'P/L',
                wValue: this.plWatchedValue,
                formatter: 'profit' as StandardFormatterName,
            },
            {
                text: 'Margin',
                wValue: this.marginWatchedValue,
                formatter: 'fixed' as StandardFormatterName,
            },
            {
                text: 'Credit',
                wValue: this.creditWatchedValue,
                formatter: 'fixed' as StandardFormatterName,
            },
            {
                text: 'Collateral',
                wValue: this.collateralWatchedValue,
                formatter: 'fixed' as StandardFormatterName,
            },
        ];

        const accountDetailsTable: AccountManagerTable = {
            id: 'accountProfile',
            title: 'Account Profile',
            columns: accountProfileColumns,
            getData: async () => {
                logger.debug('getData() called for account profile table');
                await this.loadAccountProfileData();
                return this.accountProfileData;
            },
            changeDelegate: this.accountDetailsChangeDelegate,
        };

        const accountPage: AccountManagerPage = {
            id: 'account',
            title: 'Account',
            tables: [accountDetailsTable],
        };

        const transferHistoryTable: AccountManagerTable = {
            id: 'transferHistory',
            title: 'Transfers',
            columns: transferHistoryColumns,
            getData: async () => {
                logger.debug('getData() called for transfer history table');
                await this.loadTransferHistoryData();
                return this.transferHistoryData;
            },
            changeDelegate: this.accountDetailsChangeDelegate,
        };

        const transferHistoryPage: AccountManagerPage = {
            id: 'transferHistory',
            title: 'Cash Transfers',
            tables: [transferHistoryTable],
        };

        const tradeHistoryTable: AccountManagerTable = {
            id: 'tradeHistory',
            columns: tradeHistoryColumns,
            initialSorting: {
                property: 'time',
                asc: false,
            },
            flags: {
                supportPagination: true,
            },
            getData: async (paginationLastId?: string | number) => {
                logger.debug('getData() called for trade history table', { paginationLastId });
                return this.tradeHistoryService.getTradeHistory(paginationLastId);
            },
            changeDelegate: this.accountDetailsChangeDelegate,
        };

        const tradeHistoryPage: AccountManagerPage = {
            id: 'tradeHistory',
            title: 'Trade History',
            tables: [tradeHistoryTable],
        };

        const ordersHistoryTable: AccountManagerTable = {
            id: 'ordersHistory',
            columns: ordersHistoryColumns,
            initialSorting: {
                property: 'time',
                asc: false,
            },
            flags: {
                supportPagination: true,
            },
            getData: async (paginationLastId?: string | number) => {
                logger.debug('getData() called for orders history table', { paginationLastId });
                return this.orderHistoryService.getOrderHistory(paginationLastId);
            },
            changeDelegate: this.accountDetailsChangeDelegate,
        };

        const ordersHistoryPage: AccountManagerPage = {
            id: 'ordersHistory',
            title: 'Orders History',
            tables: [ordersHistoryTable],
        };

        return {
            accountTitle: 'Trading Account',
            summary: summaryFields,
            orderColumns: ordersPageColumns,
            positionColumns: positionsPageColumns,
            possibleOrderStatuses: [OrderStatus.Working, OrderStatus.Inactive],
            pages: [accountPage, tradeHistoryPage, ordersHistoryPage, transferHistoryPage],
        };
    }

    private async loadAccountProfileData(): Promise<void> {
        try {
            const currency = this.currencyWatchedValue.value();

            this.accountProfileData = [
                {
                    id: 'currency',
                    field: 'Currency',
                    value: currency,
                },
                {
                    id: 'serverUrl',
                    field: 'Server URL',
                    value: deriveServerUrls(CONFIG.tradeServer.server).baseUrl,
                },
                {
                    id: 'accountId',
                    field: 'Account ID',
                    value: CONFIG.tradeServer.user.login.toString(),
                },
            ];

            logger.debug('Account profile data loaded:', this.accountProfileData.length, 'items');
        } catch (error) {
            logger.error('Error loading account profile data:', error);
            this.accountProfileData = [
                {
                    id: 'error',
                    field: 'Error',
                    value: 'Failed to load account profile',
                },
            ];
        }
    }

    private async loadTransferHistoryData(): Promise<void> {
        try {
            logger.debug('Fetching transfer history from API...');
            const result = await this.api.account.getTransfersHistory({ maxResults: 50, sortOrder: 'desc' });
            const transfers = result?.transfers || [];

            if (!Array.isArray(transfers) || transfers.length === 0) {
                logger.warn('No transfers returned from API');
                this.transferHistoryData = [];
                return;
            }

            this.transferHistoryData = transfers.map((transfer: TradeServerTransferHistory) => {
                const formattedTime = formatTimestamp(transfer.t);

                return {
                    id: transfer.id.toString(),
                    time: formattedTime,
                    type: transfer.T,
                    amount: transfer.a,
                    currency: transfer.c,
                    comment: transfer.ct || '',
                };
            });

            logger.info('Transfer history loaded:', this.transferHistoryData.length, 'transfers');
        } catch (error) {
            logger.error('Error loading transfer history:', error);
            const formattedTime = formatTimestamp(Date.now() * 1000);

            this.transferHistoryData = [
                {
                    id: 'error',
                    time: formattedTime,
                    type: 'Error',
                    amount: 0,
                    currency: '',
                    comment: 'Failed to load transfer history',
                },
            ];
        }
    }

    getCurrentAccount(): AccountId {
        return CONFIG.tradeServer.user.login.toString() as AccountId;
    }

    async getAccountsMetainfo(): Promise<AccountMetainfo[]> {
        await this.ensureAccountDataLoaded();

        return [
            {
                id: CONFIG.tradeServer.user.login.toString() as AccountId,
                name: CONFIG.tradeServer.user.login.toString(),
                currency: this.getAccountCurrency(),
            },
        ];
    }
}
