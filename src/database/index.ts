// Импортируем необходимые модули для работы с базой данных
import 'reflect-metadata'; // Обязательный импорт для TypeORM
import { AppDataSource, initializeDatabase, closeDatabase } from './config/database.config';

// Экспорт основных сущностей и репозиториев
// По мере добавления новых моделей, добавляйте их экспорт здесь
export * from './entities/transaction.entity';
export * from './repositories/transaction.repository';

// Экспорт основного интерфейса для работы с базой данных
export {
  AppDataSource,
  initializeDatabase,
  closeDatabase
};

// Функция для проверки существования таблиц и выполнения миграций при необходимости
export async function ensureDatabaseReady(): Promise<void> {
  try {
    const dataSource = await initializeDatabase();
    
    // Проверяем, нужно ли выполнить миграции
    const pendingMigrations = await dataSource.showMigrations();
    if (pendingMigrations) {
      console.log('[Database] Обнаружены ожидающие миграции, выполняем...');
      await dataSource.runMigrations();
      console.log('[Database] Миграции успешно выполнены');
    } else {
      console.log('[Database] Миграции не требуются');
    }
    
    console.log('[Database] База данных готова к использованию');
  } catch (error) {
    console.error('[Database] Ошибка при подготовке базы данных:', error);
    throw error;
  }
} 