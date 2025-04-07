## [2024-04-07 11:40] Исправление ESLint ошибок в walletModels.ts

### Обнаруженные проблемы
1. Использование типа `any` в двух интерфейсах:
   - `TransactionResult.additionalData?: any;` (строка 92)
   - `WalletTransaction.additionalData?: any;` (строка 222)

### Выполненные исправления
Заменил тип `any` на более безопасный `Record<string, unknown>` в обоих случаях:

```typescript
// До исправления:
additionalData?: any;

// После исправления:
additionalData?: Record<string, unknown>;
```

### Технические детали
- Тип `any` отключает все проверки типов TypeScript, что делает код менее надежным и предсказуемым.
- `Record<string, unknown>` указывает, что `additionalData` - это объект со строковыми ключами и значениями неизвестного типа.
- Использование `unknown` вместо `any` заставляет разработчика явно проверять тип значений перед их использованием, что повышает безопасность типов.
- Правило линтера `@typescript-eslint/no-explicit-any` предназначено для выявления и устранения мест, где используется `any`, чтобы улучшить типобезопасность кода.

### Преимущества внесенных изменений
1. **Улучшение безопасности типов**: `Record<string, unknown>` заставляет явно проверять типы перед использованием.
2. **Лучшая документация**: Более ясно, что `additionalData` представляет собой объект со строковыми ключами.
3. **Улучшенное автодополнение**: IDE может предоставлять более точное автодополнение при работе с объектом.
4. **Предотвращение ошибок**: Снижается вероятность ошибок из-за неправильных предположений о структуре данных.

### Ссылки
- [TypeScript ESLint no-explicit-any](https://typescript-eslint.io/rules/no-explicit-any)
- [TypeScript Record Type](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)
- [TypeScript unknown vs any](https://mariusschulz.com/blog/the-unknown-type-in-typescript) 