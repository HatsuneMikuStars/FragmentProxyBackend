import { AppDataSource } from '../src/database';

/**
 * Скрипт для ручного создания таблицы transaction_history
 */
async function createTransactionHistoryTable() {
  try {
    // Инициализируем соединение с базой данных
    console.log('Инициализация соединения с базой данных...');
    await AppDataSource.initialize();
    console.log('Соединение с базой данных успешно установлено.');

    // Создаем таблицу transaction_history с внешним ключом
    console.log('Создание таблицы transaction_history...');
    
    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS "transaction_history" (
        "id" varchar PRIMARY KEY,
        "transactionHash" varchar(64) NOT NULL,
        "previousStatus" varchar(20),
        "newStatus" varchar(20) NOT NULL,
        "action" varchar(50) NOT NULL,
        "data" text,
        "message" text,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY ("transactionHash") REFERENCES "transactions"("hash") ON DELETE CASCADE
      )
    `);
    
    console.log('Создание индекса...');
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TRANSACTION_HISTORY_HASH" ON "transaction_history" ("transactionHash")
    `);
    
    // Добавляем запись о миграции
    console.log('Проверка существования таблицы migrations...');
    const migrationsTableExists = await AppDataSource.query(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'
    `);
    
    if (migrationsTableExists.length > 0) {
      console.log('Добавление записи о миграции...');
      await AppDataSource.query(`
        INSERT INTO "migrations" ("timestamp", "name") 
        VALUES (1747193652000, 'AddTransactionHistory1747193652000')
      `);
    } else {
      console.log('Таблица migrations не существует, запись о миграции не добавлена');
    }

    console.log('Таблица transaction_history успешно создана!');

    // Закрываем соединение
    await AppDataSource.destroy();
    console.log('Соединение с базой данных закрыто.');
    
    process.exit(0);
  } catch (error) {
    console.error('Ошибка при создании таблицы:', error);
    process.exit(1);
  }
}

// Запускаем скрипт
createTransactionHistoryTable(); 