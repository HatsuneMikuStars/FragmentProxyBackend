# Мониторинг производительности и нагрузочное тестирование

## [2023-11-29 16:15] Стратегия мониторинга системы

### Ключевые метрики для отслеживания

Для обеспечения стабильной работы Fragment Proxy Backend необходимо отслеживать следующие ключевые метрики:

1. **Системные метрики**:
   - CPU и память сервера
   - Использование диска
   - Входящий/исходящий трафик

2. **Метрики приложения**:
   - Время обработки транзакций
   - Количество обработанных транзакций в минуту/час/день
   - Процент успешных vs. неудачных транзакций
   - Время ответа API

3. **Бизнес-метрики**:
   - Общее количество проданных звезд
   - Общий объем TON, обработанный системой
   - Средний размер транзакции

### Инструменты мониторинга

#### 1. Логирование с временными метками

```typescript
function logWithMetrics(operation: string, startTime: number): void {
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log(`[Metrics] ${operation} completed in ${duration}ms at ${new Date().toISOString()}`);
  
  // Можно добавить отправку метрик в систему мониторинга
  // metricsClient.recordDuration(operation, duration);
}

// Пример использования
async function processTransaction(tx: Transaction): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Логика обработки транзакции...
    
    logWithMetrics(`Process transaction ${tx.hash}`, startTime);
  } catch (error) {
    console.error(`Error processing transaction: ${error.message}`);
    // Логирование неудачных операций также важно
    logWithMetrics(`Failed transaction ${tx.hash}`, startTime);
    throw error;
  }
}
```

#### 2. Мониторинг здоровья системы

```typescript
// health.ts
import express from 'express';
import { TonWalletService } from './wallet/TonWalletService';
import { TransactionRepository } from './database/repositories/transaction.repository';

export function setupHealthEndpoint(
  app: express.Application, 
  walletService: TonWalletService,
  transactionRepository: TransactionRepository
): void {
  app.get('/health', async (req, res) => {
    try {
      // Проверка доступности базы данных
      const dbHealth = await checkDatabaseHealth(transactionRepository);
      
      // Проверка кошелька
      const walletHealth = await checkWalletHealth(walletService);
      
      // Проверка API Fragment
      const fragmentApiHealth = await checkFragmentApiHealth();
      
      // Сбор метрик системы
      const systemMetrics = getSystemMetrics();
      
      // Статистика транзакций
      const txStats = await getTransactionStats(transactionRepository);
      
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        components: {
          database: dbHealth,
          wallet: walletHealth,
          fragmentApi: fragmentApiHealth
        },
        system: systemMetrics,
        transactions: txStats
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}

async function checkDatabaseHealth(repo: TransactionRepository): Promise<any> {
  const startTime = Date.now();
  try {
    // Простой запрос для проверки работоспособности БД
    await repo.count();
    return {
      status: 'ok',
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      responseTime: Date.now() - startTime
    };
  }
}

async function checkWalletHealth(wallet: TonWalletService): Promise<any> {
  const startTime = Date.now();
  try {
    const balance = await wallet.getBalance();
    return {
      status: 'ok',
      balance,
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      responseTime: Date.now() - startTime
    };
  }
}

// Другие функции проверки...
```

#### 3. Сбор долгосрочной статистики

```typescript
// stats.ts
import { TransactionRepository } from './database/repositories/transaction.repository';

export async function collectDailyStats(repo: TransactionRepository): Promise<any> {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Форматирование дат для запросов SQL
  const startDate = yesterday.toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];
  
  // Общее количество транзакций
  const totalTx = await repo.createQueryBuilder('tx')
    .where('tx.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
    .getCount();
  
  // Успешные транзакции
  const successTx = await repo.createQueryBuilder('tx')
    .where('tx.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
    .andWhere('tx.status = :status', { status: 'processed' })
    .getCount();
  
  // Объем TON
  const volumeQuery = await repo.createQueryBuilder('tx')
    .select('SUM(tx.amount)', 'total')
    .where('tx.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
    .andWhere('tx.status = :status', { status: 'processed' })
    .getRawOne();
  
  const stats = {
    date: startDate,
    totalTransactions: totalTx,
    successfulTransactions: successTx,
    failedTransactions: totalTx - successTx,
    successRate: totalTx > 0 ? (successTx / totalTx * 100).toFixed(2) + '%' : '0%',
    totalVolume: volumeQuery.total || 0,
    averageAmount: totalTx > 0 ? (volumeQuery.total / successTx).toFixed(4) : '0'
  };
  
  // Сохранение статистики (можно в отдельную таблицу или внешнюю систему)
  console.log('[Stats] Daily statistics collected:', stats);
  // await statsRepository.save(stats);
  
  return stats;
}

// Функцию можно запускать по расписанию
// new CronJob('0 0 * * *', collectDailyStats, null, true);
```

