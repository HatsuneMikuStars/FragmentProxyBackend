// Fragment Stars Purchase Service
// Сервис для покупки звезд на платформе Fragment

import { FragmentApiClient } from '../apiClient/fragmentApiClient';
import { 
  Recipient,
  FragmentApiException,
  WalletAccount
} from '../apiClient/models/apiModels';
import {
  PurchaseResult,
  InsufficientBalanceException,
  PurchaseState,
  PurchaseServiceOptions
} from './models/purchaseModels';
import { IWalletService } from '../wallet/IWalletService';
import { TransactionStatus } from '../wallet/models/walletModels';
import { TRANSACTION_MONITOR_CONFIG, FRAGMENT_CONFIG } from '../config';

/**
 * Сервис для покупки звезд на платформе Fragment
 */
export class FragmentStarsPurchaseService {
  private readonly _fragmentClient: FragmentApiClient;
  private readonly _walletService?: IWalletService;
  private readonly _walletAddress: string;
  private readonly _publicKey: string;
  private readonly _walletStateInit: string;
  private readonly _options: PurchaseServiceOptions;

  /**
   * Создает новый экземпляр сервиса покупки звезд
   * @param cookies Куки для авторизации на сайте Fragment
   * @param walletAddress Адрес кошелька для отправки средств
   * @param publicKey Публичный ключ кошелька
   * @param walletStateInit StateInit кошелька
   * @param fragmentBaseUrl Базовый URL API Fragment
   * @param options Дополнительные опции сервиса
   * @param walletService Опциональный сервис кошелька для автоматической отправки транзакций
   */
  constructor(
    cookies: Record<string, string>,
    walletAddress: string,
    publicKey: string,
    walletStateInit: string,
    fragmentBaseUrl: string,
    options: PurchaseServiceOptions = {},
    walletService?: IWalletService
  ) {
    this._fragmentClient = new FragmentApiClient(cookies, fragmentBaseUrl);
    this._walletAddress = walletAddress;
    this._publicKey = publicKey;
    this._walletStateInit = walletStateInit;
    this._walletService = walletService;
    this._options = {
      apiTimeout: 15000,
      retryCount: 3,
      retryDelay: 2000,
      ...options
    };
  }

  /**
   * Создает экземпляр сервиса на основе API клиента и сервиса кошелька
   * @param fragmentClient API клиент Fragment
   * @param walletService Сервис кошелька
   * @returns Сервис покупки звезд
   */
  public static async createFromWalletService(
    fragmentClient: FragmentApiClient,
    walletService: IWalletService
  ): Promise<FragmentStarsPurchaseService> {
    // Получаем данные кошелька
    const account = await walletService.getWalletAccount();
    
    return new FragmentStarsPurchaseService(
      fragmentClient.cookies,
      account.address,
      account.publicKey,
      account.walletStateInit,
      fragmentClient.baseUrl,
      {},
      walletService
    );
  }

  /**
   * Поиск получателя по юзернейму
   * @param username Имя пользователя для поиска
   * @returns Идентификатор получателя
   * @throws {FragmentApiException} если получатель не найден
   */
  public async findRecipientIdAsync(username: string): Promise<string> {
    const searchResult = await this._fragmentClient.searchRecipientsAsync(username);
    if (searchResult.recipients.length === 0) {
      throw new FragmentApiException(`Пользователь ${username} не найден`);
    }

    return searchResult.recipients[0].id;
  }

