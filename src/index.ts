/**
 * Основной файл для экспорта компонентов API
 */

import app from './server';

// Экспортируем сервер
export { app };

// Экспортируем функциональность покупки звезд для использования в других модулях
export { FragmentStarsPurchaseService } from './services/fragmentStarsPurchaseService';
export { FragmentApiClient } from './apiClient/fragmentApiClient';
export { TonWalletService } from './wallet/TonWalletService';

// Экспортируем настройки
export * from './config';

// Экспорт моделей API
export {
  Recipient,
  ButtonInfo,
  SearchRecipientsResponse,
  InitBuyStarsResponse,
  InitBuyStarsRequestResponse,
  StarsBuyState,
  StarsBuyStateApiResponse,
  UpdatePurchaseStateResponse,
  GetBuyStarsLinkResponse,
  WalletAccount,
  DeviceInfo,
  FragmentApiException
} from './apiClient/models/apiModels';

// Экспорт моделей сервиса покупки звезд
export {
  PurchaseResult,
  InsufficientBalanceException,
  PurchaseServiceOptions,
  PurchaseState
} from './services/models/purchaseModels';

// Информация о версии библиотеки
export const VERSION = {
  major: 1,
  minor: 0,
  patch: 0,
  toString: () => `${VERSION.major}.${VERSION.minor}.${VERSION.patch}`
}; 