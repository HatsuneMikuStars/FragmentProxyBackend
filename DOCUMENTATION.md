# Fragment TON Stars Purchase - Документация проекта

## Обзор проекта

Fragment-proxy-typescript - это приложение для автоматизированной покупки Telegram Stars через TON кошелек на платформе [Fragment](https://fragment.com/). Проект позволяет программно авторизоваться на платформе Fragment, найти необходимого пользователя, инициировать покупку звезд и выполнить TON-транзакцию на указанную сумму.

### Основные функции

1. Авторизация на Fragment через предоставленные cookies
2. Поиск получателя звезд по имени пользователя
3. Инициализация покупки определенного количества звезд
4. Выполнение TON-транзакции через интегрированный TON кошелек
5. Мониторинг и подтверждение статуса покупки

### Технологический стек

- **Язык программирования**: TypeScript
- **Платформа**: Node.js
- **Инструменты сборки**: yarn, tsc
- **Библиотеки**: 
  - `@ton/ton`: для работы с TON блокчейном и кошельками
  - `@ton/crypto`: для криптографических операций (работа с ключами)
  - Нативный `fetch` для HTTP-запросов

## Архитектура проекта

### Структура проекта

```
fragment-proxy-typescript/
├── dist/                # Скомпилированные JavaScript файлы
├── src/                 # Исходный код TypeScript
│   ├── api/             # Компоненты для работы с API Fragment
│   │   ├── models/      # Модели данных для API
│   │   └── fragmentApiClient.ts # Клиент для работы с API Fragment
│   ├── services/        # Сервисы для бизнес-логики
│   │   └── fragmentStarsPurchaseService.ts # Сервис покупки звезд
│   ├── wallet/          # Компоненты для работы с TON кошельком
│   │   ├── models/      # Модели данных для кошелька
│   │   ├── IWalletService.ts    # Интерфейс сервиса кошелька
│   │   ├── TonWalletService.ts  # Реализация сервиса кошелька
│   │   └── config.ts            # Конфигурация кошелька
│   ├── config.ts        # Глобальный конфигурационный файл
│   └── Program.ts       # Главный файл программы
├── package.json         # Зависимости и скрипты проекта
└── tsconfig.json        # Конфигурация TypeScript
```

### Компоненты системы

#### 1. FragmentApiClient

Компонент для взаимодействия с API Fragment. Отвечает за:
- Авторизацию через cookies
- Поиск получателей для покупки звезд
- Инициализацию запроса на покупку звезд
- Мониторинг статуса покупки
- Получение данных для транзакции
- Подтверждение транзакции

#### 2. TonWalletService

Сервис для работы с TON кошельком. Отвечает за:
- Инициализацию кошелька на основе мнемонической фразы
- Получение адреса кошелька и баланса
- Подготовку и отправку транзакций
- Подпись данных и сообщений

#### 3. FragmentStarsPurchaseService

Сервис высокого уровня, объединяющий работу с Fragment API и TON кошельком. Отвечает за:
- Координацию процесса покупки звезд
- Поиск получателя
- Инициализацию покупки
- Выполнение транзакции
- Мониторинг статуса покупки

#### 4. Конфигурационные компоненты

- `config.ts`: Глобальный конфигурационный файл с настройками Fragment и TON
- `wallet/config.ts`: Специфичные настройки для TON кошелька

## Конфигурационные настройки

### Глобальные настройки (config.ts)

```typescript
export const FRAGMENT_CONFIG = {
  // Базовый URL для API Fragment
  BASE_URL: "https://fragment.com",
  
  // API хеш, используемый для запросов к Fragment
  API_HASH: "0f78530fcefef0af5f",
  
  // Cookies для авторизации в Fragment
  COOKIES: {
    "stel_ssid": "14a75dc083c0679f3d_6928836527378146031",
    "stel_token": "94731c4abdea8663f392b876f8d1c16294731c5094731b44612be24897a791de43f36",
    "stel_ton_token": "X9-urC5VfzxRnpLr4VUZva3aebhq0ijbOTdcf6tVtyf3hMjTj6b3cZqpJ2cSrRHGp7uDA3EV8cXu9l4cvoNikgtgAYWzoIgVPIh-1-eEDYDnEKuJJOiXKKyG-MpRYJaE2mw0cGnav6ilwJ1nDz7Tt8v3xY9jyhyWFolm7SA0erCMXxTYULbKJzyx5yUmCzLvkKz5p-qd",
    "stel_dt": "-240"
  }
};

export const TON_WALLET_CONFIG = {
  // Мнемоническая фраза для кошелька (в production должна загружаться из защищенного источника)
  MNEMONIC: "piano text master maze weapon oxygen umbrella neck tumble shop initial crystal toss excite ramp caution museum lunch reflect believe tiger often sample salon",
  
  // ID подкошелька (обычно 0 или стандартное значение 698983191)
  SUBWALLET_ID: 698983191,
  
  // Флаг использования тестовой сети
  USE_TESTNET: false,
  
  // URL API для взаимодействия с TON
  API_URL: {
    MAINNET: "https://toncenter.com/api/v2/jsonRPC",
    TESTNET: "https://testnet.toncenter.com/api/v2/jsonRPC"
  },
  
  // API ключ для доступа к TON API
  API_KEY: "3050bcc91490a5813b8ed40b4e33685e46b20ace910cc1dc643bdbb4c7885008"
};

// Настройки приложения по умолчанию
export const APP_CONFIG = {
  DEFAULT_USERNAME: "skulidropek",
  DEFAULT_STARS_AMOUNT: 50
};

// Настройки окружения
export const ENV_CONFIG = {
  IS_DEVELOPMENT: true,
  LOG_LEVEL: "debug",
  VERBOSE_HTTP_LOGGING: true
};
```

### Настройки кошелька (wallet/config.ts)

```typescript
export const TON_WALLET_CONFIG_LEGACY: WalletConfig = {
  // Используем настройки из глобальной конфигурации
  mnemonic: TON_WALLET_CONFIG.MNEMONIC,
  subwalletId: TON_WALLET_CONFIG.SUBWALLET_ID,
  useTestnet: TON_WALLET_CONFIG.USE_TESTNET,
  apiKey: TON_WALLET_CONFIG.API_KEY,
  
  // Если нужны определенные URL API
  apiUrl: TON_WALLET_CONFIG.USE_TESTNET 
    ? TON_WALLET_CONFIG.API_URL.TESTNET 
    : TON_WALLET_CONFIG.API_URL.MAINNET,
};
```

## Процесс работы программы

### Алгоритм покупки звезд

1. **Инициализация**:
   - Загрузка конфигурации
   - Создание клиента Fragment API
   - Инициализация TON кошелька

2. **Поиск получателя**:
   - Запрос к API Fragment для поиска пользователя по имени
   - Получение идентификатора получателя

3. **Инициализация покупки**:
   - Запрос к API Fragment для инициализации покупки звезд
   - Получение идентификатора запроса (req_id) и суммы в TON

4. **Получение данных для транзакции**:
   - Запрос к API Fragment для получения деталей транзакции
   - Получение адреса для отправки TON и payload сообщения

5. **Отправка транзакции**:
   - Создание и подписание транзакции с помощью TON кошелька
   - Отправка транзакции в сеть TON

6. **Подтверждение покупки**:
   - Отправка подтверждения транзакции на Fragment
   - Мониторинг статуса покупки до завершения

### Диаграмма процесса

```
Пользователь → Program.ts → FragmentApiClient → TON API
                    ↓
                TonWalletService → TON Blockchain
                    ↓
                FragmentStarsPurchaseService
                    ↓
                Результат покупки
```

## Особенности работы с API Fragment

### Cookies

Для авторизации на Fragment используются cookies, которые включают:
- `stel_ssid`: Идентификатор сессии пользователя
- `stel_token`: Токен авторизации
- `stel_ton_token`: Токен для работы с TON
- `stel_dt`: Параметр часового пояса

### API Hash

Для запросов к API Fragment требуется специальный хеш, который регулярно обновляется на сервере. Необходимо периодически обновлять это значение в конфигурации:

```
API_HASH: "0f78530fcefef0af5f"
```

### Мониторинг статуса

Fragment использует сложную систему мониторинга статуса покупки с несколькими режимами:
- `new`: Начальный режим
- `processing`: Транзакция в процессе обработки
- `done`: Транзакция успешно завершена

## Особенности работы с TON

### Версии кошельков

Проект поддерживает работу с кошельками TON версии V4, но может использоваться и с кошельками V5 с некоторыми ограничениями. При использовании V5 кошелька с контрактом V4 выводится предупреждение:

```
⚠️ Внимание: используется WalletContractV4 для работы с V5 кошельком. Некоторые специфические функции V5 могут быть недоступны.
```

### Генерация адреса кошелька

Адрес кошелька генерируется на основе:
- Мнемонической фразы (24 слова)
- ID подкошелька (698983191 для стандартного кошелька)
- Workchain ID (обычно 0)

## Инструкции по запуску

### Требования

- Node.js 16+
- Yarn или NPM

### Установка зависимостей

```bash
cd fragment-proxy-typescript
yarn install
```

### Сборка проекта

```bash
yarn build
```

### Запуск программы

Базовый запуск с параметрами по умолчанию:
```bash
node dist/Program.js
```

Запуск с указанием получателя и количества звезд:
```bash
node dist/Program.js username 100
```

Где:
- `username`: Имя пользователя получателя (например, skulidropek)
- `100`: Количество звезд для покупки

## Обновление API Fragment

API Fragment может меняться со временем. Необходимо периодически обновлять:

1. **Cookies**: Полученные после авторизации в браузере на Fragment.com
2. **API Hash**: Извлеченный из запросов в DevTools браузера
3. **Базовый URL**: Если изменится домен Fragment

Пример получения актуальных параметров из браузера:

```bash
curl 'https://fragment.com/api?hash=0f78530fcefef0af5f' \
  -H 'accept: application/json, text/javascript, */*; q=0.01' \
  -H 'accept-language: en-US,en;q=0.9,ru;q=0.8' \
  -H 'content-type: application/x-www-form-urlencoded; charset=UTF-8' \
  -b 'stel_ssid=14a75dc083c0679f3d_6928836527378146031; stel_dt=-240; stel_token=94731c4abdea8663f392b876f8d1c16294731c5094731b44612be24897a791de43f36; stel_ton_token=X9-urC5VfzxRnpLr4VUZva3aebhq0ijbOTdcf6tVtyf3hMjTj6b3cZqpJ2cSrRHGp7uDA3EV8cXu9l4cvoNikgtgAYWzoIgVPIh-1-eEDYDnEKuJJOiXKKyG-MpRYJaE2mw0cGnav6ilwJ1nDz7Tt8v3xY9jyhyWFolm7SA0erCMXxTYULbKJzyx5yUmCzLvkKz5p-qd' \
  -H 'origin: https://fragment.com' \
  -H 'referer: https://fragment.com/stars/buy?recipient=SYmKhfM1yKuNJ0jTE2hih97yuH5Nd5R81WjauOFhToxLgGpOei5m8YVCO1C5osJt&quantity=50' \
  -H 'sec-ch-ua: "Not:A-Brand";v="24", "Chromium";v="134"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Linux"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36' \
  -H 'x-requested-with: XMLHttpRequest' \
  --data-raw 'mode=new&lv=false&dh=1648884528&method=updateStarsBuyState'
```

## Обнаруженные проблемы и их решения

### 1. Проблема: Несовместимость между кошельками V4 и V5

**Проблема**: Библиотека `@ton/ton` (версия 15.2.1) не предоставляет прямой доступ к `WalletContractV5`, что вызывает проблемы при работе с кошельками V5.

**Решение**: Используется `WalletContractV4` для взаимодействия с кошельками V5, что обеспечивает базовую функциональность, но ограничивает доступ к специфическим возможностям V5.

### 2. Проблема: Устаревание cookies и API hash

**Проблема**: Cookies авторизации и API hash периодически становятся недействительными.

**Решение**: Реализована возможность обновления этих значений через глобальный конфигурационный файл `config.ts`.

### 3. Проблема: Асинхронный статус покупки звезд

**Проблема**: После отправки транзакции, Fragment не сразу обновляет статус покупки из-за задержек в блокчейне.

**Решение**: Реализован механизм опроса API с гибкими таймаутами и логикой определения завершения покупки на основе нескольких факторов.

## Рекомендации по улучшению

1. **Безопасность конфигурации**:
   - Перенести чувствительные данные (мнемоническая фраза, API ключи) в переменные окружения
   - Реализовать механизм шифрования для хранения мнемонической фразы

2. **Поддержка кошельков V5**:
   - Добавить полноценную поддержку кошельков V5 с использованием специализированных библиотек

3. **Логирование**:
   - Реализовать систему логирования с сохранением в файл для отслеживания операций
   - Добавить различные уровни логирования (debug, info, warn, error)

4. **Улучшение обработки ошибок**:
   - Разработать более детальную систему обработки и отображения ошибок
   - Добавить механизм повторных попыток для нестабильных операций

5. **Профили настроек**:
   - Реализовать разные профили настроек для разных окружений (dev, test, prod)
   - Добавить возможность быстрого переключения между профилями

## Ссылки на документацию

- [Fragment API](https://fragment.com) - Неофициальная, API не документировано публично
- [TON SDK](https://ton.org/docs/) - Официальная документация TON
- [TON API](https://toncenter.com/api/v2/) - API для взаимодействия с TON
- [@ton/ton](https://www.npmjs.com/package/@ton/ton) - NPM пакет для работы с TON 