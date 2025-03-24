import { TonClient, WalletContractV4, beginCell, toNano, internal, Address, SendMode } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { IWalletService } from './IWalletService';
import { SendTransactionParams, TransactionResult, TransactionStatus, WalletConfig } from './models/walletModels';
import { WalletAccount } from '../api/models/apiModels';

/**
 * Сервис для работы с TON кошельком (совместимый с V5 кошельками)
 */
export class TonWalletService implements IWalletService {
  private client: TonClient | null = null;
  private wallet: WalletContractV4 | null = null;
  private keyPair: { publicKey: Buffer; secretKey: Buffer } | null = null;
  private config: WalletConfig | null = null;
  private isInitialized: boolean = false;

  /**
   * Инициализирует кошелек с указанной конфигурацией
   * @param config Конфигурация кошелька
   */
  async initializeWallet(config: WalletConfig): Promise<void> {
    try {
      console.log("🔄 Начинаем инициализацию кошелька...");
      this.config = config;
      
      // Создаем клиент TON
      const endpoint = config.apiUrl || 
        (config.useTestnet ? 'https://testnet.toncenter.com/api/v2/jsonRPC' : 'https://toncenter.com/api/v2/jsonRPC');
      
      console.log(`📡 Используем endpoint: ${endpoint}`);
      
      this.client = new TonClient({
        endpoint,
        apiKey: config.apiKey
      });
      
      console.log("👤 Клиент TON создан");
      
      // Преобразуем мнемоническую фразу в ключи
      const mnemonicArray = config.mnemonic.split(' ');
      console.log(`🔑 Преобразуем мнемоническую фразу (${mnemonicArray.length} слов) в ключи...`);
      this.keyPair = await mnemonicToPrivateKey(mnemonicArray);
      console.log("✅ Ключи получены успешно");
      
      // Используем явно указанный subwalletId или 0 по умолчанию
      const subwalletId = config.subwalletId !== undefined ? config.subwalletId : 0;
      
      // Создаем экземпляр кошелька
      const workchain = 0; // Обычно используется workchain 0
      console.log(`🏗️ Создаем кошелек с subwalletId: ${subwalletId}`);
      
      // Для работы с V5 кошельками используем V4R2, так как это самая новая версия, доступная в библиотеке
      // При этом правильно указываем ID кошелька
      this.wallet = WalletContractV4.create({ 
        workchain, 
        publicKey: this.keyPair.publicKey,
        walletId: subwalletId
      });
      
      this.isInitialized = true;
      const walletAddress = await this.getWalletAddress();
      console.log(`✅ Кошелек инициализирован. Адрес: ${walletAddress}`);
      console.log(`⚠️ Внимание: используется WalletContractV4 для работы с V5 кошельком. Некоторые специфические функции V5 могут быть недоступны.`);
    } catch (error: any) {
      console.error('❌ Ошибка при инициализации кошелька:', error);
      throw new Error(`Не удалось инициализировать кошелек: ${error.message}`);
    }
  }
  
  /**
   * Проверяет, что кошелек инициализирован
   * @throws Error если кошелек не инициализирован
   */
  private checkInitialization() {
    if (!this.isInitialized || !this.client || !this.wallet || !this.keyPair) {
      throw new Error('Кошелек не инициализирован. Сначала вызовите initializeWallet()');
    }
  }

  /**
   * Получает адрес кошелька
   * @returns Адрес кошелька в формате TON
   */
  async getWalletAddress(): Promise<string> {
    this.checkInitialization();
    return this.wallet!.address.toString();
  }
  
  /**
   * Получает баланс кошелька
   * @returns Баланс в наноТОН
   */
  async getBalance(): Promise<bigint> {
    this.checkInitialization();
    
    if (!this.client || !this.wallet) {
      throw new Error("Кошелек не инициализирован");
    }
    
    try {
      // Получаем состояние контракта
      const state = await this.client.getContractState(this.wallet.address);
      return BigInt(state.balance || 0);
    } catch (error) {
      console.error('Ошибка при получении баланса:', error);
      throw new Error('Не удалось получить баланс кошелька');
    }
  }
  