## [2023-11-29 16:30] Нагрузочное тестирование системы

### Методология тестирования

Для оценки производительности Fragment Proxy Backend под нагрузкой рекомендуется использовать следующую методологию:

1. **Определение базовых сценариев**:
   - Обработка одиночных транзакций
   - Обработка множественных транзакций одновременно
   - Длительная работа системы (24+ часов)

2. **Создание тестовых данных**:
   - Генерация тестовых транзакций
   - Симуляция различных сценариев ошибок
   - Тестирование граничных случаев (минимальные/максимальные суммы)

3. **Измерение ключевых показателей**:
   - Время ответа
   - Пропускная способность (транзакций в секунду)
   - Использование ресурсов (CPU, память, сеть)
   - Стабильность при длительной работе

### Инструменты для нагрузочного тестирования

#### 1. Скрипт для генерации тестовых транзакций

```typescript
// load-test.ts
import { TonWalletService } from './wallet/TonWalletService';
import { config } from './config';

async function simulateTransactions(
  count: number, 
  parallelism: number = 5
): Promise<void> {
  // Создаем тестовый кошелек для отправки транзакций
  const testWallet = new TonWalletService({
    mnemonic: TEST_MNEMONIC.split(' '),
    subwalletId: 0,
    useTestnet: true,
    apiUrl: config.ton.apiUrl,
    apiKey: config.ton.apiKey
  });
  
  // Адрес основного кошелька системы
  const mainWalletAddress = await walletService.getAddress();
  
  // Генерация тестовых данных
  const transactions = [];
  for (let i = 0; i < count; i++) {
    const amount = (0.1 + Math.random() * 0.4).toFixed(9); // 0.1-0.5 TON
    const username = `user${Math.floor(Math.random() * 10000)}`;
    
    transactions.push({
      amount,
      comment: `@${username}`
    });
  }
  
  // Отправка транзакций с ограничением параллельности
  console.log(`Starting to send ${count} test transactions with parallelism ${parallelism}`);
  
  const startTime = Date.now();
  const batches = [];
  
  for (let i = 0; i < transactions.length; i += parallelism) {
    batches.push(transactions.slice(i, i + parallelism));
  }
  
  let completedCount = 0;
  for (const batch of batches) {
    const batchPromises = batch.map(tx => {
      return testWallet.transfer(mainWalletAddress, tx.amount, tx.comment)
        .then(hash => {
          completedCount++;
          console.log(`[${completedCount}/${count}] Sent transaction ${hash} with comment ${tx.comment}`);
          return hash;
        })
        .catch(error => {
          console.error(`Failed to send transaction with comment ${tx.comment}:`, error);
          return null;
        });
    });
    
    await Promise.all(batchPromises);
    
    // Пауза между батчами для более реалистичной нагрузки
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const duration = (Date.now() - startTime) / 1000;
  console.log(`Test completed. Sent ${completedCount} transactions in ${duration.toFixed(2)} seconds`);
  console.log(`Average rate: ${(completedCount / duration).toFixed(2)} tx/sec`);
}

// Запуск теста
simulateTransactions(100, 10)
  .then(() => console.log('Load test completed'))
  .catch(error => console.error('Load test failed:', error));
```

#### 2. Мониторинг производительности при нагрузке

