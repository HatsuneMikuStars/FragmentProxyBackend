# Жизненный цикл статусов транзакций в Fragment Proxy

## [2023-11-29 14:30] Детальное описание статусов и переходов

### Доступные статусы транзакций

В системе Fragment Proxy Backend используются следующие статусы для отслеживания жизненного цикла транзакций:

1. **`pending`** — начальный статус; транзакция только что обнаружена и ожидает обработки
2. **`processing`** — транзакция находится в процессе обработки; система выполняет покупку звезд 
3. **`processed`** — транзакция успешно обработана; звезды были куплены и отправлены пользователю
4. **`failed`** — транзакция не была обработана из-за ошибки

### Диаграмма жизненного цикла

```
           ┌─────────┐                    
           │         │                    
           │ pending │                    
           │         │                    
           └────┬────┘                    
                │                         
                ▼                         
        ┌───────────────┐                 
        │               │                 
        │  processing   │                 
        │               │                 
        └───────┬───────┘                 
                │                         
                ▼                         
┌───────────────────────────────────┐     
│                                   │     
│             failed                │     
│                                   │     
└───────────────────────────────────┘     
                │                         
                │       ┌─────────────────┐
                │       │                 │
                └──────►│   processed     │
                        │                 │
                        └─────────────────┘
```

### Переходы между статусами

#### 1. `pending` → `processing`
Происходит, когда система начинает обработку транзакции:
```typescript
// Fragment Proxy: src/services/tonTransactionMonitor.ts
transaction.status = 'processing';
await this.transactionRepository.save(transaction);
```

#### 2. `processing` → `processed`
Транзакция успешно обработана, звезды отправлены:
```typescript
// После успешной обработки
transaction.status = 'processed';
transaction.fragmentTransactionHash = fragmentTxHash;
await this.transactionRepository.save(transaction);
```

#### 3. `processing` → `failed`
Транзакция не может быть обработана из-за ошибки:
```typescript
// При возникновении ошибки
transaction.status = 'failed';
transaction.errorMessage = error.message;
await this.transactionRepository.save(transaction);
```

#### 4. `failed` → `processing` (повторная обработка)
Транзакция с retryable-ошибкой может быть обработана повторно:
```typescript
if (transaction && transaction.status === 'failed') {
  // Проверяем, является ли ошибка подходящей для повторной обработки
  const isNonRetryableError = NON_RETRYABLE_ERRORS.some(error => 
    transaction.errorMessage?.includes(error)
  );
  
  if (!isNonRetryableError) {
    console.log(`[Monitor] Повторная обработка транзакции: ${hash}`);
    transaction.status = 'processing';
    await this.transactionRepository.save(transaction);
    // Продолжаем обработку
  } else {
    console.log(`[Monitor] Пропуск транзакции с не-повторяемой ошибкой: ${hash}`);
    return;
  }
}
```

### Неповторяемые ошибки (Non-retryable)

Система определяет следующие типы ошибок как не подлежащие повторной обработке:

```typescript
const NON_RETRYABLE_ERRORS = [
  'Invalid username',
  'Invalid username format',
  'Username not found',
  'Stars amount should be at least 50',
  'Stars amount exceeds maximum limit',
  'Invalid comment format'
];
```

Эти ошибки фундаментальны и не зависят от временных технических проблем, поэтому повторная обработка транзакций с такими ошибками не имеет смысла.

### Повторяемые ошибки (Retryable)

Примеры ошибок, при которых повторная обработка может быть успешной:

1. **Временные сбои сети**:
   ```
   Failed to fetch: Network error
   ```

2. **Недоступность сервиса Fragment**:
   ```
   Service unavailable: Fragment API returned 503
   ```

3. **Проблемы с кошельком**:
   ```
   Wallet service error: Could not send transaction
   ```

4. **Временные ошибки авторизации**:
   ```
   Authorization failed: Session expired
   ```

## [2023-11-29 14:45] Рекомендации по обработке статусов

### Мониторинг и оповещения

Для эффективного отслеживания проблемных транзакций рекомендуется:

