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
      // Проверяем, не обрабатывали ли мы уже эту транзакцию
      const exists = await this.transactionRepository.exists(tx.id);
      if (exists) {
        return;
      }
      
      // Если нет комментария, игнорируем транзакцию
      if (!tx.comment) {
        await this.transactionRepository.saveTransaction({
          hash: tx.id,
          amount: Number(tx.amount) / 1_000_000_000,
          timestamp: tx.timestamp,
          comment: '',
          senderAddress: tx.fromAddress || ''
        });
        return;
      }
      
      // Извлекаем никнейм из комментария
      const username = this.extractUsernameFromComment(tx.comment);
      
      if (!username) {
        await this.transactionRepository.saveTransaction({
          hash: tx.id,
          amount: Number(tx.amount) / 1_000_000_000,
          timestamp: tx.timestamp,
          comment: tx.comment,
          senderAddress: tx.fromAddress || ''
        });
        return;
      }
      
      console.log(`[Monitor] Extracted username: @${username}`);
      
      // Получаем актуальный курс обмена TON на звезды для этой транзакции
      let starsPerTon = 0;
      try {
        starsPerTon = await this.starsPurchaseService.getStarsExchangeRate();
        console.log(`[Monitor] Current exchange rate: ${starsPerTon.toFixed(2)} stars per TON`);
      } catch (error) {
        console.error(`[Monitor] Failed to get current exchange rate, skipping transaction ${tx.id}`);
        await this.transactionRepository.saveTransaction({
          hash: tx.id,
          amount: Number(tx.amount) / 1_000_000_000,
          timestamp: tx.timestamp,
          comment: tx.comment,
          senderAddress: tx.fromAddress || ''
        }, username);
        return;
      }
      
      // Конвертируем сумму из наноТОН в TON
      const tonAmount = Number(tx.amount) / 1_000_000_000;
      
      // Вычисляем количество звезд на основе актуального курса и полученной суммы
      const starsAmount = Math.floor(tonAmount * starsPerTon);
      
      if (starsAmount <= 0) {
        console.log(`[Monitor] Calculated stars amount ${starsAmount} <= 0, ignoring`);
        await this.transactionRepository.saveTransaction({
          hash: tx.id,
          amount: tonAmount,
          timestamp: tx.timestamp,
          comment: tx.comment,
          senderAddress: tx.fromAddress || ''
        }, username);
        return;
      }
      
      console.log(`[Monitor] Sending ${starsAmount} stars to user @${username} (received ${tonAmount} TON, rate: ${starsPerTon})`);
      
      // Сохраняем транзакцию в базу данных
      await this.transactionRepository.saveTransaction({
        hash: tx.id,
        amount: tonAmount,
        timestamp: tx.timestamp,
        comment: tx.comment,
        senderAddress: tx.fromAddress || ''
      }, username, starsAmount);
      
      // Отправляем звезды через существующий сервис
      try {
        const result = await this.starsPurchaseService.purchaseStarsAsync(username, starsAmount);
        
        // Обновляем информацию о транзакции в базе данных
        if (result.success) {
          await this.transactionRepository.updateTransactionAfterStarsPurchase(
            tx.id,
            result.transactionHash || "",
            true
          );
          console.log(`[Monitor] Successfully sent ${starsAmount} stars to user @${username}, transaction hash: ${result.transactionHash}`);
        } else {
          await this.transactionRepository.updateTransactionAfterStarsPurchase(
            tx.id,
            result.transactionHash || "",
            false,
            result.error || "Unknown error"
          );
          console.error(`[Monitor] Error sending stars: ${result.error}`);
        }
      } catch (error) {
        const errorMessage = (error as Error).message;
        await this.transactionRepository.updateTransactionAfterStarsPurchase(
          tx.id,
          "",
          false,
          errorMessage
        );
        console.error(`[Monitor] Exception sending stars`);
      }
    } catch (error) {
      console.error(`[Monitor] Error processing transaction ${tx.id}`);
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