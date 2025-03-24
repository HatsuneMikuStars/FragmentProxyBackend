import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения из .env
dotenv.config();

// Базовый путь для файла базы данных
const basePath = process.cwd();
const dbPath = path.join(basePath, process.env.DB_PATH || 'data/database.sqlite');

// Конфигурация базы данных
export const databaseConfig: DataSourceOptions = {
  type: 'sqlite',
  database: dbPath,
  synchronize: false, // В продакшене должно быть false, используйте миграции
  logging: process.env.NODE_ENV === 'development',
  entities: [path.join(__dirname, '../entities/**/*.{js,ts}')],
  migrations: [path.join(__dirname, '../migrations/**/*.{js,ts}')],
  subscribers: [path.join(__dirname, '../subscribers/**/*.{js,ts}')],
};

// Экспортируем DataSource для использования в приложении
export const AppDataSource = new DataSource(databaseConfig);

// Функция для инициализации подключения к базе данных
export async function initializeDatabase(): Promise<DataSource> {
  try {
    if (!AppDataSource.isInitialized) {
      console.log(`[Database] Инициализация подключения к SQLite базе данных: ${dbPath}`);
      await AppDataSource.initialize();
      console.log('[Database] Подключение к базе данных успешно установлено');
    }
    return AppDataSource;
  } catch (error) {
    console.error('[Database] Ошибка при подключении к базе данных:', error);
    throw error;
  }
}

// Функция для закрытия подключения к базе данных
export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    console.log('[Database] Подключение к базе данных закрыто');
  }
} 