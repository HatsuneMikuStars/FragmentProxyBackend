import { TonWalletService } from '../wallet/TonWalletService';
import { FragmentStarsPurchaseService } from './fragmentStarsPurchaseService';
import { TransactionRepository } from '../database/repositories/transaction.repository';
import { TransactionType, WalletTransaction } from '../wallet/models/walletModels';
import { TRANSACTION_MONITOR_CONFIG } from '../config';
import { Transaction } from '../database/entities/transaction.entity';

/**
 * Сервис для мониторинга транзакций TON и автоматической покупки звезд
 */
export class TonTransactionMonitor {
  private walletService: TonWalletService;
  private starsPurchaseService: FragmentStarsPurchaseService;
  private transactionRepository: TransactionRepository;
  
  private isRunning: boolean = false;
  private lastCheckTimestamp: number = 0;
  private interval: NodeJS.Timeout | null = null;
  
  /**
   * Constructor
   */
  constructor(
    walletService: TonWalletService,
    starsPurchaseService: FragmentStarsPurchaseService,
    transactionRepository: TransactionRepository
  ) {
    this.walletService = walletService;
    this.starsPurchaseService = starsPurchaseService;
    this.transactionRepository = transactionRepository;
    
    console.log('[Monitor] Transaction monitor initialized');
  }
  
  /**
   * Start transaction monitoring
   */
  public start(): void {
    if (this.isRunning) {
      console.log('[Monitor] Monitoring already running');
      return;
    }
    
    this.isRunning = true;
    console.log('[Monitor] Monitoring started');
    
    // Start initial check immediately
    this.checkNewTransactions();
    
    // Запускаем диагностику застрявших транзакций
    this.diagnoseStuckTransactions()
      .then(result => {
        console.log(`[Monitor] Начальная диагностика застрявших транзакций: ${JSON.stringify(result, null, 2)}`);
      })
      .catch(error => {
        console.error(`[Monitor] Ошибка при начальной диагностике: ${error.message}`);
      });
    
    // Start periodic check
    this.interval = setInterval(
      () => this.checkNewTransactions(), 
      TRANSACTION_MONITOR_CONFIG.CHECK_INTERVAL_MS
    );
    
    // Запускаем периодическую диагностику застрявших транзакций
    // с интервалом в 2 раза больше обычного интервала проверки
    setInterval(() => {
      if (!this.isRunning) return;
      
      this.diagnoseStuckTransactions()
        .then(result => {
          if (result.stuck > 0) {
            console.log(`[Monitor] Диагностика обнаружила ${result.stuck} застрявших транзакций`);
            console.log(`[Monitor] Подробности: ${JSON.stringify(result.transactions, null, 2)}`);
          }
        })
        .catch(error => {
          console.error(`[Monitor] Ошибка при диагностике застрявших транзакций: ${error.message}`);
        });
    }, TRANSACTION_MONITOR_CONFIG.CHECK_INTERVAL_MS * 2);
  }
  
