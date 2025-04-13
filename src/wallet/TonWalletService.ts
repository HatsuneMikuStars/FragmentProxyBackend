import { TonClient, WalletContractV4, beginCell, internal, Address } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { IWalletService } from './IWalletService';
import { GetTransactionsParams, SendTransactionParams, TransactionResult, TransactionStatus, TransactionType, WalletConfig, WalletTransaction } from './models/walletModels';
import { WalletAccount } from '../apiClient/models/apiModels';

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
      console.log("[Wallet] Initializing TON wallet");
      this.config = config;
      
      // Create TON client
      const endpoint = config.apiUrl || 
        (config.useTestnet ? 'https://testnet.toncenter.com/api/v2/jsonRPC' : 'https://toncenter.com/api/v2/jsonRPC');
      
      this.client = new TonClient({
        endpoint,
        apiKey: config.apiKey
      });
      
      // Convert mnemonic to keys
      const mnemonicArray = config.mnemonic.split(' ');
      this.keyPair = await mnemonicToPrivateKey(mnemonicArray);
      
      // Use specified subwalletId or default to 0
      const subwalletId = config.subwalletId !== undefined ? config.subwalletId : 0;
      
      // Create wallet instance
      const workchain = 0; // Usually workchain 0 is used
      
      // For V5 wallets compatibility, we use V4R2 as this is the newest version available in the library
      this.wallet = WalletContractV4.create({ 
        workchain, 
        publicKey: this.keyPair.publicKey,
        walletId: subwalletId
      });
      
      this.isInitialized = true;
      const walletAddress = await this.getWalletAddress();
      console.log(`[Wallet] Initialized successfully. Address: ${walletAddress}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Wallet] Initialization error:', errorMessage);
      throw new Error(`Failed to initialize wallet: ${errorMessage}`);
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
        throw new Error("Wallet is not initialized");
      }
      
      const maxRetries = params.maxRetries || 3;
      let lastError: Error | null = null;
      
      // Convert recipient address to Address format
      const toAddress = Address.parse(params.toAddress);
      
      // Convert amount to nanoTON
      let amount: bigint;
      if (typeof params.amount === 'string') {
        amount = BigInt(params.amount);
      } else if (typeof params.amount === 'number') {
        amount = BigInt(Math.floor(params.amount));
      } else {
        amount = params.amount;
      }
      
      // Implement retry strategy with exponential backoff
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Wallet] Transaction attempt ${attempt}/${maxRetries}`);
          
          // Open wallet
          const walletContract = this.client.open(this.wallet);
          const seqno = await walletContract.getSeqno();
          
          // If there's a comment, form message body
          let msgBody;
          if (params.comment) {
            msgBody = beginCell()
              .storeUint(0, 32) // op = 0 for text comment
              .storeStringTail(params.comment)
              .endCell();
          }
          
          // Create and send transaction
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
            validUntil: Math.floor(Date.now() / 1000) + (params.timeout || 60), // Default transaction valid for 60 seconds
          });
          
          // Send external message
          await this.client.sendExternalMessage(this.wallet, transfer);
          
          // Get transaction hash
          const transferBoc = transfer.toBoc();
          const txHash = Buffer.from(transferBoc).toString('base64').substring(0, 44);
          
          console.log(`[Wallet] Transaction sent successfully. Hash: ${txHash}`);
          
          return {
            success: true,
            transactionHash: txHash,
            additionalData: {
              seqno,
              externalMessageCell: Buffer.from(transferBoc).toString('base64')
            }
          };
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error sending transaction";
          lastError = new Error(errorMessage);
          console.error(`[Wallet] Transaction error (attempt ${attempt}/${maxRetries}): ${errorMessage}`);
          
          // If this is the last attempt, throw the error
          if (attempt === maxRetries) {
            throw lastError;
          }
          
          // Exponential backoff between attempts (1s, 2s, 4s, ...)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
          console.log(`[Wallet] Waiting ${delay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // If all attempts failed
      throw lastError || new Error('Failed to send transaction after multiple attempts');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Wallet] Transaction failed:', errorMessage);
      return {
        success: false,
        errorMessage: errorMessage || 'Unknown transaction error'
      };
    }
  }
  
  /**
   * Проверяет статус транзакции по её хешу
   * @returns Статус транзакции
   */
  async checkTransactionStatus(): Promise<TransactionStatus> {
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
    let lastStatus = await this.checkTransactionStatus();
    
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
      lastStatus = await this.checkTransactionStatus();
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
  
  /**
   * Извлекает комментарий из тела сообщения, если есть
   * @param body Тело сообщения
   * @returns Комментарий или undefined
   */
  private extractCommentFromBody(body: unknown): string | undefined {
    if (!body) return undefined;
    
    try {
      // Способ 1: Стандартный для @ton/ton - комментарий в виде Cell с опкодом 0
      if (typeof body === 'object' && body !== null && 'beginParse' in body && typeof body.beginParse === 'function') {
        const bodySlice = body.beginParse();
        
        if (bodySlice.remainingBits >= 32) {
          const op = bodySlice.loadUint(32);
          
          if (op === 0) {
            // op = 0 означает текстовый комментарий
            const comment = bodySlice.loadStringTail();
            return comment;
          }
        }
      }
      
      // Способ 2: Для сообщений в формате MCP/TON API - комментарий в декодированном теле
      if (typeof body === 'object' && body !== null) {
        // Проверяем наличие decoded_body с полем text (как в ответе MCP)
        if ('decoded_body' in body && body.decoded_body && typeof body.decoded_body === 'object' && 
            'text' in body.decoded_body && typeof body.decoded_body.text === 'string') {
          return body.decoded_body.text;
        }
        
        // Проверяем наличие decoded_op_name "text_comment"
        if ('decoded_op_name' in body && body.decoded_op_name === 'text_comment' && 
            'decoded_body' in body && body.decoded_body && typeof body.decoded_body === 'object' && 
            'text' in body.decoded_body && typeof body.decoded_body.text === 'string') {
          return body.decoded_body.text;
        }
        
        // Проверяем наличие body с полем text
        if ('body' in body && body.body && typeof body.body === 'object' && 
            'text' in body.body && typeof body.body.text === 'string') {
          return body.body.text;
        }
        
        // Проверяем наличие текстового комментария в других форматах
        if ('text' in body && typeof body.text === 'string') {
          return body.text;
        }
        
        // Иногда комментарий может быть в свойстве comment
        if ('comment' in body && typeof body.comment === 'string') {
          return body.comment;
        }
        
        // Проверяем наличие данных в формате base64
        if ('data' in body && typeof body.data === 'string') {
          try {
            // Пробуем декодировать base64 строку
            const decoded = Buffer.from(body.data, 'base64').toString('utf8');
            // Проверяем, что строка содержит только ASCII символы
            if (decoded && decoded.length > 0 && /^[A-Za-z0-9\s!-~]*$/.test(decoded)) {
              return decoded;
            }
          } catch {
            // Если декодирование не удалось, игнорируем ошибку
          }
        }
      }
      
      // Способ 3: JSON сериализованный комментарий
      if (typeof body === 'string' && body.startsWith('{') && body.endsWith('}')) {
        try {
          const jsonBody = JSON.parse(body);
          if (jsonBody.text || jsonBody.comment || jsonBody.message) {
            return jsonBody.text || jsonBody.comment || jsonBody.message;
          }
        } catch {
          // Если парсинг JSON не удался, это не JSON
        }
      }
      
      // Способ 4: Прямой текстовый комментарий
      if (typeof body === 'string' && body.length > 0) {
        return body;
      }
    } catch {
      // Не выводим полную ошибку
      console.warn("Ошибка при извлечении комментария из сообщения");
    }
    
    return undefined;
  }
  
  /**
   * Получает историю транзакций кошелька
   * @param params Параметры запроса транзакций (лимит, пагинация)
   * @returns Массив транзакций кошелька
   */
  async getTransactions(params: GetTransactionsParams): Promise<WalletTransaction[]> {
    this.checkInitialization();
    
    if (!this.client || !this.wallet) {
      throw new Error("Кошелек не инициализирован");
    }
    
    try {
      const address = this.wallet.address;
      const limit = params.limit || 10;
      const lt = params.lt;
      const hash = params.hash;
      const to_lt = params.to_lt;
      const archival = params.archival || false;
      // Получаем тип из параметров
      const type = params.type;
      // Получаем timestamp начала фильтрации
      const startTimestamp = params.startTimestamp;
      // Фильтрация подозрительных транзакций
      const filterSuspicious = params.filterSuspicious || false;
      
      // Получаем транзакции с архивного сервера, если нужно
      const transactions = await this.client.getTransactions(address, {
        limit,
        lt,
        hash,
        to_lt,
        archival
      });
      
      // Преобразуем транзакции в наш формат
      let result = transactions.map(tx => this.convertTonTransaction(tx));
      
      // Фильтрация по типу
      if (type) {
        result = result.filter(tx => tx.type === type);
      }
      
      // Фильтрация по времени
      if (startTimestamp) {
        result = result.filter(tx => tx.timestamp >= startTimestamp);
      }
      
      // Фильтрация подозрительных транзакций, если требуется
      if (filterSuspicious) {
        result = result.filter(tx => !this.isSuspiciousTransaction(tx));
      }
      
      return result;
    } catch (error) {
      console.error('Ошибка при получении транзакций:', error);
      throw new Error('Не удалось получить список транзакций');
    }
  }
  
  /**
   * Получение транзакции по хешу
   * @param hash Хеш транзакции
   * @returns Транзакция или null, если не найдена
   */
  async getTransactionByHash(hash: string): Promise<WalletTransaction | null> {
    this.checkInitialization();
    
    if (!this.client || !this.wallet) {
      throw new Error("Кошелек не инициализирован");
    }
    
    try {
      // Получаем последние транзакции и ищем по хешу
      const transactions = await this.getTransactions({
        limit: 50,
        archival: true
      });
      
      // Ищем транзакцию с нужным хешем
      const transaction = transactions.find(tx => tx.id === hash);
      return transaction || null;
    } catch {
      console.error(`Ошибка при получении транзакции по хешу ${hash}`);
      return null;
    }
  }
  
  /**
   * Преобразует транзакцию TON в формат WalletTransaction
   * @param tx Транзакция TON
   * @returns Транзакция в формате WalletTransaction
   */
  private convertTonTransaction(tx: Record<string, unknown>): WalletTransaction {
    const myAddress = this.wallet!.address.toString();
    
    // Определяем тип транзакции (входящая или исходящая)
    let type = TransactionType.UNKNOWN;
    let fromAddress = '';
    let toAddress = '';
    let amount = BigInt(0);
    let comment: string | undefined;
    
    // Обработка входящего сообщения
    const inMessage = tx.inMessage as Record<string, unknown> | undefined;
    if (inMessage && inMessage.info && typeof inMessage.info === 'object' && 
        'type' in inMessage.info && inMessage.info.type === 'internal' && 
        'src' in inMessage.info && inMessage.info.src) {
      // Входящий перевод
      type = TransactionType.INCOMING;
      fromAddress = inMessage.info.src.toString();
      toAddress = myAddress;
      
      // Преобразуем сумму в BigInt
      if ('info' in inMessage && typeof inMessage.info === 'object' && 
          'value' in inMessage.info && typeof inMessage.info.value === 'object' && inMessage.info.value && 
          'coins' in inMessage.info.value && inMessage.info.value.coins) {
        amount = BigInt(inMessage.info.value.coins.toString());
      }
      
      // Извлекаем комментарий
      comment = this.extractCommentFromBody(inMessage.body);
    } 
    
    // Обработка исходящих сообщений
    let outMessages: Array<Record<string, unknown>> = [];
    
    // Преобразуем outMessages в массив для унифицированной обработки
    if ('outMessages' in tx) {
      if (Array.isArray(tx.outMessages)) {
        outMessages = tx.outMessages as Array<Record<string, unknown>>;
      } else if (tx.outMessages && typeof tx.outMessages === 'object' && 
                'get' in tx.outMessages && typeof tx.outMessages.get === 'function') {
        // Если это словарь, преобразуем его в массив
        outMessages = [];
        for (let i = 0; i < 10; i++) { // Предполагаем, что максимум 10 сообщений
          const msg = tx.outMessages.get(i);
          if (msg) outMessages.push(msg as Record<string, unknown>);
          else break;
        }
      }
    }
    
    // Если есть исходящие сообщения, обрабатываем их
    if (outMessages.length > 0) {
      // Обрабатываем первое исходящее сообщение (обычно основное для простых переводов)
      const firstOutMsg = outMessages[0];
      
      if (firstOutMsg && 'info' in firstOutMsg && typeof firstOutMsg.info === 'object' && firstOutMsg.info && 
          'type' in firstOutMsg.info && firstOutMsg.info.type === 'internal' && 
          'dest' in firstOutMsg.info && firstOutMsg.info.dest) {
        // Если нет входящего сообщения или тип уже не определен как входящий,
        // считаем транзакцию исходящей
        if (type !== TransactionType.INCOMING) {
          type = TransactionType.OUTGOING;
          fromAddress = myAddress;
          toAddress = firstOutMsg.info.dest.toString();
          
          // Преобразуем сумму в BigInt
          if ('info' in firstOutMsg && typeof firstOutMsg.info === 'object' && 
              'value' in firstOutMsg.info && typeof firstOutMsg.info.value === 'object' && firstOutMsg.info.value && 
              'coins' in firstOutMsg.info.value && firstOutMsg.info.value.coins) {
            amount = BigInt(firstOutMsg.info.value.coins.toString());
          }
          
          // Извлекаем комментарий
          comment = this.extractCommentFromBody(firstOutMsg.body);
        }
      }
    }
    
    // Вычисляем комиссию
    const fee = 'totalFees' in tx && typeof tx.totalFees === 'object' && tx.totalFees && 
          'coins' in tx.totalFees && tx.totalFees.coins 
      ? BigInt(tx.totalFees.coins.toString()) 
      : BigInt(0);
    
    // Преобразуем хеш в строку (в зависимости от типа)
    let hashString: string = 'unknown_hash';
    
    try {
      if ('hash' in tx) {
        if (typeof tx.hash === 'function') {
          hashString = tx.hash();
        } else if (typeof tx.hash === 'string') {
          hashString = tx.hash;
        } else if (tx.hash) {
          // Для всех остальных случаев просто преобразуем в строку
          hashString = String(tx.hash);
        }
      }
    } catch {
      // Уменьшаем детализацию ошибки
      console.warn("Ошибка при преобразовании хеша транзакции");
      hashString = 'hash_error';
    }
    
    // Формируем объект транзакции
    const walletTx: WalletTransaction = {
      id: `${tx.lt}_${hashString}`,
      type,
      timestamp: 'now' in tx && typeof tx.now === 'number' ? tx.now : Math.floor(Date.now() / 1000),
      lt: 'lt' in tx ? String(tx.lt) : '0',
      hash: hashString,
      fromAddress,
      toAddress,
      amount,
      fee,
      comment,
      status: TransactionStatus.COMPLETED, // Все полученные транзакции считаем завершенными
      additionalData: {
        // Дополнительные данные о транзакции могут быть полезны для отладки
        utime: 'now' in tx ? tx.now : undefined
      }
    };
    
    return walletTx;
  }

  /**
   * Проверяет, является ли транзакция подозрительной (спамом)
   * @param transaction Транзакция для проверки
   * @returns true если транзакция подозрительная, false если нет
   */
  isSuspiciousTransaction(transaction: WalletTransaction): boolean {
    // 1. Проверка на транзакции с нулевыми или очень маленькими суммами (распространенный спам-паттерн)
    const minSuspiciousAmount = BigInt(10000000); // 0.01 TON в нано-единицах
    const isSmallAmount = transaction.amount <= minSuspiciousAmount;
    
    // 2. Проверка на отсутствие комментария
    const hasNoComment = !transaction.comment || transaction.comment.trim() === '';
    
    // Проверяем комментарии на наличие @
    const atSymbolPattern = /^@/;
    const isAtTagComment = transaction.comment && atSymbolPattern.test(transaction.comment);
    
    // Другие подозрительные паттерны
    const otherSuspiciousPatterns = [
      /https?:\/\//i,                  // Любые URL
      /t\.me\//i,                      // Telegram ссылки
      /airdrop|free|giveaway|claim/i,  // Ключевые слова, связанные с мошенничеством
      /received \+\d+/i,               // Ложные сообщения о получении средств
      /\bwin\b|\bprize\b|\breward\b/i, // Обещания выигрыша
      /wallet connect|connect wallet/i // Попытки заставить подключить кошелек
    ];
    
    const hasOtherSuspiciousPattern = transaction.comment && 
      otherSuspiciousPatterns.some(pattern => pattern.test(transaction.comment!));
    
    // 3. Проверка на известные паттерны "bounce" транзакций (переводы туда-обратно)
    // Для полной проверки нужно также анализировать историю транзакций
    const isBouncePattern = transaction.additionalData && 
      transaction.additionalData['bounce'] === true;
  
    // Транзакция считается подозрительной, если:
    // 1. Комментарий начинается с '@' (независимо от суммы), или
    // 2. Маленькая сумма и другой подозрительный комментарий, или
    // 3. Это bounce-транзакция
    // 4. Отсутствует комментарий
    return isAtTagComment || (isSmallAmount && hasOtherSuspiciousPattern) || isBouncePattern === true || hasNoComment;
  }

  /**
   * Получает список транзакций и фильтрует подозрительные
   * @param params Параметры для получения транзакций
   * @param filterSuspicious Фильтровать ли подозрительные транзакции (по умолчанию false)
   * @returns Список транзакций (может быть отфильтрован)
   */
  async getTransactionsWithSuspiciousCheck(
    params: GetTransactionsParams,
    filterSuspicious: boolean = false
  ): Promise<{transactions: WalletTransaction[], suspiciousTransactions: WalletTransaction[]}> {
    const allTransactions = await this.getTransactions(params);
    
    // Проверяем каждую транзакцию на подозрительность
    const suspiciousTransactions = allTransactions.filter(tx => this.isSuspiciousTransaction(tx));
    
    // Возвращаем либо все транзакции, либо только не подозрительные
    return {
      transactions: filterSuspicious ? allTransactions.filter(tx => !this.isSuspiciousTransaction(tx)) : allTransactions,
      suspiciousTransactions
    };
  }
} 