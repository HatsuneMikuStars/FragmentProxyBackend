import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

// Base path for database file
const basePath = process.cwd();
const dbPath = path.join(basePath, process.env.DB_PATH || 'data/database.sqlite');

// Database configuration
export const databaseConfig: DataSourceOptions = {
  type: 'sqlite',
  database: dbPath,
  synchronize: false, // Should be false in production, use migrations instead
  logging: process.env.NODE_ENV === 'development',
  entities: [path.join(__dirname, '../entities/**/*.{js,ts}')],
  migrations: [path.join(__dirname, '../migrations/**/*.{js,ts}')],
  subscribers: [path.join(__dirname, '../subscribers/**/*.{js,ts}')],
};

// Export DataSource for use in application
export const AppDataSource = new DataSource(databaseConfig);

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