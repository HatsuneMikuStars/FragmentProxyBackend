## [2024-04-07 10:25] Исправление ошибок типизации в Express маршрутах

### Проблема
При попытке использовать асинхронные функции в обработчиках маршрутов Express с TypeScript возникали ошибки:
- `No overload matches this call` - несоответствие типов в обработчиках Express
- TypeScript не мог определить правильную сигнатуру функций-обработчиков

Ошибка подробно:
```
No overload matches this call.
  The last overload gave the following error.
    Argument of type '(req: Request, res: Response) => Promise<Response<any, Record<string, any>>>' is not assignable to parameter of type 'Application<Record<string, any>>'.
      Type '(req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>) => Promise<...>' is missing the following properties from type 'Application<Record<string, any>>': init, defaultConfiguration, engine, set, and 63 more.
```

### Решение
1. Заменили асинхронные функции (`async/await`) на обычные функции с промисами (`then/catch`)
2. Удалили неиспользуемый параметр `next: NextFunction`, который не был нужен в наших обработчиках
3. Вместо `return res.json()` теперь используем `res.json(); return;` для явного завершения функции
4. Явно возвращаемся из функции в случае раннего возврата ответа (например, при ошибке)

### Технические детали
- Express не ожидает возвращаемых значений от обработчиков маршрутов
- Правильный тип обработчика маршрута: `(req: Request, res: Response) => void`
- Возврат результата `res.json()` создавал конфликт типов, так как Express ожидает void
- Использование промисов с `.then().catch()` вместо `async/await` помогает избежать проблем с типизацией

### Ссылки
- [TypeScript Express API Guide](https://expressjs.com/en/4x/api.html)
- [Stack Overflow: TypeScript No overload matches this call](https://stackoverflow.com/questions/70964519/typescript-no-overload-matches-this-call)

### Итоговый результат
Все ошибки типизации в маршрутах были исправлены, код соответствует ожидаемым TypeScript типам для Express обработчиков. 