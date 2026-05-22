/**
 * Seed script: clean existing ads/services/messages and insert demo data.
 * Run: node seed.js
 */

const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");

const db = new Database(path.join(__dirname, "data/aqsha.db"));
db.pragma("foreign_keys = OFF");

// ── 1. Clean old data ─────────────────────────────────────────────────────────
db.prepare("DELETE FROM ad_messages").run();
db.prepare("DELETE FROM service_messages").run();
db.prepare("DELETE FROM service_orders").run();
db.prepare("DELETE FROM images").run();
db.prepare("DELETE FROM service_images").run();
db.prepare("DELETE FROM ads").run();
db.prepare("DELETE FROM services").run();
db.prepare("DELETE FROM notifications").run();
db.prepare("DELETE FROM favorites").run();
db.prepare("DELETE FROM service_reviews").run();
console.log("✓ Old data cleared");

// ── 2. Ensure demo users exist (upsert by email) ──────────────────────────────
const hash = bcrypt.hashSync("password123", 10);

const upsertUser = db.prepare(`
  INSERT INTO users (name, email, university, password_hash, is_verified, role)
  VALUES (?, ?, 'Актау', ?, 1, ?)
  ON CONFLICT(email) DO UPDATE SET name=excluded.name, is_verified=1, role=excluded.role
`);

upsertUser.run("Нурсултан Аренов",  "nursultan@demo.kz",  hash, "employer");
upsertUser.run("КазМунайГаз HR",    "kmg@demo.kz",        hash, "employer");
upsertUser.run("Гранд Отель Актау", "hotel@demo.kz",      hash, "employer");
upsertUser.run("Alibek Seitkali",   "alibek@demo.kz",     hash, "seeker");
upsertUser.run("Dina Muratova",     "dina@demo.kz",       hash, "seeker");
upsertUser.run("Marat Kenzhebaev",  "marat@demo.kz",      hash, "seeker");
upsertUser.run("Aigerim Bekova",    "aigerim@demo.kz",    hash, "seeker");

const userId = (email) => db.prepare("SELECT id FROM users WHERE email=?").get(email).id;

const uN  = userId("nursultan@demo.kz");
const uKMG = userId("kmg@demo.kz");
const uHotel = userId("hotel@demo.kz");
const uAlibek = userId("alibek@demo.kz");
const uDina   = userId("dina@demo.kz");
const uMarat  = userId("marat@demo.kz");
const uAigerim = userId("aigerim@demo.kz");

// Also use real existing users for richer chats
const existingUsers = db.prepare("SELECT id FROM users WHERE email NOT LIKE '%@demo.kz' LIMIT 3").all();
const u1 = existingUsers[0]?.id || uAlibek;
const u2 = existingUsers[1]?.id || uDina;

console.log("✓ Demo users ready");

// ── 3. Insert ads (vacancies) ─────────────────────────────────────────────────
const insertAd = db.prepare(`
  INSERT INTO ads (user_id, title, category, price, university, description,
    contact_phone, contact_whatsapp, contact_telegram,
    employment_type, experience_level, microrayon, status)
  VALUES (?, ?, ?, ?, 'Актау', ?, ?, ?, ?, ?, ?, ?, 'active')
`);

