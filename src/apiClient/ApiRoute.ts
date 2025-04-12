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
  TopicMessageDto,
  Transaction,
  TransactionDto,
  TransactionHistory,
  UpdateStarsDto,
  UpdateTelegramUserDto,
  UserTopicDto,
} from "./data-contracts";

export namespace Api {
  /**
   * No description
   * @tags FragmentProxy
   * @name TransactionsList
   * @request GET:/api/Transactions
   * @response `200` `(Transaction)[]` OK
   * @response `500` `number` Internal Server Error
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
    export type ResponseBody = Transaction[];
  }

  /**
   * No description
   * @tags FragmentProxy
   * @name TransactionsCreate
   * @request POST:/api/Transactions
   * @response `201` `TransactionDto` Created
   * @response `500` `number` Internal Server Error
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
   * @tags FragmentProxy
   * @name TransactionsDetail
   * @request GET:/api/Transactions/{hash}
   * @response `200` `Transaction` OK
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
   */
  export namespace TransactionsDetail {
    export type RequestParams = {
      hash: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = Transaction;
  }

  /**
   * No description
   * @tags FragmentProxy
   * @name TransactionsHistoryList
   * @request GET:/api/Transactions/{hash}/history
   * @response `200` `(TransactionHistory)[]` OK
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
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
   * @tags FragmentProxy
   * @name TransactionsStarsUpdate
   * @request PUT:/api/Transactions/{hash}/stars
   * @response `200` `Transaction` OK
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
   */
  export namespace TransactionsStarsUpdate {
    export type RequestParams = {
      hash: string;
    };
    export type RequestQuery = {};
    export type RequestBody = UpdateStarsDto;
    export type RequestHeaders = {};
    export type ResponseBody = Transaction;
  }

  /**
   * No description
   * @tags FragmentProxy
   * @name TransactionsLockUpdate
   * @request PUT:/api/Transactions/{hash}/lock
   * @response `200` `void` OK
   * @response `400` `string` Bad Request
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
   */
  export namespace TransactionsLockUpdate {
    export type RequestParams = {
      hash: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = void;
  }

  /**
   * No description
   * @tags FragmentProxy
   * @name TransactionsUnlockUpdate
   * @request PUT:/api/Transactions/{hash}/unlock
   * @response `200` `void` OK
   * @response `400` `string` Bad Request
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
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

  /**
   * No description
   * @tags Support
   * @name SupportTopicsList
   * @request GET:/api/support-topics
   * @response `200` `(UserTopicDto)[]` OK
   */
  export namespace SupportTopicsList {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = UserTopicDto[];
  }

  /**
   * No description
   * @tags Support
   * @name SupportTopicsCreate
   * @request POST:/api/support-topics
   * @response `200` `UserTopicDto` OK
   * @response `201` `UserTopicDto` Created
   */
  export namespace SupportTopicsCreate {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = UserTopicDto;
    export type RequestHeaders = {};
    export type ResponseBody = UserTopicDto;
  }

  /**
   * No description
   * @tags Support
   * @name SupportTopicsUserDetail
   * @request GET:/api/support-topics/user/{userId}
   * @response `200` `UserTopicDto` OK
   * @response `404` `string` Not Found
   */
  export namespace SupportTopicsUserDetail {
    export type RequestParams = {
      /** @format int64 */
      userId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = UserTopicDto;
  }

  /**
   * No description
   * @tags Support
   * @name SupportTopicsMessagesList
   * @request GET:/api/support-topics/{topicId}/messages
   * @response `200` `(TopicMessageDto)[]` OK
   * @response `404` `string` Not Found
   */
  export namespace SupportTopicsMessagesList {
    export type RequestParams = {
      /** @format int32 */
      topicId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = TopicMessageDto[];
  }

  /**
   * No description
   * @tags Support
   * @name SupportTopicsUserMessagesList
   * @request GET:/api/support-topics/user/{userId}/messages
   * @response `200` `(TopicMessageDto)[]` OK
   * @response `404` `string` Not Found
   */
  export namespace SupportTopicsUserMessagesList {
    export type RequestParams = {
      /** @format int64 */
      userId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = TopicMessageDto[];
  }

  /**
   * No description
   * @tags Support
   * @name SupportTopicsMessagesCreate
   * @request POST:/api/support-topics/messages
   * @response `201` `TopicMessageDto` Created
   */
  export namespace SupportTopicsMessagesCreate {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = CreateTopicMessageDto;
    export type RequestHeaders = {};
    export type ResponseBody = TopicMessageDto;
  }

  /**
   * No description
   * @tags TelegramBot
   * @name TelegramUsersList
   * @request GET:/api/TelegramUsers
   * @response `200` `(TelegramUserDto)[]` OK
   * @response `500` `number` Internal Server Error
   */
  export namespace TelegramUsersList {
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
    export type ResponseBody = TelegramUserDto[];
  }

  /**
   * No description
   * @tags TelegramBot
   * @name TelegramUsersCreate
   * @request POST:/api/TelegramUsers
   * @response `201` `TelegramUserDto` Created
   * @response `400` `string` Bad Request
   * @response `409` `string` Conflict
   * @response `500` `number` Internal Server Error
   */
  export namespace TelegramUsersCreate {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = CreateTelegramUserDto;
    export type RequestHeaders = {};
    export type ResponseBody = TelegramUserDto;
  }

  /**
   * No description
   * @tags TelegramBot
   * @name TelegramUsersDetail
   * @request GET:/api/TelegramUsers/{userId}
   * @response `200` `TelegramUserDto` OK
   * @response `404` `string` Not Found
   * @response `500` `number` Internal Server Error
   */
  export namespace TelegramUsersDetail {
    export type RequestParams = {
      /** @format int64 */
      userId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = TelegramUserDto;
  }

  /**
   * No description
   * @tags TelegramBot
   * @name TelegramUsersUpdate
   * @request PUT:/api/TelegramUsers/{userId}
   * @response `200` `TelegramUserDto` OK
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
   */
  export namespace TelegramUsersUpdate {
    export type RequestParams = {
      /** @format int64 */
      userId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = UpdateTelegramUserDto;
    export type RequestHeaders = {};
    export type ResponseBody = TelegramUserDto;
  }

  /**
   * No description
   * @tags TelegramBot
   * @name TelegramUsersDelete
   * @request DELETE:/api/TelegramUsers/{userId}
   * @response `204` `void` No Content
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
   */
  export namespace TelegramUsersDelete {
    export type RequestParams = {
      /** @format int64 */
      userId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = void;
  }

  /**
   * No description
   * @tags TelegramBot
   * @name TelegramUsersReferralUpdate
   * @request PUT:/api/TelegramUsers/{userId}/referral
   * @response `200` `void` OK
   * @response `400` `string` Bad Request
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
   */
  export namespace TelegramUsersReferralUpdate {
    export type RequestParams = {
      /** @format int64 */
      userId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = ReferralUpdateDto;
    export type RequestHeaders = {};
    export type ResponseBody = void;
  }

  /**
   * No description
   * @tags TelegramBot
   * @name TelegramUsersStarsUpdate
   * @request PUT:/api/TelegramUsers/{userId}/stars
   * @response `200` `void` OK
   * @response `400` `string` Bad Request
   * @response `404` `void` Not Found
   * @response `500` `number` Internal Server Error
   */
  export namespace TelegramUsersStarsUpdate {
    export type RequestParams = {
      /** @format int64 */
      userId: number;
    };
    export type RequestQuery = {
      /** @format int32 */
      stars?: number;
      /** @default true */
      bought?: boolean;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = void;
  }
}
