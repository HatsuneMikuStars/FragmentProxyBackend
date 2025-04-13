import { TonWalletService } from './wallet/TonWalletService';
import { TON_WALLET_CONFIG } from './config';
import { TransactionType } from './wallet/models/walletModels';
const tonWalletService = new TonWalletService();

async function initializeWallet() {
  try {
    await tonWalletService.initializeWallet({
      mnemonic: TON_WALLET_CONFIG.MNEMONIC,
      subwalletId: TON_WALLET_CONFIG.SUBWALLET_ID,
      useTestnet: TON_WALLET_CONFIG.USE_TESTNET,
      apiUrl: TON_WALLET_CONFIG.USE_TESTNET ? TON_WALLET_CONFIG.API_URL.TESTNET : TON_WALLET_CONFIG.API_URL.MAINNET,
      apiKey: TON_WALLET_CONFIG.API_KEY
    });
    
    const transactions = await tonWalletService.getTransactions({
      limit: 20,
      archival: true,
      type: TransactionType.INCOMING,
      filterSuspicious: true,
    });

    console.log(transactions);

    console.log('Wallet initialized successfully');
  } catch (error) {
    console.error('Failed to initialize wallet:', error);
  }
}

// Execute the initialization function
initializeWallet();