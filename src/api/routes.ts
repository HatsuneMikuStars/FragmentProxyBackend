import express, { Request, Response, NextFunction } from 'express';
import { TonWalletService } from '../wallet/TonWalletService';
import { StarsPriceCalculatorService } from '../services/starsPriceCalculatorService';
import { FragmentStarsPurchaseService } from '../services/fragmentStarsPurchaseService';
import { FRAGMENT_CONFIG } from '../config';
import { TonTransactionMonitor } from '../services/tonTransactionMonitor';
import { Api } from '../apiClient/Api';

const router = express.Router();

/**
 * Маршруты для API
 */

// Создаем экземпляр API клиента
const apiClient = new Api({
  baseURL: 'http://localhost:5238',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Middleware для проверки наличия монитора транзакций
const checkMonitor = (req: Request, res: Response, next: NextFunction): void => {
  const monitor = req.app.get('monitor') as TonTransactionMonitor;
  if (!monitor) {
    res.status(500).json({
      error: 'Monitor not initialized',
      message: 'Transaction monitor service is not initialized'
    });
    return;
  }
  next();
};

// Получение адреса кошелька для отправки TON
router.get('/wallet-address', function(req: express.Request, res: express.Response) {
  try {
    // Получаем глобальную переменную сервиса кошелька из приложения
    const tonWalletService = (req.app.get('tonWalletService') as TonWalletService);
    
    if (!tonWalletService) {
      res.status(500).json({
        success: false,
        error: 'Сервис кошелька не инициализирован'
      });
      return;
    }
    
    // Получаем адрес кошелька
    tonWalletService.getWalletAddress().then(address => {
      // Возвращаем адрес клиенту
      res.json({
        success: true,
        address,
        instructions: 'Отправьте TON на этот адрес и укажите свой Telegram username в комментарии к транзакции'
      });
    }).catch(error => {
      console.error('[API] Ошибка при получении адреса кошелька:', error);
      res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера'
      });
    });
  } catch (error) {
    console.error('[API] Ошибка при получении адреса кошелька:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Получение статистики транзакций
router.get('/stats', checkMonitor, async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: transactions } = await apiClient.transactionsList({ page: 1, pageSize: 1000 });
    
    const stats = {
      totalCount: transactions.length,
      processedCount: transactions.filter(tx => tx.status === 2).length,
      processingCount: transactions.filter(tx => tx.status === 1).length,
      failedCount: transactions.filter(tx => tx.status === 3).length,
      totalStars: transactions.reduce((sum, tx) => sum + (tx.starCount || 0), 0),
      totalTon: transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0).toFixed(9)
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get transaction stats',
      message: (error as Error).message
    });
  }
});

// Получение списка транзакций с пагинацией
router.get('/transactions', checkMonitor, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const { data: transactions } = await apiClient.transactionsList({
      page,
      pageSize: limit
    });
    
    res.json({
      data: transactions,
      page,
      limit,
      total: transactions.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get transactions',
      message: (error as Error).message
    });
  }
});

// Получение стоимости звезд в TON и USD
router.get('/stars/price', function(req: express.Request, res: express.Response) {
  try {
    // Получаем количество звезд из запроса
    const starsAmount = parseInt(req.query.amount as string);
    
    // Получаем сервис для покупки звезд из приложения или создаем новый
    let starsPurchaseService = req.app.get('starsPurchaseService') as FragmentStarsPurchaseService;
    
    // Если сервис не был инициализирован в приложении, создаем его
    if (!starsPurchaseService) {
      console.log('[API] StarsPurchaseService not found in app, creating new instance');
      
      // Создаем новый экземпляр сервиса (с минимально необходимыми параметрами)
      starsPurchaseService = new FragmentStarsPurchaseService(
        FRAGMENT_CONFIG.COOKIES,
        '', // address - не используется для получения курса
        '', // publicKey - не используется для получения курса
        '', // stateInit - не используется для получения курса
        FRAGMENT_CONFIG.BASE_URL,
        {},
        undefined // tonWalletService - не используется для получения курса
      );
    }
    
    // Создаем калькулятор стоимости звезд
    const starsPriceCalculator = new StarsPriceCalculatorService(starsPurchaseService);
    
    // Получаем стоимость звезд
    starsPriceCalculator.calculateStarsPrice(starsAmount).then(priceResult => {
      // Проверяем на ошибки
      if (priceResult.error) {
        res.status(400).json({
          success: false,
          error: priceResult.error,
          data: priceResult
        });
        return;
      }
      
      // Возвращаем результаты клиенту
      res.json({
        success: true,
        data: {
          ...priceResult,
          // Округляем значения для удобства отображения
          tonPrice: parseFloat(priceResult.tonPrice.toFixed(6)),
          gasFee: parseFloat(priceResult.gasFee.toFixed(6)),
          totalTonPrice: parseFloat(priceResult.totalTonPrice.toFixed(6)),
          usdPrice: priceResult.usdPrice !== null 
            ? parseFloat(priceResult.usdPrice.toFixed(2)) 
            : null,
          totalUsdPrice: priceResult.totalUsdPrice !== null 
            ? parseFloat(priceResult.totalUsdPrice.toFixed(2)) 
            : null,
          tonToUsdRate: priceResult.tonToUsdRate !== null 
            ? parseFloat(priceResult.tonToUsdRate.toFixed(2)) 
            : null,
          starsPerTon: parseFloat(priceResult.starsPerTon.toFixed(2))
        }
      });
    }).catch(error => {
      console.error('[API] Ошибка при расчете стоимости звезд:', error);
      res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера'
      });
    });
  } catch (error) {
    console.error('[API] Ошибка при расчете стоимости звезд:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Здесь можно добавить информационные маршруты API при необходимости
// Например, маршрут для получения адреса кошелька или курса обмена

export default router; 