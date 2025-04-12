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

export interface CreateTelegramUserDto {
  /** @format int64 */
  userId: number;
  referralCode?: string | null;
  cryptoWallet?: string | null;
  language?: string | null;
  /** @format int64 */
  referredBy?: number | null;
}

export interface CreateTopicMessageDto {
  /** @format int64 */
  userId: number;
  /** @format int32 */
  topicId: number;
  /** @minLength 1 */
  message: string;
  isSupport: boolean;
}

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

export interface ReferralUpdateDto {
  /** @minLength 1 */
  referralCode: string;
}

export interface TelegramUserDto {
  /** @format int64 */
  userId?: number;
  /** @format int32 */
  starsBought?: number;
  /** @format int32 */
  starsSold?: number;
  /** @format double */
  referralEarnings?: number;
  /** @format int32 */
  referrals?: number;
  referralCode?: string | null;
  cryptoWallet?: string | null;
  /** @format int32 */
  earnedStars?: number;
  language?: string | null;
  /** @format int64 */
  referredBy?: number | null;
  showImages?: boolean;
}

export interface TopicMessageDto {
  /** @format int32 */
  id?: number;
  /** @format int64 */
  userId?: number;
  /** @format int32 */
  topicId?: number;
  message?: string | null;
  isSupport?: boolean;
  /** @format date-time */
  timestamp?: string;
  username?: string | null;
}

export interface Transaction {
  /** @format uuid */
  id?: string;
  hash: string | null;
  /** @format double */
  amount?: number;
  sender: string | null;
  receiver: string | null;
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

export interface UpdateTelegramUserDto {
  cryptoWallet?: string | null;
  language?: string | null;
  showImages?: boolean | null;
}

export interface UserTopicDto {
  /** @format int64 */
  userId: number;
  /** @format int32 */
  topicId: number;
  username?: string | null;
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

export interface TelegramUsersListParams {
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

export interface TelegramUsersStarsUpdateParams {
  /** @format int32 */
  stars?: number;
  /** @default true */
  bought?: boolean;
  /** @format int64 */
  userId: number;
}
