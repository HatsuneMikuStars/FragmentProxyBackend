/**
 * Модели для работы с TON кошельком
 */

/**
 * Конфигурация кошелька
 */
export interface WalletConfig {
  /**
   * Мнемоническая фраза для восстановления ключей кошелька
   */
  mnemonic: string;
  
  /**
   * ID подкошелька (обычно 0 для основного кошелька)
   */
  subwalletId?: number;
  
  /**
   * Версия кошелька (v4, v3R2 и т.д.)
   */
  walletVersion?: string;
  
  /**
   * Использовать тестовую сеть вместо основной
   */
  useTestnet?: boolean;
  
  /**
   * URL API для взаимодействия с TON
   */
  apiUrl?: string;
  
  /**
   * API ключ для доступа к TON API
   */
  apiKey?: string;
}

/**
 * Параметры транзакции для отправки TON
 */
export interface SendTransactionParams {
  /**
   * Адрес получателя в формате TON
   */
  toAddress: string;
  
  /**
   * Сумма перевода в наноТОН (1 TON = 1_000_000_000 наноТОН)
   */
  amount: string | number | bigint;
  
  /**
   * Комментарий к транзакции (опционально)
   */
  comment?: string;
  
  /**
   * Время жизни транзакции в секундах (опционально)
   */
  timeout?: number;
  
  /**
   * Максимальное количество попыток отправки (опционально)
   */
  maxRetries?: number;
}

/**
 * Результат транзакции
 */
export interface TransactionResult {
  /**
   * Успешность выполнения транзакции
   */
  success: boolean;
  
  /**
   * Хеш транзакции, если успешно
   */
  transactionHash?: string;
  
  /**
   * Сообщение об ошибке, если произошла ошибка
   */
  errorMessage?: string;
  
  /**
   * Дополнительные данные о транзакции
   */
  additionalData?: any;
}

/**
 * Статус транзакции
 */
export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
}

/**
 * Тип транзакции
 */
export enum TransactionType {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
  UNKNOWN = 'unknown'
}

/**
 * Параметры запроса для получения транзакций кошелька
 */
export interface GetTransactionsParams {
  /**
   * Максимальное количество транзакций в ответе
   * (по умолчанию 10, максимум 100)
   */
  limit?: number;
  
  /**
   * Логическое время (LT) транзакции, с которой начать выборку 
   * (для пагинации)
   */
  lt?: string;
  
  /**
   * Хеш транзакции, с которой начать выборку
   * (должен использоваться вместе с lt)
   */
  hash?: string;
  
  /**
   * Логическое время (LT) транзакции, до которой производить выборку
   */
  to_lt?: string;
  
  /**
   * Использовать архивные ноды для полной истории транзакций
   * (по умолчанию false)
   */
  archival?: boolean;

  /**
   * Тип транзакций для фильтрации (входящие/исходящие)
   */
  type?: TransactionType;
  
  /**
   * Unix timestamp начала периода для фильтрации транзакций
   * Возвращаются только транзакции с timestamp >= startTimestamp
   */
  startTimestamp?: number;
}

/**
 * Модель транзакции кошелька
 */
export interface WalletTransaction {
  /**
   * Уникальный идентификатор транзакции
   */
  id: string;
  
  /**
   * Тип транзакции (входящая/исходящая)
   */
  type: TransactionType;
  
  /**
   * Unix timestamp создания транзакции
   */
  timestamp: number;
  
  /**
   * Логическое время транзакции (для пагинации)
   */
  lt: number | string;
  
  /**
   * Хеш транзакции
   */
  hash: string;
  
  /**
   * Адрес отправителя
   */
  fromAddress: string;
  
  /**
   * Адрес получателя
   */
  toAddress: string;
  
  /**
   * Сумма транзакции в наноТОН
   */
  amount: bigint;
  
  /**
   * Комиссия за транзакцию в наноТОН
   */
  fee: bigint;
  
  /**
   * Комментарий к транзакции (если есть)
   */
  comment?: string;
  
  /**
   * Статус транзакции
   */
  status: TransactionStatus;
  
  /**
   * Дополнительные данные о транзакции
   */
  additionalData?: any;
} 