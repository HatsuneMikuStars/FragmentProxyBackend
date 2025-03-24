import { WalletConfig } from './models/walletModels';
import { TON_WALLET_CONFIG } from '../config';

/**
 * Конфигурация кошелька TON
 * 
 * ВНИМАНИЕ! Для безопасного использования в рабочей среде замените эти значения
 * на переменные окружения или загрузку из безопасного хранилища.
 */
export const TON_WALLET_CONFIG_LEGACY: WalletConfig = {
  // Используем настройки из глобальной конфигурации
  mnemonic: TON_WALLET_CONFIG.MNEMONIC,
  subwalletId: TON_WALLET_CONFIG.SUBWALLET_ID,
  useTestnet: TON_WALLET_CONFIG.USE_TESTNET,
  apiKey: TON_WALLET_CONFIG.API_KEY,
  
  // Если нужны определенные URL API
  apiUrl: TON_WALLET_CONFIG.USE_TESTNET 
    ? TON_WALLET_CONFIG.API_URL.TESTNET 
    : TON_WALLET_CONFIG.API_URL.MAINNET,
};

/**
 * Функция для безопасной загрузки конфигурации кошелька
 * 
 * В реальной системе эта функция должна загружать мнемоническую фразу и другие 
 * секретные данные из безопасного хранилища или переменных окружения.
 */
export async function loadWalletConfig(): Promise<WalletConfig> {
  // В реальной системе здесь должен быть код для загрузки конфигурации из безопасного источника
  
  // Вариант улучшенной безопасности для production:
  // - Получение мнемоники из переменных окружения или безопасного хранилища
  // - Проверка, что ключи не являются пустыми значениями
  
  return TON_WALLET_CONFIG_LEGACY;
} 