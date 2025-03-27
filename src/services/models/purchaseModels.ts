// Fragment Purchase Service Models
// Модели данных сервиса покупки звезд на платформе Fragment

/**
 * Результат операции покупки звезд
 */
export interface PurchaseResult {
  /**
   * Успешна ли операция покупки
   */
  success: boolean;
  
  /**
   * Хеш транзакции в Fragment (если доступен)
   */
  transactionHash?: string;
  
  /**
   * Хеш исходящей TON транзакции на адрес Fragment
   */
  outgoingTransactionHash?: string;
  
  /**
   * Сумма транзакции
   */
  amount?: number;
  
  /**
   * Статус покупки
   */
  status?: string;
  
  /**
   * Идентификатор получателя
   */
  recipientId?: string;
  
  /**
   * Количество купленных звезд
   */
  starsAmount?: number;
  
  /**
   * Сообщение об ошибке (если есть)
   */
  error?: string;
}

/**
 * Исключение при недостаточном балансе
 */
export class InsufficientBalanceException extends Error {
  /**
   * Создает новый экземпляр исключения о недостаточном балансе
   * @param message Сообщение об ошибке
   * @param innerException Вложенное исключение
   */
  constructor(message: string = "Недостаточный баланс для операции", public innerException?: Error) {
    super(message);
    this.name = 'InsufficientBalanceException';
  }
}

/**
 * Настройки сервиса покупки звезд
 */
export interface PurchaseServiceOptions {
  /**
   * Время ожидания ответа API в миллисекундах
   */
  apiTimeout?: number;
  
  /**
   * Количество попыток повторного запроса при ошибке
   */
  retryCount?: number;
  
  /**
   * Задержка между повторными попытками в миллисекундах
   */
  retryDelay?: number;
}

/**
 * Состояние процесса покупки звезд
 */
export enum PurchaseState {
  /**
   * Новая покупка, еще не обработана
   */
  New = "new",
  
  /**
   * Покупка в процессе обработки
   */
  Processing = "processing",
  
  /**
   * Покупка завершена успешно
   */
  Completed = "completed",
  
  /**
   * Произошла ошибка при покупке
   */
  Error = "error",
  
  /**
   * Истекло время ожидания завершения покупки
   */
  Timeout = "timeout"
} 