const ads = [
  {
    user_id: uKMG,
    title: "Инженер-технолог нефтеперерабатывающего производства",
    category: "Производство и сырьё",
    price: 580000,
    description: `КазМунайГаз приглашает опытного инженера-технолога в команду Атырауского НПЗ — филиал в Актау.

Обязанности:
• Контроль технологических процессов переработки нефти
• Разработка и оптимизация регламентов производства
• Участие в пуско-наладочных работах нового оборудования
• Ведение технической документации и отчётности

Требования:
• Высшее техническое образование (нефтегазовое / химическое)
• Опыт работы от 3 лет на нефтеперерабатывающем предприятии
• Знание HAZOP, ISO 9001
• Казахский и русский языки — обязательно

Условия:
• Официальное трудоустройство, соц. пакет
• Вахтовый метод 28/28 или стационар на выбор
• Корпоративный транспорт, жильё`,
    phone: "+7 729 250-00-01",
    whatsapp: "+77292500001",
    telegram: "@kmg_hr",
    employment_type: "Полная занятость",
    experience_level: "От 3 лет",
    microrayon: "Центр",
  },
  {
    user_id: uKMG,
    title: "Оператор по добыче нефти и газа (вахта)",
    category: "Производство и сырьё",
    price: 420000,
    description: `Требуется оператор по добыче нефти и газа на нефтяное месторождение Мангистауской области.

Обязанности:
• Обслуживание скважин, насосных агрегатов и трубопроводов
• Замер дебита и контроль параметров пласта
• Устранение мелких неисправностей, подготовка оборудования к ремонту
• Ведение сменного журнала

Требования:
• Среднее специальное или высшее техническое образование
• Опыт работы оператором от 1 года
• Допуски на работу с газовым оборудованием

Условия:
• Вахтовый метод 15/15
• Питание, проживание, спецодежда — за счёт компании
• Страхование жизни и здоровья`,
    phone: "+7 729 250-00-01",
    whatsapp: "+77292500001",
    telegram: "@kmg_hr",
    employment_type: "Вахтовый метод",
    experience_level: "От 1 года",
    microrayon: "Другое",
  },
  {
    user_id: uHotel,
    title: "Администратор на ресепшн (Гранд Отель)",
    category: "Административный персонал",
    price: 185000,
    description: `Гранд Отель Актау ищет приветливого и ответственного администратора на стойку ресепшн.

Обязанности:
• Встреча и регистрация гостей, check-in / check-out
• Работа в системе управления отелем (Opera / 1С:Отель)
• Ответы на входящие звонки и e-mail
• Координация с отделами горничных, ресторана, service-desk

Требования:
• Приятная внешность, грамотная речь
• Английский язык — разговорный (обязательно)
• Опыт в сфере гостеприимства от 6 месяцев (плюс, но не обязательно)

Условия:
• График 2/2 (день/ночь), 12 часов
• Питание во время смены
• Обучение за счёт отеля`,
    phone: "+7 729 233-44-55",
    whatsapp: "+77292334455",
    telegram: "@grandhotel_aktau",
    employment_type: "Полная занятость",
    experience_level: "Без опыта",
    microrayon: "Центр",
  },
  {
    user_id: uN,
    title: "Менеджер по продажам строительных материалов",
    category: "Продажи и торговля",
    price: 250000,
    description: `Строительная компания «АктауСтрой» ищет активного менеджера по продажам.

Обязанности:
• Поиск и привлечение новых клиентов (B2B и B2C)
• Ведение переговоров, выставление КП
• Работа с CRM, составление отчётов
• Участие в тендерах и гос. закупках

Требования:
• Опыт в активных продажах от 1 года
• Навыки работы в 1С или CRM-системах
• Ответственность, нацеленность на результат

Условия:
• Оклад 150 000 + % от продаж (до 250 000+)
• Корпоративный автомобиль для разъездов
• Официальное трудоустройство`,
    phone: "+7 707 100-20-30",
    whatsapp: "+77071002030",
    telegram: "@aktau_stroy",
    employment_type: "Полная занятость",
    experience_level: "От 1 года",
    microrayon: "8 мкр",
  },
  {
    user_id: uN,
    title: "Повар-универсал / Шеф-повар (ресторан «Каспий»)",
    category: "Рестораны и общепит",
    price: 210000,
    description: `Ресторан «Каспий» на набережной Актау открывает вакансию повара.

Обязанности:
• Приготовление блюд казахской и европейской кухни
• Составление меню совместно с шефом
• Контроль качества, соблюдение СанПиН
• Управление кухонной командой (для шефа)

Требования:
• Опыт работы поваром от 2 лет
• Знание технологических карт
• Санитарная книжка (или готовность оформить)

Условия:
• График 5/2
• Питание в смену
• Премии по итогам сезона`,
    phone: "+7 729 255-66-77",
    whatsapp: "+77292556677",
    telegram: "",
    employment_type: "Полная занятость",
    experience_level: "От 1 года",
    microrayon: "5 мкр",
  },
  {
    user_id: uHotel,
    title: "Водитель-курьер (доставка по городу)",
    category: "Транспорт и логистика",
    price: 170000,
    description: `Логистическая компания «АктауЭкспресс» ищет водителя-курьера для доставки по Актау и области.

Обязанности:
• Доставка товаров и документов по адресам клиентов
• Работа с накладными и сопроводительными документами
• Содержание автомобиля в чистоте

Требования:
• Водительское удостоверение категории B (обязательно)
• Знание улиц Актау и района
• Без вредных привычек

Условия:
• Оклад 120 000 + бонусы за объём
• Корпоративный автомобиль предоставляется
• Топливо за счёт компании`,
    phone: "+7 707 300-40-50",
    whatsapp: "+77073004050",
    telegram: "@aktau_express",
    employment_type: "Полная занятость",
    experience_level: "Без опыта",
    microrayon: "12 мкр",
  },
];

