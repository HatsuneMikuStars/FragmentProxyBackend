## [2024-04-07 11:25] Исправление ESLint ошибок в server.ts

### Обнаруженные проблемы
1. Неиспользуемые импорты:
   - `TON_API_CONFIG` - импортирован из ./config, но не используется в коде
   - `initializeDatabase` - импортирован из ./database, но не используется в коде

2. Неиспользуемые переменные:
   - `fragmentApiClient` - объявлена как глобальная переменная, но использовалась только локально
   - `account` - объявлена, но стала ненужной после изменения способа инициализации сервиса

### Выполненные исправления
1. Удалены неиспользуемые импорты:
   ```typescript
   // Было:
   import { ENV_CONFIG, TON_WALLET_CONFIG, TON_API_CONFIG, FRAGMENT_CONFIG, TRANSACTION_MONITOR_CONFIG } from './config';
   import { initializeDatabase, ensureDatabaseReady, AppDataSource } from './database';
   
   // Стало:
   import { ENV_CONFIG, TON_WALLET_CONFIG, FRAGMENT_CONFIG, TRANSACTION_MONITOR_CONFIG } from './config';
   import { ensureDatabaseReady, AppDataSource } from './database';
   ```

2. Изменена работа с FragmentApiClient:
   - Удалена глобальная переменная `fragmentApiClient` из списка глобальных переменных
   - Переделан код инициализации с использованием локальной переменной
   - Добавлен поясняющий комментарий, почему переменная локальная, а не глобальная

3. Изменен способ инициализации FragmentStarsPurchaseService:
   ```typescript
   // Было:
   const account = await tonWalletService.getWalletAccount();
   starsPurchaseService = new FragmentStarsPurchaseService(
     FRAGMENT_CONFIG.COOKIES,
     account.address,
     account.publicKey,
     account.walletStateInit,
     FRAGMENT_CONFIG.BASE_URL,
     {},
     tonWalletService
   );
   
   // Стало:
   starsPurchaseService = await FragmentStarsPurchaseService.createFromWalletService(
     fragmentApiClient,
     tonWalletService
   );
   ```

### Технические детали
- Использование статического фабричного метода `createFromWalletService` вместо конструктора позволяет получить более чистый код
- При использовании фабричного метода нет необходимости получать и передавать отдельно данные аккаунта, что уменьшает дублирование кода
- Локальное использование переменной `fragmentApiClient` вместо глобальной улучшает инкапсуляцию и уменьшает область видимости
- Удаление неиспользуемых импортов делает код чище и улучшает производительность компиляции

### Ссылки
- [TypeScript ESLint no-unused-vars](https://typescript-eslint.io/rules/no-unused-vars)
- [Factory Method Pattern](https://refactoring.guru/design-patterns/factory-method) 