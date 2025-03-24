import { Router } from 'express';
import { StarsController } from './controllers/starsController';

const router = Router();

/**
 * Маршруты для API
 */

// Маршрут для покупки звезд
router.post('/buy-stars', StarsController.buyStars);

// Здесь можно добавить другие маршруты API при необходимости

export default router; 