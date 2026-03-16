# aqsha

Студенческая фриланс-биржа: безопасный backend на Express + SQLite и frontend на React + Vite.

## Что изменено

- Проект переработан на модульную структуру (`server/*` и `client/src/*`).
- Удален устаревший легаси-фронт из `public/*`.
- Усилена безопасность API:
  - `helmet` для базовых security-заголовков.
  - `express-rate-limit` для `/api` и отдельный лимит для `/api/auth`.
  - Строгий `CORS` по списку разрешенных origin.
  - Централизованный обработчик ошибок.
  - Валидация полей на сервере (email, пароль, цены, длины строк).
  - Защищенная загрузка файлов (только JPG/PNG/WEBP, лимит размера и количества).
  - JWT авторизация через middleware.

## Структура

```text
server/
  app.js
  index.js
  config/
  constants/
  db/
  lib/
  middleware/
  routes/

client/src/
  api/
  components/
  lib/
  pages/
  App.tsx
```

## Запуск

```bash
npm install
npm run dev
```

Frontend отдельно:

```bash
npm run client:dev
```

Сборка клиента:

```bash
npm run client:build
```

## Переменные окружения

Поддерживаются:

- `PORT` (по умолчанию `3000`)
- `JWT_SECRET`
- `CORS_ORIGINS` (через запятую, например `http://localhost:5173,http://127.0.0.1:5173`)
- `ADMIN_MFA_SECRET` (секрет для админского FaceID-токена, по умолчанию `JWT_SECRET`)
- `ADMIN_MFA_TTL_MIN` (время жизни FaceID-токена, по умолчанию `15`)
- `WEBAUTHN_RP_ID` (домен для WebAuthn, по умолчанию `localhost`)
- `WEBAUTHN_ORIGIN` (origin фронта для WebAuthn, по умолчанию `http://localhost:5173`)
- `WEBAUTHN_RP_NAME` (название для WebAuthn, по умолчанию `Aqsha Admin`)

## API

- `GET /api/health`
- `GET /api/meta`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/ads`
- `GET /api/ads/:id`
- `POST /api/ads`
- `DELETE /api/ads/:id`
- `GET /api/my/ads`
