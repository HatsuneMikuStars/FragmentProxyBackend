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
   * Конструктор
   */
  constructor(
    walletService: TonWalletService,
    starsPurchaseService: FragmentStarsPurchaseService,
    transactionRepository: TransactionRepository
  ) {
    this.walletService = walletService;
    this.starsPurchaseService = starsPurchaseService;
    this.transactionRepository = transactionRepository;
    
    console.log('[TonTransactionMonitor] Инициализирован');
  }
  
  /**
   * Запуск мониторинга транзакций
   */
  public start(): void {
    if (this.isRunning) {
      console.log('[TonTransactionMonitor] Мониторинг уже запущен');
      return;
    }
    
    this.isRunning = true;
    console.log('[TonTransactionMonitor] Мониторинг запущен');
    
    // Запускаем начальную проверку немедленно
    this.checkNewTransactions();
    
    // Запускаем периодическую проверку
    this.interval = setInterval(
      () => this.checkNewTransactions(), 
      TRANSACTION_MONITOR_CONFIG.CHECK_INTERVAL_MS
    );
  }
  
  /**
   * Остановка мониторинга
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log('[TonTransactionMonitor] Мониторинг уже остановлен');
      return;
    }
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    this.isRunning = false;
    console.log('[TonTransactionMonitor] Мониторинг остановлен');
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
        console.log(`[TonTransactionMonitor] Найдено ${newTransactions.length} транзакций`);
      }
      
      // Обрабатываем каждую новую транзакцию
      for (const tx of newTransactions) {
        await this.processTransaction(tx);
      }
      
      // Обновляем время последней проверки
      this.lastCheckTimestamp = Date.now();
    } catch (error) {
      console.error(`[TonTransactionMonitor] Ошибка при проверке транзакций`);
    }
  }
  
  /**
   * Проверка новых транзакций для заданного хеша транзакции
   * Этот метод можно вызывать публично для принудительной проверки конкретной транзакции
   */
  public async checkTransactionByHash(txHash: string): Promise<boolean> {
    try {
      console.log(`[TonTransactionMonitor] Проверка транзакции по хешу: ${txHash}`);
      
      // Проверяем, не обрабатывали ли мы уже эту транзакцию
      const exists = await this.transactionRepository.exists(txHash);
      if (exists) {
        return false;
      }
      
      // Получаем транзакцию по хешу
      const tx = await this.walletService.getTransactionByHash(txHash);
      if (!tx) {
        console.log(`[TonTransactionMonitor] Транзакция с хешем ${txHash} не найдена`);
        return false;
      }
      
      // Обрабатываем транзакцию
      await this.processTransaction(tx);
      return true;
    } catch (error) {
      console.error(`[TonTransactionMonitor] Ошибка при проверке транзакции ${txHash}`);
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
      
      console.log(`[TonTransactionMonitor] Извлечен никнейм: @${username}`);
      
      // Если сумма меньше минимальной, игнорируем
      const amount = Number(tx.amount) / 1_000_000_000;
      if (amount < TRANSACTION_MONITOR_CONFIG.MIN_AMOUNT) {
        console.log(`[TonTransactionMonitor] Сумма ${amount} TON меньше минимальной ${TRANSACTION_MONITOR_CONFIG.MIN_AMOUNT} TON, игнорируем`);
        await this.transactionRepository.saveTransaction({
          hash: tx.id,
          amount: amount,
          timestamp: tx.timestamp,
          comment: tx.comment,
          senderAddress: tx.fromAddress || ''
        }, username);
        return;
      }
      
      // Вычисляем количество звезд на основе полученной суммы
      const starsAmount = Math.floor(amount * TRANSACTION_MONITOR_CONFIG.STARS_PER_TON);
      
      if (starsAmount <= 0) {
        console.log(`[TonTransactionMonitor] Рассчитанное количество звезд ${starsAmount} <= 0, игнорируем`);
        await this.transactionRepository.saveTransaction({
          hash: tx.id,
          amount: amount,
          timestamp: tx.timestamp,
          comment: tx.comment,
          senderAddress: tx.fromAddress || ''
        }, username);
        return;
      }
      
      console.log(`[TonTransactionMonitor] Отправка ${starsAmount} звезд пользователю @${username} (получено ${amount} TON)`);
      
      // Сохраняем транзакцию в базу данных
      await this.transactionRepository.saveTransaction({
        hash: tx.id,
        amount: amount,
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
          console.log(`[TonTransactionMonitor] Успешно отправлено ${starsAmount} звезд пользователю @${username}, хеш транзакции: ${result.transactionHash}`);
        } else {
          await this.transactionRepository.updateTransactionAfterStarsPurchase(
            tx.id,
            result.transactionHash || "",
            false,
            result.error || "Неизвестная ошибка"
          );
          console.error(`[TonTransactionMonitor] Ошибка при отправке звезд: ${result.error}`);
        }
      } catch (error) {
        const errorMessage = (error as Error).message;
        await this.transactionRepository.updateTransactionAfterStarsPurchase(
          tx.id,
          "",
          false,
          errorMessage
        );
        console.error(`[TonTransactionMonitor] Исключение при отправке звезд`);
      }
    } catch (error) {
      console.error(`[TonTransactionMonitor] Ошибка при обработке транзакции ${tx.id}`);
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