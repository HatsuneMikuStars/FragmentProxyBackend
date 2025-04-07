import { DataSource, DataSourceOptions, NamingStrategyInterface, DefaultNamingStrategy } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { v4 } from 'uuid';

// Load environment variables from .env
dotenv.config();

// Custom naming strategy to fix SAVEPOINT issue
export class CustomNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  // Переопределяем метод для создания имени точки сохранения
  generateTemporaryName(): string {
    // Создаем имя без дефисов, которое безопасно для SQLite
    return `temp_${Math.floor(Math.random() * 999999)}`;
  }
  
  // Добавляем метод для именования SAVEPOINT
  generateSavepointName(previousSavepoint?: string): string {
    const uuid = previousSavepoint || v4();
    return `typeorm_sp_${uuid.replace(/-/g, '_')}`;
  }
}

// Base path for database file
const basePath = process.cwd();
const dbPath = path.join(basePath, process.env.DB_PATH || 'data/database.sqlite');

// Database configuration
export const getDatabaseConfig = (): DataSourceOptions => {
  // Базовая конфигурация для всех БД
  const baseConfig: DataSourceOptions = {
    type: 'sqlite',
    database: dbPath,
    synchronize: false, // Should be false in production, use migrations instead
    logging: process.env.NODE_ENV === 'development',
    entities: [path.join(__dirname, '../entities/**/*.{js,ts}')],
    migrations: [path.join(__dirname, '../migrations/**/*.{js,ts}')],
    subscribers: [path.join(__dirname, '../subscribers/**/*.{js,ts}')],
    // Настройка таймаута ожидания при блокировке и дополнительные параметры
    extra: {
      // Таймаут в миллисекундах (10 секунд)
      busyTimeout: 10000,
      // Включаем режим WAL (Write-Ahead Logging), который снижает вероятность блокировок
      journal: 'WAL',
      // Включаем режим синхронизации NORMAL для лучшей производительности
      synchronous: 'NORMAL',
      // Увеличиваем кэш страниц для лучшей производительности
      cache: 'SHARED',
      // Размер кеша в килобайтах
      'cache_size': 8000,
      // Максимальное количество параллельных воркеров
      'threads': 4,
      // Разрешаем чтение во время записи для нескольких соединений
      'read_uncommitted': 1
    }
  };

  // Дополнительные настройки для SQLite
  const dbType = process.env.DB_TYPE || '';
  if (dbType === 'sqlite') {
    return {
      ...baseConfig,
      type: 'sqlite',
      database: process.env.DB_PATH || 'data/database.sqlite',
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      namingStrategy: new CustomNamingStrategy(),
      // Настройка таймаута ожидания при блокировке и дополнительные параметры
      extra: {
        // Таймаут в миллисекундах (10 секунд)
        busyTimeout: 10000,
        // Включаем режим WAL (Write-Ahead Logging), который снижает вероятность блокировок
        journal: 'WAL',
        // Включаем режим синхронизации NORMAL для лучшей производительности
        synchronous: 'NORMAL',
        // Увеличиваем кэш страниц для лучшей производительности
        cache: 'SHARED',
        // Размер кеша в килобайтах
        'cache_size': 8000,
        // Максимальное количество параллельных воркеров
        'threads': 4,
        // Разрешаем чтение во время записи для нескольких соединений
        'read_uncommitted': 1
      }
    };
  }

  // Возвращаем базовую конфигурацию по умолчанию
  return baseConfig;
};

// Export DataSource for use in application
export const AppDataSource = new DataSource(getDatabaseConfig());

// Function to initialize database connection
export async function initializeDatabase(): Promise<DataSource> {
  try {
    if (!AppDataSource.isInitialized) {
      console.log(`[Database] Initializing SQLite database connection: ${dbPath}`);
      await AppDataSource.initialize();
      console.log('[Database] Database connection established');
    }
    return AppDataSource;
  } catch (error) {
    console.error('[Database] Database connection error:', error);
    throw error;
  }
}

// Function to close database connection
export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    console.log('[Database] Database connection closed');
  }
} 