const bcrypt = require("bcryptjs");
const { run, get } = require("./client");
const { DEFAULT_UNIVERSITY, CATEGORIES, EMPLOYMENT_TYPES, MICRORAYONS, DEMO_IMAGE } = require("../constants");

async function initDb() {
  await run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      university TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_verified INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  try {
    await run("ALTER TABLE users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0");
  } catch (_error) {
    // Column already exists.
  }

  await run(
    `CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      transports TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  /* Recreate challenges table to support 'login' type and user_id=0 */
  await run("DROP TABLE IF EXISTS webauthn_challenges");
  await run(
    `CREATE TABLE IF NOT EXISTS webauthn_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL CHECK (type IN ('registration', 'authentication', 'login')),
      challenge TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS face_descriptors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      descriptor TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS ads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
      university TEXT NOT NULL,
      description TEXT NOT NULL,
      contact_phone TEXT DEFAULT '',
      contact_whatsapp TEXT DEFAULT '',
      contact_telegram TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      employment_type TEXT DEFAULT '',
      experience_level TEXT DEFAULT '',
      microrayon TEXT DEFAULT '',
      skills TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  try {
    await run("ALTER TABLE ads ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  } catch (_error) {
    // Column already exists.
  }
  await run("UPDATE ads SET status = 'active' WHERE status IS NULL OR status = ''");

  // New job-related columns
  try { await run("ALTER TABLE ads ADD COLUMN employment_type TEXT DEFAULT ''"); } catch (_) {}
  try { await run("ALTER TABLE ads ADD COLUMN experience_level TEXT DEFAULT ''"); } catch (_) {}
  try { await run("ALTER TABLE ads ADD COLUMN microrayon TEXT DEFAULT ''"); } catch (_) {}
  try { await run("ALTER TABLE ads ADD COLUMN skills TEXT DEFAULT ''"); } catch (_) {}

  await run(
    `CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      FOREIGN KEY(ad_id) REFERENCES ads(id) ON DELETE CASCADE
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
      university TEXT NOT NULL,
      description TEXT NOT NULL,
      contact_phone TEXT DEFAULT '',
      contact_whatsapp TEXT DEFAULT '',
      contact_telegram TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  try {
    await run("ALTER TABLE services ADD COLUMN contact_phone TEXT DEFAULT ''");
    await run("ALTER TABLE services ADD COLUMN contact_whatsapp TEXT DEFAULT ''");
    await run("ALTER TABLE services ADD COLUMN contact_telegram TEXT DEFAULT ''");
  } catch (_error) {
    // Columns already exist.
  }

  await run(
    `CREATE TABLE IF NOT EXISTS service_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
    )`
  );

  const serviceOrdersInfo = await get(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='service_orders'"
  );

  const createServiceOrdersSql = `
    CREATE TABLE IF NOT EXISTS service_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      provider_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'frozen', 'under_review', 'completed', 'cancelled')),
      payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
      payment_paid_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      commission_amount INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE,
      FOREIGN KEY(client_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(provider_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  const needsMigration = serviceOrdersInfo && (
    !serviceOrdersInfo.sql.includes('under_review') ||
    !serviceOrdersInfo.sql.includes('cancelled')
  );

  if (needsMigration) {
    await run("PRAGMA foreign_keys=OFF;");
    await run(createServiceOrdersSql.replace('service_orders', 'service_orders_new'));
    await run('INSERT INTO service_orders_new SELECT * FROM service_orders');
    await run('DROP TABLE service_orders');
    await run('ALTER TABLE service_orders_new RENAME TO service_orders');
    await run("PRAGMA foreign_keys=ON;");
  } else if (!serviceOrdersInfo) {
    await run(createServiceOrdersSql);
  }

  try {
    await run(
      "ALTER TABLE service_orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'"
    );
  } catch (_error) {
    // Column already exists.
  }
  await run(
    "UPDATE service_orders SET payment_status = 'unpaid' WHERE payment_status IS NULL OR payment_status = ''"
  );

  try {
    await run("ALTER TABLE service_orders ADD COLUMN payment_paid_at DATETIME");
  } catch (_error) {
    // Column already exists.
  }

  await run(
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link TEXT DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  try {
    await run("ALTER TABLE notifications ADD COLUMN link TEXT DEFAULT ''");
  } catch (_error) {
    // Column already exists.
  }

  await run(
    `CREATE TABLE IF NOT EXISTS ad_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      client_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(ad_id) REFERENCES ads(id) ON DELETE CASCADE,
      FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  try {
    await run("ALTER TABLE ad_messages ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0");
  } catch (_error) {
    // Column already exists.
  }

  try {
    await run("ALTER TABLE ad_messages ADD COLUMN client_id INTEGER");
    // Migrate existing messages
    await run(`
      UPDATE ad_messages
      SET client_id = sender_id
      WHERE sender_id NOT IN (
        SELECT user_id FROM ads WHERE ads.id = ad_messages.ad_id
      )
    `);
    
    // For messages sent by the owner, try to guess the client_id (the first non-owner sender in the same ad)
    await run(`
      UPDATE ad_messages
      SET client_id = (
        SELECT sender_id FROM ad_messages m2
        WHERE m2.ad_id = ad_messages.ad_id
          AND m2.sender_id != (SELECT user_id FROM ads WHERE ads.id = m2.ad_id)
        LIMIT 1
      )
      WHERE client_id IS NULL
    `);
  } catch (_error) {
    // Column already exists.
  }

  await run(
    `CREATE TABLE IF NOT EXISTS service_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES service_orders(id) ON DELETE CASCADE,
      FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  try {
    await run("ALTER TABLE service_messages ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0");
  } catch (_error) {
    // Column already exists.
  }

  await run(
    `CREATE TABLE IF NOT EXISTS service_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE,
      service_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      provider_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES service_orders(id) ON DELETE CASCADE,
      FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE,
      FOREIGN KEY(client_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(provider_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  // ── Job Applications (отклики) ────────────────────────────────────────
  await run(
    `CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      applicant_id INTEGER NOT NULL,
      cover_letter TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'accepted', 'rejected')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(job_id, applicant_id),
      FOREIGN KEY(job_id) REFERENCES ads(id) ON DELETE CASCADE,
      FOREIGN KEY(applicant_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  // User skills & role
  try { await run("ALTER TABLE users ADD COLUMN skills TEXT DEFAULT ''"); } catch (_) {}
  try { await run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'seeker'"); } catch (_) {}
  try { await run("ALTER TABLE users ADD COLUMN telegram_chat_id TEXT DEFAULT ''"); } catch (_) {}

  await run("CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON applications(applicant_id)");

  // User preferred microrayon (for AI location matching)
  try { await run("ALTER TABLE users ADD COLUMN preferred_microrayon TEXT DEFAULT ''"); } catch (_) {}

  // Telegram one-time link tokens
  await run(
    `CREATE TABLE IF NOT EXISTS telegram_link_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  // ── Reports (жалобы) ──────────────────────────────────────────────────
  await run(
    `CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL,
      target_type TEXT NOT NULL CHECK (target_type IN ('ad', 'service', 'user')),
      target_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      comment TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  // ── Favorites (избранное) ─────────────────────────────────────────────
  await run(
    `CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      ad_id INTEGER,
      service_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(ad_id) REFERENCES ads(id) ON DELETE CASCADE,
      FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
    )`
  );

  // ── User badges (достижения) ──────────────────────────────────────────
  await run(
    `CREATE TABLE IF NOT EXISTS user_badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      badge TEXT NOT NULL,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, badge)
    )`
  );

  // ── News cache (кэш новостей) ─────────────────────────────────────────
  await run(
    `CREATE TABLE IF NOT EXISTS news_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      image_url TEXT DEFAULT '',
      published_at TEXT DEFAULT '',
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  // ── Migrate service_reviews to support two-way reviews ────────────────
  const reviewsInfo = await get(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='service_reviews'"
  );
  if (reviewsInfo && !reviewsInfo.sql.includes("reviewer_type")) {
    await run("PRAGMA foreign_keys=OFF;");
    await run(
      `CREATE TABLE IF NOT EXISTS service_reviews_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        service_id INTEGER NOT NULL,
        client_id INTEGER NOT NULL,
        provider_id INTEGER NOT NULL,
        reviewer_type TEXT NOT NULL DEFAULT 'client' CHECK (reviewer_type IN ('client', 'provider')),
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(order_id, reviewer_type),
        FOREIGN KEY(order_id) REFERENCES service_orders(id) ON DELETE CASCADE,
        FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE,
        FOREIGN KEY(client_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(provider_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    );
    await run(
      `INSERT INTO service_reviews_new
         (id, order_id, service_id, client_id, provider_id, reviewer_type, rating, comment, created_at)
       SELECT id, order_id, service_id, client_id, provider_id, 'client', rating, comment, created_at
       FROM service_reviews`
    );
    await run("DROP TABLE service_reviews");
    await run("ALTER TABLE service_reviews_new RENAME TO service_reviews");
    await run("PRAGMA foreign_keys=ON;");
  }

  // ── Add commission_amount to service_orders ───────────────────────────
  try {
    await run(
      "ALTER TABLE service_orders ADD COLUMN commission_amount INTEGER NOT NULL DEFAULT 0"
    );
  } catch (_error) {
    // Column already exists.
  }

  await run("CREATE INDEX IF NOT EXISTS idx_ads_created_at ON ads(created_at DESC)");
  await run("CREATE INDEX IF NOT EXISTS idx_ads_user_id ON ads(user_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status)");
  await run("CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON webauthn_credentials(user_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user ON webauthn_challenges(user_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_images_ad_id ON images(ad_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at DESC)");
  await run("CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_service_images_service_id ON service_images(service_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_service_orders_service_id ON service_orders(service_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_service_orders_client_id ON service_orders(client_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_service_orders_provider_id ON service_orders(provider_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_service_messages_order_id ON service_messages(order_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_service_reviews_service_id ON service_reviews(service_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)");
  await run("CREATE INDEX IF NOT EXISTS idx_face_descriptors_user_id ON face_descriptors(user_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_ad_messages_ad_id ON ad_messages(ad_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_ad_messages_sender_id ON ad_messages(sender_id)");

  const adsCount = await get("SELECT COUNT(*) as count FROM ads");
  if (adsCount.count === 0) {
    await seedDemoData();
  }
}

async function seedDemoData() {
  const passwordHash = await bcrypt.hash("Demo12345", 10);

  const employer = await run(
    `INSERT INTO users (name, email, university, password_hash, is_verified, role) VALUES (?, ?, ?, ?, ?, ?)`,
    ["Кафе «Актау»", "employer@jumys.kz", DEFAULT_UNIVERSITY, passwordHash, 1, "employer"]
  );

  const demoJobs = [
    {
      title: "Официант / Бармен в кафе",
      category: CATEGORIES[0],
      price: 150000,
      employmentType: EMPLOYMENT_TYPES[0],
      experienceLevel: "Без опыта",
      microrayon: "5 мкр",
      skills: "общение,обслуживание,кассовый аппарат",
      description: "Требуется официант/бармен. График 2/2. Обучаем с нуля. Молодёжный коллектив. Чаевые от клиентов. Оформление по договору.",
      phone: "+7 701 123 45 67",
      whatsapp: "+7 701 123 45 67",
      telegram: "@aktau_cafe_hr",
    },
    {
      title: "Разнорабочий на стройку (вахта)",
      category: CATEGORIES[1],
      price: 200000,
      employmentType: EMPLOYMENT_TYPES[0],
      experienceLevel: "Без опыта",
      microrayon: "Жетыбай",
      skills: "физическая работа,инструменты,вахта",
      description: "Нужны разнорабочие на строительный объект в Жетыбае. Вахтовый метод 15/15. Жильё и питание предоставляем. Официальное трудоустройство.",
      phone: "+7 777 999 11 22",
      whatsapp: "+7 777 999 11 22",
    },
    {
      title: "Кассир в магазин продуктов",
      category: CATEGORIES[2],
      price: 120000,
      employmentType: EMPLOYMENT_TYPES[0],
      experienceLevel: "До 1 года",
      microrayon: "9 мкр",
      skills: "касса,1С,внимательность,честность",
      description: "Ищем кассира в продуктовый магазин. График 5/2. Опыт работы с кассой приветствуется. Ответственность и честность — главные качества.",
      phone: "+7 702 555 33 44",
      telegram: "@aktau_shop_job",
    },
    {
      title: "Мастер маникюра / Косметолог",
      category: CATEGORIES[3],
      price: 180000,
      employmentType: EMPLOYMENT_TYPES[0],
      experienceLevel: "1–3 года",
      microrayon: "3 мкр",
      skills: "маникюр,педикюр,косметология,клиентоориентированность",
      description: "Салон красоты приглашает мастера маникюра или косметолога. Место в аренду или процент от выручки. Готовая клиентская база. Удобный график.",
      phone: "+7 705 444 77 88",
      whatsapp: "+7 705 444 77 88",
    },
    {
      title: "Frontend-разработчик (Junior/Middle)",
      category: CATEGORIES[4],
      price: 350000,
      employmentType: EMPLOYMENT_TYPES[0],
      experienceLevel: "1–3 года",
      microrayon: "Центр",
      skills: "React,JavaScript,TypeScript,HTML,CSS,Git",
      description: "IT-компания Актау ищет Frontend-разработчика. Стек: React, TypeScript. Удалённая работа возможна. Молодая команда, интересные проекты.",
      phone: "+7 776 111 22 33",
      telegram: "@aktau_it_hr",
    },
    {
      title: "Водитель категории B/C (доставка)",
      category: CATEGORIES[5],
      price: 160000,
      employmentType: EMPLOYMENT_TYPES[0],
      experienceLevel: "До 1 года",
      microrayon: "12 мкр",
      skills: "вождение,категория B,GPS,пунктуальность",
      description: "Служба доставки ищет водителя. Наш автомобиль, топливо за наш счёт. График гибкий. Нужны права категории B и знание города Актау.",
      phone: "+7 747 222 55 66",
      whatsapp: "+7 747 222 55 66",
    },
  ];

  for (const job of demoJobs) {
    const adResult = await run(
      `INSERT INTO ads (
        user_id, title, category, price, university, description,
        contact_phone, contact_whatsapp, contact_telegram,
        employment_type, experience_level, microrayon, skills
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employer.lastID,
        job.title,
        job.category,
        job.price,
        DEFAULT_UNIVERSITY,
        job.description,
        job.phone || "",
        job.whatsapp || "",
        job.telegram || "",
        job.employmentType,
        job.experienceLevel,
        job.microrayon,
        job.skills,
      ]
    );

    await run(`INSERT INTO images (ad_id, url) VALUES (?, ?)`, [adResult.lastID, DEMO_IMAGE]);
  }

  // Demo seeker profiles (services)
  const seekerHash = await bcrypt.hash("Demo12345", 10);
  const seeker = await run(
    `INSERT INTO users (name, email, university, password_hash, is_verified, role, skills) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ["Азамат Оспанов", "seeker@jumys.kz", DEFAULT_UNIVERSITY, seekerHash, 1, "seeker", "React,JavaScript,Node.js,Python,Git"]
  );

  await run(
    `INSERT INTO services (user_id, title, category, price, university, description, contact_telegram) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [seeker.lastID, "Ищу работу: Junior Frontend Developer", CATEGORIES[4], 200000, DEFAULT_UNIVERSITY, "Молодой разработчик, 1 год опыта в React и JavaScript. Ищу стажировку или работу с наставником. Готов к обучению. Портфолио по запросу.", "@azamat_dev"]
  );
}

module.exports = {
  initDb,
};
