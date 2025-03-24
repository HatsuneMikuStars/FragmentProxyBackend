import axios from 'axios';

/**
 * Интерфейс для транзакций TON
 */
export interface TonTransaction {
  hash: string;
  amount: number;
  timestamp: number;
  comment?: string;
  senderAddress?: string;
}

/**
 * Клиент для работы с TON API
 */
export class TonApiClient {
  private apiUrl: string;
  private apiKey: string;
  private timeout: number;

  /**
   * Конструктор
   */
  constructor(config: { apiUrl: string; apiKey: string; timeout?: number }) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
    
    console.log(`[TonApiClient] Инициализирован с URL: ${this.apiUrl}`);
  }

  /**
   * Получение транзакций для адреса кошелька
   */
  async getTransactions(walletAddress: string, limit: number = 10): Promise<TonTransaction[]> {
    try {
      console.log(`[TonApiClient] Запрос транзакций для адреса ${walletAddress}, лимит: ${limit}`);
      
      // Формируем URL для запроса списка транзакций
      const url = `${this.apiUrl}/getTransactions`;
      
      // Выполняем запрос к TON API
      const response = await axios.get(url, {
        params: {
          address: walletAddress,
          limit
        },
        headers: {
          'X-API-Key': this.apiKey
        },
        timeout: this.timeout
      });
      
      // Проверяем ответ и результат
      if (!response.data || !response.data.result) {
        console.warn('[TonApiClient] Ответ API не содержит транзакций');
        return [];
      }
      
      // Подробное логирование всего ответа API для отладки
      console.log('[TonApiClient] Полный ответ от API:');
      console.log(JSON.stringify(response.data, null, 2));
      
      console.log(`[TonApiClient] Получено ${response.data.result.length} транзакций`);
      
      // Логируем информацию о каждой транзакции для отладки
      response.data.result.forEach((tx: any, index: number) => {
        console.log(`[TonApiClient] Транзакция #${index + 1}:`);
        
        if (tx.in_msg) {
          console.log(`  in_msg присутствует: ${JSON.stringify(tx.in_msg, null, 2)}`);
          console.log(`  message: "${tx.in_msg.message || '<отсутствует>'}"`);
          console.log(`  msg_data: ${tx.in_msg.msg_data ? JSON.stringify(tx.in_msg.msg_data, null, 2) : '<отсутствует>'}`);
          
          // Проверяем все возможные поля, связанные с комментарием
          const possibleCommentFields = [
            tx.in_msg.message,
            tx.in_msg.msg_data?.text,
            tx.in_msg.comment,
            tx.in_msg.payload
          ];
          
          console.log('  Возможные поля комментария:');
          possibleCommentFields.forEach((field, i) => {
            console.log(`    Поле ${i+1}: ${field || '<пусто>'}`);
          });
        } else {
          console.log('  in_msg отсутствует');
        }
        
        // Проверяем наличие других полей, которые могут содержать комментарий
        if (tx.message) console.log(`  message: "${tx.message}"`);
        if (tx.comment) console.log(`  comment: "${tx.comment}"`);
        
        console.log('---------------------------------------');
      });
      
      // Преобразуем данные в наш формат
      const transactions = response.data.result
        .filter((tx: any) => tx.in_msg && parseFloat(tx.in_msg.value) > 0)
        .map((tx: any) => {
          // Получаем комментарий, если он есть
          let comment = '';
          
          // Проверяем разные поля, которые могут содержать комментарий
          if (tx.in_msg && tx.in_msg.message) {
            comment = tx.in_msg.message;
            console.log(`[TonApiClient] Найден комментарий в поле in_msg.message: "${comment}"`);
          } else if (tx.in_msg && tx.in_msg.msg_data && tx.in_msg.msg_data.text) {
            comment = tx.in_msg.msg_data.text;
            console.log(`[TonApiClient] Найден комментарий в поле in_msg.msg_data.text: "${comment}"`);
          } else if (tx.comment) {
            comment = tx.comment;
            console.log(`[TonApiClient] Найден комментарий в поле comment: "${comment}"`);
          } else if (tx.message) {
            comment = tx.message;
            console.log(`[TonApiClient] Найден комментарий в поле message: "${comment}"`);
          }
          
          // Получаем сумму транзакции в TON (переводим из наноТОН)
          const amount = tx.in_msg && tx.in_msg.value 
            ? parseFloat(tx.in_msg.value) / 1_000_000_000 
            : 0;
          
          // Логируем результат преобразования
          console.log(`[TonApiClient] Преобразованная транзакция:
            hash: ${tx.transaction_id?.hash || tx.hash || ''}
            amount: ${amount}
            comment: "${comment}"
            senderAddress: ${tx.in_msg ? tx.in_msg.source : ''}
          `);
          
          // Собираем объект транзакции
          return {
            hash: tx.transaction_id?.hash || tx.hash || '',
            amount,
            timestamp: tx.utime * 1000, // Переводим время из секунд в миллисекунды
            comment,
            senderAddress: tx.in_msg ? tx.in_msg.source : ''
          };
        });
      
      // Логируем итоговый результат
      console.log(`[TonApiClient] Обработано ${transactions.length} транзакций`);
      
      return transactions;
    } catch (error) {
      console.error('[TonApiClient] Ошибка при получении транзакций:', error);
      return [];
    }
  }
} 