// Fragment API Client
// Клиент для работы с API Fragment

import { 
  Recipient, 
  ButtonInfo, 
  SearchRecipientsResponse, 
  InitBuyStarsResponse, 
  InitBuyStarsRequestResponse, 
  StarsBuyState, 
  StarsBuyStateApiResponse, 
  UpdatePurchaseStateResponse, 
  GetBuyStarsLinkResponse, 
  WalletAccount,
  DeviceInfo,
  FragmentApiException,
  StarsPriceResponse
} from './models/apiModels';
import { FRAGMENT_CONFIG } from '../config';

/**
 * Клиент для работы с API Fragment.com
 */
export class FragmentApiClient {
  private readonly _cookies: Record<string, string>;
  private readonly _baseUrl: string;
  private readonly _apiHash: string;
  
  // Добавляем свойства для хранения текущего режима и dh
  public currentMode: string = "new";
  public currentDh?: string;

  /**
   * Создает новый экземпляр клиента API Fragment
   * @param cookies Куки для авторизации на сайте Fragment
   * @param baseUrl Базовый URL API Fragment
   * @param apiHash Hash для API запросов
   */
  constructor(
    cookies: Record<string, string>, 
    baseUrl: string,
    apiHash: string = FRAGMENT_CONFIG.API_HASH
  ) {
    this._cookies = cookies;
    this._baseUrl = baseUrl;
    this._apiHash = apiHash;
  }

  /**
   * Получает куки для авторизации
   */
  get cookies(): Record<string, string> {
    return this._cookies;
  }

  /**
   * Получает базовый URL API
   */
  get baseUrl(): string {
    return this._baseUrl;
  }

