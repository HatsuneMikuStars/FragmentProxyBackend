# Код для улучшения обработки ошибок Fragment API

## [2024-07-17 20:15] Расширенная обработка ошибок Fragment API

Ниже представлены варианты кода для улучшения обработки ошибок во взаимодействии с Fragment API:

### 1. Проверка валидности сессии

```typescript
/**
 * Проверяет валидность сессии Fragment API
 * @returns true, если сессия валидна, иначе false
 */
public async checkSessionValidAsync(): Promise<boolean> {
  try {
    // Используем updatePurchaseStateAsync как легкий и информативный запрос
    // для проверки валидности сессии
    const response = await this.updatePurchaseStateAsync(
      "session_check", // Идентификатор запроса
      "new",           // Режим запроса
      "",              // Пустой dh
      true             // Флаг проверки сессии
    );
    
    // Если ответ содержит ошибку авторизации, сессия недействительна
    if (!response.ok && 
        (response.error?.includes("auth") || 
         response.error?.includes("session") || 
         response.error === "Unknown error")) {
      console.log("[FragmentAPI] Сессия недействительна: " + response.error);
      return false;
    }
    
    // Даже если есть другие ошибки, но не связанные с авторизацией,
    // считаем сессию валидной
    return true;
  } catch (error) {
    console.error("[FragmentAPI] Ошибка при проверке сессии:", (error as Error).message);
    return false;
  }
}
```

### 2. Расширенная обработка ошибок в getBuyStarsLinkAsync

```typescript
/**
 * Получение ссылки для покупки звезд с расширенной обработкой ошибок
 * @param account Информация о кошельке
 * @param id Идентификатор запроса покупки
 * @param showSender Показывать ли отправителя
 * @returns Данные для транзакции
 */
public async getBuyStarsLinkAsync(
  account: WalletAccount,
  id: string,
  showSender: number
): Promise<GetBuyStarsLinkResponse> {
  console.log(`[FragmentAPI] Получение данных для транзакции ${id}`);
  
  // Проверяем валидность сессии перед запросом
  if (!(await this.checkSessionValidAsync())) {
    return {
      ok: false,
      error: "Недействительная сессия. Пожалуйста, обновите авторизационные данные",
      transaction: { messages: [] }
    };
  }
  
  const headers = this.addDefaultHeaders();
  
  // Создаем DeviceInfo с более подробной информацией для уменьшения отказов
  const deviceInfo: DeviceInfo = {
    platform: "browser",
    appName: "telegram-wallet",
    appVersion: "1.27.0", // Обновляем до последней версии
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
      // Более детальная обработка HTTP-ошибок
      const errorDetails = `${response.status} - ${response.statusText}`;
      // При ошибке 401/403 - проблема с авторизацией
      if (response.status === 401 || response.status === 403) {
        console.error(`[FragmentAPI] Ошибка авторизации: ${errorDetails}`);
        return {
          ok: false,
          error: `Ошибка авторизации: необходимо обновить сессию`,
          transaction: { messages: [] }
        };
      }
      // При ошибке 429 - превышен лимит запросов
      if (response.status === 429) {
        console.error(`[FragmentAPI] Превышен лимит запросов: ${errorDetails}`);
        return {
          ok: false,
          error: `Превышен лимит запросов, повторите позже`,
          transaction: { messages: [] }
        };
      }
      // Общая ошибка HTTP
      throw new FragmentApiException(
        `Ошибка при получении данных транзакции: ${errorDetails}`
      );
    }
    
    const content = await response.text();
    
    try {
      const responseObject = JSON.parse(content);
      
      // Проверяем наличие ошибки
      if (responseObject.error) {
        // Расширенная обработка специфических ошибок
        if (responseObject.error === "Unknown error") {
          console.error("[FragmentAPI] Получена 'Unknown error', возможно истекла сессия");
          // Пытаемся обновить состояние для диагностики
          await this.updatePurchaseStateAsync(id, "new", "");
        } else if (responseObject.error.includes("invalid hash")) {
          console.error("[FragmentAPI] Недействительный API hash");
        }
        
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
    // Для обработки таймаута и сетевых ошибок
    if ((ex as Error).name === 'AbortError') {
      console.error("[FragmentAPI] Превышено время ожидания ответа");
      return {
        ok: false,
        error: `Превышено время ожидания ответа от Fragment API`,
        transaction: { messages: [] }
      };
    }
    
    throw new FragmentApiException(`Ошибка при получении данных транзакции: ${(ex as Error).message}`, ex as Error);
  }
}
```

