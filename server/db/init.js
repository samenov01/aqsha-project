const bcrypt = require("bcryptjs");
const { run, get } = require("./client");
const { DEFAULT_UNIVERSITY, CATEGORIES, DEMO_IMAGE } = require("../constants");

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

  try {
    await run("ALTER TABLE users ADD COLUMN balance INTEGER NOT NULL DEFAULT 0");
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
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'frozen', 'under_review', 'completed')),
      payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
      payment_paid_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE,
      FOREIGN KEY(client_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(provider_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  if (serviceOrdersInfo && !serviceOrdersInfo.sql.includes('under_review')) {
    await run("PRAGMA foreign_keys=OFF;");
    await run(createServiceOrdersSql.replace('service_orders', 'service_orders_new'));
    await run('INSERT INTO service_orders_new SELECT * FROM service_orders');
    await run('DROP TABLE service_orders');
    await run('ALTER TABLE service_orders_new RENAME TO service_orders');
    await run("PRAGMA foreign_keys=ON;");
  } else if (!serviceOrdersInfo) {
    await run(createServiceOrdersSql);
  }

  await run(
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

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
  const userResult = await run(
    `INSERT INTO users (name, email, university, password_hash, is_verified) VALUES (?, ?, ?, ?, ?)`,
    ["Demo User", "demo@aqsha.kz", DEFAULT_UNIVERSITY, passwordHash, 1]
  );

  const demoAds = [
    {
      title: "Сделаю презентацию за вечер",
      category: CATEGORIES[1],
      price: 9000,
      description: "Чистый дизайн, структура по дедлайну и правки до финала.",
      phone: "+7 777 111 22 33",
      telegram: "@aqsha_designer",
    },
    {
      title: "Куизы/NEO отвечаю",
      category: CATEGORIES[2],
      price: 7000,
      description: "Помогу с квизами, тестами и NEO A1/A2. Быстро и аккуратно.",
      whatsapp: "+7 701 555 10 10",
    },
    {
      title: "Сдам микронаушник для экзамена",
      category: CATEGORIES[3],
      price: 0,
      description: "Аренда микронаушника/петлички на экзамен, есть инструкции.",
      telegram: "@aqsha_micro",
    },
  ];

  for (const ad of demoAds) {
    const adResult = await run(
      `INSERT INTO ads (
        user_id, title, category, price, university, description,
        contact_phone, contact_whatsapp, contact_telegram
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userResult.lastID,
        ad.title,
        ad.category,
        ad.price,
        DEFAULT_UNIVERSITY,
        ad.description,
        ad.phone || "",
        ad.whatsapp || "",
        ad.telegram || "",
      ]
    );

    await run(`INSERT INTO images (ad_id, url) VALUES (?, ?)`, [adResult.lastID, DEMO_IMAGE]);
  }

  const demoServices = [
    {
      title: "Сделаю учебные работы под ключ",
      category: CATEGORIES[0],
      price: 15000,
      description: "Презентации, рефераты, эссе, доклады, БӨЖ/БОӨЖ.",
    },
    {
      title: "Помогу с квизами и NEO",
      category: CATEGORIES[2],
      price: 8000,
      description: "Куизы/тесты/NEO A1/A2, ответы на сессию.",
    },
  ];

  for (const service of demoServices) {
    const serviceResult = await run(
      `INSERT INTO services (
        user_id, title, category, price, university, description
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userResult.lastID,
        service.title,
        service.category,
        service.price,
        DEFAULT_UNIVERSITY,
        service.description,
      ]
    );

    await run(`INSERT INTO service_images (service_id, url) VALUES (?, ?)`, [
      serviceResult.lastID,
      DEMO_IMAGE,
    ]);
  }
}

module.exports = {
  initDb,
};
