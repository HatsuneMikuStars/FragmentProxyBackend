import { TonWalletService } from '../wallet/TonWalletService';
import { FragmentStarsPurchaseService } from './fragmentStarsPurchaseService';
import { TonApiClient, TonTransaction } from '../apiClient/tonApi';
import { TransactionRepository } from '../database/repositories/transaction.repository';
import fs from 'fs';
import path from 'path';
import { TRANSACTION_MONITOR_CONFIG } from '../config';

/**
 * Сервис для мониторинга транзакций TON и автоматической покупки звезд
 */
export class TonTransactionMonitor {
  private walletService: TonWalletService;
  private starsPurchaseService: FragmentStarsPurchaseService;
  private tonApiClient: TonApiClient;
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
    tonApiClient: TonApiClient,
    transactionRepository: TransactionRepository
  ) {
    this.walletService = walletService;
    this.starsPurchaseService = starsPurchaseService;
    this.tonApiClient = tonApiClient;
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
      console.log('[TonTransactionMonitor] Проверка новых транзакций...');
      
      // Получаем адрес кошелька
      const walletAddress = await this.walletService.getWalletAddress();
      
      // Получаем новые транзакции через TON API клиент
      const newTransactions = await this.tonApiClient.getTransactions(walletAddress, 20);
      
      if (newTransactions.length > 0) {
        console.log(`[TonTransactionMonitor] Найдено ${newTransactions.length} транзакций`);
      } else {
        console.log('[TonTransactionMonitor] Новых транзакций не найдено');
      }
      
      // Обрабатываем каждую новую транзакцию
      for (const tx of newTransactions) {
        await this.processTransaction(tx);
      }
      
      // Обновляем время последней проверки
      this.lastCheckTimestamp = Date.now();
    } catch (error) {
      console.error(`[TonTransactionMonitor] Ошибка при проверке транзакций:`, error);
    }
  }
  
  /**
   * Обработка транзакции
   */
  private async processTransaction(tx: TonTransaction): Promise<void> {
    try {
      // Проверяем, не обрабатывали ли мы уже эту транзакцию
      const exists = await this.transactionRepository.exists(tx.hash);
      if (exists) {
        console.log(`[TonTransactionMonitor] Транзакция ${tx.hash} уже обработана, пропускаем`);
        return;
      }
      
      console.log(`[TonTransactionMonitor] Обработка транзакции: ${tx.hash}`);
      console.log(`[TonTransactionMonitor] Детали транзакции:
        Hash: ${tx.hash}
        Amount: ${tx.amount} TON
        Timestamp: ${new Date(tx.timestamp).toISOString()}
        Sender: ${tx.senderAddress || '<не указан>'}
        Comment: "${tx.comment || '<отсутствует>'}"
      `);
      
      // Если нет комментария, игнорируем транзакцию
      if (!tx.comment) {
        console.log(`[TonTransactionMonitor] Транзакция ${tx.hash} без комментария, игнорируем`);
        console.log(`[TonTransactionMonitor] Сохраняем транзакцию в БД без username и starsAmount`);
        await this.transactionRepository.saveTransaction(tx);
        return;
      }
      
      // Извлекаем никнейм из комментария
      console.log(`[TonTransactionMonitor] Пытаемся извлечь никнейм из комментария: "${tx.comment}"`);
      const username = this.extractUsernameFromComment(tx.comment);
      
      if (!username) {
        console.log(`[TonTransactionMonitor] Не удалось извлечь никнейм из комментария: "${tx.comment}"`);
        console.log(`[TonTransactionMonitor] Сохраняем транзакцию в БД без username и starsAmount`);
        await this.transactionRepository.saveTransaction(tx);
        return;
      }
      
      console.log(`[TonTransactionMonitor] Успешно извлечен никнейм: @${username}`);
      
      // Если сумма меньше минимальной, игнорируем
      if (tx.amount < TRANSACTION_MONITOR_CONFIG.MIN_AMOUNT) {
        console.log(`[TonTransactionMonitor] Сумма ${tx.amount} TON меньше минимальной ${TRANSACTION_MONITOR_CONFIG.MIN_AMOUNT} TON, игнорируем`);
        console.log(`[TonTransactionMonitor] Сохраняем транзакцию в БД с username, но без starsAmount`);
        await this.transactionRepository.saveTransaction(tx, username);
        return;
      }
      
      // Вычисляем количество звезд на основе полученной суммы
      const starsAmount = Math.floor(tx.amount * TRANSACTION_MONITOR_CONFIG.STARS_PER_TON);
      console.log(`[TonTransactionMonitor] Расчет количества звезд: ${tx.amount} TON * ${TRANSACTION_MONITOR_CONFIG.STARS_PER_TON} = ${starsAmount} звезд`);
      
      if (starsAmount <= 0) {
        console.log(`[TonTransactionMonitor] Рассчитанное количество звезд ${starsAmount} <= 0, игнорируем`);
        console.log(`[TonTransactionMonitor] Сохраняем транзакцию в БД с username, но без starsAmount`);
        await this.transactionRepository.saveTransaction(tx, username);
        return;
      }
      
      console.log(`[TonTransactionMonitor] Отправка ${starsAmount} звезд пользователю @${username} (получено ${tx.amount} TON)`);
      
      // Сохраняем транзакцию в базу данных
      console.log(`[TonTransactionMonitor] Сохраняем транзакцию в БД с username и starsAmount перед отправкой звезд`);
      await this.transactionRepository.saveTransaction(tx, username, starsAmount);
      
      // Отправляем звезды через существующий сервис
      try {
        console.log(`[TonTransactionMonitor] Вызываем метод purchaseStarsAsync для username=${username}, starsAmount=${starsAmount}`);
        const result = await this.starsPurchaseService.purchaseStarsAsync(username, starsAmount);
        console.log(`[TonTransactionMonitor] Результат отправки звезд:`, result);
        
        // Обновляем информацию о транзакции в базе данных
        if (result.success) {
          await this.transactionRepository.updateTransactionAfterStarsPurchase(
            tx.hash,
            result.transactionHash || "",
            true
          );
          console.log(`[TonTransactionMonitor] Успешно отправлено ${starsAmount} звезд пользователю @${username}, хеш транзакции: ${result.transactionHash}`);
        } else {
          await this.transactionRepository.updateTransactionAfterStarsPurchase(
            tx.hash,
            result.transactionHash || "",
            false,
            result.error || "Неизвестная ошибка"
          );
          console.error(`[TonTransactionMonitor] Ошибка при отправке звезд: ${result.error}`);
        }
      } catch (error) {
        const errorMessage = (error as Error).message;
        await this.transactionRepository.updateTransactionAfterStarsPurchase(
          tx.hash,
          "",
          false,
          errorMessage
        );
        console.error(`[TonTransactionMonitor] Исключение при отправке звезд:`, error);
      }
    } catch (error) {
      console.error(`[TonTransactionMonitor] Ошибка при обработке транзакции ${tx.hash}:`, error);
      // Не будем пытаться сохранять транзакцию в случае ошибки обработки
    }
  }
  
  /**
   * Извлечение никнейма из комментария транзакции
   */
  private extractUsernameFromComment(comment: string): string | null {
    console.log(`[TonTransactionMonitor] Извлечение никнейма из комментария: "${comment}"`);
    
    // Удаляем лишние пробелы
    comment = comment.trim();
    console.log(`[TonTransactionMonitor] После удаления пробелов: "${comment}"`);
    
    // Проверяем, начинается ли комментарий с @
    if (comment.startsWith('@')) {
      // Убираем @ в начале
      const username = comment.substring(1);
      console.log(`[TonTransactionMonitor] Найден комментарий с @, извлечённый username: "${username}"`);
      
      // Проверяем, что никнейм соответствует правилам Telegram (5-32 символа, буквы, цифры и подчеркивания)
      const usernameRegex = /^[a-zA-Z0-9_]{5,32}$/;
      if (usernameRegex.test(username)) {
        console.log(`[TonTransactionMonitor] Username "${username}" соответствует правилам Telegram`);
        return username;
      } else {
        console.log(`[TonTransactionMonitor] Username "${username}" НЕ соответствует правилам Telegram (должен быть 5-32 символа, буквы, цифры, подчеркивания)`);
      }
    } else {
      // Проверяем, может быть никнейм указан без @
      const usernameRegex = /^[a-zA-Z0-9_]{5,32}$/;
      if (usernameRegex.test(comment)) {
        console.log(`[TonTransactionMonitor] Найден username без @: "${comment}"`);
        return comment;
      } else {
        console.log(`[TonTransactionMonitor] Комментарий "${comment}" не соответствует формату username Telegram`);
      }
    }
    
    console.log(`[TonTransactionMonitor] Не удалось извлечь никнейм из комментария`);
    return null;
  }
} 