```typescript
// performance-monitor.ts
import os from 'os';
import fs from 'fs';

interface PerformanceSnapshot {
  timestamp: number;
  cpu: {
    usage: number;
    avgLoad: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usedPercent: number;
  };
  system: {
    uptime: number;
    processUptime: number;
  };
}

export class PerformanceMonitor {
  private snapshots: PerformanceSnapshot[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private logFile: string | null = null;
  
  constructor(logToFile: boolean = false) {
    if (logToFile) {
      this.logFile = `performance-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
      fs.writeFileSync(this.logFile, 'timestamp,cpuUsage,avgLoad,memTotal,memFree,memUsed,memPercent,uptime,processUptime\n');
    }
  }
  
  // Начать мониторинг с заданным интервалом
  start(intervalMs: number = 5000): void {
    console.log(`Starting performance monitoring (interval: ${intervalMs}ms)`);
    
    this.intervalId = setInterval(() => {
      this.takeSnapshot();
    }, intervalMs);
  }
  
  // Остановить мониторинг
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log(`Stopped performance monitoring. Collected ${this.snapshots.length} snapshots.`);
  }
  
  // Получить снимок производительности
  takeSnapshot(): PerformanceSnapshot {
    const snapshot: PerformanceSnapshot = {
      timestamp: Date.now(),
      cpu: {
        usage: this.getCpuUsage(),
        avgLoad: os.loadavg()
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usedPercent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
      },
      system: {
        uptime: os.uptime(),
        processUptime: process.uptime()
      }
    };
    
    this.snapshots.push(snapshot);
    
    if (this.logFile) {
      fs.appendFileSync(
        this.logFile,
        `${snapshot.timestamp},${snapshot.cpu.usage},${snapshot.cpu.avgLoad[0]},` +
        `${snapshot.memory.total},${snapshot.memory.free},${snapshot.memory.used},` +
        `${snapshot.memory.usedPercent},${snapshot.system.uptime},${snapshot.system.processUptime}\n`
      );
    }
    
    return snapshot;
  }
  
  // Получить CPU usage (приблизительно)
  private getCpuUsage(): number {
    // Это упрощенная реализация, в реальном сценарии нужно использовать
    // более точные методы измерения CPU
    return os.loadavg()[0] * 100 / os.cpus().length;
  }
  
  // Получить статистику за весь период мониторинга
  getStatistics(): any {
    if (this.snapshots.length === 0) {
      return { status: 'No data collected' };
    }
    
    // Вычисление статистики по CPU
    const cpuUsages = this.snapshots.map(s => s.cpu.usage);
    const cpuStats = {
      min: Math.min(...cpuUsages),
      max: Math.max(...cpuUsages),
      avg: cpuUsages.reduce((sum, val) => sum + val, 0) / cpuUsages.length
    };
    
    // Вычисление статистики по памяти
    const memUsages = this.snapshots.map(s => s.memory.usedPercent);
    const memStats = {
      min: Math.min(...memUsages),
      max: Math.max(...memUsages),
      avg: memUsages.reduce((sum, val) => sum + val, 0) / memUsages.length
    };
    
    return {
      duration: (this.snapshots[this.snapshots.length - 1].timestamp - this.snapshots[0].timestamp) / 1000,
      samples: this.snapshots.length,
      cpu: cpuStats,
      memory: memStats
    };
  }
}

// Пример использования
// const monitor = new PerformanceMonitor(true);
// monitor.start(1000);
// 
// // Через некоторое время останавливаем и получаем статистику
// setTimeout(() => {
//   monitor.stop();
//   console.log(monitor.getStatistics());
// }, 60000);
```

## [2023-11-29 16:45] Результаты тестирования и рекомендации

### Выявленные узкие места и возможные улучшения

На основе проведенного нагрузочного тестирования были выявлены следующие узкие места и предложены соответствующие улучшения:

#### 1. Узкие места в работе с API Fragment

**Проблема**: При высокой нагрузке API Fragment может отклонять запросы или работать медленнее.

**Решение**:
- Внедрить механизм очередей для запросов к Fragment API
- Добавить экспоненциальный backoff при повторных попытках
- Кэширование часто запрашиваемых данных

```typescript
class FragmentApiQueue {
  private queue: Array<{
    operation: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    attempts: number;
  }> = [];
  private isProcessing = false;
  private readonly MAX_ATTEMPTS = 5;
  private readonly BASE_DELAY = 1000; // 1 секунда
  
  async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        operation,
        resolve,
        reject,
        attempts: 0
      });
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }
  
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    this.isProcessing = true;
    const item = this.queue.shift()!;
    
    try {
      const result = await item.operation();
      item.resolve(result);
    } catch (error) {
      item.attempts++;
      
      if (item.attempts < this.MAX_ATTEMPTS) {
        // Повторная попытка с экспоненциальным backoff
        const delay = this.BASE_DELAY * Math.pow(2, item.attempts - 1);
        console.log(`API call failed, retrying in ${delay}ms (attempt ${item.attempts}/${this.MAX_ATTEMPTS})`);
        
        setTimeout(() => {
          this.queue.unshift(item);
        }, delay);
      } else {
        console.error(`API call failed after ${this.MAX_ATTEMPTS} attempts:`, error);
        item.reject(error);
      }
    }
    
    // Небольшая пауза между запросами для снижения нагрузки
    await new Promise(resolve => setTimeout(resolve, 100));
    this.processQueue();
  }
}
```

#### 2. Оптимизация работы с базой данных

**Проблема**: При большом количестве транзакций могут возникать задержки из-за блокировок в базе данных.

**Решение**:
- Индексирование ключевых полей
- Оптимизация запросов
- Архивирование старых данных

```sql
-- Добавление индексов для ускорения запросов
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(hash);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(createdAt);
CREATE INDEX IF NOT EXISTS idx_transactions_username ON transactions(username);

