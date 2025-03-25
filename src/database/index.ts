// Import required modules for database operations
import 'reflect-metadata'; // Required import for TypeORM
import { AppDataSource, initializeDatabase, closeDatabase } from './config/database.config';

// Export main entities and repositories
// Add exports for new models here as they are created
export * from './entities/transaction.entity';
export * from './repositories/transaction.repository';

// Export main database interface
export {
  AppDataSource,
  initializeDatabase,
  closeDatabase
};

// Function to check table existence and run migrations if needed
export async function ensureDatabaseReady(): Promise<void> {
  try {
    const dataSource = await initializeDatabase();
    
    // Check if migrations need to be run
    const pendingMigrations = await dataSource.showMigrations();
    if (pendingMigrations) {
      console.log('[Database] Pending migrations detected, running...');
      await dataSource.runMigrations();
      console.log('[Database] Migrations completed successfully');
    } else {
      console.log('[Database] No migrations needed');
    }
    
    console.log('[Database] Database ready for use');
  } catch (error) {
    console.error('[Database] Error preparing database:', error);
    throw error;
  }
} 