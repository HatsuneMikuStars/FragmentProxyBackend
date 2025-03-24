# Fragment Proxy TypeScript API

Прокси API для работы с Fragment, написанный на TypeScript.

## Установка

```bash
yarn install
```

## Запуск

Для разработки:
```bash
yarn dev
```

Для продакшена:
```bash
yarn build
yarn start
```

## API Endpoints

### POST /api/buy-stars

Поиск пользователя и инициализация покупки звезд.

**Запрос:**
```json
{
    "username": "string",
    "stars": "number"
}
```

**Успешный ответ:**
```json
{
    "success": true,
    "data": {
        "recipient": {
            "id": "string",
            "username": "string",
            "name": "string"
        },
        "transaction": {
            "reqId": "string",
            "amount": "number",
            "button": {
                "address": "string",
                "amount": "string",
                "payload": "string"
            }
        }
    }
}
```

**Ошибка:**
```json
{
    "error": "string"
}
```

## Конфигурация

Для работы API необходимо указать правильный URL Fragment API в файле `src/index.ts`. 