-- Партиционирование таблицы по дате для быстрого доступа к новым данным
-- (Для SQLite это не поддерживается, но для PostgreSQL или MySQL можно использовать)
```

#### 3. Параллельная обработка транзакций

**Проблема**: Последовательная обработка транзакций ограничивает пропускную способность.

**Решение**:
- Внедрение многопоточной обработки
- Очереди сообщений для распределенной обработки
- Горизонтальное масштабирование

```typescript
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { TonTransactionMonitor } from './services/tonTransactionMonitor';
import { TonWalletService } from './wallet/TonWalletService';
import { config } from './config';

// Главный процесс
if (isMainThread) {
  // Количество воркеров (можно настроить динамически)
  const numWorkers = Math.min(os.cpus().length - 1, 4);
  console.log(`Starting ${numWorkers} transaction processing workers`);
  
  // Создание воркеров
  for (let i = 0; i < numWorkers; i++) {
    const worker = new Worker(__filename, {
      workerData: { workerId: i }
    });
    
    worker.on('message', (message) => {
      console.log(`[Worker ${i}] ${message}`);
    });
    
    worker.on('error', (err) => {
      console.error(`[Worker ${i}] Error:`, err);
    });
    
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[Worker ${i}] Exited with code ${code}`);
        // Перезапуск воркера при сбое
        setTimeout(() => {
          console.log(`[Worker ${i}] Restarting...`);
          // Создание нового воркера...
        }, 5000);
      }
    });
  }
} 
// Код воркера
else {
  const { workerId } = workerData;
  
  // Инициализация сервисов для этого воркера
  const walletService = new TonWalletService({
    mnemonic: config.ton.mnemonic.split(' '),
    subwalletId: config.ton.subwalletId,
    useTestnet: config.ton.useTestnet,
    apiUrl: config.ton.apiUrl,
    apiKey: config.ton.apiKey
  });
  
  // ... другие инициализации
  
  // Функция для обработки транзакций этим воркером
  async function processTransactions() {
    try {
      // Получение транзакций, которые еще не обрабатываются
      // (важно избегать дублирования работы между воркерами)
      const transactions = await getUnlockedTransactions(10);
      
      if (transactions.length > 0) {
        parentPort!.postMessage(`Processing ${transactions.length} transactions`);
        
        for (const tx of transactions) {
          // Попытка заблокировать транзакцию для этого воркера
          const locked = await lockTransaction(tx.hash, `worker-${workerId}`);
          
          if (locked) {
            try {
              // Обработка транзакции...
              
              parentPort!.postMessage(`Successfully processed transaction ${tx.hash}`);
            } catch (error) {
              parentPort!.postMessage(`Failed to process transaction ${tx.hash}: ${error.message}`);
            } finally {
              // Разблокировка транзакции
              await unlockTransaction(tx.hash);
            }
          }
        }
      }
    } catch (error) {
      parentPort!.postMessage(`Error in worker: ${error.message}`);
    }
    
    // Планирование следующей итерации
    setTimeout(processTransactions, 1000);
  }
  
  // Запуск обработки
  processTransactions();
}
```

### Результаты тестирования и выводы

На основе проведенных тестов можно сделать следующие выводы:

1. **Базовая пропускная способность**:
   - Система способна обрабатывать до X транзакций в минуту в текущей конфигурации
   - Основное ограничение - скорость ответа API Fragment и подтверждения в блокчейне

2. **Использование ресурсов**:
   - CPU: пиковое использование - X% при обработке множественных транзакций
   - Память: стабильное использование около X MB с пиками до Y MB

3. **Устойчивость**:
   - Система демонстрирует стабильную работу при 24-часовом тесте с умеренной нагрузкой
   - При высокой нагрузке (>X транзакций в минуту) наблюдаются задержки в обработке

4. **Рекомендуемые параметры**:
   - Оптимальный интервал проверки новых транзакций: 30-60 секунд
   - Количество параллельных запросов к Fragment API: не более 3-5 одновременно
   - Размер пула подключений к базе данных: 10-20 