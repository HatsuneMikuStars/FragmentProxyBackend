import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRoutes from './api/routes';
import { ENV_CONFIG, TON_WALLET_CONFIG, TON_API_CONFIG, FRAGMENT_CONFIG, TRANSACTION_MONITOR_CONFIG } from './config';
import { TonWalletService } from './wallet/TonWalletService';
import { FragmentStarsPurchaseService } from './services/fragmentStarsPurchaseService';
import { TonTransactionMonitor } from './services/tonTransactionMonitor';
import { FragmentApiClient } from './apiClient/fragmentApiClient';
import { initializeDatabase, ensureDatabaseReady, AppDataSource } from './database';
import { TransactionRepository } from './database/repositories/transaction.repository';
import path from 'path';

/**
 * Настройка и запуск Express сервера
 */
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet()); // Безопасность заголовков
app.use(cors()); // Разрешаем CORS
app.use(express.json()); // Парсинг JSON
app.use(express.urlencoded({ extended: true })); // Парсинг URL-encoded

// Обслуживание статических файлов из папки public
app.use(express.static(path.join(__dirname, '../public')));

// Логгирование запросов в режиме разработки
if (ENV_CONFIG.IS_DEVELOPMENT && ENV_CONFIG.VERBOSE_HTTP_LOGGING) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// Маршруты API
app.use('/api', apiRoutes);

// Глобальные переменные для служб
let tonWalletService: TonWalletService;
let fragmentApiClient: FragmentApiClient;
let starsPurchaseService: FragmentStarsPurchaseService;
let transactionMonitor: TonTransactionMonitor;
let transactionRepository: TransactionRepository;
let isMonitoringRunning = false; // Флаг для отслеживания состояния мониторинга

// Обработка корневого маршрута
app.get('/', (req, res) => {
  res.json({
    message: 'Fragment Proxy API работает',
    version: '1.0.0',
    info: 'Сервис мониторинга транзакций TON для автоматической покупки звезд',
    transactionMonitor: transactionMonitor ? 
      { status: isMonitoringRunning ? 'running' : 'stopped' } : 
      { status: 'not initialized' }
  });
});

// Обработка ошибок для несуществующих маршрутов
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Запрашиваемый ресурс не найден'
  });
});

/**
 * Асинхронная функция для инициализации и запуска всех сервисов
 */
async function startServer() {
  try {
    console.log('[API] Запуск сервера и инициализация сервисов...');
    
    // Инициализация базы данных
    console.log('[API] Подготовка базы данных...');
    await ensureDatabaseReady();
    
    // Создаем репозиторий транзакций
    transactionRepository = new TransactionRepository(AppDataSource);
    
    // Инициализация сервиса TON кошелька
    tonWalletService = new TonWalletService();
    
    // Инициализируем кошелек с настройками
    await tonWalletService.initializeWallet({
      mnemonic: TON_WALLET_CONFIG.MNEMONIC,
      subwalletId: TON_WALLET_CONFIG.SUBWALLET_ID,
      useTestnet: TON_WALLET_CONFIG.USE_TESTNET,
      apiUrl: TON_WALLET_CONFIG.USE_TESTNET ? TON_WALLET_CONFIG.API_URL.TESTNET : TON_WALLET_CONFIG.API_URL.MAINNET,
      apiKey: TON_WALLET_CONFIG.API_KEY
    });
    
    // Сохраняем сервис кошелька в app для доступа из маршрутов
    app.set('tonWalletService', tonWalletService);
    
    // Получаем адрес кошелька
    const walletAddress = await tonWalletService.getWalletAddress();
    console.log(`🔑 Адрес кошелька: ${walletAddress}`);
    
    // Получаем баланс кошелька
    const balance = await tonWalletService.getBalance();
    console.log(`💰 Баланс кошелька: ${Number(balance) / 1_000_000_000} TON`);
    
    // Инициализация Fragment API клиента
    fragmentApiClient = new FragmentApiClient(
      FRAGMENT_CONFIG.COOKIES,
      FRAGMENT_CONFIG.BASE_URL
    );
    
    // Инициализация сервиса покупки звезд
    const account = await tonWalletService.getWalletAccount();
    starsPurchaseService = new FragmentStarsPurchaseService(
      FRAGMENT_CONFIG.COOKIES,
      account.address,
      account.publicKey,
      account.walletStateInit,
      FRAGMENT_CONFIG.BASE_URL
    );
    
    // Инициализация монитора транзакций с репозиторием
    transactionMonitor = new TonTransactionMonitor(
      tonWalletService,
      starsPurchaseService,
      transactionRepository
    );
    
    // Запуск монитора, если настроен автоматический старт
    if (TRANSACTION_MONITOR_CONFIG.AUTO_START) {
      transactionMonitor.start();
      isMonitoringRunning = true;
      console.log('🔄 Мониторинг транзакций запущен автоматически');
    }
    
    // Запуск сервера
    app.listen(PORT, () => {
      console.log(`
  🚀 Fragment Proxy API сервер запущен!
  🌍 Сервер доступен по адресу: http://localhost:${PORT}
  📝 Режим: ${ENV_CONFIG.IS_DEVELOPMENT ? 'Development' : 'Production'}
  📚 Подробное логирование HTTP: ${ENV_CONFIG.VERBOSE_HTTP_LOGGING ? 'Включено' : 'Отключено'}
  🔄 Мониторинг транзакций: ${isMonitoringRunning ? 'Включен' : 'Отключен'}
  💱 Курс обмена: 1 TON = ${TRANSACTION_MONITOR_CONFIG.STARS_PER_TON} звезд
  💵 Минимальная сумма: ${TRANSACTION_MONITOR_CONFIG.MIN_AMOUNT} TON
  💾 База данных: SQLite (${process.env.DB_PATH || 'data/database.sqlite'})
      `);
    });
    
  } catch (error) {
    console.error('❌ Ошибка при запуске сервера:', error);
    process.exit(1);
  }
}

// Обработка сигналов завершения для корректного закрытия базы данных
process.on('SIGINT', async () => {
  try {
    console.log('\n[API] Получен сигнал завершения, закрываем соединения...');
    if (transactionMonitor) {
      transactionMonitor.stop();
    }
    await AppDataSource.destroy();
    console.log('[API] Все соединения закрыты, завершаем работу');
    process.exit(0);
  } catch (error) {
    console.error('[API] Ошибка при завершении работы:', error);
    process.exit(1);
  }
});

// Запуск сервера и инициализация всех сервисов
startServer();

export default app; 