1. **Настроить мониторинг для транзакций, "застрявших" в статусе `processing`**:
   ```sql
   SELECT * FROM transactions 
   WHERE status = 'processing' 
   AND updatedAt < datetime('now', '-30 minutes');
   ```

2. **Регулярные проверки транзакций в статусе `failed`**:
   ```sql
   SELECT errorMessage, COUNT(*) as count 
   FROM transactions 
   WHERE status = 'failed' 
   GROUP BY errorMessage 
   ORDER BY count DESC;
   ```

3. **Отслеживание времени обработки транзакций**:
   ```sql
   SELECT 
     AVG(unixepoch(updatedAt) - unixepoch(createdAt)) as avg_processing_time_seconds
   FROM transactions 
   WHERE status = 'processed' 
   AND createdAt > datetime('now', '-24 hours');
   ```

### Улучшение обработки ошибок

1. **Категоризация ошибок**:
   ```typescript
   function categorizeError(error: Error): 'retryable' | 'non-retryable' | 'unknown' {
     if (NON_RETRYABLE_ERRORS.some(msg => error.message.includes(msg))) {
       return 'non-retryable';
     }
     
     if (error.message.includes('network') || 
         error.message.includes('timeout') || 
         error.message.includes('503')) {
       return 'retryable';
     }
     
     return 'unknown';
   }
   ```

2. **Автоматическое восстановление после сбоев**:
   ```typescript
   // В начале работы сервиса
   async function recoverStuckTransactions() {
     const stuckTransactions = await transactionRepository.find({
       where: {
         status: 'processing',
         updatedAt: LessThan(new Date(Date.now() - 30 * 60 * 1000))
       }
     });
     
     for (const tx of stuckTransactions) {
       tx.status = 'pending'; // Возвращаем в очередь на обработку
       await transactionRepository.save(tx);
       console.log(`[Recovery] Reset stuck transaction: ${tx.hash}`);
     }
   }
   ```

### Улучшение блокировки транзакций

Для предотвращения одновременной обработки одной транзакции несколькими процессами:

```typescript
async function lockTransaction(hash: string): Promise<boolean> {
  try {
    await database.query(`
      UPDATE transactions 
      SET status = 'processing', updatedAt = CURRENT_TIMESTAMP 
      WHERE hash = ? AND status NOT IN ('processing', 'processed')
    `, [hash]);
    
    const affected = this.changes;
    return affected > 0;
  } catch (error) {
    console.error(`[Lock] Failed to lock transaction ${hash}:`, error);
    return false;
  }
}
```

## [2023-11-29 15:00] Статистика и аналитика статусов

### SQL-запросы для анализа состояния системы

#### 1. Распределение транзакций по статусам

```sql
SELECT 
  status, 
  COUNT(*) as count, 
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM transactions), 2) as percentage
FROM transactions
GROUP BY status
ORDER BY count DESC;
```

#### 2. Среднее время обработки транзакций

```sql
SELECT 
  ROUND(AVG(JULIANDAY(updatedAt) - JULIANDAY(createdAt)) * 24 * 60, 2) as avg_minutes
FROM transactions
WHERE status = 'processed';
```

#### 3. Анализ ошибок по типам

```sql
SELECT 
  CASE 
    WHEN errorMessage LIKE '%Invalid username%' THEN 'Username Error'
    WHEN errorMessage LIKE '%Stars amount%' THEN 'Stars Amount Error'
    WHEN errorMessage LIKE '%network%' OR errorMessage LIKE '%timeout%' THEN 'Network Error'
    WHEN errorMessage LIKE '%wallet%' THEN 'Wallet Error'
    WHEN errorMessage LIKE '%Fragment%' THEN 'Fragment API Error'
    ELSE 'Other Error'
  END as error_category,
  COUNT(*) as count
FROM transactions
WHERE status = 'failed'
GROUP BY error_category
ORDER BY count DESC;
```

#### 4. Исторический анализ успешности обработки

```sql
SELECT 
  DATE(createdAt) as date,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as success,
  ROUND(SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
FROM transactions
GROUP BY DATE(createdAt)
ORDER BY date DESC;
``` 