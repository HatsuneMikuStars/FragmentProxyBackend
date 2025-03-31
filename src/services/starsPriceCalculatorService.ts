/**
 * Сервис для расчета стоимости звезд в TON и USD
 */
import { FragmentStarsPurchaseService } from './fragmentStarsPurchaseService';
import { TonPriceService } from './tonPriceService';
import { TRANSACTION_MONITOR_CONFIG } from '../config';

export interface StarsPriceResult {
  // Запрошенное количество звезд
  starsAmount: number;
  
  // Стоимость звезд в TON (точное значение)
  tonPrice: number;
  
  // Комиссия за газ в TON
  gasFee: number;
  
  // Полная стоимость в TON (включая комиссию за газ)
  totalTonPrice: number;
  
  // Стоимость звезд в USD (приблизительное значение)
  usdPrice: number | null;
  
  // Полная стоимость в USD (включая комиссию за газ)
  totalUsdPrice: number | null;
  
  // Текущий курс TON к USD
  tonToUsdRate: number | null;
  
  // Количество звезд на 1 TON
  starsPerTon: number;
  
  // Минимальное количество звезд для покупки
  minStars: number;
  
  // Максимальное количество звезд для покупки
  maxStars: number;
  
  // Сообщение об ошибке (если есть)
  error?: string;
}

export class StarsPriceCalculatorService {
  private starsPurchaseService: FragmentStarsPurchaseService;
  
  constructor(starsPurchaseService: FragmentStarsPurchaseService) {
    this.starsPurchaseService = starsPurchaseService;
  }
  
  /**
   * Рассчитывает стоимость заданного количества звезд в TON и USD
   * 
   * @param starsAmount Количество звезд
   * @returns Результат с информацией о стоимости
   */
  public async calculateStarsPrice(starsAmount: number): Promise<StarsPriceResult> {
    try {
      // Проверяем минимальное и максимальное количество звезд
      const minStars = TRANSACTION_MONITOR_CONFIG.MIN_STARS;
      const maxStars = TRANSACTION_MONITOR_CONFIG.MAX_STARS;
      
      // Валидация количества звезд
      if (isNaN(starsAmount) || starsAmount <= 0) {
        return {
          starsAmount: 0,
          tonPrice: 0,
          gasFee: 0,
          totalTonPrice: 0,
          usdPrice: null,
          totalUsdPrice: null,
          tonToUsdRate: null,
          starsPerTon: 0,
          minStars,
          maxStars,
          error: 'Неверное количество звезд. Пожалуйста, укажите положительное число.'
        };
      }
      
      if (starsAmount < minStars) {
        return {
          starsAmount,
          tonPrice: 0,
          gasFee: 0,
          totalTonPrice: 0,
          usdPrice: null,
          totalUsdPrice: null,
          tonToUsdRate: null,
          starsPerTon: 0,
          minStars,
          maxStars,
          error: `Минимальное количество звезд для покупки: ${minStars}`
        };
      }
      
      if (starsAmount > maxStars) {
        return {
          starsAmount,
          tonPrice: 0,
          gasFee: 0,
          totalTonPrice: 0,
          usdPrice: null,
          totalUsdPrice: null,
          tonToUsdRate: null,
          starsPerTon: 0,
          minStars,
          maxStars,
          error: `Максимальное количество звезд для покупки: ${maxStars}`
        };
      }
      
      // Получаем текущий курс обмена звезд на TON
      const starsPerTon = await this.starsPurchaseService.getStarsExchangeRate();
      
      // Рассчитываем стоимость в TON
      const tonPrice = starsAmount / starsPerTon;
      
      // Получаем текущий курс TON к USD
      const tonToUsdRate = await TonPriceService.getTonToUsdRate();
      
      // Рассчитываем стоимость в USD (если удалось получить курс)
      const usdPrice = tonToUsdRate !== null ? tonPrice * tonToUsdRate : null;
      
      // Получаем комиссию за газ из конфигурации
      const gasFee = TRANSACTION_MONITOR_CONFIG.GAS_FEE;
      
      // Рассчитываем полную стоимость в TON (включая комиссию за газ)
      const totalTonPrice = tonPrice + gasFee;
      
      // Рассчитываем полную стоимость в USD (включая комиссию за газ)
      const totalUsdPrice = tonToUsdRate !== null ? totalTonPrice * tonToUsdRate : null;
      
      return {
        starsAmount,
        tonPrice,
        gasFee,
        totalTonPrice,
        usdPrice,
        totalUsdPrice,
        tonToUsdRate,
        starsPerTon,
        minStars,
        maxStars
      };
    } catch (error) {
      console.error('[StarsPriceCalculator] Error calculating stars price:', error);
      
      return {
        starsAmount: starsAmount || 0,
        tonPrice: 0,
        gasFee: 0,
        totalTonPrice: 0,
        usdPrice: null,
        totalUsdPrice: null,
        tonToUsdRate: null,
        starsPerTon: 0,
        minStars: TRANSACTION_MONITOR_CONFIG.MIN_STARS,
        maxStars: TRANSACTION_MONITOR_CONFIG.MAX_STARS,
        error: 'Произошла ошибка при расчете стоимости звезд'
      };
    }
  }
} 