/**
 * Утилита для расчета комиссий за газ в сети TON
 * Использует значения из официальной документации TON
 * https://docs.ton.org/v3/documentation/smart-contracts/transaction-fees/fees
 */

/**
 * Типы транзакций для оценки комиссии
 */
export enum TransactionType {
  // Простой перевод TON
  SIMPLE_TRANSFER = 'SIMPLE_TRANSFER',
  
  // Передача Jetton (токенов)
  JETTON_TRANSFER = 'JETTON_TRANSFER',
  
  // Минт NFT
  NFT_MINT = 'NFT_MINT'
}

/**
 * Оценка комиссии за газ для различных типов транзакций
 * Эти значения основаны на средних показателях в сети TON
 * Исходя из официальной документации: https://docs.ton.org/v3/documentation/smart-contracts/transaction-fees/fees
 * 
 * @param type Тип транзакции
 * @param customFee Пользовательское значение комиссии (необязательно)
 * @returns Оценка комиссии в TON
 */
export function estimateGasFee(type: TransactionType, customFee?: number): number {
  // Если передано пользовательское значение комиссии, используем его
  if (customFee !== undefined && customFee > 0) {
    return customFee;
  }
  
  // Средние комиссии для различных типов транзакций (в TON)
  // Взяты из официальной документации TON
  switch (type) {
    case TransactionType.SIMPLE_TRANSFER:
      // Средняя комиссия за простой перевод TON
      return 0.0055;
      
    case TransactionType.JETTON_TRANSFER:
      // Средняя комиссия за перевод Jetton (токенов)
      return 0.037;
      
    case TransactionType.NFT_MINT:
      // Средняя комиссия за минт NFT
      return 0.08;
      
    default:
      // Для неизвестных типов транзакций используем повышенную комиссию для надежности
      return 0.05;
  }
}

/**
 * Расчет суммы доступной для покупки звезд
 * Вычитает комиссию за газ из общей суммы транзакции
 * 
 * @param totalAmount Общая сумма транзакции в TON
 * @param transactionType Тип транзакции (необязательно, по умолчанию SIMPLE_TRANSFER)
 * @param customFee Пользовательское значение комиссии (необязательно)
 * @returns Сумма доступная для покупки звезд в TON
 */
export function calculateAmountAfterGas(
  totalAmount: number, 
  transactionType: TransactionType = TransactionType.SIMPLE_TRANSFER,
  customFee?: number
): { amountAfterGas: number, gasFee: number } {
  const gasFee = estimateGasFee(transactionType, customFee);
  
  // Проверяем, что после вычета комиссии остается положительная сумма
  const amountAfterGas = Math.max(0, totalAmount - gasFee);
  
  return {
    amountAfterGas,
    gasFee
  };
} 