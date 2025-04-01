import { Router, Request, Response } from 'express';
import { TonWalletService } from '../wallet/TonWalletService';
import { TransactionRepository } from '../database/repositories/transaction.repository';
import { AppDataSource } from '../database';
import { StarsPriceCalculatorService } from '../services/starsPriceCalculatorService';
import { FragmentStarsPurchaseService } from '../services/fragmentStarsPurchaseService';
import { FragmentApiClient } from '../apiClient/fragmentApiClient';
import { FRAGMENT_CONFIG } from '../config';

const router = Router();

/**
 * Маршруты для API
 */

// Получение адреса кошелька для отправки TON
router.get('/wallet-address', (async (req: Request, res: Response) => {
  try {
    // Получаем глобальную переменную сервиса кошелька из приложения
    const tonWalletService = (req.app.get('tonWalletService') as TonWalletService);
    
    if (!tonWalletService) {
      return res.status(500).json({
        success: false,
        error: 'Сервис кошелька не инициализирован'
      });
    }
    
    // Получаем адрес кошелька
    const address = await tonWalletService.getWalletAddress();
    
    // Возвращаем адрес клиенту
    return res.json({
      success: true,
      address,
      instructions: 'Отправьте TON на этот адрес и укажите свой Telegram username в комментарии к транзакции'
    });
  } catch (error) {
    console.error('[API] Ошибка при получении адреса кошелька:', error);
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
}) as any);

// Получение статистики транзакций
router.get('/transactions/stats', (async (req: Request, res: Response) => {
  try {
    // Создаем репозиторий
    const transactionRepo = new TransactionRepository(AppDataSource);
    
    // Получаем статистику
    const stats = await transactionRepo.getTransactionStats();
    
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
  } catch (error) {
    console.error(`[API] Ошибка при получении статистики: ${(error as Error).message}`);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${(error as Error).message}`
    });
  }
}) as any);

// Получение последних транзакций
router.get('/transactions', (async (req: Request, res: Response) => {
  try {
    // Получаем параметры из запроса
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    // Создаем репозиторий транзакций
    const transactionRepository = new TransactionRepository(AppDataSource);
    
    // Получаем транзакции с пагинацией
    const [transactions, total] = await transactionRepository.getRecentTransactions(page, limit);
    
    return res.json({
      success: true,
      data: {
        transactions,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[API] Ошибка при получении списка транзакций:', error);
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
}) as any);

// Получение стоимости звезд в TON и USD
router.get('/stars/price', (async (req: Request, res: Response) => {
  try {
    // Получаем количество звезд из запроса
    const starsAmount = parseInt(req.query.amount as string);
    
    // Получаем сервис для покупки звезд из приложения или создаем новый
    let starsPurchaseService = req.app.get('starsPurchaseService') as FragmentStarsPurchaseService;
    
    // Если сервис не был инициализирован в приложении, создаем его
    if (!starsPurchaseService) {
      console.log('[API] StarsPurchaseService not found in app, creating new instance');
      
      // Создаем клиент API Fragment
      const fragmentClient = new FragmentApiClient(
        FRAGMENT_CONFIG.COOKIES,
        FRAGMENT_CONFIG.BASE_URL,
        FRAGMENT_CONFIG.API_HASH
      );
      
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
    const priceResult = await starsPriceCalculator.calculateStarsPrice(starsAmount);
    
    // Проверяем на ошибки
    if (priceResult.error) {
      return res.status(400).json({
        success: false,
        error: priceResult.error,
        data: priceResult
      });
    }
    
    // Возвращаем результаты клиенту
    return res.json({
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
  } catch (error) {
    console.error('[API] Ошибка при расчете стоимости звезд:', error);
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
}) as any);

// Здесь можно добавить информационные маршруты API при необходимости
// Например, маршрут для получения адреса кошелька или курса обмена

export default router; 