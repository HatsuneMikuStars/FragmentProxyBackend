# Fragment Proxy TypeScript API

Прокси API для работы с Fragment, написанный на TypeScript. Позволяет автоматически конвертировать TON в звезды и отправлять их пользователям Telegram.

## Установка

```bash
yarn install
```

## Настройка конфигурации

1. Скопируйте файл шаблона конфигурации и заполните его своими данными:
```bash
cp src/config.example.ts src/config.ts
```

2. Отредактируйте файл `src/config.ts` и укажите:
   - Cookies для авторизации на Fragment (получите их после авторизации в браузере)
   - API хеш Fragment (можно найти в запросах при инспекции сетевого трафика)
   - Мнемоническую фразу вашего TON кошелька (для безопасности используйте переменные окружения)
   - API ключ TON (получите его от @tonapibot в Telegram)
   - Другие настройки при необходимости

3. Создайте или отредактируйте файл `.env`:
```bash
# Общие настройки приложения
NODE_ENV=development

# Настройки базы данных
DB_PATH=data/database.sqlite

# Настройки сервера
PORT=3000
```

**ВАЖНО**: Файлы `src/config.ts` и `.env` содержат чувствительные данные, они добавлены в `.gitignore` и не должны включаться в контроль версий.

## Запуск

Для запуска API сервера:

```bash
# Разработка с автоматической перезагрузкой при изменениях
yarn dev:api

# Продакшн
yarn build
yarn start:api
```

По умолчанию API будет доступен по адресу: http://localhost:3000

## Функциональность

### Мониторинг транзакций TON

Сервис автоматически мониторит входящие транзакции на кошелек и отправляет звезды указанным пользователям.

- При отправке TON на кошелек сервиса, **укажите в комментарии имя пользователя Telegram** (например, `@username`).
- Сервис автоматически конвертирует полученные TON в звезды и отправит их указанному пользователю.
- Курс конвертации и минимальная сумма настраиваются в конфигурации.

### База данных

Сервис использует SQLite для хранения информации о транзакциях. База данных автоматически создается при первом запуске сервиса. 

Место хранения базы данных можно настроить через переменную окружения `DB_PATH` в файле `.env`.

## API Endpoints

### GET /api/wallet-address

Получение адреса кошелька для отправки TON.

**Успешный ответ:**
```json
{
    "success": true,
    "data": {
        "address": "string",     // Адрес кошелька TON
        "instructions": "Отправьте TON на этот адрес и укажите в комментарии свой Telegram-username"
    }
}
```

**Ошибка:**
```json
{
    "success": false,
    "error": "string"      // Сообщение об ошибке
}
```

### GET /api/transactions/stats

Получение статистики по транзакциям.

**Успешный ответ:**
```json
{
    "success": true,
    "data": {
        "totalCount": 10,                   // Общее количество транзакций
        "processedCount": 8,                // Количество успешно обработанных транзакций
        "failedCount": 2,                   // Количество транзакций с ошибками
        "totalStars": 500,                  // Общее количество отправленных звезд
        "totalTon": "10.000000000",         // Общая сумма полученных TON
        "averageStarsPerTransaction": 62,   // Среднее количество звезд на транзакцию
        "successRate": 80                   // Процент успешных транзакций
    }
}
```

### GET /api/transactions

Получение списка транзакций с пагинацией.

**Параметры:**
- `page` (число, опционально) - номер страницы, по умолчанию 1
- `limit` (число, опционально) - количество транзакций на странице, по умолчанию 10

**Успешный ответ:**
```json
{
    "success": true,
    "data": {
        "transactions": [
            {
                "hash": "string",
                "amount": 1.5,
                "senderAddress": "string",
                "comment": "string",
                "username": "string",
                "starsAmount": 75,
                "fragmentTransactionHash": "string",
                "status": "processed",
                "errorMessage": null,
                "gasFee": 0.004,
                "amountAfterGas": 1.496,
                "exchangeRate": 50.123,
                "createdAt": "2023-03-25T12:00:00.000Z",
                "updatedAt": "2023-03-25T12:01:00.000Z"
            }
            // Другие транзакции...
        ],
        "pagination": {
            "total": 25,       // Общее количество транзакций
            "page": 1,         // Текущая страница
            "limit": 10,       // Количество транзакций на странице
            "pages": 3         // Общее количество страниц
        }
    }
}
```

## Автоматический мониторинг транзакций

### Как это работает

1. **Отправка TON**: Пользователь отправляет TON на адрес кошелька сервиса.
2. **Указание получателя**: В комментарии к транзакции пользователь указывает имя пользователя Telegram (например, `@username`).
3. **Обработка транзакции**: Сервис мониторит входящие транзакции и обрабатывает их автоматически.
4. **Конвертация**: Сервис конвертирует полученные TON в звезды по заданному курсу.
5. **Отправка звезд**: Звезды автоматически отправляются указанному пользователю Telegram.
6. **Сохранение в базу данных**: Информация о транзакции сохраняется в базе данных SQLite.

### Настройка мониторинга

В файле `src/config.ts` есть раздел `TRANSACTION_MONITOR_CONFIG` с настройками:

```typescript
export const TRANSACTION_MONITOR_CONFIG = {
  // Интервал проверки транзакций в миллисекундах (по умолчанию 1 минута)
  CHECK_INTERVAL_MS: 60 * 1000,
  
  // Минимальное количество звезд, которое можно купить (соответствует API Fragment)
  MIN_STARS: 50,
  
  // Максимальное количество звезд, которое можно купить за один раз (соответствует API Fragment)
  MAX_STARS: 1000000,
  
  // Автоматический запуск монитора при старте приложения
  AUTO_START: true,
  
  // Фиксированная комиссия за газ в TON, которая вычитается из суммы транзакции перед расчетом звезд
  GAS_FEE: 0.004
};
```

### Комиссия за газ

Система автоматически учитывает комиссию за газ при обработке транзакций:

1. **Фиксированная комиссия 0.004 TON**: Из каждой входящей транзакции вычитается 0.004 TON на покрытие расходов на газ.
2. **Реальная сумма для покупки звезд**: После вычета комиссии за газ оставшаяся сумма используется для расчета количества звезд.
3. **Пример расчета**: 
   - Пользователь отправляет 1 TON
   - Комиссия за газ: 0.004 TON
   - Сумма для покупки звезд: 0.996 TON
   - При курсе 243 звезды за 1 TON: получится примерно 242 звезды (0.996 * 243 = 242.03)

При планировании отправки транзакций, пользователям рекомендуется учитывать эту комиссию, особенно для небольших сумм.

## Безопасность

1. **Не храните чувствительные данные в коде**: Используйте переменные окружения или защищенные хранилища.
2. **Не включайте файл конфигурации в репозиторий**: Файлы `src/config.ts` и `.env` добавлены в `.gitignore`.
3. **Регулярно обновляйте токены**: Для большей безопасности регулярно обновляйте токены авторизации. 