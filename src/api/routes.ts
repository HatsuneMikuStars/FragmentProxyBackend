import { Router, Request, Response } from 'express';
import { TonWalletService } from '../wallet/TonWalletService';
import { TransactionRepository } from '../database/repositories/transaction.repository';
import { AppDataSource } from '../database';
import { StarsPriceCalculatorService } from '../services/starsPriceCalculatorService';
import { FragmentStarsPurchaseService } from '../services/fragmentStarsPurchaseService';
import { FRAGMENT_CONFIG } from '../config';

const router = Router();

/**
 * Маршруты для API
 */

// Получение адреса кошелька для отправки TON
router.get('/wallet-address', function(req: Request, res: Response) {
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
router.get('/transactions/stats', function(req: Request, res: Response) {
  try {
    // Создаем репозиторий
    const transactionRepo = new TransactionRepository(AppDataSource);
    
    // Получаем статистику
    transactionRepo.getTransactionStats().then(stats => {
      // Возвращаем статистику клиенту
      res.json({
        success: true,
        data: {
          ...stats,
          // Добавляем дополнительную информацию
          averageStarsPerTransaction: stats.totalCount > 0 
            ? Math.round(stats.totalStars / stats.processedCount) 
            : 0,
          successRate: stats.totalCount > 0 
            ? Math.round((stats.processedCount / stats.totalCount) * 100) 
            : 0
        }
      });
    }).catch(error => {
      console.error(`[API] Ошибка при получении статистики: ${(error as Error).message}`);
      res.status(500).json({
        success: false,
        error: `Internal server error: ${(error as Error).message}`
      });
    });
  } catch (error) {
    console.error(`[API] Ошибка при получении статистики: ${(error as Error).message}`);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${(error as Error).message}`
    });
  }
});

// Получение последних транзакций
router.get('/transactions', function(req: Request, res: Response) {
  try {
    // Получаем параметры из запроса
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    // Создаем репозиторий транзакций
    const transactionRepository = new TransactionRepository(AppDataSource);
    
    // Получаем транзакции с пагинацией
    transactionRepository.getRecentTransactions(page, limit).then(([transactions, total]) => {
      res.json({
        success: true,
        data: {
          transactions,
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    }).catch(error => {
      console.error('[API] Ошибка при получении списка транзакций:', error);
      res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера'
      });
    });
  } catch (error) {
    console.error('[API] Ошибка при получении списка транзакций:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Получение стоимости звезд в TON и USD
router.get('/stars/price', function(req: Request, res: Response) {
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