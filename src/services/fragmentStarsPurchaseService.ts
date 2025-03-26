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
   * @param starsAmount Количество звезд для поиска (влияет на результат API)
   * @returns Идентификатор получателя
   * @throws {FragmentApiException} если получатель не найден
   */
  public async findRecipientIdAsync(username: string, starsAmount: number = 60): Promise<string> {
    console.log(`[Fragment] Поиск пользователя @${username} для покупки ${starsAmount} звезд`);
    
    // Используем метод поиска с правильным количеством звезд
    const searchResult = await this._fragmentClient.searchRecipientsAsync(username, starsAmount);
    
    if (searchResult.recipients.length === 0) {
      throw new FragmentApiException(`Пользователь ${username} не найден в системе Fragment`);
    }

    console.log(`[Fragment] Пользователь @${username} успешно найден, ID: ${searchResult.recipients[0].id}`);
    return searchResult.recipients[0].id;
  }

  /**
   * Покупка звезд для указанного пользователя
   * @param username Имя пользователя
   * @param starsAmount Количество звезд
   * @returns Результат покупки звезд
   */
  public async purchaseStarsAsync(username: string, starsAmount: number): Promise<PurchaseResult> {
    try {
      console.log(`[Fragment] Начало процесса покупки ${starsAmount} звезд для пользователя @${username}`);
      
      // Проверка валидности параметров
      if (!username) {
        console.error('[Fragment] ОШИБКА: Не указано имя пользователя');
        throw new Error('Не указано имя пользователя');
      }
      
      if (starsAmount <= 0) {
        console.error('[Fragment] ОШИБКА: Неверное количество звезд');
        throw new Error('Неверное количество звезд');
      }
      
      // Форматируем имя пользователя, удаляя @ если он есть в начале
      const formattedUsername = username.startsWith('@') ? username.substring(1) : username;
      
      // Инициализируем состояние сессии
      const initialState = await this._fragmentClient.updatePurchaseStateAsync("", "new", "");
      console.log(`[Fragment] Сессия с Fragment API инициализирована`);
      
      // ВАЖНО: Сначала ищем пользователя по ID с правильным количеством звезд
      console.log(`[Fragment] Поиск получателя в системе Fragment...`);
      const recipientId = await this.findRecipientIdAsync(formattedUsername, starsAmount);
      
      // Инициализируем покупку звезд, используя полученный ID получателя
      console.log(`[Fragment] Инициализация покупки звезд...`);
      const initResult = await this._fragmentClient.initBuyStarsAsync(recipientId, starsAmount);
      
      if (!initResult.reqId || initResult.amount <= 0) {
        const errorMsg = `Ошибка при инициализации покупки: недостаточно данных для продолжения`;
        console.error(`[Fragment] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      console.log(`[Fragment] Покупка инициализирована, reqId: ${initResult.reqId}`);
      console.log(`[Fragment] Получен запрос TON: ${initResult.amount} TON`);

      // Получаем информацию о платеже
      console.log(`[Fragment] Запрос платежной информации...`);
      
      // Получаем данные для транзакции
      const walletAccount: WalletAccount = {
        address: this._walletAddress,
        chain: "-239",
        publicKey: this._publicKey,
        walletStateInit: this._walletStateInit
      };
      
      const getLinkResponse = await this._fragmentClient.getBuyStarsLinkAsync(
        walletAccount,
        initResult.reqId,
        1
      );
      
      if (!getLinkResponse.ok || getLinkResponse.transaction.messages.length === 0) {
        throw new Error("Не удалось получить детали транзакции");
      }
      
      // Получаем данные транзакции
      const message = getLinkResponse.transaction.messages[0];
      
      if (!message) {
        const errorMsg = `Ошибка при получении информации о платеже`;
        console.error(`[Fragment] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      console.log(`[Fragment] Получена платежная информация:
  - Адрес: ${message.address}
  - Сумма: ${message.amount / 1_000_000_000} TON
  - Payload Base64: ${message.payload}`);

      // Подтверждаем транзакцию для получения dh и других параметров
      console.log(`[Fragment] Подтверждение транзакции...`);
      
      // Переводим режим в processing и продолжаем проверку статуса
      const processingState = await this._fragmentClient.updatePurchaseStateAsync(
        initResult.reqId, 
        "processing", 
        this._fragmentClient.currentDh || ""
      );
      
      // Сохраняем dh для использования в последующих запросах
      const currentDh = processingState.ok && processingState.dh ? processingState.dh : "";
      
      // Подтверждаем транзакцию на Fragment
      const confirmResult = await this._fragmentClient.confirmReqAsync(
        initResult.reqId, 
        message.payload, 
        walletAccount
      );
      
      if (!confirmResult) {
        const errorMsg = `Ошибка при подтверждении покупки: не получен ответ от API`;
        console.error(`[Fragment] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // Обновляем состояние после подтверждения
      const afterConfirmState = await this._fragmentClient.updatePurchaseStateAsync(
        initResult.reqId, 
        "new", 
        currentDh
      );
      
      console.log(`[Fragment] Транзакция подтверждена, получены параметры dh и mode`);
      
      // Декодируем payload для определения содержимого комментария
      const comment = this.decodePayload(message.payload);

      const amountInTon = message.amount / 1_000_000_000;
      console.log(`[Fragment] Подготовлены данные для отправки транзакции:
  - Адрес: ${message.address}
  - Сумма: ${amountInTon} TON
  - Комментарий: ${comment}`);

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
          
          if (transactionStatus !== TransactionStatus.COMPLETED) {
            console.warn(`[Fragment] ВНИМАНИЕ: Транзакция не подтверждена. Статус: ${transactionStatus}`);
          } else {
            console.log(`[Fragment] Транзакция успешно подтверждена в блокчейне`);
          }
        } catch (error) {
          console.error(`[Fragment] ОШИБКА при отправке транзакции: ${(error as Error).message}`);
          throw new Error(`Ошибка при отправке TON: ${(error as Error).message}`);
        }
      } else {
        // Если сервис кошелька недоступен, выбрасываем исключение
        console.error("[Fragment] ОШИБКА: Сервис кошелька недоступен, невозможно отправить реальную транзакцию");
        throw new Error("Сервис кошелька недоступен. Невозможно выполнить транзакцию.");
      }

      // Используем текущий режим и dh, полученные после подтверждения
      const startMode = afterConfirmState.ok && afterConfirmState.mode ? afterConfirmState.mode : "new";
      
      // Устанавливаем глобальные переменные mode и dh для последующих вызовов API
      this._fragmentClient.currentMode = startMode;
      this._fragmentClient.currentDh = currentDh;
      
      console.log("[Fragment] Ожидание обработки транзакции Fragment...");
      
      const status = await this._fragmentClient.checkPurchaseStatusWithPollingAsync(
        initResult.reqId,
        0,     // 0 = бесконечное ожидание 
        2000   // 2 секунды между попытками
      );
      
      if (status.ok && status.state === PurchaseState.Completed) {
        console.log(`[Fragment] Покупка звезд УСПЕШНО завершена`);
      } else {
        console.error(`[Fragment] Ошибка при завершении покупки звезд, статус: ${status.state}, ошибка: ${status.error || "Нет информации"}`);
      }
      
      return {
        success: status.ok && status.state === PurchaseState.Completed,
        transactionHash: txHash,
        outgoingTransactionHash: txHash,
        amount: initResult.amount,
        status: status.state,
        recipientId: recipientId,
        starsAmount: starsAmount,
        error: status.error || undefined
      };
    } catch (error) {
      console.error(`[Fragment] КРИТИЧЕСКАЯ ОШИБКА при покупке звезд: ${(error as Error).message}`);
      console.error(`[Fragment] Стек вызовов: ${(error as Error).stack}`);
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