# Улучшение системы отслеживания транзакций в проекте Fragment Proxy

## [2024-06-15 20:30] Анализ текущей структуры и выявленные ограничения

### Текущая структура отслеживания транзакций

В текущей реализации проекта предусмотрено отслеживание транзакций следующим образом:

1. **Входящая TON транзакция** (поле `hash`) - TON транзакция на кошелек сервиса
2. **Fragment транзакция** (поле `fragmentTransactionHash`) - хеш транзакции, выполненной в системе Fragment

Важный процесс обновления информации о транзакции после покупки звезд:

```typescript
// Метод в TransactionRepository
async updateTransactionAfterStarsPurchase(
  hash: string, 
  fragmentTxHash: string, 
  success: boolean,
  errorMessage?: string
): Promise<Transaction | null> {
  const transaction = await this.findByHash(hash);
  if (!transaction) return null;

  transaction.fragmentTransactionHash = fragmentTxHash;
  transaction.status = success ? 'processed' : 'failed';
  if (errorMessage) {
    transaction.errorMessage = errorMessage;
  }

  return await this.repository.save(transaction);
}
```

### Выявленные ограничения

При анализе кода и транзакций в базе данных выявлены следующие ограничения:

1. **Неполное отслеживание TON транзакций** - система сохраняет хеш входящей TON транзакции, но не сохраняет хеш исходящей TON транзакции на адрес Fragment
   
2. **Неявное различие между типами транзакций** - `hash` и `fragmentTransactionHash` хранятся в разных полях, но логическая связь между ними не очевидна

3. **Недостаточная полнота данных** - при просмотре истории транзакций невозможно проследить полную цепочку: входящая TON → исходящая TON → Fragment транзакция

### Примеры из реальных данных

Из предоставленного скриншота базы данных видно, что некоторые транзакции имеют следующую структуру:

```
hash: uY0zn+aaXPC34Es9KKMl5hxDjxBLXI0OQLszaoxP264=
amount: 0.69096012
senderAddress: EQAYDqED-rEu18UGFQT56P6nrq9l4Ik_Dci4LwiXgmEKjHBA
status: processed
fragmentTransactionHash: [отсутствует или null]
```

Также видны транзакции с корректно заполненными полями `fragmentTransactionHash`, например:

```
hash: [какой-то хеш]
amount: 0.25
senderAddress: EQCYwUqSjneabEutANoh3tZPzq2pbBXZj-Uiqe0g_zzUpAEO
username: skulidropek
status: processing
```

Однако отсутствует информация о хеше исходящей TON транзакции на адрес Fragment, который важен для полной отслеживаемости.

## [2024-06-15 20:45] Предлагаемые улучшения

### 1. Добавление нового поля в модель Transaction

Необходимо добавить поле `outgoingTransactionHash` для хранения хеша исходящей транзакции:

```typescript
/**
 * Хеш исходящей TON транзакции на адрес Fragment
 */
@Column({ type: 'varchar', length: 64, nullable: true })
outgoingTransactionHash: string | null;
```

### 2. Модификация метода updateTransactionAfterStarsPurchase

Обновить метод для сохранения хеша исходящей транзакции:

```typescript
async updateTransactionAfterStarsPurchase(
  hash: string, 
  outgoingTxHash: string,
  fragmentTxHash: string, 
  success: boolean,
  errorMessage?: string
): Promise<Transaction | null> {
  const transaction = await this.findByHash(hash);
  if (!transaction) return null;

  transaction.outgoingTransactionHash = outgoingTxHash;
  transaction.fragmentTransactionHash = fragmentTxHash;
  transaction.status = success ? 'processed' : 'failed';
  if (errorMessage) {
    transaction.errorMessage = errorMessage;
  }

  return await this.repository.save(transaction);
}
```

### 3. Обновление сервиса TonTransactionMonitor

Модифицировать вызов метода в TonTransactionMonitor для передачи хеша исходящей транзакции:

```typescript
// При успешной покупке
await this.transactionRepository.updateTransactionAfterStarsPurchase(
  hash,
  result.outgoingTransactionHash || "", // Новый параметр
  result.transactionHash || "",
  true
);

// При ошибке
await this.transactionRepository.updateTransactionAfterStarsPurchase(
  hash,
  result.outgoingTransactionHash || "", // Новый параметр
  result.transactionHash || "",
  false,
  errorMsg
);
```

### 4. Обновление модели PurchaseResult

Добавить новое поле в интерфейс PurchaseResult:

```typescript
export interface PurchaseResult {
  success: boolean;
  transactionHash?: string;
  outgoingTransactionHash?: string; // Новое поле
  amount?: number;
  status?: string;
  recipientId?: string;
  starsAmount?: number;
  error?: string;
}
```

### 5. Обновление UI компонентов

Модифицировать компоненты интерфейса для отображения всех трех хешей транзакций:

1. Хеш входящей транзакции (`hash`)
2. Хеш исходящей транзакции (`outgoingTransactionHash`)
3. Хеш транзакции в Fragment (`fragmentTransactionHash`)

### Преимущества предлагаемых изменений

1. **Полная прослеживаемость** - возможность отследить всю цепочку транзакций от поступления TON до получения звезд
2. **Улучшение аналитики** - более детальная информация для анализа и аудита
3. **Упрощение отладки** - при возникновении проблем будет доступна полная информация
4. **Повышение прозрачности** - пользователи могут видеть все этапы обработки их платежей

## [2024-06-15 21:00] План внедрения

1. Создание миграции для добавления нового поля в таблицу transactions
2. Обновление entity модели
3. Модификация repository методов
4. Обновление сервисов для поддержки нового поля
5. Обновление UI компонентов
6. Тестирование и валидация

### ASCII-Диаграмма улучшенного процесса отслеживания транзакций

```
Входящая TON транзакция       Исходящая TON транзакция      Fragment транзакция
       (hash)              (outgoingTransactionHash)    (fragmentTransactionHash)
         │                            │                            │
         ▼                            ▼                            ▼
    ┌─────────┐                 ┌─────────┐                 ┌─────────┐
    │Получение│ ──────────────▶ │Отправка │ ──────────────▶ │ Покупка │
    │  TON    │                 │  TON    │                 │  звезд  │
    └─────────┘                 └─────────┘                 └─────────┘
``` 