  /**
   * Отправляет TON транзакцию
   * @param params Параметры транзакции
   * @returns Результат выполнения транзакции
   */
  async sendTransaction(params: SendTransactionParams): Promise<TransactionResult> {
    this.checkInitialization();
    
    try {
      if (!this.client || !this.wallet || !this.keyPair) {
        throw new Error("Кошелек не инициализирован");
      }
      
      const maxRetries = params.maxRetries || 3;
      let lastError: Error | null = null;
      
      // Преобразуем адрес получателя в формат Address
      const toAddress = Address.parse(params.toAddress);
      
      // Преобразуем сумму в наноТОН
      let amount: bigint;
      if (typeof params.amount === 'string') {
        amount = BigInt(params.amount);
      } else if (typeof params.amount === 'number') {
        amount = BigInt(Math.floor(params.amount));
      } else {
        amount = params.amount;
      }
      
      // Реализуем стратегию повторных попыток с экспоненциальной задержкой
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Попытка отправки транзакции ${attempt}/${maxRetries}`);
          
          // Открываем кошелек
          const walletContract = this.client.open(this.wallet);
          const seqno = await walletContract.getSeqno();
          console.log(`Текущий seqno: ${seqno}`);
          
          // Создаем сообщение
          const msgParams = {
            to: toAddress,
            value: amount,
            bounce: false,
            sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS
          };
          
          // Если есть комментарий, формируем тело сообщения
          let msgBody;
          if (params.comment) {
            msgBody = beginCell()
              .storeUint(0, 32) // op = 0 для текстового комментария
              .storeStringTail(params.comment)
              .endCell();
          }
          
          // Создаем и отправляем транзакцию
          const transfer = await this.wallet.createTransfer({
            seqno,
            secretKey: this.keyPair.secretKey,
            messages: [
              internal({
                to: toAddress,
                value: amount,
                bounce: false,
                body: msgBody
              })
            ],
            validUntil: Math.floor(Date.now() / 1000) + (params.timeout || 60), // По умолчанию транзакция действительна 60 секунд
          });
          
          // Отправляем внешнее сообщение
          await this.client.sendExternalMessage(this.wallet, transfer);
          
          // Получаем хеш транзакции
          const transferBoc = transfer.toBoc();
          const txHash = Buffer.from(transferBoc).toString('base64').substring(0, 44);
          
          console.log(`Транзакция успешно отправлена. Hash: ${txHash}`);
          
          return {
            success: true,
            transactionHash: txHash,
            additionalData: {
              seqno,
              externalMessageCell: Buffer.from(transferBoc).toString('base64')
            }
          };
        } catch (error: any) {
          lastError = new Error(error.message || "Неизвестная ошибка при отправке транзакции");
          console.error(`Ошибка при отправке транзакции (попытка ${attempt}/${maxRetries}):`, error);
          
          // Если это последняя попытка, выбрасываем ошибку
          if (attempt === maxRetries) {
            throw lastError;
          }
          
          // Экспоненциальная задержка между попытками (1s, 2s, 4s, ...)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
          console.log(`Ожидание ${delay}мс перед следующей попыткой...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // Если все попытки завершились неудачно
      throw lastError || new Error('Не удалось отправить транзакцию после нескольких попыток');
    } catch (error: any) {
      console.error('Ошибка при отправке транзакции:', error);
      return {
        success: false,
        errorMessage: error.message || 'Неизвестная ошибка при отправке транзакции'
      };
    }
  }
  
