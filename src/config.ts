/**
 * Глобальный конфигурационный файл приложения
 * 
 * Загружает настройки из переменных окружения (.env)
 * ВСЕ чувствительные данные должны быть указаны ТОЛЬКО в .env файле
 */
import * as dotenv from 'dotenv';

// Загрузка переменных окружения из .env
dotenv.config();

// Вспомогательная функция для получения булевых значений из переменных окружения
function getBooleanEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

// Вспомогательная функция для получения числовых значений из переменных окружения
function getNumberEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Проверяет наличие необходимых переменных окружения
function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined) {
    console.error(`КРИТИЧЕСКАЯ ОШИБКА: Переменная окружения ${key} не определена в .env файле`);
    process.exit(1); // Завершаем приложение, так как невозможно работать без требуемой переменной
  }
  return value;
}

/**
 * Базовые настройки Fragment
 */
export const FRAGMENT_CONFIG = {
  // Базовый URL для API Fragment
  BASE_URL: process.env.FRAGMENT_BASE_URL || "https://fragment.com",
  
  // API хеш, используемый для запросов к Fragment (требуется)
  API_HASH: requireEnv("FRAGMENT_API_HASH"),
  
  // Cookies для авторизации в Fragment (требуются)
  COOKIES: {
    "stel_ssid": requireEnv("FRAGMENT_COOKIE_STEL_SSID"),
    "stel_token": requireEnv("FRAGMENT_COOKIE_STEL_TOKEN"),
    "stel_ton_token": requireEnv("FRAGMENT_COOKIE_STEL_TON_TOKEN"),
    "stel_dt": process.env.FRAGMENT_COOKIE_STEL_DT || "-240"
  }
};

/**
 * Настройки TON кошелька
 */
export const TON_WALLET_CONFIG = {
  // Мнемоническая фраза (требуется)
  // ВНИМАНИЕ! Никогда не включайте мнемонику в исходный код!
  MNEMONIC: requireEnv("TON_WALLET_MNEMONIC"),
  
  // ID подкошелька (обычно 0 или стандартное значение 698983191)
  SUBWALLET_ID: getNumberEnv("TON_WALLET_SUBWALLET_ID", 698983191),
  
  // Используем основную сеть TON (для тестовой сети установите в true)
  USE_TESTNET: getBooleanEnv("TON_WALLET_USE_TESTNET", false),
  
  // URL API для взаимодействия с TON
  API_URL: {
    MAINNET: process.env.TON_WALLET_API_URL_MAINNET || "https://toncenter.com/api/v2/jsonRPC",
    TESTNET: process.env.TON_WALLET_API_URL_TESTNET || "https://testnet.toncenter.com/api/v2/jsonRPC"
  },
  
  // API ключ для доступа к TON API (требуется)
  API_KEY: requireEnv("TON_WALLET_API_KEY")
};

/**
 * Настройки TON API клиента
 */
export const TON_API_CONFIG = {
  // URL API для получения транзакций
  API_URL: process.env.TON_API_URL || "https://toncenter.com/api/v2",
  
  // URL Testnet API для получения транзакций
  TESTNET_API_URL: process.env.TON_API_TESTNET_URL || "https://testnet.toncenter.com/api/v2",
  
  // API ключ (используем тот же ключ, что и для кошелька)
  API_KEY: requireEnv("TON_WALLET_API_KEY"),
  
  // Таймаут запросов в миллисекундах
  TIMEOUT: getNumberEnv("TON_API_TIMEOUT", 10000)
};

/**
 * Настройки монитора транзакций
 */
export const TRANSACTION_MONITOR_CONFIG = {
  // Интервал проверки транзакций в миллисекундах (по умолчанию 1 минута)
  CHECK_INTERVAL_MS: getNumberEnv("TRANSACTION_MONITOR_CHECK_INTERVAL_MS", 60 * 1000),
  
  // Минимальное количество звезд, которое можно купить (соответствует API Fragment)
  MIN_STARS: getNumberEnv("TRANSACTION_MONITOR_MIN_STARS", 50),
  
  // Максимальное количество звезд, которое можно купить за один раз (соответствует API Fragment)
  MAX_STARS: getNumberEnv("TRANSACTION_MONITOR_MAX_STARS", 1000000),
  
  // Автоматический запуск монитора при старте приложения
  AUTO_START: getBooleanEnv("TRANSACTION_MONITOR_AUTO_START", true),
  
  // Фиксированная комиссия за газ в TON, которая вычитается из суммы транзакции перед расчетом звезд
  // Значение основано на анализе реальных транзакций (типичное значение ~0.0032 TON)
  GAS_FEE: getNumberEnv("TRANSACTION_MONITOR_GAS_FEE", 0.004),
  
  // Временной лимит в миллисекундах, после которого транзакция считается "зависшей" в статусе processing
  // По умолчанию 30 минут (1800000 мс)
  PROCESSING_TIMEOUT_MS: getNumberEnv("TRANSACTION_MONITOR_PROCESSING_TIMEOUT_MS", 30 * 60 * 1000)
};

/**
 * Настройки окружения (environment configuration)
 * Эти настройки должны быть настроены для разных окружений (dev, test, prod)
 */
export const ENV_CONFIG = {
  // Режим разработки - установите в false для production
  IS_DEVELOPMENT: getBooleanEnv("ENV_IS_DEVELOPMENT", process.env.NODE_ENV === "development"),
  
  // Уровень логирования (debug, info, warn, error)
  LOG_LEVEL: process.env.ENV_LOG_LEVEL || "debug",
  
  // Включение подробного логирования HTTP запросов
  VERBOSE_HTTP_LOGGING: getBooleanEnv("ENV_VERBOSE_HTTP_LOGGING", true)
}; 