  /**
   * Stop monitoring
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log('[Monitor] Monitoring already stopped');
      return;
    }
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    this.isRunning = false;
    console.log('[Monitor] Monitoring stopped');
  }
  
  /**
   * Проверка новых транзакций
   */
  private async checkNewTransactions(): Promise<void> {
    try {
      // Получаем timestamp 24 часа назад
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);
      const last24HoursTimestamp = Math.floor(last24Hours.getTime() / 1000);
      
      // Получаем транзакции напрямую из WalletService с фильтрацией за последние 24 часа
      const recentTransactions = await this.walletService.getTransactions({
        limit: 20,
        archival: true, // Используем архивные ноды для полной истории
        type: TransactionType.INCOMING, // Только входящие транзакции
        startTimestamp: last24HoursTimestamp // Только транзакции за последние 24 часа
      });
      
      if (recentTransactions.length > 0) {
        console.log(`[Monitor] Found ${recentTransactions.length} transactions for the last 24 hours (since ${new Date(last24HoursTimestamp * 1000).toISOString()})`);
      }
      
      // Обрабатываем каждую транзакцию за последние 24 часа
      for (const tx of recentTransactions) {
        await this.processTransaction(tx);
      }
      
      // Обновляем время последней проверки
      this.lastCheckTimestamp = Date.now();
    } catch (error) {
      console.error(`[Monitor] Error checking transactions: ${(error as Error).message}`);
    }
  }
  
  /**
   * Проверка новых транзакций для заданного хеша транзакции
   * Этот метод можно вызывать публично для принудительной проверки конкретной транзакции
   */
  public async checkTransactionByHash(txHash: string): Promise<boolean> {
    try {
      console.log(`[Monitor] Checking transaction by hash: ${txHash}`);
      
      // Проверяем, не обрабатывали ли мы уже эту транзакцию
      const existingTx = await this.transactionRepository.findByHash(txHash);
      
      // Если транзакция уже существует и успешно обработана, пропускаем её
      if (existingTx && existingTx.status === 'processed') {
        console.log(`[Monitor] Транзакция ${txHash} уже обработана успешно, повторная обработка не требуется`);
        return false;
      }
      
      // Если транзакция уже существует и в процессе обработки, пропускаем её
      if (existingTx && existingTx.status === 'processing') {
        console.log(`[Monitor] Транзакция ${txHash} уже обрабатывается другим процессом`);
        return false;
      }
      
      // Получаем транзакцию по хешу
      const tx = await this.walletService.getTransactionByHash(txHash);
      if (!tx) {
        console.log(`[Monitor] Transaction with hash ${txHash} not found`);
        
        // Если транзакция существует в нашей БД, но не найдена в блокчейне,
        // отмечаем её как failed
        if (existingTx) {
          await this.transactionRepository.unlockTransaction(
            txHash, 
            "ERR_NOT_FOUND: Транзакция не найдена в блокчейне"
          );
        }
        
        return false;
      }
      
      // Обрабатываем транзакцию
      await this.processTransaction(tx);
      return true;
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(`[Monitor] Error checking transaction ${txHash}: ${errorMessage}`);
      
      // Если произошла ошибка и транзакция существует, разблокируем её
      try {
        const existingTx = await this.transactionRepository.findByHash(txHash);
        if (existingTx && existingTx.status === 'processing') {
          await this.transactionRepository.unlockTransaction(
            txHash, 
            `ERR_CHECK_FAILED: Ошибка при проверке транзакции: ${errorMessage}`
          );
        }
      } catch (unlockError) {
        console.error(`[Monitor] Failed to unlock transaction ${txHash}: ${(unlockError as Error).message}`);
      }
      
      return false;
    }
  }
  
  /**
   * Обработка транзакции
   */
  private async processTransaction(tx: WalletTransaction): Promise<void> {
    // Хеш транзакции для удобства использования в логах
    const hash = tx.id;
    
    try {
      // Проверяем, существует ли транзакция в базе данных
      const existingTransaction = await this.transactionRepository.findByHash(hash);
      
      // Проверка статусов существующей транзакции
      if (existingTransaction) {

        if(existingTransaction.fragmentTransactionHash) {
          console.log(`[Monitor] Транзакция ${hash} уже была обработана в Fragment`);
          return;
        }

        // Если транзакция уже обработана - пропускаем
        if (existingTransaction.status === 'processed') {
          console.log(`[Monitor] Скипуем уже обработанную транзакцию: ${hash}`);
          return;
        }
        
        // Проверяем зависшие транзакции в статусе processing
        if (existingTransaction.status === 'processing') {
          // Проверяем время последнего обновления транзакции
          const now = new Date();
          const updatedAt = existingTransaction.updatedAt;
          const timeInProcessing = now.getTime() - updatedAt.getTime();
          
          // Логируем подробности для диагностики
          console.log(`[Monitor] Транзакция ${hash} в статусе processing ${(timeInProcessing / (60 * 1000)).toFixed(1)} минут. Таймаут: ${(TRANSACTION_MONITOR_CONFIG.PROCESSING_TIMEOUT_MS / (60 * 1000)).toFixed(1)} минут`);
          
          // Если транзакция "зависла" в processing дольше заданного времени
          if (timeInProcessing >= TRANSACTION_MONITOR_CONFIG.PROCESSING_TIMEOUT_MS) {
            console.log(`[Monitor] Транзакция ${hash} зависла в состоянии processing на ${(timeInProcessing / (60 * 1000)).toFixed(1)} минут, пробуем обработать повторно`);
            
            // Пытаемся разблокировать транзакцию с ошибкой тайм-аута
            const unlockResult = await this.transactionRepository.unlockTransaction(
              hash, 
              `ERR_PROCESSING_TIMEOUT: Транзакция зависла в статусе processing на ${(timeInProcessing / (60 * 1000)).toFixed(1)} минут`
            );
            
            if (!unlockResult) {
              console.log(`[Monitor] Не удалось разблокировать зависшую транзакцию ${hash}, возможно она была разблокирована другим процессом`);
              return;
            }
            
            console.log(`[Monitor] Транзакция ${hash} успешно разблокирована, продолжаем обработку`);
            // Продолжаем выполнение кода (не делаем return), чтобы перезапустить обработку транзакции
          } else {
            console.log(`[Monitor] Скипуем транзакцию в обработке: ${hash} (${(timeInProcessing / (60 * 1000)).toFixed(1)} минут в статусе processing)`);
            return;
          }
        }
        
        // Для транзакций со статусом 'failed' выполняем повторную обработку только если ошибка исправима
        if (existingTransaction.status === 'failed') {
          // Список ошибок, при которых нет смысла повторять транзакцию
          const nonRetryableErrors = [
            "ERR_INVALID_USERNAME", 
            "ERR_MISSING_COMMENT",
            "ERR_STARS_BELOW_MINIMUM",
            "ERR_STARS_ABOVE_MAXIMUM"
          ];
          
          // Проверяем, является ли ошибка неисправимой
          const errorMessage = existingTransaction.errorMessage || '';
          const isNonRetryableError = nonRetryableErrors.some(err => errorMessage.includes(err));
          
          if (isNonRetryableError) {
            console.log(`[Monitor] Скипуем проваленную транзакцию с неисправимой ошибкой: ${hash}, ошибка: ${errorMessage}`);
            return;
          }
          
          // Проверяем, была ли уже отправка звезд ранее (по наличию outgoingTransactionHash)
          if (existingTransaction.outgoingTransactionHash) {
            console.log(`[Monitor] Скипуем проваленную транзакцию, которая уже отправляла звезды: ${hash}, outgoingHash: ${existingTransaction.outgoingTransactionHash}`);
            
            // Меняем статус на processed, чтобы предотвратить повторную обработку
            await this.transactionRepository.updateTransactionAfterStarsPurchase(
              hash,
              existingTransaction.outgoingTransactionHash,
              existingTransaction.fragmentTransactionHash || existingTransaction.outgoingTransactionHash,
              true, // отмечаем как успешную
              'ERR_ALREADY_PROCESSED: Транзакция уже отправляла звезды ранее'
            );
            
            return;
          }
          
          console.log(`[Monitor] Повторяем проваленную транзакцию с потенциально исправимой ошибкой: ${hash}, ошибка: ${errorMessage}`);
        }
        
        // Пытаемся заблокировать транзакцию для обработки
        const lockSuccessful = await this.transactionRepository.lockTransaction(hash);
        if (!lockSuccessful) {
          console.log(`[Monitor] Не удалось заблокировать транзакцию ${hash} для обработки`);
          return;
        }
        console.log(`[Monitor] Транзакция ${hash} успешно заблокирована для обработки`);
      }
      
      // Используем блок try-finally для гарантированной разблокировки транзакции в случае ошибки
      try {
        if (!tx.comment) {
          console.log(`[Monitor] Скипуем транзакцию без комментария: ${hash}, сумма: ${Number(tx.amount) / 1_000_000_000} TON, отправитель: ${tx.fromAddress || 'неизвестен'}`);
          
          // Сохраняем информацию о пропущенной транзакции
          await this.transactionRepository.saveTransaction({
            hash: hash,
            amount: Number(tx.amount) / 1_000_000_000, // Преобразуем bigint в number и конвертируем из нано в TON
            timestamp: tx.timestamp,
            senderAddress: tx.fromAddress || '',
            status: "failed",
            statusMsg: "ERR_MISSING_COMMENT: Транзакция не содержит комментарий с именем пользователя"
          });
          
          // Если транзакция была заблокирована, разблокируем её с ошибкой
          if (existingTransaction) {
            await this.transactionRepository.unlockTransaction(hash, "ERR_MISSING_COMMENT: Транзакция не содержит комментарий с именем пользователя");
          }
          return;
        }
        
        const username = this.extractUsernameFromComment(tx.comment);
        if (!username) {
          console.log(`[Monitor] Некорректное или отсутствующее имя пользователя в комментарии: "${tx.comment}" для транзакции: ${hash}`);
          
          // Сохраняем информацию о пропущенной транзакции
          await this.transactionRepository.saveTransaction({
            hash: hash,
            amount: Number(tx.amount) / 1_000_000_000, // Преобразуем bigint в number и конвертируем из нано в TON
            timestamp: tx.timestamp,
            comment: tx.comment,
            senderAddress: tx.fromAddress || '',
            status: "failed",
            statusMsg: `ERR_INVALID_USERNAME: Некорректное имя пользователя в комментарии: "${tx.comment}"`
          });
          
          // Если транзакция была заблокирована, разблокируем её с ошибкой
          if (existingTransaction) {
            await this.transactionRepository.unlockTransaction(hash, `ERR_INVALID_USERNAME: Некорректное имя пользователя в комментарии: "${tx.comment}"`);
          }
          return;
        }
        
        // Получаем текущий курс обмена TON на звезды
        const starsPerTon = await this.starsPurchaseService.getStarsExchangeRate();
        
        // Рассчитываем комиссию за газ и сумму после вычета газа
        const originalAmount = Number(tx.amount) / 1_000_000_000; // Преобразуем из нано TON в TON
        const gasFee = tx.fee ? Number(tx.fee) / 1_000_000_000 : 0; // Преобразуем комиссию из нано TON в TON
        const amountAfterGas = Math.max(0, originalAmount - gasFee);
        
        // Рассчитываем количество звезд для покупки (без дробной части)
        const starsAmount = Math.floor(amountAfterGas * starsPerTon);
        
        // Проверяем, что количество звезд превышает минимальный порог
        if (starsAmount < TRANSACTION_MONITOR_CONFIG.MIN_STARS) {
          console.log(`[Monitor] Stars amount (${starsAmount}) is less than minimum threshold (${TRANSACTION_MONITOR_CONFIG.MIN_STARS}) for transaction: ${hash}`);
          
          // Сохраняем информацию о пропущенной транзакции с детальным кодом ошибки
          const errorMsg = `ERR_STARS_BELOW_MINIMUM: Количество звезд (${starsAmount}) меньше минимального порога (${TRANSACTION_MONITOR_CONFIG.MIN_STARS})`;
          
          await this.transactionRepository.saveTransaction({
            hash: hash,
            amount: originalAmount,
            timestamp: tx.timestamp,
            comment: tx.comment,
            senderAddress: tx.fromAddress || '',
            status: "failed",
            gasFee,
            amountAfterGas,
            exchangeRate: starsPerTon,
            statusMsg: errorMsg
          }, username, starsAmount);
          
          // Если транзакция была заблокирована, разблокируем её с ошибкой
          if (existingTransaction) {
            await this.transactionRepository.unlockTransaction(hash, errorMsg);
          }
          return;
        }
        
        // Проверяем, что количество звезд не превышает максимальный лимит
        if (starsAmount > TRANSACTION_MONITOR_CONFIG.MAX_STARS) {
          console.log(`[Monitor] Stars amount (${starsAmount}) exceeds maximum limit (${TRANSACTION_MONITOR_CONFIG.MAX_STARS}) for transaction: ${hash}`);
          
          // Сохраняем информацию о пропущенной транзакции с детальным кодом ошибки
          const errorMsg = `ERR_STARS_ABOVE_MAXIMUM: Количество звезд (${starsAmount}) превышает максимальный лимит (${TRANSACTION_MONITOR_CONFIG.MAX_STARS})`;
          
          await this.transactionRepository.saveTransaction({
            hash: hash,
            amount: originalAmount,
            timestamp: tx.timestamp,
            comment: tx.comment,
            senderAddress: tx.fromAddress || '',
            status: "failed",
            gasFee,
            amountAfterGas,
            exchangeRate: starsPerTon,
            statusMsg: errorMsg
          }, username, starsAmount);
          
          // Если транзакция была заблокирована, разблокируем её с ошибкой
          if (existingTransaction) {
            await this.transactionRepository.unlockTransaction(hash, errorMsg);
          }
          return;
        }
        
        console.log(`[Monitor] Processing transaction:
  - Hash: ${hash}
  - User: @${username}
  - Original amount: ${originalAmount.toFixed(9)} TON
  - Gas fee: ${gasFee.toFixed(9)} TON (${(gasFee/originalAmount*100).toFixed(2)}% of transaction)
  - Amount after gas: ${amountAfterGas.toFixed(9)} TON
  - Stars to purchase: ${starsAmount} (rate: ${starsPerTon.toFixed(2)} stars/TON)`);
        
        // Если это новая транзакция, сохраняем её со статусом processing
        if (!existingTransaction) {
          await this.transactionRepository.saveTransaction({
            hash: hash,
            amount: originalAmount,
            timestamp: tx.timestamp,
            comment: tx.comment,
            senderAddress: tx.fromAddress || '',
            gasFee,
            amountAfterGas,
            exchangeRate: starsPerTon,
            status: "processing" // Сразу устанавливаем статус "processing"
          }, username, starsAmount);
          console.log(`[Monitor] Новая транзакция ${hash} создана и заблокирована для обработки`);
        }
        
        // Отправляем звезды через существующий сервис
        try {
          console.log(`[Monitor] Начинаем покупку ${starsAmount} звезд для пользователя @${username}`);
          const result = await this.starsPurchaseService.purchaseStarsAsync(username, starsAmount);
          
          // Обновляем информацию о транзакции в базе данных
          if (result.success) {
            await this.transactionRepository.updateTransactionAfterStarsPurchase(
              hash,
              result.outgoingTransactionHash || "",
              result.transactionHash || "",
              true
            );
            console.log(`[Monitor] УСПЕШНО отправлено ${starsAmount} звезд пользователю @${username}, хеш транзакции: ${result.transactionHash}`);
          } else {
            // Детализированное сообщение об ошибке с кодом категории
            const errorType = this.categorizeError(result.error || "Неизвестная ошибка");
            const errorCode = `ERR_${errorType}`;
            const errorMsg = `${errorCode}: ${result.error || "Неизвестная ошибка"}`;
            console.error(`[Monitor] ОШИБКА: ${errorMsg}`);
            
            await this.transactionRepository.updateTransactionAfterStarsPurchase(
              hash,
              result.outgoingTransactionHash || "",
              result.transactionHash || "",
              false,
              errorMsg
            );
          }
        } catch (error) {
          const errorMessage = (error as Error).message;
          const errorType = this.categorizeError(errorMessage);
          const errorCode = `ERR_${errorType}`;
          const detailedError = `${errorCode}: ${errorMessage}`;
          console.error(`[Monitor] КРИТИЧЕСКАЯ ОШИБКА при отправке звезд: ${detailedError}`);
          
          // Если транзакция была заблокирована или создана со статусом processing,
          // разблокируем её с ошибкой (это обновит статус на failed)
          await this.transactionRepository.unlockTransaction(hash, detailedError);
        }
      } finally {
        // В блоке finally гарантируем разблокировку транзакции в случае непредвиденных ошибок
        // Это важно для обеспечения отказоустойчивости системы
        if (existingTransaction) {
          // Проверяем текущий статус транзакции
          const currentTx = await this.transactionRepository.findByHash(hash);
          
          // Если транзакция все еще имеет статус 'processing', значит что-то пошло не так
          // и нужно разблокировать её
          if (currentTx && currentTx.status === 'processing') {
            console.log(`[Monitor] Принудительная разблокировка транзакции ${hash} в блоке finally`);
            await this.transactionRepository.unlockTransaction(hash);
          }
        }
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      const errorType = this.categorizeError(errorMessage);
      const errorCode = `ERR_${errorType}`;
      const detailedError = `${errorCode}: ${errorMessage}`;
      console.error(`[Monitor] НЕПРЕДВИДЕННАЯ ОШИБКА при обработке транзакции ${hash}: ${detailedError}`);
       
      // Пытаемся сохранить информацию об ошибке в базу данных
      try {
        // Проверяем, существует ли транзакция
        const existingTx = await this.transactionRepository.findByHash(hash);
        
        if (existingTx) {
          // Если транзакция существует, разблокируем её с ошибкой
          await this.transactionRepository.unlockTransaction(hash, detailedError);
        } else {
          // Если транзакции не существует, создаем новую с ошибкой
          await this.transactionRepository.saveTransaction({
            hash: hash,
            amount: Number(tx.amount) / 1_000_000_000, // Преобразуем bigint в number и конвертируем из нано в TON
            timestamp: tx.timestamp,
            comment: tx.comment || "",
            senderAddress: tx.fromAddress || '',
            status: "failed",
            statusMsg: detailedError
          });
        }
      } catch (dbError) {
        console.error(`[Monitor] Не удалось сохранить информацию об ошибке в базу: ${(dbError as Error).message}`);
      }
    }
  }
  
  /**
   * Категоризирует ошибку для более понятного вывода в логи и базу данных
   * @param errorMessage сообщение об ошибке
   * @returns код категории ошибки
   */
  private categorizeError(errorMessage: string): string {
    const lowerCaseError = errorMessage.toLowerCase();
    
    if (lowerCaseError.includes('status code 500')) {
      return 'API_SERVER_ERROR';
    } else if (lowerCaseError.includes('unauthorized') || lowerCaseError.includes('авторизац')) {
      return 'AUTH_FAILURE';
    } else if (lowerCaseError.includes('пользователь не найден') || lowerCaseError.includes('user not found')) {
      return 'USER_NOT_FOUND';
    } else if (lowerCaseError.includes('wallet') || lowerCaseError.includes('кошел')) {
      return 'WALLET_ERROR';
    } else if (lowerCaseError.includes('баланс') || lowerCaseError.includes('balance')) {
      return 'INSUFFICIENT_FUNDS';
    } else if (lowerCaseError.includes('timeout') || lowerCaseError.includes('таймаут')) {
      return 'CONNECTION_TIMEOUT';
    } else if (lowerCaseError.includes('network') || lowerCaseError.includes('сет')) {
      return 'NETWORK_ERROR';
    } else if (lowerCaseError.includes('fragment api')) {
      return 'FRAGMENT_API_ERROR';
    } else {
      return 'UNKNOWN_ERROR';
    }
  }
  
  /**
   * Извлечение никнейма из комментария транзакции
   */
  private extractUsernameFromComment(comment: string): string | null {
    // Удаляем лишние пробелы
    comment = comment.trim();
    
    // Проверяем, начинается ли комментарий с @
    if (comment.startsWith('@')) {
      // Убираем @ в начале
      const username = comment.substring(1);
      
      // Проверяем, что никнейм соответствует правилам Telegram (5-32 символа, буквы, цифры и подчеркивания)
      const usernameRegex = /^[a-zA-Z0-9_]{5,32}$/;
      if (usernameRegex.test(username)) {
        return username;
      }
    } else {
      // Проверяем, может быть никнейм указан без @
      const usernameRegex = /^[a-zA-Z0-9_]{5,32}$/;
      if (usernameRegex.test(comment)) {
        return comment;
      }
    }
    
    return null;
  }
  
  /**
   * Получение всех последних транзакций с пагинацией
   */
  public async getAllTransactions(page: number = 1, limit: number = 20): Promise<{ data: Transaction[], total: number }> {
    const [transactions, count] = await this.transactionRepository.getRecentTransactions(page, limit);
    return {
      data: transactions,
      total: count
    };
  }
  
  /**
   * Получение транзакций с ошибками, которые можно повторить
   */
  public async getRetryableFailedTransactions(page: number = 1, limit: number = 20): Promise<{ data: Transaction[], total: number }> {
    const [transactions, count] = await this.transactionRepository.getRetryableFailedTransactions(page, limit);
    return {
      data: transactions,
      total: count
    };
  }
  
  /**
   * Получение всех обработанных транзакций
   */
  public async getProcessedTransactions(page: number = 1, limit: number = 20): Promise<{ data: Transaction[], total: number }> {
    const [transactions, count] = await this.transactionRepository.getTransactionsByStatus('processed', page, limit);
    return {
      data: transactions,
      total: count
    };
  }
  
  /**
   * Получение статистики транзакций
   */
  public async getTransactionStats(): Promise<{
    totalCount: number;
    processedCount: number;
    processingCount: number;
    failedCount: number;
    retryableFailedCount: number;
    totalStars: number;
    totalTon: string;
  }> {
    return await this.transactionRepository.getTransactionStats();
  }
  
  /**
   * Получение истории конкретной транзакции
   */
  public async getTransactionHistory(hash: string): Promise<Array<{
    timestamp: string;
    action: string;
    statusChange: string;
    message: string | null;
    data: Record<string, unknown> | null;
  }>> {
    return await this.transactionRepository.getTransactionHistory(hash);
  }
  
  /**
   * Диагностика проблем с транзакциями, находящимися в статусе processing
   */
  public async diagnoseStuckTransactions(): Promise<{
    stuck: number;
    transactions?: Array<{
      hash: string;
      timeInProcessing: string;
      isTimedOut: boolean;
      historyRecordsCount: number;
      updatedAt: string;
      status: string;
    }>;
    message?: string;
    error?: string;
  }> {
    try {
      console.log('[Monitor] Запуск диагностики застрявших транзакций...');
      
      // Получаем все транзакции в статусе processing
      const [transactions] = await this.transactionRepository.getTransactionsByStatus('processing', 1, 100);
      
      if (transactions.length === 0) {
        console.log('[Monitor] Застрявших транзакций не обнаружено');
        return { stuck: 0, message: 'Застрявших транзакций не обнаружено' };
      }
      
      console.log(`[Monitor] Обнаружено ${transactions.length} застрявших транзакций`);
      
      // Проверяем каждую транзакцию
      const diagnosisResults = [];
      
      for (const tx of transactions) {
        const now = new Date();
        const updatedAt = new Date(tx.updatedAt);
        const timeInProcessing = now.getTime() - updatedAt.getTime();
        const minutesInProcessing = timeInProcessing / (60 * 1000);
        
        // Получаем историю транзакции
        const history = await this.transactionRepository.getTransactionHistory(tx.hash);
        
        // Проверяем таймаут
        const isTimedOut = timeInProcessing >= TRANSACTION_MONITOR_CONFIG.PROCESSING_TIMEOUT_MS;
        
        diagnosisResults.push({
          hash: tx.hash,
          timeInProcessing: `${minutesInProcessing.toFixed(1)} минут`,
          isTimedOut,
          historyRecordsCount: history.length,
          updatedAt: updatedAt.toISOString(),
          status: tx.status
        });
        
        // Если транзакция превысила таймаут, автоматически разблокируем её
        if (isTimedOut) {
          console.log(`[Monitor] Автоматическая разблокировка зависшей транзакции ${tx.hash} (${minutesInProcessing.toFixed(1)} минут в processing)`);
          
          await this.transactionRepository.unlockTransaction(
            tx.hash,
            `ERR_PROCESSING_TIMEOUT: Транзакция автоматически разблокирована после ${minutesInProcessing.toFixed(1)} минут в статусе processing`
          );
        }
      }
      
      return {
        stuck: transactions.length,
        transactions: diagnosisResults
      };
    } catch (error) {
      console.error(`[Monitor] Ошибка при диагностике застрявших транзакций: ${(error as Error).message}`);
      return { stuck: 0, error: (error as Error).message };
    }
  }
} 