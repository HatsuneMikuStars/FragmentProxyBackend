/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import {
  CreateTransactionDto,
  TransactionDto,
  TransactionHistory,
  TransactionsListParams,
  TransactionsLockUpdatePayload,
  UpdateStarsDto,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class Api<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {
  /**
   * No description
   *
   * @tags Transactions
   * @name TransactionsList
   * @request GET:/api/Transactions
   * @response `200` `(TransactionDto)[]` OK
   */
  transactionsList = (query: TransactionsListParams, params: RequestParams = {}) =>
    this.request<TransactionDto[], any>({
      path: `/api/Transactions`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Transactions
   * @name TransactionsCreate
   * @request POST:/api/Transactions
   * @response `200` `TransactionDto` OK
   */
  transactionsCreate = (data: CreateTransactionDto, params: RequestParams = {}) =>
    this.request<TransactionDto, any>({
      path: `/api/Transactions`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Transactions
   * @name TransactionsDetail
   * @request GET:/api/Transactions/{hash}
   * @response `200` `TransactionDto` OK
   */
  transactionsDetail = (hash: string, params: RequestParams = {}) =>
    this.request<TransactionDto, any>({
      path: `/api/Transactions/${hash}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Transactions
   * @name TransactionsHistoryList
   * @request GET:/api/Transactions/{hash}/history
   * @response `200` `(TransactionHistory)[]` OK
   */
  transactionsHistoryList = (hash: string, params: RequestParams = {}) =>
    this.request<TransactionHistory[], any>({
      path: `/api/Transactions/${hash}/history`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Transactions
   * @name TransactionsStarsUpdate
   * @request PUT:/api/Transactions/{hash}/stars
   * @response `200` `TransactionDto` OK
   */
  transactionsStarsUpdate = (hash: string, data: UpdateStarsDto, params: RequestParams = {}) =>
    this.request<TransactionDto, any>({
      path: `/api/Transactions/${hash}/stars`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Transactions
   * @name TransactionsLockUpdate
   * @request PUT:/api/Transactions/{hash}/lock
   * @response `200` `void` OK
   */
  transactionsLockUpdate = (hash: string, data: TransactionsLockUpdatePayload, params: RequestParams = {}) =>
    this.request<void, any>({
      path: `/api/Transactions/${hash}/lock`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      ...params,
    });
  /**
   * No description
   *
   * @tags Transactions
   * @name TransactionsUnlockUpdate
   * @request PUT:/api/Transactions/{hash}/unlock
   * @response `200` `void` OK
   */
  transactionsUnlockUpdate = (hash: string, params: RequestParams = {}) =>
    this.request<void, any>({
      path: `/api/Transactions/${hash}/unlock`,
      method: "PUT",
      ...params,
    });
}
