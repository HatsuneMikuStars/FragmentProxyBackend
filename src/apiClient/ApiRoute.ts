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
  TransactionsLockUpdatePayload,
  UpdateStarsDto,
} from "./data-contracts";

export namespace Api {
  /**
   * No description
   * @tags Transactions
   * @name TransactionsList
   * @request GET:/api/Transactions
   * @response `200` `(TransactionDto)[]` OK
   */
  export namespace TransactionsList {
    export type RequestParams = {};
    export type RequestQuery = {
      /**
       * @format int32
       * @default 1
       */
      page?: number;
      /**
       * @format int32
       * @default 10
       */
      pageSize?: number;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = TransactionDto[];
  }

  /**
   * No description
   * @tags Transactions
   * @name TransactionsCreate
   * @request POST:/api/Transactions
   * @response `200` `TransactionDto` OK
   */
  export namespace TransactionsCreate {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = CreateTransactionDto;
    export type RequestHeaders = {};
    export type ResponseBody = TransactionDto;
  }

  /**
   * No description
   * @tags Transactions
   * @name TransactionsDetail
   * @request GET:/api/Transactions/{hash}
   * @response `200` `TransactionDto` OK
   */
  export namespace TransactionsDetail {
    export type RequestParams = {
      hash: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = TransactionDto;
  }

  /**
   * No description
   * @tags Transactions
   * @name TransactionsHistoryList
   * @request GET:/api/Transactions/{hash}/history
   * @response `200` `(TransactionHistory)[]` OK
   */
  export namespace TransactionsHistoryList {
    export type RequestParams = {
      hash: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = TransactionHistory[];
  }

  /**
   * No description
   * @tags Transactions
   * @name TransactionsStarsUpdate
   * @request PUT:/api/Transactions/{hash}/stars
   * @response `200` `TransactionDto` OK
   */
  export namespace TransactionsStarsUpdate {
    export type RequestParams = {
      hash: string;
    };
    export type RequestQuery = {};
    export type RequestBody = UpdateStarsDto;
    export type RequestHeaders = {};
    export type ResponseBody = TransactionDto;
  }

  /**
   * No description
   * @tags Transactions
   * @name TransactionsLockUpdate
   * @request PUT:/api/Transactions/{hash}/lock
   * @response `200` `void` OK
   */
  export namespace TransactionsLockUpdate {
    export type RequestParams = {
      hash: string;
    };
    export type RequestQuery = {};
    export type RequestBody = TransactionsLockUpdatePayload;
    export type RequestHeaders = {};
    export type ResponseBody = void;
  }

  /**
   * No description
   * @tags Transactions
   * @name TransactionsUnlockUpdate
   * @request PUT:/api/Transactions/{hash}/unlock
   * @response `200` `void` OK
   */
  export namespace TransactionsUnlockUpdate {
    export type RequestParams = {
      hash: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = void;
  }
}
