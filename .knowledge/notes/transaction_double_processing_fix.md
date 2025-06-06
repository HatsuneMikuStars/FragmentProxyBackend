# Решение проблемы двойной обработки транзакций

## [2025-04-01 15:20] Анализ и исправление двойной обработки транзакций со статусом "failed"

### Описание проблемы

Был выявлен критический баг в системе обработки транзакций: транзакции со статусом "failed" могли обрабатываться повторно, даже если они уже успешно отправили TON на Fragment API. Это приводило к тому, что для одной и той же входящей транзакции пользователь мог получить звезды несколько раз.

Проявление ошибки:
1. Транзакция успешно отправляется на Fragment API с хешем outgoingTransactionHash
2. Fragment API возвращает таймаут при подтверждении, и транзакция попадает в статус "failed"
3. Монитор транзакций обнаруживает транзакцию со статусом "failed" и пытается обработать её снова
4. Происходит повторная отправка TON и пользователь получает звезды дважды

### Внесенные изменения

1. **Добавлена проверка наличия outgoingTransactionHash в методе lockTransaction**:
   ```typescript
   // Если у транзакции уже есть outgoingTransactionHash, значит она уже отправляла средства
   if (tx.outgoingTransactionHash) {
     console.log(`[TransactionRepo] Транзакция ${hash} уже отправляла средства, блокировка не требуется`);
     // Обновляем статус на processed для предотвращения повторной обработки
     tx.status = 'processed';
     tx.errorMessage = 'ERR_ALREADY_PROCESSED: Транзакция уже отправляла средства ранее';
     await this.repository.save(tx);
     return false;
   }
   ```

2. **Модификация метода processTransaction в классе TonTransactionMonitor**:
   ```typescript
   // Проверяем, была ли уже отправка звезд ранее (по наличию outgoingTransactionHash)
   if (existingTransaction.outgoingTransactionHash) {
     console.log(`[Monitor] Скипуем проваленную транзакцию, которая уже отправляла звезды`);
     
     // Меняем статус на processed, чтобы предотвратить повторную обработку
     await this.transactionRepository.updateTransactionAfterStarsPurchase(
       hash,
       existingTransaction.outgoingTransactionHash,
       existingTransaction.fragmentTransactionHash || existingTransaction.outgoingTransactionHash,
       true, // отмечаем как успешную
       'ERR_ALREADY_PROCESSED: Транзакция уже отправляла звезды ранее'
     );
     
     return;
   }
   ```

3. **Модификация метода lockTransaction для транзакций со статусом failed**:
   ```typescript
   // Транзакция имеет исправимую ошибку, но уже обрабатывается - отмечаем её обработанной
   // Это предотвратит повторную обработку той же самой транзакции
   // и решит проблему с двойной отправкой звезд
   tx.status = 'processed';
   tx.errorMessage = 'ERR_ALREADY_PROCESSED: Транзакция уже была обработана ранее';
   await this.repository.save(tx);
   ```

### Изменение жизненного цикла транзакций

После внесенных изменений транзакция может переходить из статуса `failed` напрямую в статус `processed` в следующих случаях:
1. Если у транзакции уже есть outgoingTransactionHash (признак того, что отправка TON уже произошла)
2. При повторном обнаружении транзакции со статусом "failed" и исправимой ошибкой

Это предотвращает повторную обработку транзакций, которые уже отправили средства, но не получили подтверждение от Fragment API.

### Тестирование

Необходимо протестировать следующие сценарии:
1. Транзакция со статусом "failed" и наличием outgoingTransactionHash не должна обрабатываться повторно
2. Транзакция со статусом "failed" и исправимой ошибкой должна обрабатываться только один раз
3. Проверка корректности ведения истории изменений статусов транзакций

### Воздействие на пользователей

Данные изменения устраняют вероятность двойной отправки звезд пользователям, что улучшает финансовую безопасность системы и предотвращает непредусмотренные расходы TON. 