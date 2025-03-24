import { SendTransactionParams, TransactionResult, TransactionStatus, WalletConfig } from './models/walletModels';
import { WalletAccount } from '../apiClient/models/apiModels';

/**
 * Интерфейс сервиса для работы с TON кошельком
 */
export interface IWalletService {
  /**
   * Инициализирует кошелек с указанной конфигурацией
   * @param config Конфигурация кошелька
   */
  initializeWallet(config: WalletConfig): Promise<void>;
  
  /**
   * Получает адрес кошелька
   * @returns Адрес кошелька в формате TON
   */
  getWalletAddress(): Promise<string>;
  
  /**
   * Получает баланс кошелька
   * @returns Баланс в наноТОН
   */
  getBalance(): Promise<bigint>;
  
  /**
   * Получает информацию о кошельке в формате WalletAccount
   * @returns Объект с информацией о кошельке
   */
  getWalletAccount(): Promise<WalletAccount>;
  
  /**
   * Отправляет TON транзакцию
   * @param params Параметры транзакции
   * @returns Результат выполнения транзакции
   */
  sendTransaction(params: SendTransactionParams): Promise<TransactionResult>;
  
  /**
   * Проверяет статус транзакции по её хешу
   * @param transactionHash Хеш транзакции
   * @returns Статус транзакции
   */
  checkTransactionStatus(transactionHash: string): Promise<TransactionStatus>;
  
  /**
   * Ожидает завершения транзакции с указанным хешем
   * @param transactionHash Хеш транзакции
   * @param timeout Время ожидания в миллисекундах (по умолчанию 60000 мс = 1 минута)
   * @returns Финальный статус транзакции
   */
  waitForTransactionCompletion(transactionHash: string, timeout?: number): Promise<TransactionStatus>;
} 