### 3. Автоматическое обновление сессии при сбое

```typescript
/**
 * Обертка для выполнения API запроса с автоматическим обновлением сессии при ошибке
 * @param apiCall Функция вызова API
 * @param maxRetries Максимальное количество повторных попыток
 * @returns Результат вызова API
 */
public async withSessionRefreshAsync<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 1
): Promise<T> {
  try {
    // Пытаемся выполнить запрос
    return await apiCall();
  } catch (error) {
    // Если это не ошибка сессии или превышено количество попыток, пробрасываем
    if (maxRetries <= 0 || 
        !((error as Error).message.includes('Unknown error') || 
          (error as Error).message.includes('session') || 
          (error as Error).message.includes('auth'))) {
      throw error;
    }
    
    console.log("[FragmentAPI] Попытка обновления сессии после ошибки");
    
    // Проверяем наличие запасного набора куки
    if (this._backupCookies) {
      console.log("[FragmentAPI] Переключение на запасной набор куки");
      this._cookies = { ...this._backupCookies };
      
      // Рекурсивно вызываем с уменьшенным счетчиком повторов
      return await this.withSessionRefreshAsync(apiCall, maxRetries - 1);
    }
    
    // Если нет запасных куки, пробрасываем ошибку
    throw new FragmentApiException(
      "Ошибка сессии, требуется ручное обновление авторизационных данных",
      error as Error
    );
  }
}
```

### 4. Класс для хранения нескольких наборов куки

```typescript
/**
 * Хранилище для множественных наборов куки Fragment API
 */
export class FragmentCookieStore {
  private _sessions: Record<string, Record<string, string>>[] = [];
  private _currentIndex: number = 0;
  
  /**
   * Добавляет новый набор куки в хранилище
   * @param name Название набора
   * @param cookies Куки для добавления
   */
  public addSession(name: string, cookies: Record<string, string>): void {
    this._sessions.push({
      name,
      ...cookies
    });
  }
  
  /**
   * Получает текущий активный набор куки
   * @returns Активный набор куки или undefined, если нет доступных наборов
   */
  public getCurrentSession(): Record<string, string> | undefined {
    if (this._sessions.length === 0) {
      return undefined;
    }
    
    return this._sessions[this._currentIndex];
  }
  
  /**
   * Переключается на следующий доступный набор куки
   * @returns Новый активный набор куки или undefined, если нет доступных наборов
   */
  public rotateSession(): Record<string, string> | undefined {
    if (this._sessions.length === 0) {
      return undefined;
    }
    
    // Переключаемся на следующий набор
    this._currentIndex = (this._currentIndex + 1) % this._sessions.length;
    
    return this.getCurrentSession();
  }
  
  /**
   * Проверяет, есть ли доступные сессии для ротации
   * @returns true, если есть альтернативные сессии
   */
  public hasAlternativeSessions(): boolean {
    return this._sessions.length > 1;
  }
}
```

### 5. Улучшенная обработка ошибок в покупке звезд

```typescript
/**
 * Покупка звезд для пользователя с расширенной обработкой ошибок
 * @param username Имя пользователя
 * @param starsAmount Количество звезд
 * @returns Результат покупки
 */
public async purchaseStarsAsync(username: string, starsAmount: number): Promise<PurchaseResult> {
  try {
    console.log(`[Fragment] Начало процесса покупки ${starsAmount} звезд для пользователя @${username}`);
    
    // Проверка валидности сессии перед началом цепочки операций
    if (!(await this._fragmentClient.checkSessionValidAsync())) {
      throw new Error("Недействительная сессия. Необходимо обновить авторизационные данные");
    }
    
    // Остальной код метода...
    
  } catch (error) {
    console.error(`[Fragment] КРИТИЧЕСКАЯ ОШИБКА при покупке звезд: ${(error as Error).message}`);
    console.error(`[Fragment] Стек вызовов: ${(error as Error).stack}`);
    
    // Классифицируем ошибку для более информативного сообщения
    let errorMessage = (error as Error).message;
    let errorType = "ERR_UNKNOWN_ERROR";
    
    if (errorMessage.includes("Недействительная сессия") || 
        errorMessage.includes("Unknown error") ||
        errorMessage.includes("auth")) {
      errorType = "ERR_SESSION_INVALID";
      errorMessage = "Недействительная сессия. Пожалуйста, обновите авторизационные данные в файле .env";
    } else if (errorMessage.includes("recipient") || 
               errorMessage.includes("пользовател")) {
      errorType = "ERR_INVALID_RECIPIENT";
      errorMessage = `Пользователь @${username} не найден или недоступен для отправки звезд`;
    } else if (errorMessage.includes("средств") || 
               errorMessage.includes("баланс")) {
      errorType = "ERR_INSUFFICIENT_FUNDS";
      errorMessage = "Недостаточно средств на балансе кошелька для выполнения операции";
    }
    
    return {
      success: false,
      error: errorMessage,
      errorType: errorType
    };
  }
}
```

