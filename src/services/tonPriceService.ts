/**
 * Сервис для получения актуального курса TON к USD
 */
import axios from 'axios';

interface CoinGeckoResponse {
  the_open_network: {
    usd: number;
  };
}

export class TonPriceService {
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 минут в миллисекундах
  private static cachedPrice: number | null = null;
  private static lastUpdateTime: number = 0;

  /**
   * Получает текущий курс TON к USD с использованием кэширования
   * для снижения нагрузки на API
   * 
   * @returns Курс TON к USD или null в случае ошибки
   */
  public static async getTonToUsdRate(): Promise<number | null> {
    const now = Date.now();
    
    // Если у нас есть актуальный кэшированный курс, возвращаем его
    if (this.cachedPrice !== null && now - this.lastUpdateTime < this.CACHE_TTL) {
      return this.cachedPrice;
    }
    
    try {
      // Запрашиваем актуальный курс TON/USD с CoinGecko API
      const response = await axios.get<CoinGeckoResponse>(
        'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd',
        { timeout: 5000 }
      );
      
      if (response.data && response.data.the_open_network && response.data.the_open_network.usd) {
        this.cachedPrice = response.data.the_open_network.usd;
        this.lastUpdateTime = now;
        console.log(`[TonPriceService] Updated TON/USD rate: ${this.cachedPrice}`);
        return this.cachedPrice;
      }
      
      // Если данные некорректны, пробуем альтернативный API (Binance)
      return await this.getTonToUsdRateFromBinance();
    } catch (error) {
      console.error('[TonPriceService] Error fetching TON/USD rate from CoinGecko:', error);
      
      // В случае ошибки пробуем альтернативный API
      return await this.getTonToUsdRateFromBinance();
    }
  }
  
  /**
   * Альтернативный метод получения курса TON к USD через Binance API
   * 
   * @returns Курс TON к USD или null в случае ошибки
   */
  private static async getTonToUsdRateFromBinance(): Promise<number | null> {
    try {
      // Запрашиваем актуальный курс TON/USDT с Binance API
      const response = await axios.get(
        'https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT',
        { timeout: 5000 }
      );
      
      if (response.data && response.data.price) {
        const price = parseFloat(response.data.price);
        this.cachedPrice = price;
        this.lastUpdateTime = Date.now();
        console.log(`[TonPriceService] Updated TON/USD rate from Binance: ${this.cachedPrice}`);
        return this.cachedPrice;
      }
      
      console.warn('[TonPriceService] Failed to get TON/USD rate from Binance');
      return null;
    } catch (error) {
      console.error('[TonPriceService] Error fetching TON/USD rate from Binance:', error);
      
      // Если у нас есть устаревший кэшированный курс, возвращаем его как запасной вариант
      if (this.cachedPrice !== null) {
        console.warn('[TonPriceService] Using outdated cached TON/USD rate');
        return this.cachedPrice;
      }
      
      // Если ничего не сработало, возвращаем примерный курс
      return 7.5; // Примерный курс TON к USD
    }
  }
} 