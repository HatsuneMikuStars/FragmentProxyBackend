## [2025-06-13 13:45] Установка и настройка ESLint с плагином TON AI Core

### Установленные пакеты
- Основной плагин: `@ton-ai-core/eslint-plugin-suggest-members` версия 1.5.2
- ESLint v9.24.0 
- Вспомогательные зависимости:
  - `@eslint/js` - Основной функционал ESLint
  - `typescript-eslint` - Интеграция с TypeScript
  - `@eslint/compat` - Утилиты совместимости для плагинов
  - `@typescript-eslint/parser` - Парсер для TypeScript
  - `@typescript-eslint/eslint-plugin` - Правила для TypeScript

### Особенности конфигурации

**1. ESLint v9+ использует новый формат конфигурации**

ESLint v9+ требует использования нового "flat config" формата в файле `eslint.config.js`:

```javascript
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
        // ...
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
```

**2. Требуется указание `"type": "module"` в package.json**

Поскольку конфигурация использует import/export синтаксис, требуется указание этого параметра.

## [2025-06-13 14:15] Исправление ошибок совместимости

При использовании `"type": "module"` в package.json выяснилось, что старый формат конфигурации `.eslintrc.js` не совместим с ES модулями. Возникли ошибки:

- 'module' is not defined
- '__dirname' is not defined

Решение:
- Удален файл `.eslintrc.js`
- Оставлен только новый формат конфигурации `eslint.config.js`

**Примечание:** При использовании ESLint v9+ с ES модулями (`"type": "module"`) нельзя одновременно использовать старый формат конфигурации `.eslintrc.js` в стиле CommonJS. Альтернативой было бы переименование в `.eslintrc.cjs`, но в этом нет необходимости, так как уже настроен новый формат.

**3. Добавлена команда для проверки**

В package.json добавлен скрипт для запуска линтера:

```json
"scripts": {
  "lint": "eslint src/ --ext .ts"
}
```

### Результаты первичной проверки кода

Проверка обнаружила:
- 56 ошибок
- 6 предупреждений

Включая:
- Неиспользуемые переменные
- Использование any типов
- Предупреждения от плагина TON AI Core о несуществующих свойствах в ProcessEnv

### Следующие шаги
- Исправить ошибки линтера
- Рассмотреть возможность автоматического исправления с помощью `yarn lint --fix`
- Настроить исключения для некоторых правил, если необходимо 