const insertedAdIds = [];
for (const ad of ads) {
  const r = insertAd.run(
    ad.user_id, ad.title, ad.category, ad.price, ad.description,
    ad.phone, ad.whatsapp, ad.telegram,
    ad.employment_type, ad.experience_level, ad.microrayon
  );
  insertedAdIds.push(r.lastInsertRowid);
}
console.log("✓ Ads inserted:", insertedAdIds);

// ── 4. Insert services (соискатели/фрилансеры) ────────────────────────────────
const insertService = db.prepare(`
  INSERT INTO services (user_id, title, category, price, university, description,
    contact_phone, contact_whatsapp, contact_telegram)
  VALUES (?, ?, ?, ?, 'Актау', ?, ?, ?, ?)
`);

const services = [
  {
    user_id: uAlibek,
    title: "Сантехник и электрик — выезд по Актау",
    category: "Рабочий персонал",
    price: 5000,
    description: `Оказываю услуги сантехника и электрика с выездом по всем микрорайонам Актау.

Что делаю:
• Замена смесителей, унитазов, труб, счётчиков воды
• Устранение засоров и протечек
• Монтаж розеток, выключателей, люстр
• Замена проводки в квартире (частично / полностью)
• Установка водонагревателей

Почему выбирают меня:
✓ Выезд в течение 1–2 часов
✓ Гарантия на работу 3 месяца
✓ Оплата после приёмки
✓ Опыт 8 лет

Звоните или пишите в WhatsApp — отвечу быстро!`,
    phone: "+7 777 111-22-33",
    whatsapp: "+77771112233",
    telegram: "@alibek_master",
  },
  {
    user_id: uDina,
    title: "Репетитор по математике и физике (ЕНТ, ОГЭ)",
    category: "Образование и наука",
    price: 3500,
    description: `Помогаю школьникам и студентам подтянуть математику и физику.

Уровни:
• 5–11 класс (школьная программа)
• Подготовка к ЕНТ / пробные тесты
• Студенты 1–2 курса (высшая математика, линейная алгебра)

Форматы:
• Онлайн (Zoom / Teams) — удобно из любого места
• Офлайн — выезд в 7–12 мкр

Обо мне:
— Диплом с отличием, КазНТУ (математика и информатика)
— 4 года репетиторского опыта
— 15 учеников сдали ЕНТ на 110+ баллов

Первое занятие — пробное, бесплатно!`,
    phone: "+7 707 444-55-66",
    whatsapp: "+77074445566",
    telegram: "@dina_math",
  },
  {
    user_id: uMarat,
    title: "Ремонт телефонов, ноутбуков и планшетов",
    category: "IT, интернет и дизайн",
    price: 3000,
    description: `Ремонтирую телефоны и ноутбуки любых марок. Работаю в Актау с 2018 года.

Телефоны:
• Замена экранов (iPhone, Samsung, Xiaomi, Huawei и др.)
• Замена аккумуляторов, кнопок, зарядных разъёмов
• Программный ремонт (прошивка, восстановление данных)

Ноутбуки / планшеты:
• Замена клавиатуры, экрана, петель
• Чистка от пыли + замена термопасты
• Установка SSD, апгрейд RAM

Гарантия: 90 дней на все работы
Срочный ремонт: от 30 минут
Адрес: 9 мкр, ТД «Техноград»`,
    phone: "+7 701 999-88-77",
    whatsapp: "+77019998877",
    telegram: "@marat_repair",
  },
  {
    user_id: uAigerim,
    title: "Дизайн логотипов, баннеров, соцсетей",
    category: "IT, интернет и дизайн",
    price: 15000,
    description: `Создаю современный визуальный контент для бизнеса и личного бренда.

Услуги:
• Разработка логотипа + фирменный стиль (брендбук)
• Дизайн постов и сторис для Instagram / Telegram
• Баннеры для рекламных кампаний
• Дизайн визиток, флаеров, листовок
• Обработка и ретушь фотографий

Стек: Figma, Adobe Illustrator, Photoshop

Портфолио отправлю в Telegram.
Сроки: логотип — 3 дня, баннер — 1 день.`,
    phone: "+7 747 222-33-44",
    whatsapp: "+77472223344",
    telegram: "@aigerim_design",
  },
  {
    user_id: uAlibek,
    title: "Грузчики и разнорабочие — переезды по Актау",
    category: "Рабочий персонал",
    price: 4000,
    description: `Помогаю с переездами, разгрузкой/погрузкой и мелкими строительными работами.

Что делаем:
• Квартирные и офисные переезды
• Погрузка/разгрузка мебели, техники, стройматериалов
• Сборка и разборка мебели
• Вынос строительного мусора

Работаем бригадой 2–4 человека.
Газель под заказ — есть.
Звоните в любое время, выезд по городу быстро.`,
    phone: "+7 777 111-22-33",
    whatsapp: "+77771112233",
    telegram: "@alibek_master",
  },
  {
    user_id: uDina,
    title: "Бухгалтерские услуги для ИП и ТОО",
    category: "Бухгалтерия и финансы",
    price: 25000,
    description: `Веду бухгалтерию для малого бизнеса в Актау — удалённо и с выездом.

Для ИП:
• Постановка и ведение налогового учёта
• Сдача деклараций (ФНО 910, 912)
• Расчёт зарплаты и ОПВ/СО

Для ТОО:
• Полное ведение бухгалтерии (МСФО / НСФО)
• Подготовка отчётности в налоговые органы
• Работа с 1С: Бухгалтерия

Опыт: 6 лет, работала главбухом в строительной компании.
Сдала 200+ деклараций без штрафов.

Первый месяц — скидка 20%.`,
    phone: "+7 707 444-55-66",
    whatsapp: "+77074445566",
    telegram: "@dina_buh",
  },
];

