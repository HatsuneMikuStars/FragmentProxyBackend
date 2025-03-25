import { Repository, DataSource } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';

/**
 * Локальный интерфейс для транзакций TON, заменяет TonTransaction из apiClient
 */
interface TonTransactionData {
  hash: string;
  amount: number;
  timestamp: number;
  comment?: string;
  senderAddress?: string;
  gasFee?: number;               // Комиссия за газ
  amountAfterGas?: number;       // Сумма после вычета газа
  exchangeRate?: number;         // Курс обмена TON -> звезды на момент транзакции
  status?: 'pending' | 'processed' | 'failed';  // Статус обработки
  statusMsg?: string;            // Дополнительное сообщение о статусе
}

/**
 * Репозиторий для работы с транзакциями
 */
export class TransactionRepository {
  private repository: Repository<Transaction>;

  constructor(private dataSource: DataSource) {
    this.repository = dataSource.getRepository(Transaction);
  }

  /**
   * Проверка, существует ли транзакция в базе данных
   */
  async exists(hash: string): Promise<boolean> {
    return (await this.repository.count({ where: { hash } })) > 0;
  }

  /**
   * Получение транзакции по хешу
   */
  async findByHash(hash: string): Promise<Transaction | null> {
    return await this.repository.findOne({ where: { hash } });
  }

  /**
   * Добавление новой транзакции в базу данных
   */
  async saveTransaction(transaction: TonTransactionData, username?: string, starsAmount?: number): Promise<Transaction> {
    const newTransaction = new Transaction();
    newTransaction.hash = transaction.hash;
    newTransaction.amount = transaction.amount;
    newTransaction.senderAddress = transaction.senderAddress || null;
    newTransaction.comment = transaction.comment || null;
    newTransaction.username = username || null;
    newTransaction.starsAmount = starsAmount || null;
    newTransaction.status = transaction.status || 'processed';
    
    // Добавляем новые поля
    newTransaction.gasFee = transaction.gasFee || null;
    newTransaction.amountAfterGas = transaction.amountAfterGas || null;
    newTransaction.exchangeRate = transaction.exchangeRate || null;
    
    // Если есть сообщение о статусе, сохраняем его как сообщение об ошибке
    if (transaction.statusMsg) {
      newTransaction.errorMessage = transaction.statusMsg;
    }

    return await this.repository.save(newTransaction);
  }

  /**
   * Обновление информации о транзакции после отправки звезд
   */
  async updateTransactionAfterStarsPurchase(
    hash: string, 
    fragmentTxHash: string, 
    success: boolean,
    errorMessage?: string
  ): Promise<Transaction | null> {
    const transaction = await this.findByHash(hash);
    if (!transaction) return null;

    transaction.fragmentTransactionHash = fragmentTxHash;
    transaction.status = success ? 'processed' : 'failed';
    if (errorMessage) {
      transaction.errorMessage = errorMessage;
    }

    return await this.repository.save(transaction);
  }

  /**
   * Получение всех обработанных транзакций
   */
  async findAllProcessed(): Promise<Transaction[]> {
    return await this.repository.find({ 
      where: { status: 'processed' },
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Получение списка хешей всех обработанных транзакций
   */
  async getAllProcessedHashes(): Promise<string[]> {
    const transactions = await this.repository.find({ 
      select: { hash: true },
      where: { status: 'processed' }
    });
    return transactions.map(tx => tx.hash);
  }

  /**
   * Получение последних транзакций с пагинацией
   */
  async getRecentTransactions(page: number = 1, limit: number = 20): Promise<[Transaction[], number]> {
    return await this.repository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit
    });
  }

  /**
   * Получение транзакций по статусу с пагинацией
   */
  async getTransactionsByStatus(status: 'processed' | 'pending' | 'failed', page: number = 1, limit: number = 20): Promise<[Transaction[], number]> {
    return await this.repository.findAndCount({
      where: { status },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit
    });
  }

  /**
   * Получение статистики по транзакциям
   */
  async getTransactionStats(): Promise<{ 
    totalCount: number; 
    processedCount: number; 
    failedCount: number; 
    totalStars: number;
    totalTon: string;
  }> {
    const totalCount = await this.repository.count();
    const processedCount = await this.repository.count({ where: { status: 'processed' } });
    const failedCount = await this.repository.count({ where: { status: 'failed' } });
    
    // Общее количество звезд
    const starsResult = await this.repository
      .createQueryBuilder('tx')
      .select('SUM(tx.starsAmount)', 'total')
      .where('tx.status = :status', { status: 'processed' })
      .getRawOne();
    
    // Общая сумма TON
    const tonResult = await this.repository
      .createQueryBuilder('tx')
      .select('SUM(tx.amount)', 'total')
      .where('tx.status = :status', { status: 'processed' })
      .getRawOne();
    
    return {
      totalCount,
      processedCount,
      failedCount,
      totalStars: starsResult.total || 0,
      totalTon: tonResult.total ? Number(tonResult.total).toFixed(9) : '0'
    };
  }
} 