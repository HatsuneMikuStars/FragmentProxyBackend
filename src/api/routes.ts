import { Router, Request, Response } from 'express';
import { TonWalletService } from '../wallet/TonWalletService';
import { TransactionRepository } from '../database/repositories/transaction.repository';
import { AppDataSource } from '../database';

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

// Здесь можно добавить информационные маршруты API при необходимости
// Например, маршрут для получения адреса кошелька или курса обмена

export default router; 