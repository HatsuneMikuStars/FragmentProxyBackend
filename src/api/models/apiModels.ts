// Fragment API Models
// Базовые модели данных для работы с API Fragment

/**
 * Представляет получателя в системе Fragment
 */
export interface Recipient {
  id: string;
  username: string;
  name: string;
}

/**
 * Информация о кнопке оплаты
 */
export interface ButtonInfo {
  address: string;
  amount: string;
  payload: string;
}

/**
 * Ответ на запрос поиска получателей
 */
export interface SearchRecipientsResponse {
  recipients: Recipient[];
}

/**
 * Ответ после инициализации покупки звезд
 */
export interface InitBuyStarsResponse {
  reqId: string;
  amount: number;
  button: ButtonInfo;
}

/**
 * Ответ API на запрос инициализации покупки звезд
 */
export interface InitBuyStarsRequestResponse {
  // Поля могут находиться как в корне объекта, так и в поле result
  req_id?: string;
  amount?: string | number;
  button?: {
    address?: string;
    amount?: string;
    payload?: string;
  };
  result?: {
    req_id?: string;
    amount?: string | number;
    button?: {
      address?: string;
      amount?: string;
      payload?: string;
    };
    transactionUrl?: string;
  };
  ok?: boolean;
  error?: string;
  mode?: string;
  myself?: boolean;
  to_bot?: boolean;
  item_title?: string;
  content?: string;
}

/**
 * Состояние процесса покупки звезд
 */
export interface StarsBuyState {
  status: string;
  msg: string;
}

/**
 * Ответ API на запрос получения состояния покупки звезд
 */
export interface StarsBuyStateApiResponse {
  ok: boolean;
  needUpdate: boolean;
  mode: string;
  state?: StarsBuyState;
  dh: string;
  error?: string;
  html?: string;       // HTML содержимое для отображения статуса
  options_html?: string; // HTML с вариантами покупки
}

/**
 * Ответ на запрос обновления состояния покупки
 */
export interface UpdatePurchaseStateResponse {
  ok: boolean;
  state: string;
  error: string | null;
}

/**
 * Ответ на запрос получения ссылки для покупки звезд
 */
export interface GetBuyStarsLinkResponse {
  ok: boolean;
  error?: string;
  transaction: {
    messages: {
      address: string;
      amount: number;
      payload: string;
    }[];
  };
  [key: string]: any;
}

/**
 * Информация о кошельке
 */
export interface WalletAccount {
  address: string;
  chain: string;
  publicKey: string;
  walletStateInit: string;
  [key: string]: any;
}

/**
 * Информация об устройстве
 */
export interface DeviceInfo {
  platform: string;
  appName: string;
  appVersion: string;
  maxProtocolVersion: number;
  features: any[];
  userAgent?: string;
  mobile?: boolean;
}

/**
 * Базовое исключение, связанное с API Fragment
 */
export class FragmentApiException extends Error {
  constructor(message: string, public innerException?: Error) {
    super(message);
    this.name = 'FragmentApiException';
  }
} 