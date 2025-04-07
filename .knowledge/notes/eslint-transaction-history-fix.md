## [2024-04-07 11:45] Исправление ESLint ошибок в transaction-history.repository.ts

### Обнаруженные проблемы
1. Использование типа `any` в двух местах:
   - В параметре `data?: Record<string, any>` метода `addHistoryRecord` (строка 36)
   - В типе возвращаемого значения `data: Record<string, any> | null` метода `getFormattedHistory` (строка 67)

### Выполненные исправления
Заменил тип `any` на более безопасный `unknown` в обоих случаях:

```typescript
// До исправления:
data?: Record<string, any>
data: Record<string, any> | null;

// После исправления:
data?: Record<string, unknown>
data: Record<string, unknown> | null;
```

### Технические детали
- Тип `Record<string, unknown>` представляет объект со строковыми ключами и значениями неизвестного типа, что точнее описывает структуру дополнительных данных в истории транзакций.
- Для сохранения согласованности в кодовой базе, этот подход применен так же, как и в предыдущих исправлениях в файле `walletModels.ts`.
- Использование `unknown` вместо `any` требует явных проверок типа перед использованием конкретных свойств, что повышает безопасность типов.
- При работе с данными из БД, `unknown` обеспечивает дополнительный уровень безопасности, заставляя производить валидацию данных перед их использованием.

### Потенциальное влияние
Данное изменение может потребовать также обновления типа поля `data` в сущности `TransactionHistory` и соответствующей колонки в базе данных, чтобы обеспечить полную типовую согласованность.

### Ссылки
- [TypeScript ESLint no-explicit-any](https://typescript-eslint.io/rules/no-explicit-any)
- [TypeScript Record Type](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)
- [TypeScript unknown vs any](https://mariusschulz.com/blog/the-unknown-type-in-typescript) 