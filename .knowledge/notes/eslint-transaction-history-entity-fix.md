## [2024-04-07 12:10] Исправление ESLint ошибки в transaction-history.entity.ts

### Обнаруженные проблемы
В файле `transaction-history.entity.ts` была обнаружена одна ошибка линтера:
- Использование типа `any` в поле `data: Record<string, any> | null` (строка 44)
- Нарушение правила `@typescript-eslint/no-explicit-any`: "Unexpected any. Specify a different type."

### Выполненные исправления
Заменил тип `any` на более безопасный `unknown`:

```typescript
// До исправления:
data: Record<string, any> | null;

// После исправления:
data: Record<string, unknown> | null;
```

### Технические детали
- Тип `Record<string, unknown>` представляет объект со строковыми ключами и значениями неизвестного типа, что точнее описывает структуру дополнительных данных в истории транзакций.
- Данное изменение согласуется с предыдущими исправлениями в других файлах проекта (`walletModels.ts`, `transaction-history.repository.ts`, `transaction.repository.ts`), где также был заменен тип `any` на `unknown`.
- Использование `unknown` вместо `any` требует явного приведения типов при использовании конкретных свойств объекта, что повышает типобезопасность.

### Преимущества внесенных изменений
1. **Согласованность типов**: В проекте теперь единообразно используется `Record<string, unknown>` для хранения дополнительных данных.
2. **Повышение типобезопасности**: При использовании поля `data` требуется явная проверка типов, что снижает вероятность ошибок.
3. **Совместимость с правилами ESLint**: Код теперь соответствует правилу `@typescript-eslint/no-explicit-any`.
4. **Лучшая документация кода**: Тип `unknown` явно указывает, что содержимое поля требует валидации перед использованием.

### Ссылки
- [TypeScript ESLint no-explicit-any](https://typescript-eslint.io/rules/no-explicit-any)
- [TypeScript Record Type](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)
- [TypeScript unknown vs any](https://mariusschulz.com/blog/the-unknown-type-in-typescript) 