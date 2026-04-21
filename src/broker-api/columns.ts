/**
 * This file defines the structure of the Account Manager pages: "Orders", "Positions", and "Account Summary".
 * Each Account Manager page is a table, where each column is an `AccountManagerColumnBase` object.
 * These objects are used in the `accountManagerInfo` method which builds the Account Manager.
 */
// import {
// 	AccountManagerColumn,
// 	OrderTableColumn,
// 	//OrderStatusFilter,
// 	StandardFormatterName,
// 	FormatterName,
// } from '../../charting_library/charting_library';

// import {
// 	AccountManagerColumn,
// 	OrderTableColumn,
// 	OrderStatusFilter,
// 	StandardFormatterName,
// 	FormatterName,
// } from '../../charting_library/charting_library';

// import type {
// 	AccountManagerColumn,
// 	OrderTableColumn,
// 	OrderStatusFilter,
// 	StandardFormatterName,
// 	FormatterName,
// } from '../../charting_library/charting_library';

import { AccountManagerColumn, FormatterName, OrderTableColumn } from 'charting_library/charting_library';
import { CommonAccountManagerColumnId } from '../../charting_library/broker-api';
import { OrderStatusFilter, StandardFormatterName } from './types';

/**
 * Column structure for the "Orders" page
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ordersPageColumns: OrderTableColumn[] = [
    {
        label: 'Symbol',
        formatter: 'symbol' as StandardFormatterName,
        id: CommonAccountManagerColumnId.Symbol,
        dataFields: ['symbol', 'symbol', 'message'],
    },
    {
        label: 'Side',
        id: 'side',
        dataFields: ['side'],
        formatter: 'side' as StandardFormatterName,
    },
    {
        label: 'Type',
        id: 'type',
        dataFields: ['type', 'parentId', 'stopType'],
        formatter: 'type' as StandardFormatterName,
    },
    {
        label: 'Qty',
        alignment: 'right',
        id: 'qty',
        dataFields: ['qty'],
        help: 'Size in lots',
        formatter: 'formatQuantity' as StandardFormatterName,
    },
    {
        label: 'Limit Price',
        alignment: 'right',
        id: 'limitPrice',
        dataFields: ['limitPrice'],
        formatter: 'formatPrice' as StandardFormatterName,
    },
    {
        label: 'Stop Price',
        alignment: 'right',
        id: 'stopPrice',
        dataFields: ['stopPrice'],
        formatter: 'formatPrice' as StandardFormatterName,
    },
    {
        label: 'Date/Time',
        id: 'time',
        dataFields: ['time'],
        formatter: 'text' as StandardFormatterName,
    },
    {
        label: 'Status',
        id: 'status',
        dataFields: ['status'],
        formatter: 'status' as StandardFormatterName,
        supportedStatusFilters: [OrderStatusFilter.All],
    },
    {
        label: 'Order ID',
        id: 'id',
        dataFields: ['id'],
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

/**
 * Column structure for the "Positions" page
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const positionsPageColumns: AccountManagerColumn[] = [
    {
        label: 'Symbol',
        formatter: 'symbol' as StandardFormatterName,
        id: CommonAccountManagerColumnId.Symbol,
        dataFields: ['symbol', 'symbol', 'message'],
    },
    {
        label: 'Side',
        id: 'side',
        dataFields: ['side'],
        formatter: 'side' as StandardFormatterName,
    },
    {
        label: 'Qty',
        alignment: 'right',
        id: 'qty',
        dataFields: ['qty'],
        help: 'Size in lots',
        formatter: 'formatQuantity' as StandardFormatterName,
    },
    {
        label: 'Avg Fill Price',
        alignment: 'right',
        id: 'avgPrice',
        dataFields: ['avgPrice'],
        formatter: 'formatPrice' as StandardFormatterName,
    },
    {
        label: 'Profit',
        alignment: 'right',
        id: 'pl',
        dataFields: ['pl'],
        formatter: 'profit' as StandardFormatterName,
    },
    {
        label: 'Date/Time',
        id: 'time',
        dataFields: ['time'],
        formatter: 'text' as StandardFormatterName,
    },
    {
        label: 'Stop Loss',
        alignment: 'right',
        id: 'stopLoss',
        dataFields: ['stopLoss'],
        formatter: 'formatPrice' as StandardFormatterName,
    },
    {
        label: 'Take Profit',
        alignment: 'right',
        id: 'takeProfit',
        dataFields: ['takeProfit'],
        formatter: 'formatPrice' as StandardFormatterName,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

/**
 * Column structure for the custom "Account Summary" page
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const accountSummaryColumns: AccountManagerColumn[] = [
    {
        label: 'Title',
        notSortable: true,
        id: 'title',
        dataFields: ['title'],
        formatter: 'custom_uppercase' as FormatterName,
    },
    {
        label: 'Balance',
        alignment: 'right',
        id: 'balance',
        dataFields: ['balance'],
        formatter: 'fixed' as StandardFormatterName,
    },
    {
        label: 'Open PL',
        alignment: 'right',
        id: 'pl',
        dataFields: ['pl'],
        formatter: 'profit' as StandardFormatterName,
        notSortable: true,
    },
    {
        label: 'Equity',
        alignment: 'right',
        id: 'equity',
        dataFields: ['equity'],
        formatter: 'fixed' as StandardFormatterName,
        notSortable: true,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

/**
 * Column structure for the "Account Profile" table
 * Displays static account information
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const accountProfileColumns: AccountManagerColumn[] = [
    {
        label: 'Property',
        id: 'field',
        dataFields: ['field'],
        formatter: 'text' as StandardFormatterName,
        notSortable: true,
    },
    {
        label: 'Value',
        alignment: 'left',
        id: 'value',
        dataFields: ['value'],
        formatter: 'text' as StandardFormatterName,
        notSortable: true,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

/**
 * Column structure for the "Trading Limits" table
 * Displays rate limits and order limits from the API
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tradingLimitsColumns: AccountManagerColumn[] = [
    {
        label: 'Limit Type',
        id: 'type',
        dataFields: ['type'],
        formatter: 'text' as StandardFormatterName,
        notSortable: true,
    },
    {
        label: 'Interval',
        id: 'interval',
        dataFields: ['interval'],
        formatter: 'text' as StandardFormatterName,
        notSortable: true,
    },
    {
        label: 'Limit',
        alignment: 'right',
        id: 'limit',
        dataFields: ['limit'],
        formatter: 'integerSeparated' as StandardFormatterName,
        notSortable: true,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

/**
 * Column structure for the "Balance Breakdown" table
 * Displays detailed balance information for each asset/currency
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const balanceBreakdownColumns: AccountManagerColumn[] = [
    {
        label: 'Asset',
        id: 'asset',
        dataFields: ['asset'],
        formatter: 'text' as StandardFormatterName,
        notSortable: true,
    },
    {
        label: 'Description',
        id: 'description',
        dataFields: ['description'],
        formatter: 'text' as StandardFormatterName,
        notSortable: true,
    },
    {
        label: 'Total',
        alignment: 'right',
        id: 'total',
        dataFields: ['total'],
        formatter: 'fixed' as StandardFormatterName,
        notSortable: true,
    },
    {
        label: 'Available',
        alignment: 'right',
        id: 'available',
        dataFields: ['available'],
        formatter: 'fixed' as StandardFormatterName,
        notSortable: true,
    },
    {
        label: 'Reserved',
        alignment: 'right',
        id: 'reserved',
        dataFields: ['reserved'],
        formatter: 'fixed' as StandardFormatterName,
        notSortable: true,
    },
    {
        label: 'Margin Rate',
        alignment: 'right',
        id: 'marginRate',
        dataFields: ['marginRate'],
        formatter: 'percentage' as StandardFormatterName,
        notSortable: true,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

/**
 * Column structure for the "Cash Transfer History" page
 * Displays deposit, withdrawal, and other transfer transactions
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const transferHistoryColumns: AccountManagerColumn[] = [
    {
        label: 'Date/Time',
        id: 'time',
        dataFields: ['time'],
        formatter: 'text' as StandardFormatterName,
        notSortable: false,
    },
    {
        label: 'Type',
        id: 'type',
        dataFields: ['type'],
        formatter: 'text' as StandardFormatterName,
        notSortable: false,
    },
    {
        label: 'Amount',
        alignment: 'right',
        id: 'amount',
        dataFields: ['amount'],
        formatter: 'fixed' as StandardFormatterName,
        notSortable: false,
    },
    {
        label: 'Currency',
        id: 'currency',
        dataFields: ['currency'],
        formatter: 'text' as StandardFormatterName,
        notSortable: false,
    },
    {
        label: 'Comment',
        id: 'comment',
        dataFields: ['comment'],
        formatter: 'text' as StandardFormatterName,
        notSortable: false,
    },
    {
        label: 'Transaction ID',
        alignment: 'right',
        id: 'id',
        dataFields: ['id'],
        formatter: 'text' as StandardFormatterName,
        notSortable: false,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;
