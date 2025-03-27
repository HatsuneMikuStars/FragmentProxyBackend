# Анализ проблемы блокировки SQLite в Fragment Proxy Backend

## [2025-04-01 14:30] Диагностика причин ошибки SQLITE_BUSY: database is locked

### Идентифицированные проблемы

На основе анализа логов и исходного кода выявлено несколько основных причин, вызывающих блокировку базы данных SQLite:

1. **Параллельные транзакции обработки платежей**
   ```
   [Monitor] Found 2 transactions
   query failed: UPDATE "transactions" SET "status" = ?, "errorMessage" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE ("hash" = ? AND "status" = ?) -- PARAMETERS: ["failed", ...]
   error: Error: SQLITE_BUSY: database is locked
   ```

   Происходит ситуация, когда монитор транзакций пытается одновременно обработать несколько транзакций, что приводит к конкурентным запросам записи.

2. **Длительные транзакции без завершения**
   Диагностика застрявших транзакций показывает, что некоторые операции находятся в статусе `processing` длительное время, что блокирует доступ к базе для других операций:
   ```
   [Monitor] Автоматическая разблокировка зависшей транзакции ... (54.2 минут в processing)
   ```

3. **Многократные повторные попытки без достаточной задержки**
   В логах видно, что система делает много быстрых повторных попыток, что может усугублять проблему:
   ```
   [TransactionRepo] Повторная попытка разблокировки ... через 300мс (попытка 1/10)
   ```

### Текущие настройки и их анализ

Конфигурация SQLite в `database.config.ts` уже содержит ряд оптимизаций:

```typescript
extra: {
  busyTimeout: 10000,             // Ожидание 10 секунд при блокировке
  journal: 'WAL',                 // Режим Write-Ahead Logging для снижения блокировок
  synchronous: 'NORMAL',          // Баланс между производительностью и надежностью
  cache: 'SHARED',                // Общий кеш между соединениями
  'cache_size': 8000,             // 8МБ кеш
  'threads': 4,                   // 4 параллельных воркера
  'read_uncommitted': 1           // Разрешение чтения незафиксированных данных
}
```

Однако, несмотря на эти настройки, проблемы с блокировками продолжают возникать.

### Корневые причины проблемы

1. **Неправильное управление транзакциями в TypeORM**
   TypeORM не всегда корректно закрывает транзакции SQLite, особенно при ошибках или исключениях.

2. **Отсутствие разделения операций чтения и записи**
   Одни и те же соединения используются как для чтения, так и для записи, что увеличивает вероятность блокировок.

3. **Агрессивная параллельная обработка транзакций**
   Монитор транзакций пытается обрабатывать несколько транзакций одновременно, не регулируя нагрузку на базу данных.

4. **Недостаточная координация между процессами**
   При наличии нескольких процессов (например, диагностика + обработка) нет механизма координации доступа к базе данных.

### Рекомендуемые решения

#### 1. Улучшение управления соединениями

```typescript
// Создание отдельных соединений для чтения и записи
const readDataSource = new DataSource({
  ...baseConfig,
  type: 'sqlite',
  synchronize: false,
  extra: {
    ...baseConfig.extra,
    readonly: true  // Только для чтения
  }
});

const writeDataSource = new DataSource(baseConfig);
```

#### 2. Внедрение очереди для операций записи

```typescript
// Простая очередь транзакций
class TransactionQueue {
  private queue: Array<() => Promise<any>> = [];
  private isProcessing = false;

  async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    
    const operation = this.queue.shift();
    if (operation) {
      try {
        await operation();
      } catch (error) {
        console.error("Ошибка в очереди транзакций:", error);
      }
    }
    
    this.isProcessing = false;
    this.processQueue();
  }
}
```

#### 3. Увеличение интервалов между повторными попытками

```typescript
// Увеличение экспоненциальной задержки с большей базой
const baseDelay = 1000; // 1 секунда вместо 300мс
const maxDelay = 30000; // Максимальная задержка 30 секунд

const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
```

#### 4. Ограничение параллелизма в мониторе транзакций

```typescript
// Ограничение количества одновременно обрабатываемых транзакций
const MAX_CONCURRENT_TRANSACTIONS = 1; // Обрабатываем только по одной транзакции за раз
let currentlyProcessing = 0;

// Перед обработкой транзакции
if (currentlyProcessing >= MAX_CONCURRENT_TRANSACTIONS) {
  console.log(`[Monitor] Достигнут лимит одновременной обработки, отложенная транзакция: ${hash}`);
  return; // Отложить обработку
}

currentlyProcessing++;
try {
  // Обработка транзакции
} finally {
  currentlyProcessing--;
}
```

### Дополнительные рекомендации

1. **Проверка файла базы данных**
   Возможно файл базы данных поврежден. Рекомендуется создать резервную копию и восстановить структуру:
   ```
   sqlite3 database.sqlite ".backup backup.sqlite"
   ```

2. **Мониторинг длительных транзакций**
   Добавить более агрессивное отслеживание зависших транзакций с автоматическим таймаутом.
   
3. **Проверка использования памяти**
   SQLite хранит весь файл базы в памяти при интенсивной работе. Необходимо убедиться, что система имеет достаточно памяти.

4. **Исследование использования pragma locking_mode**
   ```sql
   PRAGMA locking_mode = EXCLUSIVE;
   ```
   Это может быть временным решением для отладки, хотя снижает параллелизм.

### Заключение

Проблема блокировки базы данных SQLite является многофакторной и требует комплексного подхода. Рекомендуется начать с ограничения параллелизма и внедрения очереди для операций записи, а затем постепенно внедрять остальные решения с тщательным тестированием после каждого изменения.

## Полезные ресурсы
- [SQLite Documentation on Concurrency](https://www.sqlite.org/lockingv3.html)
- [TypeORM Issue: SQLITE_BUSY Handling](https://github.com/typeorm/typeorm/issues/746)
- [Understanding SQLite Busy Errors](https://activesphere.com/blog/2018/12/24/understanding-sqlite-busy)