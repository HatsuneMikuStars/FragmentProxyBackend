import { FragmentStarsPurchaseService } from './services/fragmentStarsPurchaseService';
import { FragmentApiClient } from './apiClient/fragmentApiClient';
import { TonWalletService } from './wallet/TonWalletService';
import { loadWalletConfig } from './wallet/config';
import { FRAGMENT_CONFIG, APP_CONFIG } from './config';

/**
 * Главная функция программы
 */
async function main() {
    console.log("Fragment API Client - Покупка звезд через TON кошелек");

    // Параметры для вызова программы
    const args = process.argv.slice(2);
    const username = args[0] || APP_CONFIG.DEFAULT_USERNAME; // Имя пользователя для покупки звезд
    const starsAmount = parseInt(args[1] || String(APP_CONFIG.DEFAULT_STARS_AMOUNT)); // Количество звезд
    
    console.log(`Получатель звезд: ${username}`);
    console.log(`Количество звезд: ${starsAmount}`);

    try {
        // Создаем словарь с куками для авторизации из конфигурации
        const cookies = FRAGMENT_CONFIG.COOKIES;

        // Создаем клиент API для прямого доступа к методам
        const fragmentClient = new FragmentApiClient(
            cookies,
            FRAGMENT_CONFIG.BASE_URL
        );
        
        console.log('1️⃣ Инициализация компонентов...');
        
        // Загрузка конфигурации кошелька
        const walletConfig = await loadWalletConfig();
        console.log('   ✅ Конфигурация кошелька загружена');
        
        // Инициализация сервиса кошелька
        const walletService = new TonWalletService();
        await walletService.initializeWallet(walletConfig);
        console.log('   ✅ Сервис кошелька инициализирован');
        
        // Получаем адрес кошелька и баланс
        const walletAddress = await walletService.getWalletAddress();
        const walletBalance = await walletService.getBalance();
        console.log(`   📝 Адрес кошелька: ${walletAddress}`);
        console.log(`   💰 Баланс кошелька: ${Number(walletBalance) / 1_000_000_000} TON`);
        
        // Инициализация сервиса покупки звезд с помощью фабричного метода
        const purchaseService = await FragmentStarsPurchaseService.createFromWalletService(fragmentClient, walletService);
        console.log('   ✅ Сервис покупки звезд инициализирован');
        
        console.log(`\n2️⃣ Начинаем покупку ${starsAmount} звезд для пользователя @${username}...`);
        
        // Запускаем покупку звезд
        const result = await purchaseService.purchaseStarsAsync(username, starsAmount);
        
        console.log('\n3️⃣ Результат покупки:');
        console.log(`   📌 Статус: ${result.success ? '✅ Успешно' : '❌ Ошибка'}`);
        
        if (result.error) {
            console.log(`   📌 Сообщение об ошибке: ${result.error}`);
        }
        
        if (result.transactionHash) {
            console.log(`   📌 Хеш транзакции: ${result.transactionHash}`);
        }
        
        if (result.status) {
            console.log(`   📌 Статус: ${result.status}`);
        }
        
        if (result.starsAmount) {
            console.log(`   📌 Количество купленных звезд: ${result.starsAmount}`);
        }
        
        if (result.amount) {
            console.log(`   📌 Сумма в TON: ${result.amount}`);
        }

        console.log("\nПроцесс завершен.");
    } catch (error) {
        console.error(`Ошибка: ${(error as Error).message}`);
    }
}

// Запускаем программу
main().catch(error => {
    console.error("Критическая ошибка:", error);
    process.exit(1);
}); 