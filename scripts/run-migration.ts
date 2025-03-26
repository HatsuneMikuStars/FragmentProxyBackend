import { AppDataSource } from '../src/database';

/**
 * Скрипт для запуска миграций базы данных
 */
async function runMigrations() {
  try {
    // Инициализируем соединение с базой данных
    console.log('Инициализация соединения с базой данных...');
    await AppDataSource.initialize();
    console.log('Соединение с базой данных успешно установлено.');

    // Запускаем миграции
    console.log('Запуск миграций...');
    const migrations = await AppDataSource.runMigrations();
    
    console.log(`Успешно выполнено ${migrations.length} миграций:`);
    migrations.forEach((migration, index) => {
      console.log(`${index + 1}. ${migration.name}`);
    });

    // Закрываем соединение
    await AppDataSource.destroy();
    console.log('Соединение с базой данных закрыто.');
    
    process.exit(0);
  } catch (error) {
    console.error('Ошибка при выполнении миграций:', error);
    process.exit(1);
  }
}

// Запускаем миграции
runMigrations(); 