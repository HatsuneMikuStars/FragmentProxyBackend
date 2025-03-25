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
 * Express server setup and launch
 */
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Allow CORS
app.use(express.json()); // JSON parsing
app.use(express.urlencoded({ extended: true })); // URL-encoded parsing

// Serve static files from public folder
app.use(express.static(path.join(__dirname, '../public')));

// Request logging in development mode
if (ENV_CONFIG.IS_DEVELOPMENT && ENV_CONFIG.VERBOSE_HTTP_LOGGING) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// API routes
app.use('/api', apiRoutes);

// Global service variables
let tonWalletService: TonWalletService;
let fragmentApiClient: FragmentApiClient;
let starsPurchaseService: FragmentStarsPurchaseService;
let transactionMonitor: TonTransactionMonitor;
let transactionRepository: TransactionRepository;
let isMonitoringRunning = false; // Flag to track monitoring status

// Root route handler
app.get('/', (req, res) => {
  res.json({
    message: 'Fragment Proxy API is running',
    version: '1.0.0',
    info: 'TON transaction monitoring service for automatic star purchases',
    transactionMonitor: transactionMonitor ? 
      { status: isMonitoringRunning ? 'running' : 'stopped' } : 
      { status: 'not initialized' }
  });
});

// Error handling for non-existent routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found'
  });
});

/**
 * Async function for initializing and starting all services
 */
async function startServer() {
  try {
    console.log('[Server] Starting server and initializing services...');
    
    // Database initialization
    await ensureDatabaseReady();
    
    // Create transaction repository
    transactionRepository = new TransactionRepository(AppDataSource);
    
    // Initialize TON wallet service
    tonWalletService = new TonWalletService();
    
    // Initialize wallet with settings
    await tonWalletService.initializeWallet({
      mnemonic: TON_WALLET_CONFIG.MNEMONIC,
      subwalletId: TON_WALLET_CONFIG.SUBWALLET_ID,
      useTestnet: TON_WALLET_CONFIG.USE_TESTNET,
      apiUrl: TON_WALLET_CONFIG.USE_TESTNET ? TON_WALLET_CONFIG.API_URL.TESTNET : TON_WALLET_CONFIG.API_URL.MAINNET,
      apiKey: TON_WALLET_CONFIG.API_KEY
    });
    
    // Save wallet service in app for access from routes
    app.set('tonWalletService', tonWalletService);
    
    // Get wallet address
    const walletAddress = await tonWalletService.getWalletAddress();
    console.log(`[Server] Wallet address: ${walletAddress}`);
    
    // Get wallet balance
    const balance = await tonWalletService.getBalance();
    console.log(`[Server] Wallet balance: ${Number(balance) / 1_000_000_000} TON`);
    
    // Initialize Fragment API client
    fragmentApiClient = new FragmentApiClient(
      FRAGMENT_CONFIG.COOKIES,
      FRAGMENT_CONFIG.BASE_URL
    );
    
    // Initialize stars purchase service
    const account = await tonWalletService.getWalletAccount();
    starsPurchaseService = new FragmentStarsPurchaseService(
      FRAGMENT_CONFIG.COOKIES,
      account.address,
      account.publicKey,
      account.walletStateInit,
      FRAGMENT_CONFIG.BASE_URL
    );
    
    // Initialize transaction monitor with repository
    transactionMonitor = new TonTransactionMonitor(
      tonWalletService,
      starsPurchaseService,
      transactionRepository
    );
    
    // Start monitor if automatic start is configured
    if (TRANSACTION_MONITOR_CONFIG.AUTO_START) {
      transactionMonitor.start();
      isMonitoringRunning = true;
    }
    
    // Start server
    app.listen(PORT, () => {
      console.log(`
[Server] Fragment Proxy API server started on port ${PORT}
[Server] Mode: ${ENV_CONFIG.IS_DEVELOPMENT ? 'Development' : 'Production'}
[Server] Transaction monitoring: ${isMonitoringRunning ? 'Enabled' : 'Disabled'}
      `);
    });
    
  } catch (error) {
    console.error('[Server] Server startup error:', error);
    process.exit(1);
  }
}

// Handle termination signals for proper database closure
process.on('SIGINT', async () => {
  try {
    console.log('\n[Server] Termination signal received, closing connections...');
    if (transactionMonitor) {
      transactionMonitor.stop();
    }
    await AppDataSource.destroy();
    console.log('[Server] All connections closed, shutting down');
    process.exit(0);
  } catch (error) {
    console.error('[Server] Error during shutdown:', error);
    process.exit(1);
  }
});

// Start server and initialize all services
startServer();

export default app; 