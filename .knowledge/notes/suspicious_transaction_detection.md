# [2023-11-09 15:30] Suspicious Transaction Detection Logic Analysis

## Overview
The `TonWalletService` implements logic to detect suspicious transactions using the `isSuspiciousTransaction` method. This method analyzes transaction data to identify potentially fraudulent or spam transactions.

## Detection Criteria
The system uses multiple criteria to flag suspicious transactions:

1. **Small Amount Transactions**
   - Transactions with very small amounts (≤0.01 TON or 10,000,000 nano-TON)
   - Small amounts are often used in spam/phishing attempts

2. **Suspicious Comments**
   - URL patterns (`https?:\/\/`)
   - Telegram links (`t\.me\/`)
   - Common scam keywords (`airdrop|free|giveaway|claim`)
   - False statements about received funds (`received \+\d+`)
   - Prize-related terms (`\bwin\b|\bprize\b|\breward\b`)
   - Wallet connection requests (`wallet connect|connect wallet`)

3. **Bounce Patterns**
   - Transactions marked with `bounce: true` in `additionalData`
   - These represent transfer reversals or failed transactions

4. **Known Scammer Addresses**
   - Transactions from addresses included in a predefined list of known scammers
   - Currently contains placeholder addresses that need to be replaced with actual known scammer addresses

## Implementation Details
```typescript
isSuspiciousTransaction(transaction: WalletTransaction): boolean {
  // 1. Check for small amounts
  const minSuspiciousAmount = BigInt(10000000); // 0.01 TON
  const isSmallAmount = transaction.amount <= minSuspiciousAmount;
  
  // 2. Check for suspicious comments using regex patterns
  const suspiciousPatterns = [
    /https?:\/\//i,                  // Any URLs
    /t\.me\//i,                      // Telegram links
    /airdrop|free|giveaway|claim/i,  // Scam-related keywords
    /received \+\d+/i,               // False claims of receiving funds
    /\bwin\b|\bprize\b|\breward\b/i, // Prize promises
    /wallet connect|connect wallet/i // Wallet connection attempts
  ];
  
  const hasSuspiciousComment = transaction.comment && 
    suspiciousPatterns.some(pattern => pattern.test(transaction.comment!));
  
  // 3. Check for bounce patterns
  const isBouncePattern = transaction.additionalData && 
    transaction.additionalData['bounce'] === true;
  
  // 4. Check if sender is a known scammer
  const knownScamAddresses = ["UQCY...pFzL", "EQCs...KHNk"]; // Placeholders
  const isFromKnownScammer = knownScamAddresses.some(address => 
    transaction.fromAddress.includes(address));
  
  // Transaction is suspicious if small amount + suspicious comment,
  // OR it's a bounce pattern, OR it's from a known scammer
  return (isSmallAmount && hasSuspiciousComment) || isBouncePattern || isFromKnownScammer;
}
```

## Integration
The system provides a method to filter out suspicious transactions when retrieving transaction lists:

```typescript
async getTransactionsWithSuspiciousCheck(
  params: GetTransactionsParams,
  filterSuspicious: boolean = false
): Promise<{
  transactions: WalletTransaction[], 
  suspiciousTransactions: WalletTransaction[]
}>
```

This method returns both the complete list of transactions and a separate list of suspicious transactions. The caller can choose to filter out suspicious transactions from the main list.

## Recommendations for Improvement
1. The list of known scammer addresses should be maintained externally and updated regularly
2. Additional heuristics could be added, such as:
   - Time-based patterns (multiple small transactions in a short period)
   - Advanced NLP for comment analysis beyond simple regex patterns
   - Blockchain analytics for transaction graph analysis
3. The suspicious amount threshold (0.01 TON) should be configurable 