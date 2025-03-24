// Fragment TypeScript API - Главная точка входа в библиотеку

// Экспорт API клиента
export { 
  FragmentApiClient 
} from './api/fragmentApiClient';

// Экспорт сервиса покупки звезд
export { 
  FragmentStarsPurchaseService 
} from './services/fragmentStarsPurchaseService';

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
} from './api/models/apiModels';

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