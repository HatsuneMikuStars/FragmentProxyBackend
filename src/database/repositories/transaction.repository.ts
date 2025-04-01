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
    // Максимальное количество попыток
    const maxRetries = 10;
    // Базовая задержка (в миллисекундах)
    const baseDelay = 300;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
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
        
        // Если у транзакции уже есть outgoingTransactionHash, значит она уже отправляла средства
        // Предотвращаем повторную обработку таких транзакций
        if (tx.outgoingTransactionHash) {
          console.log(`[TransactionRepo] Транзакция ${hash} уже отправляла средства (outgoingTransactionHash=${tx.outgoingTransactionHash}), блокировка не требуется`);
          // Обновляем статус на processed для предотвращения повторной обработки
          tx.status = 'processed';
          tx.errorMessage = 'ERR_ALREADY_PROCESSED: Транзакция уже отправляла средства ранее';
          await this.repository.save(tx);
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
          
          // Транзакция имеет исправимую ошибку, но уже обрабатывается - отмечаем её обработанной
          // Это предотвратит повторную обработку той же самой транзакции
          // и решит проблему с двойной отправкой звезд
          tx.status = 'processed';
          tx.errorMessage = 'ERR_ALREADY_PROCESSED: Транзакция уже была обработана ранее';
          await this.repository.save(tx);
          
          console.log(`[TransactionRepo] Транзакция ${hash} со статусом failed помечена как обработанная для предотвращения повторной обработки`);
          return false;
        }
        
        const previousStatus = tx.status;
        
        // Попытка атомарно обновить статус с обработкой возможной блокировки базы
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
            
            // Добавляем запись в историю с механизмом повторных попыток
            await this.addHistoryRecordWithRetry(
              hash,
              TransactionActions.LOCKED,
              'processing',
              previousStatus,
              `Транзакция заблокирована для обработки`
            );
            
            return true;
          } else {
            console.log(`[TransactionRepo] Не удалось заблокировать транзакцию ${hash}, возможно она была заблокирована другим процессом`);
            return false;
          }
        } catch (dbError) {
          console.error(`[TransactionRepo] Ошибка DB при блокировке транзакции ${hash} (попытка ${attempt+1}/${maxRetries}): ${(dbError as Error).message}`);
        }
        
        // Если выполнение дошло до этой точки, значит обновление не удалось - делаем задержку
        const delay = baseDelay * Math.pow(2, attempt); // Экспоненциальная задержка
        console.log(`[TransactionRepo] Повторная попытка блокировки ${hash} через ${delay}мс (попытка ${attempt+1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.error(`[TransactionRepo] Общая ошибка при блокировке транзакции ${hash} (попытка ${attempt+1}/${maxRetries}): ${(error as Error).message}`);
        
        // Делаем задержку перед следующей попыткой
        const delay = baseDelay * Math.pow(2, attempt); // Экспоненциальная задержка
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Если после всех попыток не удалось заблокировать - возвращаем false
    console.error(`[TransactionRepo] Не удалось заблокировать транзакцию ${hash} после ${maxRetries} попыток`);
    return false;
  }

  /**
   * Разблокирует транзакцию, если обработка не удалась
   * @param hash Хеш транзакции
   * @param errorMessage Сообщение об ошибке
   * @returns true если разблокировка успешна
   */
  async unlockTransaction(hash: string, errorMessage?: string): Promise<boolean> {
    // Максимальное количество попыток
    const maxRetries = 10;
    // Базовая задержка (в миллисекундах)
    const baseDelay = 300;
    
    // Всегда устанавливаем статус 'failed' при разблокировке
    // Если сообщение об ошибке не указано, используем стандартное
    const finalErrorMessage = errorMessage || 'ERR_INTERRUPTED: Обработка транзакции была прервана';
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const tx = await this.findByHash(hash);
        if (!tx) return false;
        
        const previousStatus = tx.status;
        
        // Если транзакция не в статусе 'processing', нет смысла разблокировать
        if (tx.status !== 'processing') {
          console.log(`[TransactionRepo] Транзакция ${hash} уже не находится в статусе 'processing', текущий статус: ${tx.status}`);
          return false;
        }
        
        // Выполняем запрос в блоке try-catch для перехвата ошибок блокировки
        try {
          await this.repository.update(
            { hash, status: 'processing' }, // Разблокируем только если статус 'processing'
            { 
              status: 'failed',
              errorMessage: finalErrorMessage
            }
          );
          
          // Проверяем, действительно ли статус обновился
          const updatedTx = await this.findByHash(hash);
          if (updatedTx && updatedTx.status === 'failed') {
            console.log(`[TransactionRepo] Транзакция ${hash} разблокирована со статусом 'failed', ошибка: ${finalErrorMessage}`);
            
            // Добавляем запись в историю с механизмом повторных попыток
            await this.addHistoryRecordWithRetry(
              hash,
              TransactionActions.UNLOCKED,
              'failed',
              previousStatus,
              finalErrorMessage
            );
            
            return true;
          }
        } catch (dbError) {
          console.error(`[TransactionRepo] Ошибка DB при разблокировке транзакции ${hash} (попытка ${attempt+1}/${maxRetries}): ${(dbError as Error).message}`);
        }
        
        // Если мы дошли до этой точки, значит обновление не удалось - делаем задержку перед следующей попыткой
        const delay = baseDelay * Math.pow(2, attempt); // Экспоненциальная задержка
        console.log(`[TransactionRepo] Повторная попытка разблокировки ${hash} через ${delay}мс (попытка ${attempt+1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.error(`[TransactionRepo] Общая ошибка при разблокировке транзакции ${hash} (попытка ${attempt+1}/${maxRetries}): ${(error as Error).message}`);
        
        // Делаем задержку перед следующей попыткой
        const delay = baseDelay * Math.pow(2, attempt); // Экспоненциальная задержка
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Если после всех попыток не удалось разблокировать - возвращаем false
    console.error(`[TransactionRepo] Не удалось разблокировать транзакцию ${hash} после ${maxRetries} попыток`);
    return false;
  }
  
  /**
   * Вспомогательный метод для добавления записи в историю с механизмом повторных попыток
   */
  private async addHistoryRecordWithRetry(
    transactionHash: string,
    action: TransactionActions,
    newStatus: string,
    previousStatus?: string,
    message?: string,
    data?: Record<string, any>
  ): Promise<boolean> {
    const maxRetries = 5;
    const baseDelay = 300;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.historyRepository.addHistoryRecord(
          transactionHash,
          action,
          newStatus,
          previousStatus,
          message,
          data
        );
        return true;
      } catch (error) {
        console.error(`[TransactionRepo] Ошибка при добавлении записи в историю для ${transactionHash} (попытка ${attempt+1}/${maxRetries}): ${(error as Error).message}`);
        
        // Делаем задержку перед следующей попыткой
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.error(`[TransactionRepo] Не удалось добавить запись в историю для ${transactionHash} после ${maxRetries} попыток`);
    return false;
  }

  /**
   * Добавление новой транзакции в базу данных
   */
  async saveTransaction(transaction: TonTransactionData, username?: string, starsAmount?: number): Promise<Transaction> {
    // Максимальное количество попыток для операций с базой
    const maxRetries = 10;
    const baseDelay = 300;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
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

        // Проверяем, существует ли уже транзакция с таким хешем
        const isNewTransaction = !(await this.exists(transaction.hash));
        
        // Сохраняем транзакцию
        let savedTransaction;
        try {
          savedTransaction = await this.repository.save(newTransaction);
        } catch (dbError) {
          const errorMsg = (dbError as Error).message;
          console.error(`[TransactionRepo] Ошибка DB при сохранении транзакции ${transaction.hash} (попытка ${attempt+1}/${maxRetries}): ${errorMsg}`);
          
          // Если ошибка связана с блокировкой базы данных или конфликтом SAVEPOINT,
          // делаем задержку и пробуем снова
          if (errorMsg.includes('SQLITE_BUSY') || errorMsg.includes('SQLITE_ERROR: near')) {
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(`[TransactionRepo] Ожидание ${delay}мс перед повторной попыткой сохранения транзакции ${transaction.hash}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            // Если ошибка не связана с блокировкой, пробрасываем её
            throw dbError;
          }
        }
        
        // Добавляем запись в историю
        if (isNewTransaction) {
          await this.addHistoryRecordWithRetry(
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
          await this.addHistoryRecordWithRetry(
            transaction.hash,
            TransactionActions.STATUS_CHANGED,
            newTransaction.status,
            undefined,
            newTransaction.errorMessage || `Статус транзакции обновлен на ${newTransaction.status}`
          );
        }
        
        return savedTransaction;
      } catch (error) {
        console.error(`[TransactionRepo] Общая ошибка при сохранении транзакции ${transaction.hash} (попытка ${attempt+1}/${maxRetries}): ${(error as Error).message}`);
        
        // Если это не последняя попытка, ждем и пробуем снова
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`[TransactionRepo] Ожидание ${delay}мс перед повторной попыткой сохранения транзакции ${transaction.hash}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // Если все попытки не удались, генерируем ошибку
    throw new Error(`Не удалось сохранить транзакцию ${transaction.hash} после ${maxRetries} попыток`);
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