const insertedServiceIds = [];
for (const s of services) {
  const r = insertService.run(
    s.user_id, s.title, s.category, s.price, s.description,
    s.phone, s.whatsapp, s.telegram
  );
  insertedServiceIds.push(r.lastInsertRowid);
}
console.log("✓ Services inserted:", insertedServiceIds);

// ── 5. Insert ad chats (оживлённые переписки) ─────────────────────────────────
const insertMsg = db.prepare(`
  INSERT INTO ad_messages (ad_id, sender_id, message, is_read, client_id, created_at)
  VALUES (?, ?, ?, 1, ?, datetime('now', ? || ' minutes'))
`);

// Chat 1: Ads[0] (Инженер КМГ) — KMG employer + Alibek applicant
const adKMG = insertedAdIds[0];
[
  [adKMG, uAlibek, uAlibek, "Добрый день! Меня заинтересовала вакансия инженера-технолога. Работал 4 года на ПКОП в Павлодаре. Можно отправить резюме?", -60],
  [adKMG, uKMG,   uAlibek, "Здравствуйте! Конечно, отправляйте на hr@kmg-aktau.kz. Укажите в теме «Инженер-технолог — Актау».", -55],
  [adKMG, uAlibek, uAlibek, "Отправил! Также хотел уточнить — вахта 28/28 или есть вариант стационара в Актау?", -50],
  [adKMG, uKMG,   uAlibek, "Для данной позиции возможен стационар, если есть прописка в Актау или Мангистауской области. Резюме посмотрим и свяжемся в течение 2 рабочих дней.", -45],
  [adKMG, uAlibek, uAlibek, "Отлично, спасибо! Жду обратной связи.", -40],
  [adKMG, uKMG,   uAlibek, "Алибек, просмотрели ваше резюме. Опыт соответствует. Готовы пригласить на собеседование в четверг, 15:00. Удобно?", -20],
  [adKMG, uAlibek, uAlibek, "Да, четверг 15:00 — подхожу. Адрес офиса подскажете?", -15],
  [adKMG, uKMG,   uAlibek, "Центр, ул. Абая 12, бизнес-центр «Мангыстау», 4 этаж. Возьмите с собой паспорт и копию диплома.", -10],
].forEach(([ad, sender, client, msg, offset]) =>
  insertMsg.run(ad, sender, msg, client, String(offset))
);

