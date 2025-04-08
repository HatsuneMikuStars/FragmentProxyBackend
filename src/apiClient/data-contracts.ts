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

export interface CreateTransactionDto {
  hash?: string | null;
  /** @format double */
  amount: number;
  sender?: string | null;
  receiver?: string | null;
  /** @format int32 */
  starCount: number;
  /** @format double */
  starPrice: number;
}

export interface TransactionDto {
  /** @format uuid */
  id?: string;
  hash?: string | null;
  /** @format double */
  amount?: number;
  sender?: string | null;
  receiver?: string | null;
  status?: TransactionStatus;
  /** @format int32 */
  starCount?: number;
  /** @format double */
  starPrice?: number;
  /** @format date-time */
  createdAt?: string;
  /** @format date-time */
  updatedAt?: string;
  isLocked?: boolean;
  /** @format date-time */
  lockedAt?: string | null;
  lockedBy?: string | null;
}

export interface TransactionHistory {
  /** @format uuid */
  id?: string;
  transactionHash: string | null;
  action: string | null;
  data: string | null;
  userId?: string | null;
  /** @format date-time */
  createdAt?: string;
}

/** @format int32 */
export enum TransactionStatus {
  Value0 = 0,
  Value1 = 1,
  Value2 = 2,
  Value3 = 3,
}

export interface UpdateStarsDto {
  /** @format int32 */
  starCount: number;
  /** @format double */
  starPrice: number;
}

export interface TransactionsListParams {
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
}

export type TransactionsLockUpdatePayload = string;
