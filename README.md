# Aqsha — Цифровая платформа занятости Мангистау

Aqsha решает реальную проблему: работодатели Актау публикуют вакансии в разрозненных WhatsApp-чатах, а молодёжь не знает о возможностях рядом. Мы заменяем этот хаос единой платформой с AI-матчингом, биржей услуг и Telegram-ботом.

---

## Ключевые возможности

| | |
|---|---|
| 🤖 **AI-матчинг** | Claude AI анализирует навыки соискателя и описание вакансии, выдаёт процент совпадения и объяснение |
| 💼 **Биржа вакансий** | Создание, фильтрация и отклики на вакансии; 60+ микрорайонов Актау |
| 🛠 **Биржа услуг** | Фрилансеры и специалисты публикуют анкеты; клиенты создают заказы и общаются в чате |
| 💬 **Чаты** | Встроенный чат на каждом объявлении и заказе; автоскролл, статус прочтения, онлайн-индикатор |
| ✈️ **Telegram-бот** | Уведомления о вакансиях, AI-подборка `/match`, отклик прямо из Telegram |
| 🔐 **FaceID / Passkey** | Вход без пароля через биометрию (WebAuthn) |
| 🛡 **Панель администратора** | Управление объявлениями, услугами, пользователями и заказами (смена статуса, верификация) |

---

## Стек

**Backend** — Node.js · Express · SQLite (better-sqlite3)  
**Frontend** — React 19 · TypeScript · Vite  
**AI** — Anthropic Claude Haiku  
**Bot** — Telegram Bot API (long-polling)  
**Auth** — JWT · bcrypt · WebAuthn (FaceID / Passkey)

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

### Демо-данные

```bash
node seed.js   # очистит старые объявления и заполнит реалистичными данными
```

Создаёт: 6 вакансий, 6 анкет специалистов, 3 заказа, 60+ сообщений в чатах.

Демо-пользователи (пароль `password123`):

| Роль | Email |
|---|---|
| Работодатель (КМГ) | `kmg@demo.kz` |
| Работодатель | `nursultan@demo.kz` |
| Специалист | `alibek@demo.kz` |
| Специалист | `dina@demo.kz` |

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

## API (основные маршруты)

```
GET    /api/health
GET    /api/meta                          — категории, районы, типы занятости

POST   /api/auth/register
POST   /api/auth/login
PATCH  /api/auth/me                       — обновить навыки, роль, район

GET    /api/ads                           — вакансии с фильтрами
POST   /api/ads                           — создать вакансию
GET    /api/ads/:id
POST   /api/jobs/:id/apply                — откликнуться
PATCH  /api/applications/:id/status       — принять / отклонить

GET    /api/services                      — анкеты специалистов
POST   /api/services                      — создать анкету
GET    /api/orders                        — мои заказы
POST   /api/orders                        — создать заказ
PATCH  /api/orders/:id/status             — обновить статус заказа

GET    /api/ai/match/jobs                 — AI-подборка вакансий
GET    /api/ai/match/candidates/:jobId    — AI-подборка кандидатов

GET    /api/admin/orders                  — все заказы (admin)
PATCH  /api/admin/orders/:id/status       — изменить статус заказа (admin)
POST   /api/admin/orders/:id/approve      — одобрить завершение заказа (admin)
PATCH  /api/admin/users/:id/verify        — верифицировать пользователя (admin)
```

---

## Структура проекта

```
server/
  routes/       auth, ads, services, orders, admin, ai, telegram, ...
  middleware/   auth (JWT), admin, security (helmet, rate-limit)
  db/           SQLite: init + миграции
  lib/          notifications, badges, validators
  telegram-bot.js

client/src/
  pages/        MarketPage, ServicesPage, OrdersPage, AdminAdsPage,
                AdDetailsPage, ProfilePage, AiMatchPage, DialogsPage, ...
  api/          типизированные fetch-обёртки
  components/   AdCard, SiteLayout, Icons, FaceCamera, ...
  i18n/         ru / kk

seed.js         — скрипт демо-данных
```

---

## Деплой на Render.com

1. Подключи репозиторий на [render.com](https://render.com)
2. **Build:** `npm install && npm install --prefix client && npm run client:build`
3. **Start:** `npm start`
4. Добавь переменные окружения в разделе Environment
5. Deploy ✓

---

2025 · Актау