// Chat 2: Ads[2] (Администратор Гранд Отель) — Hotel employer + Dina applicant
const adHotel = insertedAdIds[2];
[
  [adHotel, uDina,  uDina,  "Здравствуйте! Интересует вакансия администратора. У меня опыт 1 год в кафе, есть английский B2. Рассматриваете без опыта в отеле?", -90],
  [adHotel, uHotel, uDina,  "Добрый день, Дина! Да, рассматриваем кандидатов без прямого опыта в отелях при наличии хорошего английского. Пришлите фото и краткое CV.", -85],
  [adHotel, uDina,  uDina,  "Отправила на почту. Также хотела спросить — есть ли ночные смены? Я студентка очного отделения.", -80],
  [adHotel, uHotel, uDina,  "Да, есть ночные смены 20:00–08:00. Для студентов это иногда удобнее. График согласовываем при оформлении.", -75],
  [adHotel, uDina,  uDina,  "Это было бы идеально. Жду вашего решения!", -70],
  [adHotel, uHotel, uDina,  "Дина, приглашаем вас на собеседование. Пятница, 11:00, отель «Гранд», стойка ресепшн. Спросите Аиду.", -30],
  [adHotel, uDina,  uDina,  "Буду обязательно, спасибо большое!", -28],
].forEach(([ad, sender, client, msg, offset]) =>
  insertMsg.run(ad, sender, msg, client, String(offset))
);

// Chat 3: Ads[3] (Менеджер продаж) — Nursultan + Marat
const adSales = insertedAdIds[3];
[
  [adSales, uMarat, uMarat, "Добрый день! Меня интересует позиция менеджера. Работал 2 года в продажах стройматериалов в Алматы. Переехал в Актау месяц назад.", -120],
  [adSales, uN,    uMarat,  "Здравствуйте! Хороший опыт. Вы знакомы с программами 1С или CRM? Есть ли своя клиентская база по Актау?", -115],
  [adSales, uMarat, uMarat, "Работал в Bitrix24 и 1С:Торговля. Базы по Актау пока нет, но активно знакомлюсь с рынком — уже провёл несколько встреч с прорабами.", -110],
  [adSales, uN,    uMarat,  "Это плюс. Зарплата у нас: оклад 120к + 3% от сделок. При выполнении плана в 5 млн в месяц выходит 250–270к. Вас устраивают условия?", -105],
  [adSales, uMarat, uMarat, "Да, меня интересует. Когда можно подъехать на встречу?", -100],
  [adSales, uN,    uMarat,  "Завтра в 10:00. 8 мкр, офис «АктауСтрой», желтое здание напротив Atakent.", -95],
].forEach(([ad, sender, client, msg, offset]) =>
  insertMsg.run(ad, sender, msg, client, String(offset))
);

