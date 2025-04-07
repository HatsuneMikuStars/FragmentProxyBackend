## [2024-04-07 12:00] Исправление TypeScript ошибок в tonTransactionMonitor.ts

### Обнаруженные проблемы
1. Несоответствие типов данных между методами в разных классах:
   - В методе `getTransactionHistory` класса `TransactionRepository` возвращаемый тип был изменен на `Array<{timestamp, action, statusChange, message, data}>`, но соответствующий метод в `TonTransactionMonitor` ожидал другую структуру.
   - В методе `diagnoseStuckTransactions` было обращение к несуществующему свойству `history.history.length`, так как переменная `history` больше не содержит свойство `history`.

### Выполненные исправления
1. Обновил возвращаемый тип метода `getTransactionHistory` в классе `TonTransactionMonitor`:

```typescript
// До исправления:
public async getTransactionHistory(hash: string): Promise<{
  transaction: Transaction;
  history: {
    id: number;
    action: string;
    newStatus: string;
    previousStatus: string | null;
    message: string | null;
    data: Record<string, unknown> | null;
    createdAt: Date;
  }[];
}>

// После исправления:
public async getTransactionHistory(hash: string): Promise<Array<{
  timestamp: string;
  action: string;
  statusChange: string;
  message: string | null;
  data: Record<string, unknown> | null;
}>>
```

2. Исправил обращение к свойству `history.history.length` в методе `diagnoseStuckTransactions`:

```typescript
// До исправления:
historyRecordsCount: history.history.length

// После исправления:
historyRecordsCount: history.length
```

### Технические детали
- Изменения согласованы с недавним обновлением типов в файле `transaction.repository.ts`, где был уточнён возвращаемый тип метода `getTransactionHistory`.
- После обновления типов метод `getTransactionHistory` в обоих классах возвращает одинаковую структуру данных, что обеспечивает типовую совместимость.
- Теперь переменная `history` представляет собой массив записей истории, а не объект с свойством `history`, что соответствует фактической структуре данных возвращаемой из репозитория.

### Преимущества внесенных изменений
1. **Типовая согласованность**: Обеспечено соответствие типов между взаимодействующими компонентами.
2. **Предотвращение ошибок времени выполнения**: Исправленные типы предотвращают обращение к несуществующим свойствам.
3. **Повышение надежности**: Компилятор TypeScript теперь может правильно проверять типы при работе с историей транзакций.
4. **Улучшение разработки**: Разработчики получают корректные подсказки IntelliSense при работе с методами.

### Связанные изменения
Эти исправления являются дополнением к предыдущим изменениям, внесенным в классы `TransactionRepository` и `TransactionHistoryRepository`, где тип `any` был заменен на более безопасный `Record<string, unknown>`.

### Ссылки
- [TypeScript Interface](https://www.typescriptlang.org/docs/handbook/interfaces.html)
- [TypeScript Array Type](https://www.typescriptlang.org/docs/handbook/basic-types.html#array) 