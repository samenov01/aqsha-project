# Aqsha — Цифровая платформа занятости Мангистау

> MVP для Mangystau Hackathon 2025 · [Demo →](https://aqsha.onrender.com)

Aqsha решает реальную проблему: работодатели Актау публикуют вакансии в разрозненных WhatsApp-чатах, а молодёжь не знает о возможностях рядом. Мы заменяем этот хаос единой платформой с AI-матчингом и Telegram-ботом.

---

## Ключевые возможности

| | |
|---|---|
| 🤖 **AI-матчинг** | Claude AI анализирует навыки соискателя и описание вакансии, выдаёт процент совпадения и объяснение на русском |
| ✈️ **Telegram-бот** | Уведомления о новых вакансиях, AI-подборка `/match`, отклик в один клик прямо из Telegram |
| 📍 **Фильтрация по Актау** | 60+ микрорайонов, тип занятости, опыт, зарплатная вилка |
| 👤 **Полный flow** | Создание вакансии → отклик → уведомление работодателя → принять / отклонить |
| 🔐 **FaceID / Passkey** | Вход без пароля через биометрию или ключи доступа |

---

## Стек

**Backend** — Node.js · Express · SQLite  
**Frontend** — React 19 · TypeScript · Vite  
**AI** — Anthropic Claude Haiku  
**Bot** — Telegram Bot API (long-polling, без зависимостей)

---

## Быстрый старт

```bash
# Зависимости
npm install
npm install --prefix client

# .env
cp .env.example .env
# Заполни ANTHROPIC_API_KEY и TELEGRAM_BOT_TOKEN

# Запуск (два терминала)
npm run dev          # backend :3000
npm run client:dev   # frontend :5173
```

Демо-аккаунты создаются автоматически при первом запуске:

| Роль | Email | Пароль |
|---|---|---|
| Работодатель | `employer@jumys.kz` | `Demo12345` |
| Соискатель | `seeker@jumys.kz` | `Demo12345` |

---

## Переменные окружения

```env
PORT=3000
JWT_SECRET=your-secret
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=...
PLATFORM_URL=https://your-app.onrender.com
CORS_ORIGINS=https://your-app.onrender.com
ADMIN_EMAILS=your@email.com
```

---

## Telegram-бот — команды

| Команда | Действие |
|---|---|
| `/start` | Приветствие и список команд |
| `/jobs` | Последние 5 вакансий с кнопками отклика |
| `/match` | AI-подборка по навыкам (нужна привязка аккаунта) |
| `/link КОД` | Привязать аккаунт платформы (код из профиля) |

---

## API

```
GET    /api/health
GET    /api/meta                        — категории, районы, типы занятости
POST   /api/auth/register
POST   /api/auth/login
PATCH  /api/auth/me                     — обновить навыки, роль, район
GET    /api/ads                         — список вакансий с фильтрами
POST   /api/ads                         — создать вакансию
GET    /api/ads/:id
POST   /api/jobs/:id/apply              — откликнуться
GET    /api/jobs/:id/applications       — отклики на вакансию (работодатель)
GET    /api/my/applications             — мои отклики (соискатель)
PATCH  /api/applications/:id/status     — принять / отклонить
GET    /api/ai/match/jobs               — AI-подборка вакансий для соискателя
GET    /api/ai/match/candidates/:jobId  — AI-подборка кандидатов для работодателя
POST   /api/telegram/link-token         — генерация кода привязки Telegram
```

---

## Деплой на Render.com

1. Подключи репозиторий на [render.com](https://render.com)
2. **Build:** `npm install && npm install --prefix client && npm run client:build`
3. **Start:** `npm start`
4. Добавь переменные окружения в разделе Environment
5. Deploy ✓

---

## Структура проекта

```
server/
  routes/          ai, ads, auth, applications, telegram, ...
  middleware/       auth, security
  db/               SQLite init + seed
  telegram-bot.js   Telegram long-polling бот
client/src/
  pages/            MarketPage, AiMatchPage, ProfilePage, ...
  api/              typed fetch-обёртки
  components/       AdCard, SiteLayout, ...
```

---

Mangystau Hackathon · Апрель 2025 · Актау