// Chat 4: Ads[4] (Повар «Каспий») — Nursultan + Aigerim
const adCook = insertedAdIds[4];
[
  [adCook, uAigerim, uAigerim, "Добрый день! Вижу вакансию повара. Работаю поваром 5 лет, последнее место — ресторан «Шёлковый путь» в Актобе. Есть место для повара с опытом?", -150],
  [adCook, uN,       uAigerim, "Здравствуйте! Конечно, рассматриваем опытных специалистов. Какие кухни знаете, есть ли опыт работы с казахской и европейской?", -145],
  [adCook, uAigerim, uAigerim, "Казахская кухня — основная, также знаю итальянскую и паназиатскую. Есть навык работы на холодных закусках и горячем цеху.", -140],
  [adCook, uN,       uAigerim, "Отлично. У нас меню делает ставку на рыбу Каспия и традиционные казахские блюда. Есть санитарная книжка?", -135],
  [adCook, uAigerim, uAigerim, "Действующая санкнижка есть. Могу выйти уже с следующей недели.", -130],
  [adCook, uN,       uAigerim, "Приходите на дегустационный день — вторник, 9:00. Адрес: набережная, 5 мкр, ресторан «Каспий». Приготовите 2–3 блюда, посмотрим на технику.", -60],
  [adCook, uAigerim, uAigerim, "Принято, буду во вторник в 9:00. Что именно предпочтительно приготовить?", -55],
  [adCook, uN,       uAigerim, "На ваш выбор из нашего меню — пришлю PDF. Ждём вас!", -50],
].forEach(([ad, sender, client, msg, offset]) =>
  insertMsg.run(ad, sender, msg, client, String(offset))
);

// Chat 5: Ads[5] (Водитель-курьер) — Hotel + real user
const adDriver = insertedAdIds[5];
[
  [adDriver, u1, u1, "Добрый день! Есть категория B с 2015 года, Актау знаю как свои пять пальцев. Работал курьером в 2022–2023. Актуальна ли вакансия?", -200],
  [adDriver, uHotel, u1, "Здравствуйте! Да, актуальна. Сколько лет без ДТП?", -195],
  [adDriver, u1, u1, "Ни одного за 10 лет, справка ГИБДД чистая.", -190],
  [adDriver, uHotel, u1, "Отлично. График: пн–пт 09:00–18:00, иногда суббота. Устраивает?", -185],
  [adDriver, u1, u1, "Да, устраивает. Машину предоставляете или на своей?", -180],
  [adDriver, uHotel, u1, "Корпоративный Largus предоставляем, топливная карта. Своя не нужна. Подъезжайте с паспортом и правами — оформим быстро.", -175],
  [adDriver, u1, u1, "Когда удобнее подъехать?", -170],
  [adDriver, uHotel, u1, "Сегодня до 17:00 или завтра с 10:00. 12 мкр, офис АктауЭкспресс, 3 этаж.", -165],
].forEach(([ad, sender, client, msg, offset]) =>
  insertMsg.run(ad, sender, msg, client, String(offset))
);

console.log("✓ Ad chats inserted");

// ── 6. Insert service orders + service_messages ──────────────────────────────
const insertOrder = db.prepare(`
  INSERT INTO service_orders (service_id, client_id, provider_id, status, payment_status, created_at)
  VALUES (?, ?, ?, ?, 'unpaid', datetime('now', ? || ' days'))
`);

const insertSvcMsg = db.prepare(`
  INSERT INTO service_messages (order_id, sender_id, message, is_read, created_at)
  VALUES (?, ?, ?, 1, datetime('now', ? || ' minutes'))
`);

