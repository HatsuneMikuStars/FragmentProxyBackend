import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRoutes from './api/routes';
import { ENV_CONFIG } from './config';

/**
 * Настройка и запуск Express сервера
 */
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Безопасность заголовков
app.use(cors()); // Разрешаем CORS
app.use(express.json()); // Парсинг JSON
app.use(express.urlencoded({ extended: true })); // Парсинг URL-encoded

// Логгирование запросов в режиме разработки
if (ENV_CONFIG.IS_DEVELOPMENT && ENV_CONFIG.VERBOSE_HTTP_LOGGING) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// Маршруты API
app.use('/api', apiRoutes);

// Обработка корневого маршрута
app.get('/', (req, res) => {
  res.json({
    message: 'Fragment Proxy API работает',
    version: '1.0.0',
    endpoints: {
      buyStars: '/api/buy-stars'
    }
  });
});

// Обработка ошибок для несуществующих маршрутов
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Запрашиваемый ресурс не найден'
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`
  🚀 Fragment Proxy API сервер запущен!
  🌍 Сервер доступен по адресу: http://localhost:${PORT}
  📝 Режим: ${ENV_CONFIG.IS_DEVELOPMENT ? 'Development' : 'Production'}
  📚 Подробное логирование HTTP: ${ENV_CONFIG.VERBOSE_HTTP_LOGGING ? 'Включено' : 'Отключено'}
  `);
});

export default app; 