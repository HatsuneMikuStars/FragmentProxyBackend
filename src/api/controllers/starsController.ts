import { Request, Response } from 'express';
import { FragmentStarsPurchaseService } from '../../services/fragmentStarsPurchaseService';
import { FragmentApiClient } from '../../apiClient/fragmentApiClient';
import { TonWalletService } from '../../wallet/TonWalletService';
import { loadWalletConfig } from '../../wallet/config';
import { FRAGMENT_CONFIG, APP_CONFIG } from '../../config';

/**
 * Контроллер для покупки звезд
 */
export class StarsController {
  /**
   * Метод для покупки звезд через API
   * @param req Запрос Express
   * @param res Ответ Express
   */
  public static async buyStars(req: Request, res: Response): Promise<void> {
    try {
      // Получение параметров из тела запроса
      const { username, stars } = req.body;

      // Проверка наличия обязательных параметров
      if (!username) {
        res.status(400).json({ success: false, error: 'Username is required' });
        return;
      }

      // Использование переданного количества звезд или значение по умолчанию
      const starsAmount = stars ? parseInt(stars) : APP_CONFIG.DEFAULT_STARS_AMOUNT;

      console.log(`[API] Запрос на покупку ${starsAmount} звезд для пользователя @${username}`);

      // Создаем словарь с куками для авторизации из конфигурации
      const cookies = FRAGMENT_CONFIG.COOKIES;

      // Создаем клиент API для прямого доступа к методам
      const fragmentClient = new FragmentApiClient(
        cookies,
        FRAGMENT_CONFIG.BASE_URL
      );
      
      console.log('[API] Инициализация компонентов...');
      
      // Загрузка конфигурации кошелька
      const walletConfig = await loadWalletConfig();
      console.log('[API] Конфигурация кошелька загружена');
      
      // Инициализация сервиса кошелька
      const walletService = new TonWalletService();
      await walletService.initializeWallet(walletConfig);
      console.log('[API] Сервис кошелька инициализирован');
      
      // Получаем адрес кошелька и баланс
      const walletAddress = await walletService.getWalletAddress();
      const walletBalance = await walletService.getBalance();
      console.log(`[API] Адрес кошелька: ${walletAddress}`);
      console.log(`[API] Баланс кошелька: ${Number(walletBalance) / 1_000_000_000} TON`);
      
      // Инициализация сервиса покупки звезд с помощью фабричного метода
      const purchaseService = await FragmentStarsPurchaseService.createFromWalletService(fragmentClient, walletService);
      console.log('[API] Сервис покупки звезд инициализирован');
      
      console.log(`[API] Начинаем покупку ${starsAmount} звезд для пользователя @${username}...`);
      
      // Запускаем покупку звезд
      const result = await purchaseService.purchaseStarsAsync(username, starsAmount);
      
      // Возвращаем результат
      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            transaction: {
              hash: result.transactionHash,
              status: result.status,
              stars: result.starsAmount,
              amount: result.amount
            }
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error(`[API] Ошибка при обработке запроса: ${(error as Error).message}`);
      res.status(500).json({
        success: false,
        error: `Internal server error: ${(error as Error).message}`
      });
    }
  }
} 