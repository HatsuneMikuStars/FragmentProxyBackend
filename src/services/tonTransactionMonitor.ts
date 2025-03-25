import { TonWalletService } from '../wallet/TonWalletService';
import { FragmentStarsPurchaseService } from './fragmentStarsPurchaseService';
import { TransactionRepository } from '../database/repositories/transaction.repository';
import fs from 'fs';
import path from 'path';
import { TRANSACTION_MONITOR_CONFIG } from '../config';
import { WalletTransaction } from '../wallet/models/walletModels';

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
    
    // Start periodic check
    this.interval = setInterval(
      () => this.checkNewTransactions(), 
      TRANSACTION_MONITOR_CONFIG.CHECK_INTERVAL_MS
    );
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
      // Получаем транзакции напрямую из WalletService
      const newTransactions = await this.walletService.getTransactions({
        limit: 20,
        archival: true // Используем архивные ноды для полной истории
      });
      
      if (newTransactions.length > 0) {
        console.log(`[Monitor] Found ${newTransactions.length} transactions`);
      }
      
      // Обрабатываем каждую новую транзакцию
      for (const tx of newTransactions) {
        await this.processTransaction(tx);
      }
      
      // Обновляем время последней проверки
      this.lastCheckTimestamp = Date.now();
    } catch (error) {
      console.error(`[Monitor] Error checking transactions`);
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
      const exists = await this.transactionRepository.exists(txHash);
      if (exists) {
        return false;
      }
      
      // Получаем транзакцию по хешу
      const tx = await this.walletService.getTransactionByHash(txHash);
      if (!tx) {
        console.log(`[Monitor] Transaction with hash ${txHash} not found`);
        return false;
      }
      
      // Обрабатываем транзакцию
      await this.processTransaction(tx);
      return true;
    } catch (error) {
      console.error(`[Monitor] Error checking transaction ${txHash}`);
      return false;
    }
  }
  
  /**
   * Обработка транзакции
   */
  private async processTransaction(tx: WalletTransaction): Promise<void> {
    try {
      // Проверяем, не обрабатывали ли мы уже эту транзакцию успешно
      // Получаем транзакцию из базы данных, если она существует
      const existingTransaction = await this.transactionRepository.findByHash(tx.id);
      
      // Пропускаем только успешно обработанные транзакции
      if (existingTransaction && existingTransaction.status === 'processed') {
        console.log(`[Monitor] Скипуем уже обработанную транзакцию: ${tx.id}`);
        return;
      }
      
      // Для транзакций со статусом 'failed' выполняем повторную обработку только если ошибка исправима
      if (existingTransaction && existingTransaction.status === 'failed') {
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
          console.log(`[Monitor] Скипуем проваленную транзакцию с неисправимой ошибкой: ${tx.id}, ошибка: ${errorMessage}`);
          return;
        }
        
        console.log(`[Monitor] Повторяем проваленную транзакцию с потенциально исправимой ошибкой: ${tx.id}, ошибка: ${errorMessage}`);
      }
      
      if (!tx.comment) {
        console.log(`[Monitor] Скипуем транзакцию без комментария: ${tx.id}, сумма: ${Number(tx.amount) / 1_000_000_000} TON, отправитель: ${tx.fromAddress || 'неизвестен'}`);
        
        // Сохраняем информацию о пропущенной транзакции
        await this.transactionRepository.saveTransaction({
          hash: tx.id,
          amount: Number(tx.amount) / 1_000_000_000, // Преобразуем bigint в number и конвертируем из нано в TON
          timestamp: tx.timestamp,
          senderAddress: tx.fromAddress || '',
          status: "failed",
          statusMsg: "ERR_MISSING_COMMENT: Транзакция не содержит комментарий с именем пользователя"
        });
        return;
      }
      
      const username = this.extractUsernameFromComment(tx.comment);
      if (!username) {
        console.log(`[Monitor] Некорректное или отсутствующее имя пользователя в комментарии: "${tx.comment}" для транзакции: ${tx.id}`);
        
        // Сохраняем информацию о пропущенной транзакции
        await this.transactionRepository.saveTransaction({
          hash: tx.id,
          amount: Number(tx.amount) / 1_000_000_000, // Преобразуем bigint в number и конвертируем из нано в TON
          timestamp: tx.timestamp,
          comment: tx.comment,
          senderAddress: tx.fromAddress || '',
          status: "failed",
          statusMsg: `ERR_INVALID_USERNAME: Некорректное имя пользователя в комментарии: "${tx.comment}"`
        });
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
        console.log(`[Monitor] Stars amount (${starsAmount}) is less than minimum threshold (${TRANSACTION_MONITOR_CONFIG.MIN_STARS}) for transaction: ${tx.id}`);
        
        // Сохраняем информацию о пропущенной транзакции с детальным кодом ошибки
        await this.transactionRepository.saveTransaction({
          hash: tx.id,
          amount: originalAmount,
          timestamp: tx.timestamp,
          comment: tx.comment,
          senderAddress: tx.fromAddress || '',
          status: "failed",
          gasFee,
          amountAfterGas,
          exchangeRate: starsPerTon,
          statusMsg: `ERR_STARS_BELOW_MINIMUM: Количество звезд (${starsAmount}) меньше минимального порога (${TRANSACTION_MONITOR_CONFIG.MIN_STARS})`
        }, username, starsAmount);
        return;
      }
      
      // Проверяем, что количество звезд не превышает максимальный лимит
      if (starsAmount > TRANSACTION_MONITOR_CONFIG.MAX_STARS) {
        console.log(`[Monitor] Stars amount (${starsAmount}) exceeds maximum limit (${TRANSACTION_MONITOR_CONFIG.MAX_STARS}) for transaction: ${tx.id}`);
        
        // Сохраняем информацию о пропущенной транзакции с детальным кодом ошибки
        await this.transactionRepository.saveTransaction({
          hash: tx.id,
          amount: originalAmount,
          timestamp: tx.timestamp,
          comment: tx.comment,
          senderAddress: tx.fromAddress || '',
          status: "failed",
          gasFee,
          amountAfterGas,
          exchangeRate: starsPerTon,
          statusMsg: `ERR_STARS_ABOVE_MAXIMUM: Количество звезд (${starsAmount}) превышает максимальный лимит (${TRANSACTION_MONITOR_CONFIG.MAX_STARS})`
        }, username, starsAmount);
        return;
      }
      
      console.log(`[Monitor] Processing transaction:
  - Hash: ${tx.id}
  - User: @${username}
  - Original amount: ${originalAmount.toFixed(9)} TON
  - Gas fee: ${gasFee.toFixed(9)} TON (${(gasFee/originalAmount*100).toFixed(2)}% of transaction)
  - Amount after gas: ${amountAfterGas.toFixed(9)} TON
  - Stars to purchase: ${starsAmount} (rate: ${starsPerTon.toFixed(2)} stars/TON)`);
      
      // Сохраняем транзакцию в базу данных
      await this.transactionRepository.saveTransaction({
        hash: tx.id,
        amount: originalAmount,
        timestamp: tx.timestamp,
        comment: tx.comment,
        senderAddress: tx.fromAddress || '',
        gasFee,
        amountAfterGas,
        exchangeRate: starsPerTon,
        status: "pending"
      }, username, starsAmount);
      
      // Отправляем звезды через существующий сервис
      try {
        console.log(`[Monitor] Начинаем покупку ${starsAmount} звезд для пользователя @${username}`);
        const result = await this.starsPurchaseService.purchaseStarsAsync(username, starsAmount);
        
        // Обновляем информацию о транзакции в базе данных
        if (result.success) {
          await this.transactionRepository.updateTransactionAfterStarsPurchase(
            tx.id,
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
            tx.id,
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
        
        await this.transactionRepository.updateTransactionAfterStarsPurchase(
          tx.id,
          "",
          false,
          detailedError
        );
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      const errorType = this.categorizeError(errorMessage);
      const errorCode = `ERR_${errorType}`;
      const detailedError = `${errorCode}: ${errorMessage}`;
      console.error(`[Monitor] НЕПРЕДВИДЕННАЯ ОШИБКА при обработке транзакции ${tx.id}: ${detailedError}`);
      
      // Пытаемся сохранить информацию об ошибке в базу данных
      try {
        await this.transactionRepository.saveTransaction({
          hash: tx.id,
          amount: Number(tx.amount) / 1_000_000_000, // Преобразуем bigint в number и конвертируем из нано в TON
          timestamp: tx.timestamp,
          comment: tx.comment || "",
          senderAddress: tx.fromAddress || '',
          status: "failed",
          statusMsg: detailedError
        });
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
   * Получение всех обработанных транзакций
   */
  public async getAllTransactions(page: number = 1, limit: number = 20): Promise<any> {
    return await this.transactionRepository.getRecentTransactions(page, limit);
  }
  
  /**
   * Получение всех ожидающих обработки транзакций
   */
  public async getPendingTransactions(page: number = 1, limit: number = 20): Promise<any> {
    return await this.transactionRepository.getTransactionsByStatus('pending', page, limit);
  }
  
  /**
   * Получение всех обработанных транзакций
   */
  public async getProcessedTransactions(page: number = 1, limit: number = 20): Promise<any> {
    return await this.transactionRepository.getTransactionsByStatus('processed', page, limit);
  }
  
  /**
   * Получение статистики транзакций
   */
  public async getTransactionStats(): Promise<any> {
    return await this.transactionRepository.getTransactionStats();
  }
} 