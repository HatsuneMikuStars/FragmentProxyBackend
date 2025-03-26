import { Repository, DataSource } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { TransactionHistoryRepository, TransactionActions } from './transaction-history.repository';

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
  status?: 'processing' | 'processed' | 'failed';  // Статус обработки
  statusMsg?: string;            // Дополнительное сообщение о статусе
}

/**
 * Репозиторий для работы с транзакциями
 */
export class TransactionRepository {
  private repository: Repository<Transaction>;
  private historyRepository: TransactionHistoryRepository;

  constructor(private dataSource: DataSource) {
    this.repository = dataSource.getRepository(Transaction);
    this.historyRepository = new TransactionHistoryRepository(dataSource);
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
      const previousStatus = tx.status;
      
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
        
        // Добавляем запись в историю
        await this.historyRepository.addHistoryRecord(
          hash,
          TransactionActions.LOCKED,
          'processing',
          previousStatus,
          `Транзакция заблокирована для обработки`
        );
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
      
      // Всегда устанавливаем статус 'failed' при разблокировке
      // Если сообщение об ошибке не указано, используем стандартное
      const finalErrorMessage = errorMessage || 'ERR_INTERRUPTED: Обработка транзакции была прервана';
      const previousStatus = tx.status;
      
      await this.repository.update(
        { hash, status: 'processing' }, // Разблокируем только если статус 'processing'
        { 
          status: 'failed',
          errorMessage: finalErrorMessage
        }
      );
      
      console.log(`[TransactionRepo] Транзакция ${hash} разблокирована со статусом 'failed', ошибка: ${finalErrorMessage}`);
      
      // Добавляем запись в историю
      await this.historyRepository.addHistoryRecord(
        hash,
        TransactionActions.UNLOCKED,
        'failed',
        previousStatus,
        finalErrorMessage
      );
      
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

    const savedTransaction = await this.repository.save(newTransaction);
    
    // Добавляем запись в историю
    const isNewTransaction = !(await this.exists(transaction.hash));
    if (isNewTransaction) {
      await this.historyRepository.addHistoryRecord(
        transaction.hash,
        TransactionActions.CREATED,
        newTransaction.status,
        undefined,
        newTransaction.errorMessage || `Транзакция создана${username ? ` для пользователя @${username}` : ''}`,
        {
          amount: transaction.amount,
          starsAmount,
          gasFee: transaction.gasFee,
          amountAfterGas: transaction.amountAfterGas,
          exchangeRate: transaction.exchangeRate
        }
      );
    } else {
      // Если транзакция уже существовала, это обновление
      await this.historyRepository.addHistoryRecord(
        transaction.hash,
        TransactionActions.STATUS_CHANGED,
        newTransaction.status,
        undefined,
        newTransaction.errorMessage || `Статус транзакции обновлен на ${newTransaction.status}`
      );
    }
    
    return savedTransaction;
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

    const previousStatus = transaction.status;
    
    transaction.outgoingTransactionHash = outgoingTxHash;
    transaction.fragmentTransactionHash = fragmentTxHash;
    transaction.status = success ? 'processed' : 'failed';
    if (errorMessage) {
      transaction.errorMessage = errorMessage;
    }

    const updatedTransaction = await this.repository.save(transaction);
    
    // Добавляем запись в историю
    await this.historyRepository.addHistoryRecord(
      hash,
      TransactionActions.STARS_SENT,
      transaction.status,
      previousStatus,
      success ? 
        `Звезды успешно отправлены, хеш транзакции Fragment: ${fragmentTxHash}` :
        `Ошибка при отправке звезд: ${errorMessage}`,
      {
        outgoingTxHash,
        fragmentTxHash
      }
    );
    
    return updatedTransaction;
  }

  /**
   * Получение истории транзакции
   */
  async getTransactionHistory(hash: string): Promise<any> {
    return await this.historyRepository.getFormattedHistory(hash);
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
  async getTransactionsByStatus(status: 'processed' | 'processing' | 'failed', page: number = 1, limit: number = 20): Promise<[Transaction[], number]> {
    return await this.repository.findAndCount({
      where: { status },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit
    });
  }

  /**
   * Получение транзакций с исправимыми ошибками
   * Это заменяет предыдущий метод getPendingTransactions
   */
  async getRetryableFailedTransactions(page: number = 1, limit: number = 20): Promise<[Transaction[], number]> {
    // Список ошибок, при которых нет смысла повторять транзакцию
    const nonRetryableErrors = [
      "ERR_INVALID_USERNAME", 
      "ERR_MISSING_COMMENT",
      "ERR_STARS_BELOW_MINIMUM",
      "ERR_STARS_ABOVE_MAXIMUM"
    ];

    // Создаем запрос для получения транзакций с ошибками, которые можно повторить
    const queryBuilder = this.repository.createQueryBuilder('tx')
      .where('tx.status = :status', { status: 'failed' });
    
    // Исключаем транзакции с неисправимыми ошибками
    for (const error of nonRetryableErrors) {
      queryBuilder.andWhere('tx.errorMessage NOT LIKE :error', { error: `%${error}%` });
    }
    
    // Применяем сортировку и пагинацию
    const [transactions, count] = await queryBuilder
      .orderBy('tx.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    
    return [transactions, count];
  }

  /**
   * Получение статистики по транзакциям
   */
  async getTransactionStats(): Promise<{ 
    totalCount: number; 
    processedCount: number;
    processingCount: number;
    failedCount: number;
    retryableFailedCount: number;
    totalStars: number;
    totalTon: string;
  }> {
    const totalCount = await this.repository.count();
    const processedCount = await this.repository.count({ where: { status: 'processed' } });
    const processingCount = await this.repository.count({ where: { status: 'processing' } });
    const failedCount = await this.repository.count({ where: { status: 'failed' } });
    
    // Получение количества транзакций с исправимыми ошибками
    const [, retryableFailedCount] = await this.getRetryableFailedTransactions(1, 0);
    
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
      failedCount,
      retryableFailedCount,
      totalStars: starsResult.total || 0,
      totalTon: tonResult.total ? Number(tonResult.total).toFixed(9) : '0'
    };
  }
} 