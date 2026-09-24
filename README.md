# MAX чат — GREEN-API (React, тестовое задание)

Минималистичный веб-чат в стиле [web.max.ru](https://web.max.ru/) для отправки и получения
**только текстовых сообщений** в мессенджере MAX через сервис
[GREEN-API](https://green-api.com/max).

- Отправка: `POST …/sendMessage/…` ([SendMessage](https://green-api.com/v3/docs/api/sending/SendMessage/))
- Получение: `GET …/receiveNotification/…` + `DELETE …/deleteNotification/…` ([HTTP API](https://green-api.com/v3/docs/api/receiving/technology-http-api/))
- Стек: React 19 + Vite, без бэкенда (запросы идут напрямую в GREEN-API из браузера).

## Стек

- Язык: JavaScript (JSX), без TypeScript
- React 19 + ReactDOM
- Vite 8 (сборка и dev-сервер)
- `@vitejs/plugin-react`
- Линтер: oxlint (`npm run lint`)
- Без UI-фреймворков и state-менеджеров — только React-хуки (`useState`, `useEffect`, `useRef`, `useCallback`)

## Требования

- Node.js 18+
- npm
- Авторизованный инстанс MAX в [console.green-api.com](https://console.green-api.com) (статус `authorized`)
- Пустое поле `webhookUrl` в настройках инстанса (требование технологии HTTP API)

## Переменные окружения

Проекту **не нужен `.env`-файл** — поэтому `.env.example` отсутствует сознательно.
Все учётные данные (`apiUrl`, `idInstance`, `apiTokenInstance`) вводятся пользователем
в форме входа и хранятся только в `localStorage` его браузера. В репозитории секретов нет.

## Как это работает (по пунктам задания)

1. Пользователь открывает сайт и вводит `idInstance`, `apiTokenInstance` (и при необходимости `apiUrl`)
   из [console.green-api.com](https://console.green-api.com). При входе вызывается `getStateInstance`
   — вход разрешён только в статусе `authorized`.
2. Пользователь нажимает «+ Новый чат», вводит **номер телефона** получателя → создаётся чат
   (`79991234567` → `79991234567@c.us`).
3. Пользователь пишет текст и отправляет — вызов `sendMessage` с `{ chatId, message }`.
4. Получатель отвечает в MAX.
5. Ответ появляется в чате автоматически: цикл `receiveNotification(receiveTimeout=20)` →
   разбор `incomingMessageReceived` → `deleteNotification(receiptId)`.

Нетекстовые входящие показываются заглушкой `[Сообщение типа …]`, очередь уведомлений
всегда подтверждается удалением, чтобы не забивалась.

> Важно: для технологии HTTP API поле `webhookUrl` инстанса должно быть **пустым**
> (иначе API вернёт ошибку «custom webhook url is set»). Приложение покажет подсказку,
> если это случится.

## Локальный запуск

Требуется Node.js 18+.

```bash
npm install
npm run dev
```

Откройте http://localhost:5173

Сборка и предпросмотр продакшена:

```bash
npm run build
npm run preview
```

Проверка линтером:

```bash
npm run lint
```

## Использование

1. Создайте и авторизуйте инстанс MAX в личном кабинете GREEN-API
   (инструкция: https://green-api.com/v3/docs/before-start/ — QR-код сканируется в приложении MAX).
2. Включите получение уведомлений нужных типов в настройках инстанса, `webhookUrl` оставьте пустым.
3. Войдите в приложение с `idInstance` / `apiTokenInstance`.
4. Создайте чат по номеру телефона, отправьте сообщение, дождитесь ответа.

Данные сессии (`idInstance`/`apiTokenInstance`) и переписка хранятся только в `localStorage` браузера.

## Структура

```
src/
  api/greenApi.js            # клиент GREEN-API + нормализация уведомлений
  components/
    LoginScreen.jsx          # ввод учётных данных + проверка getStateInstance
    Sidebar.jsx              # список чатов, поиск, статус polling
    ChatView.jsx             # окно переписки, пузыри в стиле web.max.ru
    NewChatModal.jsx         # создание чата по номеру телефона
  App.jsx                    # состояние чатов + polling-цикл HTTP API
  App.css / index.css        # стили
```

## Деплой

Статика из `npm run build` (папка `dist/`) разворачивается на любом статическом хостинге
(Vercel / Netlify / GitHub Pages / Nginx).

## Production

https://testzadanie-five.vercel.app

## Архитектура (кратко)

- `src/api/greenApi.js` — весь HTTP-слой: `getStateInstance`, `sendMessage`,
  `receiveNotification`, `deleteNotification`, нормализация `chatId` из номера телефона
  (`phoneToChatId`) и нормализация входящих уведомлений (`normalizeNotification`).
- `src/App.jsx` — состояние чатов (`chats`, `activeChatId`), оптимистичная отправка
  со статусами `sending/sent/error`, бесконечный polling-цикл HTTP API
  (один цикл на маунт, остановка через флаг в cleanup эффекта).
- Компоненты глупые: `LoginScreen` (вход + проверка `authorized`),
  `Sidebar` (список, поиск, статус polling), `ChatView` (сообщения + composer),
  `NewChatModal` (создание чата по номеру).
- Персистентность: `localStorage` (`max-chat-credentials`, `max-chat-chats-{idInstance}`).

## Тестирование

Автотестов нет (минимальный скоуп тестового задания). Проверено вручную и скриптами:

- `npm run build` — успешная production-сборка
- `npm run lint` — 0 ошибок
- `npm run dev` — dev-сервер отвечает 200
- Чистые функции `phoneToChatId` / `normalizeNotification` / `extractMessageText`
  прогнаны через node (форматы `+7 (...)`, `8...`, `...@c.us`, входящий `textMessage`, нетекстовый тип)
- End-to-end с живым инстансом MAX — выполняется вручную по сценарию из раздела «Использование»