### 6. Код для обновления куки из файла

```typescript
/**
 * Обновляет куки из сохраненного файла
 * @param filePath Путь к файлу с куки
 * @returns true, если обновление успешно, иначе false
 */
public async updateCookiesFromFileAsync(filePath: string): Promise<boolean> {
  try {
    // Проверка существования файла
    if (!fs.existsSync(filePath)) {
      console.error(`[FragmentAPI] Файл с куки не найден: ${filePath}`);
      return false;
    }
    
    // Чтение содержимого файла
    const fileContent = await fs.promises.readFile(filePath, 'utf8');
    
    // Парсинг JSON
    const cookiesData = JSON.parse(fileContent);
    
    // Проверка структуры
    if (!cookiesData.stel_ssid || !cookiesData.stel_token || !cookiesData.stel_ton_token) {
      console.error(`[FragmentAPI] Неверный формат файла с куки`);
      return false;
    }
    
    // Обновление куки
    this._cookies = {
      "stel_ssid": cookiesData.stel_ssid,
      "stel_token": cookiesData.stel_token,
      "stel_ton_token": cookiesData.stel_ton_token,
      "stel_dt": cookiesData.stel_dt || "-240"
    };
    
    // Обновление API hash, если он присутствует
    if (cookiesData.api_hash) {
      this._apiHash = cookiesData.api_hash;
    }
    
    console.log(`[FragmentAPI] Куки успешно обновлены из файла ${filePath}`);
    return true;
  } catch (error) {
    console.error(`[FragmentAPI] Ошибка при обновлении куки из файла: ${(error as Error).message}`);
    return false;
  }
}
```

### 7. Периодический задача проверки сессии

```typescript
/**
 * Запускает периодическую проверку сессии
 * @param intervalMinutes Интервал проверки в минутах
 * @returns Функция для остановки мониторинга
 */
public startSessionMonitoring(intervalMinutes: number = 30): () => void {
  console.log(`[FragmentAPI] Запуск мониторинга сессии с интервалом ${intervalMinutes} минут`);
  
  // Конвертируем минуты в миллисекунды
  const intervalMs = intervalMinutes * 60 * 1000;
  
  // Запускаем периодическую проверку
  const intervalId = setInterval(async () => {
    console.log(`[FragmentAPI] Выполнение плановой проверки сессии`);
    const isValid = await this.checkSessionValidAsync();
    
    if (!isValid) {
      console.warn(`[FragmentAPI] Сессия недействительна! Пожалуйста, обновите авторизационные данные`);
      
      // Здесь можно добавить код для автоматического обновления из резервного набора
      // или отправки уведомления администратору
    } else {
      console.log(`[FragmentAPI] Сессия действительна`);
    }
  }, intervalMs);
  
  // Возвращаем функцию для остановки мониторинга
  return () => {
    clearInterval(intervalId);
    console.log(`[FragmentAPI] Мониторинг сессии остановлен`);
  };
}
```

## Рекомендуемая имплементация в существующий код

Для улучшения обработки ошибок в существующем коде, рекомендуется следующий план имплементации:

1. Добавить метод `checkSessionValidAsync` в класс `FragmentApiClient`
2. Обновить метод `getBuyStarsLinkAsync` с расширенной обработкой ошибок
3. Добавить метод `withSessionRefreshAsync` для автоматического восстановления сессии
4. Расширить интерфейс `PurchaseResult` с добавлением поля `errorType`
5. Реализовать класс для управления множественными наборами куки (опционально)
6. Добавить метод для периодического мониторинга сессии
7. Обновить логику обработки ошибок в методе `purchaseStarsAsync`

Внесение этих изменений значительно повысит надежность работы с Fragment API и упростит диагностику возникающих проблем. 