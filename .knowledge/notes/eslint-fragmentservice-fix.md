## [2024-04-07 11:10] Исправление ESLint ошибок в fragmentStarsPurchaseService.ts

### Обнаруженные проблемы
1. Неиспользуемые импорты:
   - `Recipient` - импортирован из apiModels, но не используется в коде
   - `InsufficientBalanceException` - импортирован из purchaseModels, но не используется
   - `TRANSACTION_MONITOR_CONFIG` и `FRAGMENT_CONFIG` - импортированы из конфигурации, но не используются

2. Неиспользуемые переменные:
   - `initialState` - переменная получала результат вызова функции, но нигде не использовалась
   - `error` в блоке catch метода decodePayload - параметр исключения не использовался в коде обработчика

### Выполненные исправления
1. Удалены неиспользуемые импорты:
   ```typescript
   // Было:
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
   
   import { TRANSACTION_MONITOR_CONFIG, FRAGMENT_CONFIG } from '../config';
   
   // Стало:
   import { 
     FragmentApiException,
     WalletAccount
   } from '../apiClient/models/apiModels';
   
   import {
     PurchaseResult,
     PurchaseState,
     PurchaseServiceOptions
   } from './models/purchaseModels';
   ```

2. Исправлено использование результата функции без присваивания переменной:
   ```typescript
   // Было:
   const initialState = await this._fragmentClient.updatePurchaseStateAsync("", "new", "");
   
   // Стало:
   await this._fragmentClient.updatePurchaseStateAsync("", "new", "");
   ```

3. Использование параметра ошибки в блоке catch для логирования:
   ```typescript
   // Было:
   } catch (error) {
     return "[НЕ УДАЛОСЬ ДЕКОДИРОВАТЬ PAYLOAD: " + payloadBase64 + "]";
   }
   
   // Стало:
   } catch (decodeError) {
     console.error('[Fragment] Ошибка при декодировании payload:', decodeError);
     return "[НЕ УДАЛОСЬ ДЕКОДИРОВАТЬ PAYLOAD: " + payloadBase64 + "]";
   }
   ```

### Технические детали
- Удаление неиспользуемых импортов улучшает производительность компиляции и уменьшает размер итогового бандла.
- Переименование переменной `error` на более конкретное имя `decodeError` улучшает читаемость и понимание кода.
- Добавление логирования ошибки в случае проблем с декодированием помогает в отладке.
- Для функций, результат которых не используется (как `updatePurchaseStateAsync`), предпочтительнее вызывать их без присваивания переменной, что делает код чище и предотвращает предупреждения линтера.

### Ссылки
- [TypeScript ESLint no-unused-vars](https://typescript-eslint.io/rules/no-unused-vars)
- [ESLint Best Practices - Variables](https://eslint.org/docs/rules/no-unused-vars) 