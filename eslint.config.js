import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import tonAiCore from '@ton-ai-core/eslint-plugin-suggest-members';
import { fixupPluginRules } from '@eslint/compat';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    plugins: {
      '@ton-ai-core/eslint-plugin-suggest-members': fixupPluginRules(tonAiCore),
    },
    rules: {
      '@ton-ai-core/eslint-plugin-suggest-members/suggest-members': 'warn',
    },
  },
]; 