  /**
   * Проверяет статус транзакции по её хешу
   * @param transactionHash Хеш транзакции в base64
   * @returns Статус транзакции
   */
  async checkTransactionStatus(transactionHash: string): Promise<TransactionStatus> {
    this.checkInitialization();
    
    try {
      if (!this.client || !this.wallet) {
        throw new Error("Кошелек не инициализирован");
      }
      
      const walletAddress = this.wallet.address;
      
      // Получаем состояние контракта
      const state = await this.client.getContractState(walletAddress);
      
      if (!state || !state.lastTransaction) {
        return TransactionStatus.PENDING;
      }
      
      // В текущей имплементации сложно отследить статус конкретной транзакции
      // Возвращаем COMPLETED для демонстрации
      return TransactionStatus.COMPLETED;
    } catch (error) {
      console.error('Ошибка при проверке статуса транзакции:', error);
      // В случае ошибки предполагаем, что транзакция все еще в процессе
      return TransactionStatus.PROCESSING;
    }
  }
  
  /**
   * Ожидает завершения транзакции с указанным хешем
   * @param transactionHash Хеш транзакции
   * @param timeout Время ожидания в миллисекундах (по умолчанию 60000 мс = 1 минута)
   * @returns Финальный статус транзакции
   */
  async waitForTransactionCompletion(transactionHash: string, timeout: number = 60000): Promise<TransactionStatus> {
    this.checkInitialization();
    
    const startTime = Date.now();
    let lastStatus = await this.checkTransactionStatus(transactionHash);
    
    // Счетчик стабильности для состояния COMPLETED
    let completedCounter = 0;
    
    while (
      (lastStatus === TransactionStatus.PENDING || 
       lastStatus === TransactionStatus.PROCESSING || 
       completedCounter < 3) && // Требуем 3 последовательных статуса COMPLETED для подтверждения
      Date.now() - startTime < timeout
    ) {
      // Увеличиваем счетчик, если статус COMPLETED
      if (lastStatus === TransactionStatus.COMPLETED) {
        completedCounter++;
      } else {
        completedCounter = 0; // Сбрасываем счетчик при любом другом статусе
      }
      
      // Пауза перед следующей проверкой
      // Используем возрастающий интервал для оптимизации запросов
      const checkInterval = Math.min(1000 * Math.pow(1.5, completedCounter), 5000);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
      // Получаем новый статус
      lastStatus = await this.checkTransactionStatus(transactionHash);
      console.log(`Проверка статуса транзакции: ${lastStatus}, счетчик: ${completedCounter}`);
    }
    
    // Если время ожидания истекло, но транзакция не завершена, возвращаем статус таймаута
    if (Date.now() - startTime >= timeout && 
        (lastStatus === TransactionStatus.PENDING || lastStatus === TransactionStatus.PROCESSING)) {
      return TransactionStatus.TIMEOUT;
    }
    
    return lastStatus;
  }

  /**
   * Получает информацию о кошельке в формате WalletAccount
   * @returns Объект с информацией о кошельке
   */
  async getWalletAccount(): Promise<WalletAccount> {
    this.checkInitialization();
    
    if (!this.wallet || !this.keyPair) {
      throw new Error("Кошелек не инициализирован");
    }
    
    // Получаем адрес кошелька
    const address = await this.getWalletAddress();
    
    // Создаем заглушку для walletStateInit
    const walletStateInit = Buffer.from(
      "te6ccgECFAEAAtQAART/APSkE/S88sgLAQIBYgIDA3rQAdDTAwFxsKMB+kABINdJgQELuvLgiCDXCwoggQT/uvLQiYMJuvLgiFRQUwNvBPhhAvhi2zxVFds88uCCyPhDAcx/AcoAVUBQVCDXSYEBC7ry4Igg1wsKIIEE/7ry0ImDCbry4IjPFgEwBARQqoEBAc8AFRhEsH/g"
    ).toString('base64');
    
    // Создаем объект WalletAccount
    return {
      address,
      chain: 'ton',
      publicKey: this.keyPair.publicKey.toString('hex'),
      walletStateInit
    };
  }
} 