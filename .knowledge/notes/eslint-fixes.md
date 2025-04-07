## [2024-04-07 09:50] ESLint TypeScript Fixes

### Issue
- Found 3 ESLint errors in `src/apiClient/models/apiModels.ts` related to the use of `any` types:
  - Line 113: `[key: string]: any;` in the `GetBuyStarsLinkResponse` interface
  - Line 124: `[key: string]: any;` in the `WalletAccount` interface
  - Line 135: `features: any[];` in the `DeviceInfo` interface

### Solution
- Replaced all instances of `any` with `unknown` type:
  - `unknown` is a safer alternative to `any` as it requires type checking before operations
  - This follows TypeScript best practices for type safety while maintaining flexibility
  - The changes maintain the same functionality while improving type safety

### References
- [TypeScript ESLint no-explicit-any rule](https://typescript-eslint.io/rules/no-explicit-any)
- [TypeScript documentation on unknown type](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-0.html#new-unknown-top-type)

### Technical Context
Index signatures (`[key: string]: unknown`) are used when the API might return additional properties that aren't explicitly defined in the interface. Using `unknown` instead of `any` enforces type checking when using these properties. 