## [2024-04-07 10:40] Исправление ESLint ошибок в TonWalletService.ts

### Обнаруженные проблемы
1. Неиспользуемые импорты:
   - `toNano` и `SendMode` импортированы, но не используются в коде

2. Использование явного типа `any`:
   - Параметры и переменные с типом `any` без надлежащей типизации
   - Обработчики ошибок и преобразования объектов использовали `any`

3. Неиспользуемые переменные:
   - `msgParams` - определена, но не используется в методе sendTransaction
   - `transactionHash` - параметр в методе checkTransactionStatus, но не используется
   - `safeJsonStringify` - функция определена, но не используется
   - Неиспользуемые параметры ошибок (`e`, `err`, `error`)

4. Небезопасное регулярное выражение:
   - Регулярное выражение `[\x00-\x7F]` содержало управляющий символ `\x00`

### Выполненные исправления
1. Удалены неиспользуемые импорты:
   ```typescript
   - import { TonClient, WalletContractV4, beginCell, toNano, internal, Address, SendMode } from '@ton/ton';
   + import { TonClient, WalletContractV4, beginCell, internal, Address } from '@ton/ton';
   ```

2. Заменен тип `any` на более конкретные типы:
   - `unknown` с проверкой типа
   - `Record<string, unknown>` для объектов неизвестной структуры
   - Добавлены проверки типов с использованием `typeof` и `in`

3. Удалены неиспользуемые переменные:
   - Удалена неиспользуемая переменная `msgParams`
   - Удален неиспользуемый параметр `transactionHash` из метода checkTransactionStatus
   - Удалена неиспользуемая функция `safeJsonStringify`
   - Заменены обращения к параметрам обработчиков ошибок на пустой блок catch: `catch {}`

4. Заменено небезопасное регулярное выражение:
   ```typescript
   - if (decoded && decoded.length > 0 && /^[\u0000-\u007F]*$/.test(decoded)) {
   + if (decoded && decoded.length > 0 && /^[A-Za-z0-9\s!-~]*$/.test(decoded)) {
   ```
   Новое выражение проверяет только печатаемые ASCII символы, что безопаснее и соответствует правилам ESLint.

### Технические детали
- Улучшена типизация с использованием узких типов и проверок типов в рантайме
- Добавлены правильные обработчики ошибок с преобразованием неизвестных ошибок в строки
- Исправлено регулярное выражение, которое вызывало ошибку "no-control-regex"
- Безопасно модифицированы методы без изменения основной функциональности

### Ссылки
- [TypeScript ESLint no-explicit-any](https://typescript-eslint.io/rules/no-explicit-any)
- [TypeScript ESLint no-unused-vars](https://typescript-eslint.io/rules/no-unused-vars)
- [ESLint no-control-regex](https://eslint.org/docs/latest/rules/no-control-regex) 