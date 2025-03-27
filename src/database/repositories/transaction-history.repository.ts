import { Repository, DataSource } from 'typeorm';
import { TransactionHistory } from '../entities/transaction-history.entity';

/**
 * Типы действий, которые могут быть записаны в историю
 */
export enum TransactionActions {
  CREATED = 'created',
  STATUS_CHANGED = 'status_changed',
  LOCKED = 'locked',
  UNLOCKED = 'unlocked',
  STARS_SENT = 'stars_sent',
  ERROR_OCCURRED = 'error_occurred',
  MANUAL_UPDATE = 'manual_update'
}

/**
 * Репозиторий для работы с историей транзакций
 */
export class TransactionHistoryRepository {
  private repository: Repository<TransactionHistory>;

  constructor(private dataSource: DataSource) {
    this.repository = dataSource.getRepository(TransactionHistory);
  }

  /**
   * Добавление новой записи в историю
   */
  async addHistoryRecord(
    transactionHash: string,
    action: TransactionActions | string,
    newStatus: string,
    previousStatus?: string,
    message?: string,
    data?: Record<string, any>
  ): Promise<TransactionHistory> {
    const historyRecord = new TransactionHistory();
    historyRecord.transactionHash = transactionHash;
    historyRecord.action = action;
    historyRecord.newStatus = newStatus;
    historyRecord.previousStatus = previousStatus || null;
    historyRecord.message = message || null;
    historyRecord.data = data || null;

    return await this.repository.save(historyRecord);
  }

  /**
   * Получение истории для конкретной транзакции
   */
  async getHistoryByTransactionHash(transactionHash: string): Promise<TransactionHistory[]> {
    return await this.repository.find({
      where: { transactionHash },
      order: { createdAt: 'ASC' } // От старых к новым записям
    });
  }

  /**
   * Подробная история транзакции с форматированием для вывода
   */
  async getFormattedHistory(transactionHash: string): Promise<Array<{
    timestamp: string;
    action: string;
    statusChange: string;
    message: string | null;
    data: Record<string, any> | null;
  }>> {
    const history = await this.getHistoryByTransactionHash(transactionHash);
    
    return history.map(record => {
      // Формирование читаемого изменения статуса
      let statusChange = record.newStatus;
      if (record.previousStatus) {
        statusChange = `${record.previousStatus} → ${record.newStatus}`;
      }
      
      // Форматирование даты и времени
      const timestamp = new Date(record.createdAt).toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
      return {
        timestamp,
        action: record.action,
        statusChange,
        message: record.message,
        data: record.data
      };
    });
  }
} 