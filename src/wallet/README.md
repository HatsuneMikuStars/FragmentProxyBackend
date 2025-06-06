# Интеграция TON кошелька для автоматической покупки звезд на Fragment

Эта интеграция позволяет автоматически отправлять транзакции через программный TON кошелек для покупки звезд на платформе Fragment без необходимости ручного подтверждения транзакций.

## Архитектура

```
┌─────────────────────┐      ┌──────────────────────┐
│                     │      │                      │
│  Fragment API       │<─────┤ Автоматический       │
│  Client             │      │ сервис покупки звезд │
│                     │      │                      │
└─────────────────────┘      └───────────┬──────────┘
                                         │
                                         ▼
┌─────────────────────┐      ┌──────────────────────┐
│                     │      │                      │
│  TON Blockchain     │<─────┤ TON Wallet Service   │
│                     │      │                      │
└─────────────────────┘      └──────────────────────┘
```

## Компоненты

1. **Модели кошелька** - Определяют структуру данных для работы с кошельком
2. **Интерфейс WalletService** - Определяет контракт для сервиса кошелька
3. **TonWalletService** - Реализация сервиса для работы с TON кошельком
4. **Конфигурация кошелька** - Хранение настроек и доступа к кошельку
5. **AutoWalletFragmentStarsPurchaseService** - Сервис для автоматической покупки звезд

## Настройка

1. Заполните конфигурацию кошелька в `src/wallet/config.ts`:
   - Добавьте мнемоническую фразу вашего кошелька
   - Укажите API ключ для TON API (можно получить у @tonapibot в Telegram)

2. Заполните параметры в `src/walletApp.ts`:
   - Укажите ваш аккаунт Fragment
   - Укажите ID получателя звезд
   - Установите количество звезд для покупки
   - Добавьте необходимые cookies для аутентификации в Fragment

## Безопасность

**ВАЖНО!** В реальном рабочем окружении:

1. НЕ храните мнемоническую фразу в исходном коде
2. Используйте сервисы для хранения секретов (Key Vault, Secret Manager и т.д.)
3. Загружайте чувствительные данные из переменных окружения
4. Используйте отдельный кошелек с ограниченным балансом для автоматизации

## Использование

```typescript
// Инициализация компонентов
const fragmentClient = new FragmentApiClient(cookies, baseUrl);
const walletConfig = await loadWalletConfig();
const walletService = new TonWalletService();

await walletService.initializeWallet(walletConfig);
const purchaseService = await FragmentStarsPurchaseService.createFromWalletService(fragmentClient, walletService);

// Покупка звезд
const result = await purchaseService.purchaseStarsAsync(username, amount);
```

## Запуск

Для запуска примера автоматической покупки звезд выполните:

```bash
npm run build
node dist/walletApp.js
```

## Обработка ошибок

Сервис имеет встроенную обработку ошибок и механизмы повторных попыток:

1. Повторные попытки отправки транзакций с экспоненциальной задержкой
2. Проверка статуса в блокчейне перед подтверждением успешности
3. Мониторинг статуса покупки через API Fragment
4. Стабилизация статуса для исключения ложных срабатываний 