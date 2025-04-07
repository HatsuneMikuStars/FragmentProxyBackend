## [2024-04-07 10:05] ESLint Unused Variables Fix

### Issue
Found 4 ESLint errors in `src/apiClient/fragmentApiClient.ts` related to unused variables:
- Line 6: `ButtonInfo` imported but never used
- Line 9: `InitBuyStarsRequestResponse` imported but never used
- Line 396: `stableStateCounter` assigned a value but never used
- Line 398: `previousState` assigned a value but never used

### Solution
- Removed unused imports (`ButtonInfo` and `InitBuyStarsRequestResponse`) from import statement
- Removed unused variables (`stableStateCounter` and `previousState`) from the `checkPurchaseStatusWithPollingAsync` method
- These variables appeared to be remnants of code that was refactored or debugging code that was no longer needed

### References
- [TypeScript ESLint no-unused-vars rule](https://typescript-eslint.io/rules/no-unused-vars)

### Technical Context
Removing unused variables and imports helps improve code quality by:
1. Reducing bundle size
2. Improving code readability
3. Preventing potential confusion about the purpose of defined but unused variables
4. Eliminating dead code that might cause maintenance issues later 