// Order 1: Alibek's plumbing service — Marat ordered, in work
const orderId1 = insertOrder.run(insertedServiceIds[0], uMarat, uAlibek, "accepted", "-3").lastInsertRowid;
[
  [orderId1, uMarat,  "Здравствуйте! Хочу вызвать вас по поводу течи под раковиной на кухне. Когда сможете приехать?", -200],
  [orderId1, uAlibek, "Привет! Сегодня после 18:00 или завтра утром — что удобнее?", -195],
  [orderId1, uMarat,  "Давайте завтра в 10 утра. 9 мкр, дом 14, кв. 38.", -190],
  [orderId1, uAlibek, "Записал. Буду в 10:00. Подготовьте ведро под раковину — там может быть вода при осмотре.", -185],
  [orderId1, uMarat,  "Хорошо, жду!", -180],
  [orderId1, uAlibek, "Приехал, осмотрел — треснул гибкий шланг подводки. Нужно заменить. Шланг есть с собой, работа займёт 15 минут. Итого 3 500 ₸.", -90],
  [orderId1, uMarat,  "Отлично, делайте!", -85],
  [orderId1, uAlibek, "Готово! Проверьте, всё держит. Чек и гарантийный талон оставил на столе.", -60],
  [orderId1, uMarat,  "Всё отлично, спасибо! Быстро и аккуратно.", -55],
].forEach(([oid, sender, msg, offset]) =>
  insertSvcMsg.run(oid, sender, msg, String(offset))
);

// Order 2: Dina's tutoring — Aigerim ordered, under review
const orderId2 = insertOrder.run(insertedServiceIds[1], uAigerim, uDina, "under_review", "-7").lastInsertRowid;
[
  [orderId2, uAigerim, "Добрый день, Дина! Моей дочке 10 класс, хочет сдать ЕНТ на 120+. Занимаетесь с 10-классниками?", -300],
  [orderId2, uDina,    "Здравствуйте! Да, конечно, 10–11 класс — основная часть моих учеников. Расскажите, какие темы западают больше всего?", -295],
  [orderId2, uAigerim, "Тригонометрия и задачи на производную совсем не идут. Алгебра в целом слабее геометрии.", -290],
  [orderId2, uDina,    "Это стандартная ситуация для 10 класса. Предлагаю начать с пробного занятия 1,5 часа — разберём текущий уровень и составим план. Стоимость пробного — 0 ₸.", -285],
  [orderId2, uAigerim, "Здорово! Когда можно начать?", -280],
  [orderId2, uDina,    "В пятницу вечером свободно, 18:30–20:00. Онлайн через Zoom — удобно?", -275],
  [orderId2, uAigerim, "Да, отлично! Жду ссылку.", -270],
  [orderId2, uDina,    "Ссылку пришлю за 15 минут до занятия. До пятницы!", -265],
  [orderId2, uAigerim, "Дина, занятие прошло отлично! Дочь говорит, что наконец поняла производные. Продолжаем?", -50],
  [orderId2, uDina,    "Рада слышать! Да, по итогам занятия вижу хорошую базу — нужно 2 месяца усиленной работы. Предлагаю 2 раза в неделю.", -45],
].forEach(([oid, sender, msg, offset]) =>
  insertSvcMsg.run(oid, sender, msg, String(offset))
);

// Order 3: Marat's phone repair — u1 ordered, completed
const orderId3 = insertOrder.run(insertedServiceIds[2], u1, uMarat, "completed", "-14").lastInsertRowid;
[
  [orderId3, u1,    "Привет! Разбил экран на iPhone 12, нужна замена. Сколько стоит и как быстро?", -400],
  [orderId3, uMarat, "Привет! Экран iPhone 12 — 18 000 ₸ (оригинал) или 12 000 (совместимый). Срок — 1 час. Когда сможешь приехать?", -395],
  [orderId3, u1,    "Сегодня после 15:00 могу. Оригинальный берите — не хочу с дисплеем рисковать.", -390],
  [orderId3, uMarat, "Ок, до 17:00 приходи. Адрес: 9 мкр, ТД Техноград, 1 этаж, павильон 12.", -385],
  [orderId3, u1,    "Буду в 15:30.", -380],
  [orderId3, uMarat, "Готово! Экран поменяли, всё работает. Face ID проверили — в норме.", -300],
  [orderId3, u1,    "Огонь, спасибо! Аккуратно сделано, доволен.", -295],
].forEach(([oid, sender, msg, offset]) =>
  insertSvcMsg.run(oid, sender, msg, String(offset))
);

console.log("✓ Service orders and chats inserted");

db.pragma("foreign_keys = ON");
db.close();
console.log("\n🎉 Seed complete! Restart the server to apply changes.");