  /**
   * Полный процесс покупки звезд
   * @param username Имя пользователя, которому отправляются звезды
   * @param starsAmount Количество звезд для покупки
   * @returns Результат операции покупки
   */
  public async purchaseStarsAsync(username: string, starsAmount: number): Promise<PurchaseResult> {
    console.log(`[Fragment] Покупка ${starsAmount} звезд для @${username}`);

    try {
      // Начальное получение состояния страницы покупки, как это происходит в браузере
      let currentDh = "";
      const initialState = await this._fragmentClient.updatePurchaseStateAsync("", "new", currentDh);
      if (initialState.ok && initialState.dh) {
        currentDh = initialState.dh;
      }

      // Ищем получателя
      const recipientId = await this.findRecipientIdAsync(username);

      // Обновляем состояние после поиска получателя, как в браузере
      const afterSearchState = await this._fragmentClient.updatePurchaseStateAsync("", "new", currentDh);
      if (afterSearchState.ok && afterSearchState.dh) {
        currentDh = afterSearchState.dh;
      }
      
      // Инициализируем покупку
      const initResult = await this._fragmentClient.initBuyStarsAsync(recipientId, starsAmount);
      
      // Обновляем состояние после инициализации покупки
      const afterInitState = await this._fragmentClient.updatePurchaseStateAsync(initResult.reqId, "new", currentDh);
      if (afterInitState.ok && afterInitState.dh) {
        currentDh = afterInitState.dh;
      }

      // Получаем детали для транзакции
      const walletAccount: WalletAccount = {
        address: this._walletAddress,
        chain: "-239",
        publicKey: this._publicKey,
        walletStateInit: this._walletStateInit
      };
      
      // Обновляем состояние перед получением деталей транзакции
      const beforeLinkState = await this._fragmentClient.updatePurchaseStateAsync(initResult.reqId, "new", currentDh);
      if (beforeLinkState.ok && beforeLinkState.dh) {
        currentDh = beforeLinkState.dh;
      }
      
      const getLinkResponse = await this._fragmentClient.getBuyStarsLinkAsync(
        walletAccount,
        initResult.reqId,
        1
      );

      if (!getLinkResponse.ok || getLinkResponse.transaction.messages.length === 0) {
        throw new FragmentApiException("Не удалось получить детали транзакции");
      }

      // Получаем данные транзакции
      const message = getLinkResponse.transaction.messages[0];
      const amountInTon = message.amount / 1_000_000_000; // Конвертация из нано-TON в TON
      
      // Обновляем состояние после получения деталей транзакции
      const afterLinkState = await this._fragmentClient.updatePurchaseStateAsync(initResult.reqId, "new", currentDh);
      if (afterLinkState.ok && afterLinkState.dh) {
        currentDh = afterLinkState.dh;
      }
      
      // Формируем текст комментария для транзакции
      const comment = this.decodePayload(message.payload);
      
      // Вместо ожидания пользовательского ввода, автоматически продолжаем выполнение
      const boc = message.payload;
      
      // Обновляем состояние перед подтверждением транзакции
      const beforeConfirmState = await this._fragmentClient.updatePurchaseStateAsync(initResult.reqId, "new", currentDh);
      if (beforeConfirmState.ok) {
        if (beforeConfirmState.dh) {
          currentDh = beforeConfirmState.dh;
        }
        
        if (beforeConfirmState.mode && beforeConfirmState.mode !== "new") {
          const modeChangeState = await this._fragmentClient.updatePurchaseStateAsync(
            initResult.reqId, 
            beforeConfirmState.mode, 
            currentDh
          );
          
          if (modeChangeState.ok && modeChangeState.dh) {
            currentDh = modeChangeState.dh;
          }
        }
      }
      
      // Переводим режим в processing и продолжаем проверку статуса
      const processingState = await this._fragmentClient.updatePurchaseStateAsync(
        initResult.reqId, 
        "processing", 
        currentDh
      );
      
      if (processingState.ok && processingState.dh) {
        currentDh = processingState.dh;
      }
      
      // Подтверждаем транзакцию на Fragment
      const confirmResult = await this._fragmentClient.confirmReqAsync(
        initResult.reqId, 
        boc, 
        walletAccount
      );
      
      // Обновляем состояние после подтверждения транзакции
      const afterConfirmState = await this._fragmentClient.updatePurchaseStateAsync(initResult.reqId, "new", currentDh);
      if (afterConfirmState.ok) {
        if (afterConfirmState.dh) {
          currentDh = afterConfirmState.dh;
        }
      }

      // Отправляем реальную транзакцию, если сервис кошелька доступен
      let txHash: string;
      
      if (this._walletService) {
        console.log(`[Fragment] Отправка ${amountInTon} TON для покупки ${starsAmount} звезд`);
        try {
          // Отправляем транзакцию через сервис кошелька
          const transactionResult = await this._walletService.sendTransaction({
            toAddress: message.address,
            amount: message.amount,
            comment: comment,
            maxRetries: 3,
            timeout: 180 // Действительна 3 минуты
          });
          
          if (!transactionResult.success) {
            throw new Error(`Ошибка при отправке транзакции: ${transactionResult.errorMessage}`);
          }
          
          if (!transactionResult.transactionHash) {
            throw new Error('Не получен хеш транзакции после отправки');
          }
          
          txHash = transactionResult.transactionHash;
          console.log(`[Fragment] Транзакция отправлена, хеш: ${txHash}`);
          
          // Ожидаем завершения транзакции (максимум 5 минут)
          const transactionStatus = await this._walletService.waitForTransactionCompletion(
            txHash,
            5 * 60 * 1000 // 5 минут
          );
          
          // Сокращаем информационные сообщения
          if (transactionStatus !== TransactionStatus.COMPLETED) {
            console.warn(`[Fragment] Транзакция не подтверждена. Статус: ${transactionStatus}`);
          }
        } catch (error) {
          console.error(`[Fragment] Ошибка при отправке транзакции`);
          throw new Error(`Ошибка при отправке TON: ${(error as Error).message}`);
        }
      } else {
        // Если сервис кошелька недоступен, используем симуляцию
        console.log("[Fragment] Сервис кошелька недоступен, используется симуляция");
        txHash = "TON" + Date.now().toString(16).toUpperCase();
      }

      // Используем текущий режим и dh, полученные после подтверждения
      const startMode = afterConfirmState.ok && afterConfirmState.mode ? afterConfirmState.mode : "new";
      
      // Устанавливаем глобальные переменные mode и dh для последующих вызовов API
      this._fragmentClient.currentMode = startMode;
      this._fragmentClient.currentDh = currentDh;
      
      // Объединяем несколько логов в один
      console.log("[Fragment] Ожидание обработки транзакции...");
      
      const status = await this._fragmentClient.checkPurchaseStatusWithPollingAsync(
        initResult.reqId,
        0,     // 0 = бесконечное ожидание 
        2000   // 2 секунды между попытками
      );
      
      console.log(`[Fragment] Покупка звезд завершена, статус: ${status.state}`);
      
      return {
        success: status.ok && status.state === PurchaseState.Completed,
        transactionHash: txHash,
        amount: initResult.amount,
        status: status.state,
        recipientId: recipientId,
        starsAmount: starsAmount,
        error: status.error || undefined
      };
    } catch (error) {
      console.error(`[Fragment] Ошибка при покупке звезд: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Декодирует payload из Base64 и возвращает текстовое сообщение
   * @param payloadBase64 Payload в формате Base64
   * @returns Декодированное сообщение
   */
  private decodePayload(payloadBase64: string): string {
    try {
      if (!payloadBase64) {
        return "[ОШИБКА: Payload пустой]";
      }
      
      // Автоматически исправляем padding для Base64 строки
      let paddedPayload = payloadBase64;
      const remainder = paddedPayload.length % 4;
      if (remainder === 2) {
        paddedPayload += "==";
      } else if (remainder === 3) {
        paddedPayload += "=";
      }
      
      // Преобразуем Base64 в массив байтов
      const binaryString = atob(paddedPayload);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Проверяем длину массива
      if (bytes.length <= 17) {
        return `[ОШИБКА: Данные слишком короткие (${bytes.length} байт)]`;
      }
      
      // Извлекаем данные со смещением и преобразуем в текст
      const textDecoder = new TextDecoder('utf-8');
      const result = textDecoder.decode(bytes.slice(17));
      return result;
    } catch (error) {
      return "[НЕ УДАЛОСЬ ДЕКОДИРОВАТЬ PAYLOAD: " + payloadBase64 + "]";
    }
  }

  /**
   * Получает актуальный курс обмена TON на звезды
   * @returns Коэффициент конверсии (звезд на 1 TON)
   */
  public async getStarsExchangeRate(): Promise<number> {
    try {
      console.log('[Fragment] Getting current stars exchange rate');
      
      // Запрашиваем цену для базового пакета в 50 звезд
      const priceResponse = await this._fragmentClient.updateStarsPricesAsync(50);
      
      if (!priceResponse.ok || priceResponse.starsPerTon <= 0) {
        console.warn('[Fragment] Failed to get valid exchange rate, using default rate of 50');
        return 50; // Возвращаем базовое значение в случае ошибки
      }
      
      console.log(`[Fragment] Current exchange rate: ${priceResponse.starsPerTon.toFixed(2)} stars per TON`);
      return priceResponse.starsPerTon;
    } catch (error) {
      console.error('[Fragment] Error getting stars exchange rate:', error);
      return 50; // Возвращаем базовое значение в случае ошибки
    }
  }

  /**
   * Получает текущий курс обмена
   * @returns Актуальный коэффициент конверсии
   * @deprecated Используйте getStarsExchangeRate вместо этого метода
   */
  public async updateExchangeRateConfig(): Promise<number> {
    try {
      return await this.getStarsExchangeRate();
    } catch (error) {
      console.error('[Fragment] Error getting exchange rate:', error);
      return 50; // Возвращаем базовое значение в случае ошибки
    }
  }
} 