/**
 * Скрипт для получения текущего курса обмена TON на звезды Fragment
 * Использование: npx ts-node scripts/getStarsRate.ts
 */

import { FragmentApiClient } from '../src/apiClient/fragmentApiClient';
import { FRAGMENT_CONFIG } from '../src/config';

// Создаем клиент API Fragment
const fragmentClient = new FragmentApiClient(
  FRAGMENT_CONFIG.COOKIES,
  FRAGMENT_CONFIG.BASE_URL,
  FRAGMENT_CONFIG.API_HASH
);

// Функция для получения курса обмена
async function getStarsRate() {
  try {
    console.log('Получение текущего курса обмена TON на звезды...');
    
    // Создаем массив с разными количествами звезд для проверки
    const starsAmounts = [50, 100, 500, 1000, 5000, 10000, 50000];
    
    console.log('| Звезды  | TON      | Курс (звезд за 1 TON) |');
    console.log('|---------|----------|------------------------|');
    
    // Получаем курс для каждого количества звезд
    for (const starsAmount of starsAmounts) {
      const response = await fragmentClient.updateStarsPricesAsync(starsAmount);
      
      if (!response.ok) {
        console.error(`Ошибка при получении курса для ${starsAmount} звезд`);
        continue;
      }
      
      console.log(`| ${starsAmount.toString().padEnd(7)} | ${response.tonPrice.toFixed(4).padEnd(8)} | ${response.starsPerTon.toFixed(2).padEnd(22)} |`);
    }
    
    // Получаем курс для базового значения в 50 звезд
    const defaultResponse = await fragmentClient.updateStarsPricesAsync(50);
    if (defaultResponse.ok) {
      console.log('\nТекущий рекомендуемый курс обмена:');
      console.log(`${defaultResponse.starsPerTon.toFixed(2)} звезд за 1 TON`);
    }
    
  } catch (error) {
    console.error('Ошибка при получении курса обмена:', error);
  }
}

// Запускаем функцию
getStarsRate().catch(console.error); 