  /**
   * Добавляет стандартные заголовки к запросу
   * @param headers Объект заголовков для модификации
   * @returns Обновленный объект заголовков
   */
  private addDefaultHeaders(headers: Record<string, string> = {}): Record<string, string> {
    const resultHeaders: Record<string, string> = {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Origin': this._baseUrl,
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      'X-Requested-With': 'XMLHttpRequest',
      ...headers
    };

    // Добавляем куки
    if (Object.keys(this._cookies).length > 0) {
      const cookieString = Object.entries(this._cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      resultHeaders['Cookie'] = cookieString;
    }

    return resultHeaders;
  }

  /**
   * Безопасный генератор случайных чисел
   * @param min Минимальное значение (включительно)
   * @param max Максимальное значение (включительно)
   * @returns Случайное число в заданном диапазоне
   */
  private generateSecureRandomNumber(min: number, max: number): number {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const value = Math.abs(array[0]);
    return min + (value % (max - min + 1));
  }

  /**
   * Поиск получателей по имени пользователя
   * @param username Имя пользователя для поиска
   * @returns Результат поиска с информацией о получателях
   */
  public async searchRecipientsAsync(username: string): Promise<SearchRecipientsResponse> {
    console.log(`Поиск пользователя: ${username}`);
    
    const headers = this.addDefaultHeaders({
      'Referer': `${this._baseUrl}/stars/buy?quantity=50`
    });
    
    const formData = new URLSearchParams();
    formData.append('hash', this._apiHash);
    formData.append('query', username);
    formData.append('quantity', '50');
    formData.append('method', 'searchStarsRecipient');
    
    try {
      const response = await fetch(`${this._baseUrl}/api`, {
        method: 'POST',
        headers,
        body: formData,
        // Используем более строгий таймаут
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        throw new FragmentApiException(
          `Ошибка при поиске пользователя: ${response.status} - ${response.statusText}`
        );
      }
      
      const content = await response.text();
      console.log(`Ответ поиска: ${content}`);
      
      try {
        const responseJson = JSON.parse(content);
        
        if (responseJson.error) {
          throw new FragmentApiException(`API вернул ошибку: ${responseJson.error}`);
        }
        
        const recipients: Recipient[] = [];
        
        if (responseJson.found) {
          const recipient: Recipient = {
            id: responseJson.found.recipient || '',
            username: username,
            name: responseJson.found.name || ''
          };
          recipients.push(recipient);
        }
        
        return { recipients };
      } catch (ex) {
        if (ex instanceof FragmentApiException) {
          throw ex;
        }
        throw new FragmentApiException(`Ошибка разбора ответа API: ${(ex as Error).message}`, ex as Error);
      }
    } catch (ex) {
      if (ex instanceof FragmentApiException) {
        throw ex;
      }
      throw new FragmentApiException(`Ошибка при поиске получателя: ${(ex as Error).message}`, ex as Error);
    }
  }

  /**
   * Инициализация покупки звезд
   * @param recipientId Идентификатор получателя звезд
   * @param quantity Количество звезд для покупки
   * @returns Информация о запросе покупки
   */
  public async initBuyStarsAsync(recipientId: string, quantity: number): Promise<InitBuyStarsResponse> {
    console.log(`Инициализация покупки звезд: получатель ${recipientId}, количество ${quantity}`);
    
    const headers = this.addDefaultHeaders({
      'Referer': `${this._baseUrl}/stars/buy?recipient=${recipientId}&quantity=${quantity}`
    });
    
    const formData = new URLSearchParams();
    formData.append('hash', this._apiHash);
    formData.append('recipient', recipientId);
    formData.append('quantity', quantity.toString());
    formData.append('method', 'initBuyStarsRequest');
    
    try {
      const response = await fetch(`${this._baseUrl}/api`, {
        method: 'POST',
        headers,
        body: formData,
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        throw new FragmentApiException(
          `Ошибка при инициализации покупки звезд: ${response.status} - ${response.statusText}`
        );
      }
      
      const content = await response.text();
      console.log(`Ответ инициализации: ${content}`);
      
      try {
        const responseObject = JSON.parse(content);
        
        // Поля могут находиться как в корне объекта, так и внутри поля result
        const reqId = responseObject.req_id || (responseObject.result && responseObject.result.req_id);
        const amount = parseFloat(responseObject.amount || (responseObject.result && responseObject.result.amount) || "0");
        const button = responseObject.button || (responseObject.result && responseObject.result.button) || {};
        
        if (!reqId) {
          console.error("Ответ API не содержит поле req_id:", responseObject);
          throw new FragmentApiException("Некорректный формат ответа API: отсутствует req_id");
        }
        
        console.log(`Идентификатор запроса: ${reqId}`);
        console.log(`Сумма из ответа: ${amount}`);
        
        return {
          reqId: reqId,
          amount: amount,
          button: {
            address: button.address || '',
            amount: button.amount || amount.toString(),
            payload: button.payload || ''
          }
        };
      } catch (ex) {
        if (ex instanceof FragmentApiException) {
          throw ex;
        }
        throw new FragmentApiException(`Ошибка разбора ответа API: ${(ex as Error).message}`, ex as Error);
      }
    } catch (ex) {
      if (ex instanceof FragmentApiException) {
        throw ex;
      }
      throw new FragmentApiException(`Ошибка при инициализации покупки: ${(ex as Error).message}`, ex as Error);
    }
  }

  /**
   * Проверка статуса покупки звезд с учетом изменения mode и dh
   * @param reqId Идентификатор запроса
   * @param mode Режим запроса (new, processing, done)
   * @param dh Динамический хеш для защиты от CSRF
   * @returns Ответ с информацией о статусе покупки
   */
  public async updatePurchaseStateAsync(reqId: string, mode = "new", dh = ""): Promise<StarsBuyStateApiResponse> {
    console.log(`\n[API] updatePurchaseState вызов: reqId=${reqId}, mode=${mode}, dh=${dh}`);
    
    const headers = this.addDefaultHeaders({
      'Referer': `${this._baseUrl}/stars/buy?req_id=${reqId}`
    });
    
    const formData = new URLSearchParams();
    formData.append('hash', this._apiHash);
    formData.append('req_id', reqId);
    formData.append('mode', mode);
    formData.append('lv', 'false');
    
    // Если dh не указан, используем генерируемое значение
    if (!dh) {
      // Генерируем безопасное случайное число
      const randomDh = this.generateSecureRandomNumber(100000000, 999999999);
      dh = randomDh.toString();
      console.log(`[API] Сгенерировано новое dh: ${dh}`);
    }
    
    formData.append('dh', dh);
    formData.append('method', 'updateStarsBuyState');
    
    // Логируем отправляемые данные
    console.log(`[API] updatePurchaseState данные: ${formData.toString()}`);
    
    try {
      const response = await fetch(`${this._baseUrl}/api`, {
        method: 'POST',
        headers,
        body: formData,
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        console.log(`[API] updatePurchaseState ошибка: ${response.status} - ${await response.text()}`);
        return {
          ok: false,
          needUpdate: false,
          mode: mode,
          state: {
            status: "error",
            msg: `HTTP Error: ${response.status}`
          },
          dh: dh
        };
      }
      
      const content = await response.text();
      console.log(`[API] updatePurchaseState ответ: ${content}`);
      
      // Анализируем ответ
      try {
        const responseJson = JSON.parse(content);
        
        let isOk = false;
        let needUpdate = false;
        let returnedMode = mode;
        let responseDh = dh;
        let state: StarsBuyState | undefined = undefined;
        
        // Проверяем основные поля ответа
        if ('ok' in responseJson) {
          isOk = Boolean(responseJson.ok);
        }
        
        if ('need_update' in responseJson) {
          needUpdate = Boolean(responseJson.need_update);
        }
        
        if ('mode' in responseJson) {
          returnedMode = responseJson.mode || mode;
        }
        
        if ('dh' in responseJson) {
          responseDh = String(responseJson.dh);
        }
        
        // Создаем или заполняем объект ответа
        const response: StarsBuyStateApiResponse = {
          ok: isOk,
          needUpdate: needUpdate,
          mode: returnedMode,
          state: state || (responseJson.state as StarsBuyState),
          dh: responseDh,
          error: responseJson.error as string,
          html: responseJson.html as string,
          options_html: responseJson.options_html as string
        };
        
        return response;
      } catch (ex) {
        console.log(`[API] updatePurchaseState ошибка разбора: ${(ex as Error).message}`);
        return {
          ok: false,
          needUpdate: false,
          mode: mode,
          state: {
            status: "error",
            msg: `Parse error: ${(ex as Error).message}`
          },
          dh: dh
        };
      }
    } catch (ex) {
      console.log(`[API] updatePurchaseState ошибка запроса: ${(ex as Error).message}`);
      return {
        ok: false,
        needUpdate: false,
        mode: mode,
        state: {
          status: "error",
          msg: `Request error: ${(ex as Error).message}`
        },
        dh: dh
      };
    }
  }

  /**
   * Постоянная проверка статуса покупки с указанным интервалом
   * @param reqId Идентификатор запроса
   * @param maxAttempts Максимальное количество попыток (0 = бесконечное ожидание)
   * @param delayBetweenAttempts Задержка между попытками в миллисекундах
   * @returns Статус покупки
   */
  public async checkPurchaseStatusWithPollingAsync(
    reqId: string, 
    maxAttempts = 0, 
    delayBetweenAttempts = 2000
  ): Promise<UpdatePurchaseStateResponse> {
    console.log(`\n[API] Начало мониторинга статуса для reqId: ${reqId}`);
    
    let attempts = 0;
    let currentMode = this.currentMode || "new";
    let currentDh = this.currentDh || "";
    
    let stableStateCounter = 0;
    let processingCounter = 0;
    let previousState = "";
    let lastHtmlContent = "";
    
    // Попробуем сразу после confirmReq принудительно отправить запрос с mode=done
    // Это может помочь правильно инициализировать состояние на сервере
    try {
      console.log("[API] Отправка принудительного запроса в режиме done для инициализации");
      const forceDoneResponse = await this.updatePurchaseStateAsync(reqId, "done", currentDh);
      
      if (forceDoneResponse.ok) {
        if (forceDoneResponse.mode) {
          currentMode = forceDoneResponse.mode;
          this.currentMode = currentMode;
        }
        
        if (forceDoneResponse.dh) {
          currentDh = forceDoneResponse.dh;
          this.currentDh = currentDh;
        }
      }
    } catch (ex) {
      console.log(`[API] Ошибка принудительного запроса: ${(ex as Error).message}`);
    }
    
    // После принудительного запроса возвращаемся к processing для обычного мониторинга
    currentMode = "processing";
    this.currentMode = "processing";
    
    while (maxAttempts === 0 || attempts < maxAttempts) {
      attempts++;
      console.log(`\n[API] Попытка проверки статуса #${attempts}. Mode: ${currentMode}`);
      
      try {
        const statusResponse = await this.updatePurchaseStateAsync(reqId, currentMode, currentDh);
        
        // Проверяем индикаторы завершения
        let completionDetected = false;
        
        // 1. Проверяем режим и состояние
        if (statusResponse.mode === "done" || statusResponse.state?.status === "done") {
          console.log("[API] Обнаружен режим done");
          stableStateCounter++;
          completionDetected = true;
        }
        
        // 2. Проверяем HTML-контент
        if (statusResponse.html && typeof statusResponse.html === 'string') {
          const shortHtml = statusResponse.html.substring(0, 100) + "...";
          console.log(`[API] Получен HTML: ${shortHtml}`);
          
          if (statusResponse.html.includes("Stars received") || 
              statusResponse.html.includes("Звезды получены") ||
              statusResponse.html.includes("Purchase completed")) {
            console.log("[API] Найден индикатор завершения в HTML");
            stableStateCounter++;
            completionDetected = true;
          }
        }
        
        // 3. Проверяем длительное пребывание в processing
        if (statusResponse.mode === "processing") {
          processingCounter++;
          console.log(`[API] Режим processing: попытка ${processingCounter}`);
          
          // Каждые 5 попыток отправляем принудительный запрос в режиме done
          if (processingCounter % 5 === 0) {
            console.log("[API] Принудительная проверка режима done");
            const testDoneResponse = await this.updatePurchaseStateAsync(reqId, "done", currentDh);
            
            if (testDoneResponse.ok) {
              if (testDoneResponse.mode === "done" || testDoneResponse.state?.status === "done") {
                console.log("[API] Режим done подтвержден принудительным запросом");
                stableStateCounter += 2;
                completionDetected = true;
              }
              
              if (testDoneResponse.dh) {
                currentDh = testDoneResponse.dh;
                this.currentDh = currentDh;
              }
            }
          }
          
          // После 15 попыток в режиме processing, принудительно завершаем
          if (processingCounter >= 15) {
            console.log("[API] Превышено максимальное время ожидания в режиме processing");
            return {
              ok: true,
              state: "completed", // Принудительно считаем завершенным
              error: null
            };
          }
        } else {
          processingCounter = 0;
        }
        
        // Если не обнаружено признаков завершения, сбрасываем счетчик
        if (!completionDetected) {
          stableStateCounter = 0;
        } else {
          console.log(`[API] Обнаружены признаки завершения: ${stableStateCounter}/3`);
        }
        
        // Проверяем стабильность состояния
        if (stableStateCounter >= 3) {
          console.log("[API] Транзакция завершена успешно");
          return {
            ok: true,
            state: "completed",
            error: null
          };
        }
        
        // Обновляем режим и dh для следующего запроса
        if (statusResponse.ok) {
          if (statusResponse.mode) {
            currentMode = statusResponse.mode;
            this.currentMode = currentMode;
          }
          
          if (statusResponse.dh) {
            currentDh = statusResponse.dh;
            this.currentDh = currentDh;
          }
          
          // Проверяем needUpdate
          if (statusResponse.needUpdate) {
            console.log("[API] Дополнительный запрос из-за needUpdate=true");
            const updateResponse = await this.updatePurchaseStateAsync(reqId, currentMode, currentDh);
            
            if (updateResponse.ok) {
              if (updateResponse.mode) {
                currentMode = updateResponse.mode;
                this.currentMode = currentMode;
              }
              
              if (updateResponse.dh) {
                currentDh = updateResponse.dh;
                this.currentDh = currentDh;
              }
            }
          }
        }
        
        // Проверяем наличие ошибки
        if (statusResponse.state?.status === "error") {
          console.log(`[API] Ошибка в статусе: ${statusResponse.state.msg}`);
          return {
            ok: false,
            state: "error",
            error: statusResponse.state.msg
          };
        }
        
        // Задержка перед следующей проверкой
        await new Promise<void>(resolve => setTimeout(resolve, delayBetweenAttempts));
      } catch (ex) {
        console.log(`[API] Ошибка проверки: ${(ex as Error).message}`);
        await new Promise<void>(resolve => setTimeout(resolve, delayBetweenAttempts));
      }
    }
    
    console.log(`[API] Достигнуто максимальное число попыток (${maxAttempts})`);
    return {
      ok: true,
      state: "timeout",
      error: `Достигнуто максимальное количество попыток (${maxAttempts})`
    };
  }

  /**
   * Получение ссылки для покупки звезд
   * @param account Информация о кошельке
   * @param id Идентификатор запроса покупки
   * @param showSender Показывать ли отправителя (1 - да, 0 - нет)
   * @returns Данные для транзакции
   */
  public async getBuyStarsLinkAsync(
    account: WalletAccount,
    id: string,
    showSender: number
  ): Promise<GetBuyStarsLinkResponse> {
    // Уменьшаем детализацию лога
    console.log(`[FragmentAPI] Получение данных для транзакции ${id}`);
    
    const headers = this.addDefaultHeaders();
    
    // Создаем DeviceInfo
    const deviceInfo: DeviceInfo = {
      platform: "browser",
      appName: "telegram-wallet",
      appVersion: "1",
      maxProtocolVersion: 2,
      features: [
        "SendTransaction",
        {
          name: "SendTransaction",
          maxMessages: 4
        }
      ]
    };
    
    // Сериализуем объекты в строки JSON
    const accountJson = JSON.stringify(account);
    const deviceJson = JSON.stringify(deviceInfo);
    
    const formData = new URLSearchParams();
    formData.append('hash', this._apiHash);
    formData.append('account', accountJson);
    formData.append('device', deviceJson);
    formData.append('transaction', "1");
    formData.append('id', id);
    formData.append('show_sender', showSender.toString());
    formData.append('method', 'getBuyStarsLink');
    
    try {
      const response = await fetch(`${this._baseUrl}/api`, {
        method: 'POST',
        headers,
        body: formData,
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        throw new FragmentApiException(
          `Ошибка при получении данных транзакции: ${response.status} - ${response.statusText}`
        );
      }
      
      const content = await response.text();
      // Не выводим полный ответ
      // console.log(`Ответ данных транзакции: ${content}`);
      
      try {
        const responseObject = JSON.parse(content);
        
        // Проверяем наличие ошибки
        if (responseObject.error) {
          return {
            ok: false,
            error: responseObject.error,
            transaction: { messages: [] }
          };
        }
        
        // Проверяем формат ответа и наличие необходимых полей
        if (!responseObject.transaction || !Array.isArray(responseObject.transaction.messages)) {
          console.error("[FragmentAPI] Неверный формат ответа API");
          
          // Попытка извлечь данные из других полей если возможно
          let messages = [];
          
          // В некоторых ответах данные могут быть в другой структуре
          if (responseObject.result && responseObject.result.transaction && 
              Array.isArray(responseObject.result.transaction.messages)) {
            messages = responseObject.result.transaction.messages;
          }
          
          return {
            ok: true,
            transaction: {
              messages: messages
            }
          };
        }
        
        return {
          ok: true,
          transaction: responseObject.transaction
        };
      } catch (ex) {
        if (ex instanceof FragmentApiException) {
          throw ex;
        }
        throw new FragmentApiException(`Ошибка разбора ответа API: ${(ex as Error).message}`, ex as Error);
      }
    } catch (ex) {
      if (ex instanceof FragmentApiException) {
        throw ex;
      }
      throw new FragmentApiException(`Ошибка при получении данных транзакции: ${(ex as Error).message}`, ex as Error);
    }
  }

  /**
   * Подтверждение транзакции для покупки звезд
   * @param reqId Идентификатор запроса на покупку
   * @param boc Bag of Cells (BOC) транзакции в формате Base64
   * @param account Информация о кошельке
   * @param deviceInfo Информация об устройстве (опционально)
   * @returns True, если подтверждение успешно, иначе False
   */
  public async confirmReqAsync(
    reqId: string, 
    boc: string, 
    account: WalletAccount, 
    deviceInfo?: DeviceInfo
  ): Promise<boolean> {
    console.log(`[FragmentAPI] Подтверждение транзакции ${reqId}`);
    
    const headers = this.addDefaultHeaders({
      'Referer': `${this._baseUrl}/stars/buy?req_id=${reqId}`
    });
    
    // Если устройство не предоставлено, создаем стандартное
    if (!deviceInfo) {
      deviceInfo = {
        platform: "browser",
        appName: "telegram-wallet",
        appVersion: "1",
        maxProtocolVersion: 2,
        features: [
          "SendTransaction",
          {
            name: "SendTransaction",
            maxMessages: 4
          }
        ]
      };
    }
    
    // Сериализуем объекты в строки JSON
    const accountJson = JSON.stringify(account);
    const deviceJson = JSON.stringify(deviceInfo);
    
    const formData = new URLSearchParams();
    formData.append('hash', this._apiHash);
    formData.append('account', accountJson);
    formData.append('device', deviceJson);
    formData.append('boc', boc);
    formData.append('id', reqId);
    formData.append('method', 'confirmReq');
    
    // Удаляем лишние данные в логе
    // console.log(`[API] confirmReq данные: ${formData.toString().substring(0, 100)}...`);
    
    try {
      const response = await fetch(`${this._baseUrl}/api`, {
        method: 'POST',
        headers,
        body: formData,
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        console.log(`[FragmentAPI] Ошибка подтверждения: ${response.status}`);
        return false;
      }
      
      const content = await response.text();
      // Убираем вывод полного содержимого ответа
      // console.log(`[API] confirmReq ответ: ${content}`);
      
      try {
        const responseJson = JSON.parse(content);
        
        if (responseJson.ok === true) {
          console.log("[FragmentAPI] Транзакция успешно подтверждена");
          
          // Добавляем задержку перед началом проверки статуса (возможно, серверу нужно время)
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          return true;
        } else {
          if (responseJson.error) {
            console.log(`[FragmentAPI] Ошибка подтверждения: ${responseJson.error}`);
          }
          return false;
        }
      } catch (ex) {
        console.log(`[FragmentAPI] Ошибка разбора ответа: ${(ex as Error).message}`);
        return false;
      }
    } catch (ex) {
      console.log(`[FragmentAPI] Ошибка запроса: ${(ex as Error).message}`);
      return false;
    }
  }

  /**
   * Получает актуальный курс обмена TON на звезды
   * @param starsAmount Количество звезд для расчета
   * @returns Информация о текущих ценах на звезды
   */
  public async updateStarsPricesAsync(starsAmount: number = 50): Promise<StarsPriceResponse> {
    console.log(`[FragmentAPI] Getting current stars price for ${starsAmount} stars`);
    
    const headers = this.addDefaultHeaders({
      'Referer': `${this._baseUrl}/stars/buy?quantity=${starsAmount}`
    });
    
    const formData = new URLSearchParams();
    formData.append('hash', this._apiHash);
    formData.append('stars', starsAmount.toString());
    formData.append('quantity', starsAmount.toString());
    formData.append('method', 'updateStarsPrices');
    
    try {
      const response = await fetch(`${this._baseUrl}/api`, {
        method: 'POST',
        headers,
        body: formData,
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        throw new FragmentApiException(
          `Error getting stars prices: ${response.status} - ${response.statusText}`
        );
      }
      
      const content = await response.text();
      console.log(`[FragmentAPI] Stars price response received`);
      
      try {
        const responseJson = JSON.parse(content);
        
        if (!responseJson.ok) {
          throw new FragmentApiException(`API returned error in stars price response`);
        }
        
        // Извлекаем цену из HTML-строки
        const curPrice = responseJson.cur_price || "";
        const priceMatch = curPrice.match(/>([\d,.]+)<span class="mini-frac">\.(\d+)<\/span>/);
        
        let tonPriceForStars = 0;
        if (priceMatch && priceMatch.length >= 3) {
          const wholePart = priceMatch[1].replace(/,/g, '');
          const fracPart = priceMatch[2];
          tonPriceForStars = parseFloat(`${wholePart}.${fracPart}`);
        }
        
        // Вычисляем коэффициент конверсии TON в звезды
        const starsPerTon = tonPriceForStars > 0 ? starsAmount / tonPriceForStars : 0;
        
        return {
          ok: responseJson.ok,
          curPrice: responseJson.cur_price,
          optionsHtml: responseJson.options_html,
          dh: responseJson.dh,
          // Добавляем обработанные данные
          tonPrice: tonPriceForStars,
          starsAmount: starsAmount,
          starsPerTon: starsPerTon
        };
      } catch (ex) {
        if (ex instanceof FragmentApiException) {
          throw ex;
        }
        throw new FragmentApiException(`Error parsing stars price API response: ${(ex as Error).message}`, ex as Error);
      }
    } catch (ex) {
      if (ex instanceof FragmentApiException) {
        throw ex;
      }
      throw new FragmentApiException(`Error getting stars prices: ${(ex as Error).message}`, ex as Error);
    }
  }
} 