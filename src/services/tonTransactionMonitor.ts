import { TonWalletService } from '../wallet/TonWalletService';
import { FragmentStarsPurchaseService } from './fragmentStarsPurchaseService';
import { TransactionType, WalletTransaction } from '../wallet/models/walletModels';
import { TRANSACTION_MONITOR_CONFIG } from '../config';
import { Api } from '../apiClient/Api';
import { CreateTransactionDto, TransactionDto, TransactionStatus, UpdateStarsDto } from '../apiClient/data-contracts';

/**
 * Сервис для мониторинга транзакций TON и автоматической покупки звезд
 */
export class TonTransactionMonitor {
  private walletService: TonWalletService;
  private starsPurchaseService: FragmentStarsPurchaseService;
  private apiClient: Api;
  
  private isRunning: boolean = false;
  private lastCheckTimestamp: number = 0;
  private interval: NodeJS.Timeout | null = null;
  
  /**
   * Constructor
   */
  constructor(
    walletService: TonWalletService,
    starsPurchaseService: FragmentStarsPurchaseService,
    apiClient: Api
  ) {
    this.walletService = walletService;
    this.starsPurchaseService = starsPurchaseService;
    this.apiClient = apiClient;
    
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
   */
  public async checkTransactionByHash(txHash: string): Promise<boolean> {
    try {
      console.log(`[Monitor] Checking transaction by hash: ${txHash}`);
      
      // Проверяем статус транзакции через API
      const { data: txStatus } = await this.apiClient.transactionsDetail(txHash);
      
      // Если транзакция уже существует и успешно обработана, пропускаем её
      if (txStatus.status === TransactionStatus.Value2) { // processed
        console.log(`[Monitor] Транзакция ${txHash} уже обработана успешно, повторная обработка не требуется`);
        return false;
      }
      
      // Если транзакция уже существует и в процессе обработки, пропускаем её
      if (txStatus.status === TransactionStatus.Value1) { // processing
        console.log(`[Monitor] Транзакция ${txHash} уже обрабатывается другим процессом`);
        return false;
      }
      
      // Получаем транзакцию по хешу
      const tx = await this.walletService.getTransactionByHash(txHash);
      if (!tx) {
        console.log(`[Monitor] Transaction with hash ${txHash} not found`);
        
        // Если транзакция существует в API, но не найдена в блокчейне,
        // отмечаем её как failed через API
        if (txStatus) {
          const updateData: UpdateStarsDto = {
            starCount: 0,
            starPrice: 0
          };
          await this.apiClient.transactionsStarsUpdate(txHash, updateData);
        }
        
        return false;
      }
      
      // Обрабатываем транзакцию
      await this.processTransaction(tx);
      return true;
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(`[Monitor] Error checking transaction ${txHash}: ${errorMessage}`);
      
      // Если произошла ошибка, обновляем статус через API
      try {
        const updateData: UpdateStarsDto = {
          starCount: 0,
          starPrice: 0
        };
        await this.apiClient.transactionsStarsUpdate(txHash, updateData);
      } catch (updateError) {
        console.error(`[Monitor] Failed to update transaction ${txHash} status: ${(updateError as Error).message}`);
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
      // Проверяем статус транзакции через API
      const { data: txStatus } = await this.apiClient.transactionsDetail(hash);
      
      // Проверка статусов существующей транзакции
      if (txStatus) {
        // Если транзакция уже обработана - пропускаем
        if (txStatus.status === TransactionStatus.Value2) { // processed
          console.log(`[Monitor] Скипуем уже обработанную транзакцию: ${hash}`);
          return;
        }
        
        // Проверяем зависшие транзакции в статусе processing
        if (txStatus.status === TransactionStatus.Value1) { // processing
          // Проверяем время последнего обновления транзакции
          const now = new Date();
          const updatedAt = new Date(txStatus.updatedAt || '');
          const timeInProcessing = now.getTime() - updatedAt.getTime();
          
          // Логируем подробности для диагностики
          console.log(`[Monitor] Транзакция ${hash} в статусе processing ${(timeInProcessing / (60 * 1000)).toFixed(1)} минут. Таймаут: ${(TRANSACTION_MONITOR_CONFIG.PROCESSING_TIMEOUT_MS / (60 * 1000)).toFixed(1)} минут`);
          
          // Если транзакция "зависла" в processing дольше заданного времени
          if (timeInProcessing >= TRANSACTION_MONITOR_CONFIG.PROCESSING_TIMEOUT_MS) {
            console.log(`[Monitor] Транзакция ${hash} зависла в состоянии processing на ${(timeInProcessing / (60 * 1000)).toFixed(1)} минут, пробуем обработать повторно`);
            
            // Обновляем статус транзакции через API
            const updateData: UpdateStarsDto = {
              starCount: 0,
              starPrice: 0
            };
            await this.apiClient.transactionsStarsUpdate(hash, updateData);
            
            console.log(`[Monitor] Транзакция ${hash} успешно разблокирована, продолжаем обработку`);
          } else {
            // Если время обработки не превысило таймаут, пропускаем транзакцию
            return;
          }
        }
      }
      
      // Создаем или обновляем транзакцию через API
      const createData: CreateTransactionDto = {
        hash,
        amount: Number(tx.amount) / 1_000_000_000, // Convert from nanoTON to TON
        sender: tx.fromAddress || '',
        receiver: tx.toAddress || '',
        starCount: 0,
        starPrice: 0
      };
      
      await this.apiClient.transactionsCreate(createData);
      
      // Извлекаем имя пользователя из комментария
      const username = this.extractUsernameFromComment(tx.comment || '');
      if (!username) {
        throw new Error('ERR_NO_USERNAME: Не указано имя пользователя в комментарии к транзакции');
      }
      
      // Покупаем звезды через Fragment
      const purchaseResult = await this.starsPurchaseService.purchaseStarsAsync(username, Number(tx.amount));
      
      // Обновляем статус транзакции после успешной покупки
      const updateData: UpdateStarsDto = {
        starCount: purchaseResult.starsAmount || 0,
        starPrice: Number(tx.amount) / (purchaseResult.starsAmount || 1) // Calculate price per star
      };
      await this.apiClient.transactionsStarsUpdate(hash, updateData);
      
      console.log(`[Monitor] Successfully processed transaction ${hash}`);
      
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(`[Monitor] Error processing transaction ${hash}: ${errorMessage}`);
      
      // Обновляем статус транзакции с ошибкой через API
      try {
        const updateData: UpdateStarsDto = {
          starCount: 0,
          starPrice: 0
        };
        await this.apiClient.transactionsStarsUpdate(hash, updateData);
      } catch (updateError) {
        console.error(`[Monitor] Failed to update transaction ${hash} status: ${(updateError as Error).message}`);
      }
    }
  }
  
  /**
   * Извлечение имени пользователя из комментария к транзакции
   */
  private extractUsernameFromComment(comment: string): string | null {
    if (!comment) return null;
    
    // Убираем пробелы в начале и конце
    const trimmedComment = comment.trim();
    
    // Если комментарий пустой после удаления пробелов
    if (!trimmedComment) return null;
    
    // Возвращаем комментарий как имя пользователя
    return trimmedComment;
  }
  
  /**
   * Диагностика застрявших транзакций
   */
  public async diagnoseStuckTransactions(): Promise<{
    stuck: number;
    transactions?: Array<{
      hash: string;
      timeInProcessing: string;
      isTimedOut: boolean;
      updatedAt: string;
      status: string;
    }>;
    message?: string;
    error?: string;
  }> {
    try {
      // Получаем все транзакции через API
      const { data: transactions } = await this.apiClient.transactionsList({ page: 1, pageSize: 100 });
      
      // Фильтруем только транзакции в статусе processing
      const processingTransactions = transactions.filter(tx => tx.status === TransactionStatus.Value1);
      
      const stuckTransactions = processingTransactions.map(tx => {
        const now = new Date();
        const updatedAt = new Date(tx.updatedAt || '');
        const timeInProcessing = now.getTime() - updatedAt.getTime();
        const isTimedOut = timeInProcessing >= TRANSACTION_MONITOR_CONFIG.PROCESSING_TIMEOUT_MS;
        
        return {
          hash: tx.hash || '',
          timeInProcessing: `${(timeInProcessing / (60 * 1000)).toFixed(1)} minutes`,
          isTimedOut,
          updatedAt: tx.updatedAt || '',
          status: TransactionStatus[tx.status || 0]
        };
      }).filter(tx => tx.isTimedOut);
      
      return {
        stuck: stuckTransactions.length,
        transactions: stuckTransactions,
        message: stuckTransactions.length > 0 ? 
          `Found ${stuckTransactions.length} stuck transactions` : 
          'No stuck transactions found'
      };
    } catch (error) {
      return {
        stuck: 0,
        error: `Error during diagnosis: ${(error as Error).message}`
      };
    }
  }
} 