# [2023-11-09 16:15] TON Transaction Comment Analysis

## Overview
The FragmentProxyBackend system implements a critical security mechanism to detect and filter suspicious transactions based on their comment content. This functionality is especially important as fraudulent actors often use transaction comments to distribute phishing links or scam messages.

## Comment Extraction and Storage
1. **Source of Comments**:
   - Transaction comments are extracted from the TON blockchain during transaction retrieval
   - In the `TonWalletService` class, the `convertTonTransaction` method processes raw blockchain data to structured `WalletTransaction` objects

2. **Storage in `WalletTransaction` Model**:
   ```typescript
   export interface WalletTransaction {
     // ... other properties
     
     /**
      * Комментарий к транзакции (если есть)
      */
     comment?: string;
     
     // ... other properties
   }
   ```

## Suspicious Comment Detection
The system implements pattern-based detection for suspicious comments in the `isSuspiciousTransaction` method:

```typescript
// 2. Проверка на подозрительные комментарии в транзакции
const suspiciousPatterns = [
  /https?:\/\//i,                  // Любые URL
  /t\.me\//i,                      // Telegram ссылки
  /airdrop|free|giveaway|claim/i,  // Ключевые слова, связанные с мошенничеством
  /received \+\d+/i,               // Ложные сообщения о получении средств
  /\bwin\b|\bprize\b|\breward\b/i, // Обещания выигрыша
  /wallet connect|connect wallet/i // Попытки заставить подключить кошелек
];

const hasSuspiciousComment = transaction.comment && 
  suspiciousPatterns.some(pattern => pattern.test(transaction.comment!));
```

## Detection Logic
A transaction is flagged as suspicious if it meets the following criteria:
1. It has a small amount (≤0.01 TON) **AND** contains suspicious comment patterns
2. **OR** it's identified as a bounce transaction
3. **OR** it originates from a known scammer address

## Example Suspicious Comments
Based on the patterns identified in the code, examples of suspicious comments would include:
- "Free airdrop at http://fake-site.com"
- "Claim your free TON at t.me/scam_channel"
- "You received +100 TON, verify at scam-link.com"
- "Win a prize by connecting your wallet"

## Real Transaction Example
From transaction analysis, real comments from the blockchain like "skulidropek" might be checked against these patterns:

```
"decoded_body": {
  "text": "skulidropek"
}
```

This specific comment doesn't match any of the suspicious patterns, but the system would still evaluate:
1. Is it from a small amount transaction?
2. Is it a bounce transaction?
3. Is it from a known scammer address?

## Integration Points
The suspicious transaction detection is integrated with transaction retrieval via the `getTransactionsWithSuspiciousCheck` method, which returns both the full transaction list and a filtered list of suspicious transactions:

```typescript
const { transactions, suspiciousTransactions } = await tonWalletService.getTransactionsWithSuspiciousCheck({
  limit: 20,
  archival: true,
  type: TransactionType.INCOMING
});
```

## Logging and Monitoring
The application logs detected suspicious transactions:

```typescript
console.log('Обнаружено транзакций:', transactions.length);
console.log('Из них подозрительных:', suspiciousTransactions.length);

if (suspiciousTransactions.length > 0) {
  console.log('\nОбнаружены подозрительные транзакции:');
  suspiciousTransactions.forEach((tx, index) => {
    console.log(`\n[${index + 1}] Подозрительная транзакция:`);
    console.log(`   ID: ${tx.id}`);
    console.log(`   От: ${tx.fromAddress}`);
    console.log(`   Сумма: ${Number(tx.amount) / 1000000000} TON`);
    console.log(`   Комментарий: ${tx.comment || 'Без комментария'}`);
  });
}
```

## Security Recommendations
1. **Regular Pattern Updates**: The suspicious patterns should be regularly updated to adapt to new scam techniques
2. **Database of Known Scams**: Maintain a comprehensive database of known scam addresses and patterns
3. **Machine Learning Integration**: Consider enhancing detection with ML-based approaches to identify new scam patterns
4. **External API Integration**: Connect with external scam detection services to improve accuracy
5. **User Feedback Loop**: Implement a system for users to report suspicious transactions that weren't automatically detected 