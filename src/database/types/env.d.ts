/**
 * Расширение типа ProcessEnv для пользовательских переменных окружения
 */
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Переменные для базы данных
      DB_TYPE?: string;
      DB_PATH?: string;
      DB_SYNCHRONIZE?: string;
      
      // Переменные для настройки Fragment
      FRAGMENT_BASE_URL?: string;
      FRAGMENT_API_HASH?: string;
      FRAGMENT_COOKIE_STEL_SSID?: string;
      FRAGMENT_COOKIE_STEL_TOKEN?: string;
      FRAGMENT_COOKIE_STEL_TON_TOKEN?: string;
      FRAGMENT_COOKIE_STEL_DT?: string;
      
      // Переменные для настройки TON API
      TON_API_URL?: string;
      TON_API_TESTNET_URL?: string;
      TON_API_TIMEOUT?: string;
      
      // Переменные для настройки TON кошелька
      TON_WALLET_MNEMONIC?: string;
      TON_WALLET_SUBWALLET_ID?: string;
      TON_WALLET_USE_TESTNET?: string;
      TON_WALLET_API_URL_MAINNET?: string;
      TON_WALLET_API_URL_TESTNET?: string;
      TON_WALLET_API_KEY?: string;
      
      // Переменные для настройки монитора транзакций
      TRANSACTION_MONITOR_CHECK_INTERVAL_MS?: string;
      TRANSACTION_MONITOR_MIN_STARS?: string;
      TRANSACTION_MONITOR_MAX_STARS?: string;
      TRANSACTION_MONITOR_AUTO_START?: string;
      TRANSACTION_MONITOR_GAS_FEE?: string;
      TRANSACTION_MONITOR_PROCESSING_TIMEOUT_MS?: string;
      
      // Переменные окружения приложения
      ENV_IS_DEVELOPMENT?: string;
      ENV_LOG_LEVEL?: string;
      ENV_VERBOSE_HTTP_LOGGING?: string;
      
      // Стандартные переменные Node.js
      NODE_ENV?: 'development' | 'production' | 'test';
      PORT?: string;
    }
  }
}

// Пустой экспорт для сохранения файла как модуля
export {}; 