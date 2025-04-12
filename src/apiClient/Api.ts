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
  CreateTelegramUserDto,
  CreateTopicMessageDto,
  CreateTransactionDto,
  ReferralUpdateDto,
  TelegramUserDto,
  TelegramUsersListParams,
  TelegramUsersStarsUpdateParams,
  TopicMessageDto,
  Transaction,
  TransactionDto,
  TransactionHistory,
  TransactionsListParams,
  UpdateStarsDto,
  UpdateTelegramUserDto,
  UserTopicDto,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class Api<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {
  /**
   * No description
   *
   * @tags FragmentProxy
   * @name TransactionsList
   * @request GET:/api/Transactions
   * @response `200` `(Transaction)[]` OK
   * @response `500` `number` Internal Server Error
   */
  transactionsList = (query: TransactionsListParams, params: RequestParams = {}) =>
    this.request<Transaction[], number>({
      path: `/api/Transactions`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags FragmentProxy
   * @name TransactionsCreate
   * @request POST:/api/Transactions
   * @response `201` `TransactionDto` Created
   * @response `500` `number` Internal Server Error
   */
  transactionsCreate = (data: CreateTransactionDto, params: RequestParams = {}) =>
    this.request<TransactionDto, number>({
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
   * @tags FragmentProxy
   * @name TransactionsDetail
   * @request GET:/api/Transactions/{hash}
   * @response `200` `Transaction` OK
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
   */
  transactionsDetail = (hash: string, params: RequestParams = {}) =>
    this.request<Transaction, void | number>({
      path: `/api/Transactions/${hash}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags FragmentProxy
   * @name TransactionsHistoryList
   * @request GET:/api/Transactions/{hash}/history
   * @response `200` `(TransactionHistory)[]` OK
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
   */
  transactionsHistoryList = (hash: string, params: RequestParams = {}) =>
    this.request<TransactionHistory[], void | number>({
      path: `/api/Transactions/${hash}/history`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags FragmentProxy
   * @name TransactionsStarsUpdate
   * @request PUT:/api/Transactions/{hash}/stars
   * @response `200` `Transaction` OK
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
   */
  transactionsStarsUpdate = (hash: string, data: UpdateStarsDto, params: RequestParams = {}) =>
    this.request<Transaction, void | number>({
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
   * @tags FragmentProxy
   * @name TransactionsLockUpdate
   * @request PUT:/api/Transactions/{hash}/lock
   * @response `200` `void` OK
   * @response `400` `string` Bad Request
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
   */
  transactionsLockUpdate = (hash: string, params: RequestParams = {}) =>
    this.request<void, string | void | number>({
      path: `/api/Transactions/${hash}/lock`,
      method: "PUT",
      ...params,
    });
  /**
   * No description
   *
   * @tags FragmentProxy
   * @name TransactionsUnlockUpdate
   * @request PUT:/api/Transactions/{hash}/unlock
   * @response `200` `void` OK
   * @response `400` `string` Bad Request
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
   */
  transactionsUnlockUpdate = (hash: string, params: RequestParams = {}) =>
    this.request<void, string | void | number>({
      path: `/api/Transactions/${hash}/unlock`,
      method: "PUT",
      ...params,
    });
  /**
   * No description
   *
   * @tags Support
   * @name SupportTopicsList
   * @request GET:/api/support-topics
   * @response `200` `(UserTopicDto)[]` OK
   */
  supportTopicsList = (params: RequestParams = {}) =>
    this.request<UserTopicDto[], any>({
      path: `/api/support-topics`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Support
   * @name SupportTopicsCreate
   * @request POST:/api/support-topics
   * @response `200` `UserTopicDto` OK
   * @response `201` `UserTopicDto` Created
   */
  supportTopicsCreate = (data: UserTopicDto, params: RequestParams = {}) =>
    this.request<UserTopicDto, any>({
      path: `/api/support-topics`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Support
   * @name SupportTopicsUserDetail
   * @request GET:/api/support-topics/user/{userId}
   * @response `200` `UserTopicDto` OK
   * @response `404` `string` Not Found
   */
  supportTopicsUserDetail = (userId: number, params: RequestParams = {}) =>
    this.request<UserTopicDto, string>({
      path: `/api/support-topics/user/${userId}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Support
   * @name SupportTopicsMessagesList
   * @request GET:/api/support-topics/{topicId}/messages
   * @response `200` `(TopicMessageDto)[]` OK
   * @response `404` `string` Not Found
   */
  supportTopicsMessagesList = (topicId: number, params: RequestParams = {}) =>
    this.request<TopicMessageDto[], string>({
      path: `/api/support-topics/${topicId}/messages`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Support
   * @name SupportTopicsUserMessagesList
   * @request GET:/api/support-topics/user/{userId}/messages
   * @response `200` `(TopicMessageDto)[]` OK
   * @response `404` `string` Not Found
   */
  supportTopicsUserMessagesList = (userId: number, params: RequestParams = {}) =>
    this.request<TopicMessageDto[], string>({
      path: `/api/support-topics/user/${userId}/messages`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Support
   * @name SupportTopicsMessagesCreate
   * @request POST:/api/support-topics/messages
   * @response `201` `TopicMessageDto` Created
   */
  supportTopicsMessagesCreate = (data: CreateTopicMessageDto, params: RequestParams = {}) =>
    this.request<TopicMessageDto, any>({
      path: `/api/support-topics/messages`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags TelegramBot
   * @name TelegramUsersList
   * @request GET:/api/TelegramUsers
   * @response `200` `(TelegramUserDto)[]` OK
   * @response `500` `number` Internal Server Error
   */
  telegramUsersList = (query: TelegramUsersListParams, params: RequestParams = {}) =>
    this.request<TelegramUserDto[], number>({
      path: `/api/TelegramUsers`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags TelegramBot
   * @name TelegramUsersCreate
   * @request POST:/api/TelegramUsers
   * @response `201` `TelegramUserDto` Created
   * @response `400` `string` Bad Request
   * @response `409` `string` Conflict
   * @response `500` `number` Internal Server Error
   */
  telegramUsersCreate = (data: CreateTelegramUserDto, params: RequestParams = {}) =>
    this.request<TelegramUserDto, string | number>({
      path: `/api/TelegramUsers`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags TelegramBot
   * @name TelegramUsersDetail
   * @request GET:/api/TelegramUsers/{userId}
   * @response `200` `TelegramUserDto` OK
   * @response `404` `string` Not Found
   * @response `500` `number` Internal Server Error
   */
  telegramUsersDetail = (userId: number, params: RequestParams = {}) =>
    this.request<TelegramUserDto, string | number>({
      path: `/api/TelegramUsers/${userId}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags TelegramBot
   * @name TelegramUsersUpdate
   * @request PUT:/api/TelegramUsers/{userId}
   * @response `200` `TelegramUserDto` OK
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
   */
  telegramUsersUpdate = (userId: number, data: UpdateTelegramUserDto, params: RequestParams = {}) =>
    this.request<TelegramUserDto, void | number>({
      path: `/api/TelegramUsers/${userId}`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags TelegramBot
   * @name TelegramUsersDelete
   * @request DELETE:/api/TelegramUsers/{userId}
   * @response `204` `void` No Content
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
   */
  telegramUsersDelete = (userId: number, params: RequestParams = {}) =>
    this.request<void, void | number>({
      path: `/api/TelegramUsers/${userId}`,
      method: "DELETE",
      ...params,
    });
  /**
   * No description
   *
   * @tags TelegramBot
   * @name TelegramUsersReferralUpdate
   * @request PUT:/api/TelegramUsers/{userId}/referral
   * @response `200` `void` OK
   * @response `400` `string` Bad Request
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
   */
  telegramUsersReferralUpdate = (userId: number, data: ReferralUpdateDto, params: RequestParams = {}) =>
    this.request<void, string | void | number>({
      path: `/api/TelegramUsers/${userId}/referral`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      ...params,
    });
  /**
   * No description
   *
   * @tags TelegramBot
   * @name TelegramUsersStarsUpdate
   * @request PUT:/api/TelegramUsers/{userId}/stars
   * @response `200` `void` OK
   * @response `400` `string` Bad Request
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
   */
  telegramUsersStarsUpdate = ({ userId, ...query }: TelegramUsersStarsUpdateParams, params: RequestParams = {}) =>
    this.request<void, string | void | number>({
      path: `/api/TelegramUsers/${userId}/stars`,
      method: "PUT",
      query: query,
      ...params,
    });
}
