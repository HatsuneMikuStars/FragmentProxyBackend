## [2024-04-07 10:15] ESLint Fixes for Express Route Handlers

### Issue
Found 5 ESLint errors in `src/api/routes.ts`:
- Lines 45, 77, 109, 186: `Unexpected any. Specify a different type.` - TypeScript ESLint rule against using `any` type
- Line 125: `'fragmentClient' is assigned a value but never used.` - Unused variable warning

### Solution
- Removed extra parentheses around async route handler functions and `as any` type casting
- Changed from: `router.get('/path', (async (req: Request, res: Response) => {})` **as any**);`
- Changed to: `router.get('/path', async (req: Request, res: Response) => {});`
- Removed the unused `fragmentClient` variable which was being created but never used in the `stars/price` endpoint handler

### Technical Context
1. Express route handlers in TypeScript should not return values - the framework doesn't use them
2. The proper way to handle Express route callbacks is to:
   - Use `async/await` directly on the callback function without extra wrapping parentheses
   - Not cast to `any` type, as this bypasses TypeScript's type checking
   - Not return the result of response methods as they're used for chaining, not route handler return values

### References
- [TypeScript ESLint no-explicit-any rule](https://typescript-eslint.io/rules/no-explicit-any)
- [Express route handler typing in TypeScript](https://stackoverflow.com/questions/54603561/return-type-for-express-routes-with-typescript) 