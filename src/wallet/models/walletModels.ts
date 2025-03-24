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