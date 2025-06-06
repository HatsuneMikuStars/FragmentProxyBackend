# Исследование и внедрение системы обнаружения подозрительных транзакций в TON

## [2025-04-01 17:55] Исследование проблемы подозрительных транзакций в TON

### Основные типы подозрительных транзакций в сети TON:

1. **Спам-транзакции с нулевой или малой суммой**
   - Часто содержат подозрительные ссылки в комментариях
   - Используются для фишинга и доставки вредоносного контента
   - Характерны наличием URL или Telegram-ссылок

2. **"Bounce" транзакции**
   - Используют механизм возврата средств в TON блокчейне
   - Могут эксплуатировать ошибки в логике обработки транзакций бирж
   - Параметр `bounce:true` в деталях транзакции

3. **Фейковые NFT и токены**
   - Рассылка поддельных NFT с вредоносными ссылками
   - Отправка фейковых токенов с целью обмана пользователей
   - Часто маскируются под популярные проекты экосистемы (Notcoin, DOGS, Hamster Kombat)

4. **Мошеннические транзакции с обманчивыми комментариями**
   - Использование Comment-поля для создания ложного впечатления
   - Пример: "Received +5,000 USDT" для создания иллюзии получения средств
   - Коварное использование психологических триггеров: "free", "win", "prize", "giveaway"

### Источники информации:

- Официальная документация TON Keeper (Tonkeeper)
- Аналитика от TON Guard (tonguard.org)
- Отчеты о мошенничестве от CoinsDo
- Официальная информация от TON Foundation

## [2025-04-01 18:15] Реализация системы обнаружения подозрительных транзакций

### Архитектура решения:

```
┌─────────────────────┐     ┌──────────────────────────┐
│ TonWalletService    │     │                          │
├─────────────────────┤     │                          │
│ + getTransactions() │────>│ Список всех транзакций   │
│                     │     │                          │
└─────────────────────┘     └──────────────────────────┘
         │                             │
         │                             │
         ▼                             ▼
┌─────────────────────┐     ┌──────────────────────────┐
│ isSuspicious        │     │ getTransactionsWithSuspiciousCheck│
│ Transaction()       │<────│                          │
└─────────────────────┘     └──────────────────────────┘
         │                             │
         │                             │
         ▼                             ▼
┌─────────────────────┐     ┌──────────────────────────┐
│ Проверка на паттерны │     │ Возврат отфильтрованных │
│ подозрительности    │     │ и подозрительных        │
└─────────────────────┘     │ транзакций              │
                            └──────────────────────────┘
```

### Реализованные проверки:

1. **Проверка суммы транзакции**:
   - Подозрительными считаются транзакции с суммой менее 0.01 TON (10,000,000 nanoTON)
   - Малая сумма сама по себе не является маркером спама, но в сочетании с другими признаками

2. **Анализ комментариев**:
   - Регулярные выражения для обнаружения подозрительных паттернов
   - Проверка наличия URL и Telegram-ссылок
   - Обнаружение ключевых слов, связанных с мошенничеством

3. **Обнаружение "bounce" транзакций**:
   - Проверка параметра `bounce` в дополнительных данных транзакции

4. **Проверка адресов отправителей**:
   - Сравнение с базой известных адресов мошенников
   - В полноценной имплементации требуется регулярное обновление базы

### Улучшения для будущих версий:

1. **Расширенные эвристики**:
   - Анализ временных паттернов транзакций
   - Графовый анализ связей между адресами

2. **Интеграция с внешними источниками данных**:
   - API для получения актуальных списков мошеннических адресов
   - Сервисы для проверки репутации адресов (TON Guard)

3. **Машинное обучение**:
   - Создание модели для автоматического обнаружения новых типов мошенничества
   - Использование функций времени, объема и частоты транзакций

## [2025-04-01 18:35] Тестирование и интеграция

### Логика тестирования:
1. Сначала реализовал основной код в `TonWalletService.ts`
2. Добавил 2 новых метода:
   - `isSuspiciousTransaction()` - определяет подозрительность одной транзакции
   - `getTransactionsWithSuspiciousCheck()` - получает и фильтрует транзакции

3. Обновил главный файл программы для демонстрации работы системы:
   - Вывод всех транзакций
   - Отдельный вывод подозрительных транзакций с подробной информацией

### Результаты интеграции:
- Система успешно обнаруживает подозрительные транзакции
- Минимальное влияние на производительность
- Гибкий интерфейс для дальнейшего расширения функциональности

## [2025-04-01 18:50] Рекомендации для пользователей

1. **Лучшие практики безопасности**:
   - Не переходить по ссылкам из транзакционных комментариев
   - С осторожностью относиться к любым предложениям "выигрышей", "аирдропов" и "бесплатных токенов"
   - Проверять детали транзакций перед их подтверждением

2. **Работа с подозрительными NFT и токенами**:
   - Не отправлять их на другие адреса (это может распространить спам)
   - Использовать функцию скрытия в кошельке
   - Проверять известные коллекции через официальные источники

3. **Проверка комментариев**:
   - Comment-поле используется только для идентификации и не отражает действие транзакции
   - Не доверять обещаниям получения средств в комментариях

## [2025-04-01 19:00] Заключение

Внедрение системы обнаружения подозрительных транзакций значительно повышает безопасность пользователей TON кошелька. Реализованный алгоритм позволяет идентифицировать основные типы мошеннических схем и предотвращать потенциальные угрозы. Дальнейшее развитие системы должно включать машинное обучение и интеграцию с внешними источниками данных о репутации адресов. 