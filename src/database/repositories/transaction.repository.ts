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
  status?: 'pending' | 'processing' | 'processed' | 'failed';  // Статус обработки
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
   * Проверяет, заблокирована ли транзакция
   * @param hash Хеш транзакции
   * @returns true если транзакция находится в обработке, false в противном случае
   */
  async isLocked(hash: string): Promise<boolean> {
    const tx = await this.findByHash(hash);
    return tx?.status === 'processing';
  }

  /**
   * Блокирует транзакцию для обработки
   * @param hash Хеш транзакции
   * @returns true если блокировка успешна, false если транзакция уже заблокирована или обработана
   */
  async lockTransaction(hash: string): Promise<boolean> {
    // Проверяем, существует ли транзакция и её текущий статус
    const tx = await this.findByHash(hash);
    
    // Если транзакция не найдена, возвращаем true (можно обрабатывать новую)
    if (!tx) {
      return true;
    }
    
    // Если транзакция уже обработана успешно, блокировка не требуется
    if (tx.status === 'processed') {
      console.log(`[TransactionRepo] Транзакция ${hash} уже обработана успешно, блокировка не требуется`);
      return false;
    }
    
    // Если транзакция уже в обработке, блокировка невозможна
    if (tx.status === 'processing') {
      console.log(`[TransactionRepo] Транзакция ${hash} уже обрабатывается другим процессом`);
      return false;
    }
    
    // Если транзакция имеет статус 'failed', проверим категорию ошибки
    if (tx.status === 'failed' && tx.errorMessage) {
      // Неисправимые ошибки, при которых повторная обработка не имеет смысла
      const nonRetryableErrors = [
        "ERR_INVALID_USERNAME", 
        "ERR_MISSING_COMMENT",
        "ERR_STARS_BELOW_MINIMUM",
        "ERR_STARS_ABOVE_MAXIMUM"
      ];
      
      // Если ошибка неисправима, блокировка не требуется
      if (nonRetryableErrors.some(err => tx.errorMessage?.includes(err))) {
        console.log(`[TransactionRepo] Транзакция ${hash} имеет неисправимую ошибку, повторная обработка невозможна`);
        return false;
      }
    }
    
    try {
      // Атомарно обновляем статус на 'processing'
      await this.repository.update(
        { hash, status: tx.status }, // обновляем только если статус не изменился
        { status: 'processing', errorMessage: null }
      );
      
      // Проверяем, действительно ли статус изменился
      const updatedTx = await this.findByHash(hash);
      const lockSuccessful = updatedTx?.status === 'processing';
      
      if (lockSuccessful) {
        console.log(`[TransactionRepo] Транзакция ${hash} успешно заблокирована для обработки`);
      } else {
        console.log(`[TransactionRepo] Не удалось заблокировать транзакцию ${hash}, возможно она была заблокирована другим процессом`);
      }
      
      return lockSuccessful;
    } catch (error) {
      console.error(`[TransactionRepo] Ошибка при блокировке транзакции ${hash}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Разблокирует транзакцию, если обработка не удалась
   * @param hash Хеш транзакции
   * @param errorMessage Сообщение об ошибке
   * @returns true если разблокировка успешна
   */
  async unlockTransaction(hash: string, errorMessage?: string): Promise<boolean> {
    try {
      const tx = await this.findByHash(hash);
      if (!tx) return false;
      
      // Устанавливаем статус обратно в 'pending' или 'failed' в зависимости от наличия ошибки
      const newStatus = errorMessage ? 'failed' : 'pending';
      
      await this.repository.update(
        { hash, status: 'processing' }, // Разблокируем только если статус 'processing'
        { 
          status: newStatus,
          errorMessage: errorMessage || tx.errorMessage  // Сохраняем ошибку, если она есть
        }
      );
      
      console.log(`[TransactionRepo] Транзакция ${hash} разблокирована со статусом ${newStatus}`);
      return true;
    } catch (error) {
      console.error(`[TransactionRepo] Ошибка при разблокировке транзакции ${hash}: ${(error as Error).message}`);
      return false;
    }
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
    outgoingTxHash: string,
    fragmentTxHash: string, 
    success: boolean,
    errorMessage?: string
  ): Promise<Transaction | null> {
    const transaction = await this.findByHash(hash);
    if (!transaction) return null;

    transaction.outgoingTransactionHash = outgoingTxHash;
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
  async getTransactionsByStatus(status: 'processed' | 'processing' | 'pending' | 'failed', page: number = 1, limit: number = 20): Promise<[Transaction[], number]> {
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
    processingCount: number;
    pendingCount: number;
    failedCount: number; 
    totalStars: number;
    totalTon: string;
  }> {
    const totalCount = await this.repository.count();
    const processedCount = await this.repository.count({ where: { status: 'processed' } });
    const processingCount = await this.repository.count({ where: { status: 'processing' } });
    const pendingCount = await this.repository.count({ where: { status: 'pending' } });
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
      processingCount,
      pendingCount,
      failedCount,
      totalStars: starsResult.total || 0,
      totalTon: tonResult.total ? Number(tonResult.total).toFixed(9) : '0'
    };
  }
} 