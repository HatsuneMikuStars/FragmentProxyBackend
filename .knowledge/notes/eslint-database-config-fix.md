## [2024-04-07 12:15] Исправление ESLint ошибок в database.config.ts

### Обнаруженные проблемы
В файле `database.config.ts` были обнаружены следующие ошибки:
1. Неиспользуемые импорты:
   - `TableColumn` - импортирован, но не используется в коде
   - `Table` - импортирован, но не используется в коде
2. Доступ к несуществующему свойству `DB_TYPE` в объекте `process.env`

### Выполненные исправления
1. Удалены неиспользуемые импорты:

```typescript
// До исправления:
import { DataSource, DataSourceOptions, TableColumn, Table, NamingStrategyInterface, DefaultNamingStrategy } from 'typeorm';

// После исправления:
import { DataSource, DataSourceOptions, NamingStrategyInterface, DefaultNamingStrategy } from 'typeorm';
```

2. Безопасный доступ к свойству `DB_TYPE`:

```typescript
// До исправления:
if (process.env.DB_TYPE === 'sqlite') {

// После исправления:
const dbType = process.env.DB_TYPE || '';
if (dbType === 'sqlite') {
```

### Технические детали
- Удаление неиспользуемых импортов (`TableColumn` и `Table`) делает код чище и уменьшает размер сборки.
- Использование промежуточной переменной с предоставлением значения по умолчанию `''` предотвращает ошибку типизации, связанную с обращением к потенциально несуществующему свойству в объекте `process.env`.
- TypeScript не знает о дополнительных переменных среды, которые могут быть добавлены во время выполнения, поэтому необходима явная проверка или присвоение значения по умолчанию.

### Примечания и возможные улучшения
Правильным решением для этого кода является определение расширенного типа для `ProcessEnv`, например:

```typescript
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DB_TYPE?: string;
      DB_PATH?: string;
      DB_SYNCHRONIZE?: string;
    }
  }
}
```

Однако это требует дополнительной работы по созданию файла деклараций типов и не было включено в текущее исправление, чтобы минимизировать изменения.

### Ссылки
- [TypeScript no-unused-vars](https://typescript-eslint.io/rules/no-unused-vars)
- [TypeScript declare global](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#global-augmentation)
- [Node.js process.env](https://nodejs.org/api/process.html#processenv) 