/**
 * Telegram Bot for Aqsha — employment platform for Mangystau.
 * Features: job listings with inline keyboards, account linking, AI match,
 * quick apply (one click), and proactive seeker notifications.
 */

const { all, get, run } = require("./db/client");

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const PLATFORM_URL = (process.env.PLATFORM_URL || "https://aqsha.kz").replace(/\/$/, "");

// ─── Low-level Telegram API helpers ──────────────────────────────────────────

async function tgRequest(method, body) {
  if (!TELEGRAM_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    });
    return await res.json();
  } catch (_) {
    return null;
  }
}

const MAIN_KEYBOARD = {
  reply_markup: {
    keyboard: [
      [{ text: "📋 Вакансии" }, { text: "🤖 AI Подбор" }],
      [{ text: "✅ Откликнуться" }, { text: "👤 Мой профиль" }],
      [{ text: "ℹ️ Помощь" }],
    ],
    resize_keyboard: true,
    persistent: true,
  },
};

async function sendMessage(chatId, text, extra = {}) {
  return tgRequest("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    ...MAIN_KEYBOARD,
    ...extra,
  });
}

async function answerCallback(callbackQueryId, text, showAlert = false) {
  return tgRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

// Public API used by other route modules
async function notifyTelegram(chatId, text) {
  if (!chatId) return;
  await sendMessage(chatId, text);
}

// ─── Proactive: notify matching seekers when a new job is posted ──────────────

async function notifyMatchingSeekers(job) {
  if (!TELEGRAM_TOKEN) return;
  try {
    const seekers = await all(
      `SELECT telegram_chat_id, skills, preferred_microrayon
       FROM users
       WHERE role = 'seeker'
         AND telegram_chat_id IS NOT NULL AND telegram_chat_id != ''
         AND skills IS NOT NULL AND skills != ''`
    );

    const jobTokens = new Set(
      `${job.title} ${job.category} ${job.skills || ""} ${job.description}`
        .toLowerCase()
        .split(/[\s,]+/)
        .filter((w) => w.length > 2)
    );

    for (const seeker of seekers) {
      const seekerTokens = (seeker.skills || "").toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2);
      const matchCount = seekerTokens.filter((t) => jobTokens.has(t)).length;
      const locationMatch = seeker.preferred_microrayon && job.microrayon === seeker.preferred_microrayon;

      if (matchCount < 1 && !locationMatch) continue;

      const salary = job.price ? `${Number(job.price).toLocaleString("ru")} ₸/мес` : "по договорённости";
      await sendMessage(
        seeker.telegram_chat_id,
        `🎯 *Новая подходящая вакансия!*\n\n*${job.title}*\n💼 ${job.category}\n📍 ${job.microrayon || "Актау"}\n💰 ${salary}`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: "📋 Подробнее", url: `${PLATFORM_URL}/ad/${job.id}` },
              { text: "✅ Откликнуться", callback_data: `apply_${job.id}` },
            ]],
          },
        }
      );
    }
  } catch (err) {
    console.error("[TelegramBot] notifyMatchingSeekers error:", err.message);
  }
}

// ─── Command handlers ─────────────────────────────────────────────────────────

async function handleStart(chatId) {
  await sendMessage(chatId,
    `👋 Добро пожаловать в *Aqsha*!\n\n` +
    `🔍 Цифровая платформа занятости для молодёжи и малого бизнеса Мангистауской области.\n\n` +
    `📋 *Команды:*\n` +
    `/jobs — последние вакансии\n` +
    `/match — AI-подборка для вас\n` +
    `/link КОД — привязать аккаунт платформы\n` +
    `/help — помощь\n\n` +
    `🌐 Сайт: ${PLATFORM_URL}`
  );
}

async function handleJobs(chatId) {
  const jobs = await all(
    `SELECT id, title, category, price, microrayon, employment_type
     FROM ads WHERE status = 'active'
     ORDER BY created_at DESC LIMIT 5`
  );

  if (!jobs.length) {
    await sendMessage(chatId, "Пока нет активных вакансий. Загляните позже!");
    return;
  }

  await sendMessage(chatId, `📋 *Последние вакансии:*`);

  for (const job of jobs) {
    const salary = job.price ? `${Number(job.price).toLocaleString("ru")} ₸/мес` : "по договорённости";
    await sendMessage(
      chatId,
      `*${job.title}*\n💼 ${job.category}  📍 ${job.microrayon || "Актау"}\n💰 ${salary}  ⏱ ${job.employment_type || ""}`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "📋 Подробнее", url: `${PLATFORM_URL}/ad/${job.id}` },
            { text: "✅ Откликнуться", callback_data: `apply_${job.id}` },
          ]],
        },
      }
    );
  }
}

async function handleLink(chatId, token) {
  if (!token) {
    await sendMessage(chatId,
      `Введите код из профиля:\n\`/link ВАШ_КОД\`\n\n` +
      `Код можно получить на сайте → Профиль → Подключить Telegram.\n${PLATFORM_URL}/profile`
    );
    return;
  }

  const record = await get(
    `SELECT * FROM telegram_link_tokens WHERE token = ? AND expires_at > datetime('now')`,
    [token]
  );

  if (!record) {
    await sendMessage(chatId, "❌ Код не найден или устарел (действует 5 минут).\nПолучите новый на сайте: " + PLATFORM_URL + "/profile");
    return;
  }

  await run("UPDATE users SET telegram_chat_id = ? WHERE id = ?", [String(chatId), record.user_id]);
  await run("DELETE FROM telegram_link_tokens WHERE id = ?", [record.id]);

  const user = await get("SELECT name FROM users WHERE id = ?", [record.user_id]);
  await sendMessage(chatId,
    `✅ Аккаунт привязан! Привет, *${user?.name || ""}*!\n\n` +
    `Теперь вы будете получать уведомления о новых вакансиях прямо здесь.\n\n` +
    `Попробуйте /match — AI подберёт вакансии по вашим навыкам.`
  );
}

async function handleMatch(chatId) {
  const user = await get(
    "SELECT id, name, skills, preferred_microrayon FROM users WHERE telegram_chat_id = ?",
    [String(chatId)]
  );

  if (!user) {
    await sendMessage(chatId,
      `⚠️ Аккаунт не привязан.\n\nИспользуйте \`/link КОД\`\nКод получите на: ${PLATFORM_URL}/profile`
    );
    return;
  }

  if (!user.skills) {
    await sendMessage(chatId,
      `📝 Укажите навыки в профиле, чтобы AI мог подобрать вакансии:\n${PLATFORM_URL}/profile`
    );
    return;
  }

  const jobs = await all(
    `SELECT id, title, category, price, microrayon, employment_type, skills, description
     FROM ads WHERE status = 'active'
     ORDER BY created_at DESC LIMIT 50`
  );

  const userTokens = new Set(
    (user.skills || "").toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2)
  );

  const scored = jobs
    .map((job) => {
      const jobTokens = `${job.title} ${job.skills || ""} ${job.category}`.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2);
      const matches = jobTokens.filter((t) => userTokens.has(t)).length;
      const score = jobTokens.length ? Math.round((matches / jobTokens.length) * 100) : 0;
      const locBonus = user.preferred_microrayon && job.microrayon === user.preferred_microrayon ? 20 : 0;
      return { ...job, score: Math.min(100, score + locBonus) };
    })
    .filter((j) => j.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (!scored.length) {
    await sendMessage(chatId,
      `🔍 Точных совпадений не найдено.\nДобавьте больше навыков в профиле или смотрите все вакансии:\n${PLATFORM_URL}/market`
    );
    return;
  }

  await sendMessage(chatId, `🤖 *AI-подборка вакансий для ${user.name}:*`);

  for (const job of scored) {
    const salary = job.price ? `${Number(job.price).toLocaleString("ru")} ₸/мес` : "по договорённости";
    await sendMessage(
      chatId,
      `*${job.title}* — ${job.score}% совпадение\n💼 ${job.category}  📍 ${job.microrayon || "Актау"}\n💰 ${salary}`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "📋 Подробнее", url: `${PLATFORM_URL}/ad/${job.id}` },
            { text: "✅ Откликнуться", callback_data: `apply_${job.id}` },
          ]],
        },
      }
    );
  }
}

async function handleHelp(chatId) {
  await sendMessage(chatId,
    `ℹ️ *Aqsha — помощь*\n\n` +
    `/jobs — последние 5 вакансий с кнопкой отклика\n` +
    `/match — AI подберёт вакансии по вашим навыкам\n` +
    `/link КОД — привязать аккаунт с сайта\n` +
    `/start — главное меню\n\n` +
    `🌐 ${PLATFORM_URL}`
  );
}

// ─── Quick-apply via inline button ───────────────────────────────────────────

async function handleApplyCallback(query, jobId) {
  const chatId = query.message?.chat?.id;

  const user = await get(
    "SELECT id, name FROM users WHERE telegram_chat_id = ?",
    [String(chatId)]
  );

  if (!user) {
    await answerCallback(query.id, "⚠️ Привяжите аккаунт командой /link КОД", true);
    return;
  }

  const job = await get(
    "SELECT id, user_id, title FROM ads WHERE id = ? AND status = 'active'",
    [jobId]
  );

  if (!job) {
    await answerCallback(query.id, "Вакансия не найдена или уже закрыта.", true);
    return;
  }

  if (job.user_id === user.id) {
    await answerCallback(query.id, "Нельзя откликнуться на свою вакансию.", true);
    return;
  }

  const existing = await get(
    "SELECT id FROM applications WHERE job_id = ? AND applicant_id = ?",
    [jobId, user.id]
  );

  if (existing) {
    await answerCallback(query.id, "Вы уже откликались на эту вакансию.", true);
    return;
  }

  await run(
    "INSERT INTO applications (job_id, applicant_id, cover_letter) VALUES (?, ?, ?)",
    [jobId, user.id, "Отклик через Telegram"]
  );

  // Notify employer via Telegram if linked
  const employer = await get("SELECT telegram_chat_id, name FROM users WHERE id = ?", [job.user_id]);
  if (employer?.telegram_chat_id) {
    await sendMessage(
      employer.telegram_chat_id,
      `🔔 *Новый отклик!*\n*${user.name}* откликнулся на «${job.title}» через Telegram.\n\n👉 ${PLATFORM_URL}/ad/${job.id}`
    );
  }

  await answerCallback(query.id, "✅ Отклик отправлен!", true);
  await sendMessage(
    chatId,
    `✅ Вы откликнулись на *«${job.title}»*!\n\nРаботодатель получил уведомление. Следите за статусом:\n${PLATFORM_URL}/applications`
  );
}

// ─── Update router ────────────────────────────────────────────────────────────

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  // Commands
  if (text.startsWith("/start")) return handleStart(chatId);
  if (text.startsWith("/jobs")) return handleJobs(chatId);
  if (text.startsWith("/match")) return handleMatch(chatId);
  if (text.startsWith("/help")) return handleHelp(chatId);
  if (text.startsWith("/link")) {
    const token = text.split(/\s+/)[1]?.trim();
    return handleLink(chatId, token);
  }

  // Reply keyboard buttons
  if (text === "📋 Вакансии") return handleJobs(chatId);
  if (text === "🤖 AI Подбор") return handleMatch(chatId);
  if (text === "ℹ️ Помощь") return handleHelp(chatId);

  if (text === "👤 Мой профиль") {
    const user = await get("SELECT name, skills, preferred_microrayon FROM users WHERE telegram_chat_id = ?", [String(chatId)]);
    if (!user) {
      return sendMessage(chatId,
        `⚠️ Аккаунт не привязан.\n\nПолучите код на сайте и отправьте:\n\`/link КОД\`\n\n🌐 ${PLATFORM_URL}/profile`
      );
    }
    return sendMessage(chatId,
      `👤 *${user.name}*\n\n` +
      `🎯 Навыки: ${user.skills || "не указаны"}\n` +
      `📍 Район: ${user.preferred_microrayon || "не указан"}\n\n` +
      `Изменить профиль: ${PLATFORM_URL}/profile`
    );
  }

  if (text === "✅ Откликнуться") {
    const user = await get("SELECT id FROM users WHERE telegram_chat_id = ?", [String(chatId)]);
    if (!user) {
      return sendMessage(chatId,
        `⚠️ Сначала привяжите аккаунт:\n\`/link КОД\`\nКод из профиля: ${PLATFORM_URL}/profile`
      );
    }
    return handleJobs(chatId);
  }

  await sendMessage(chatId, `Используйте кнопки ниже или команды:\n/jobs — вакансии\n/match — AI подбор\n/help — помощь`);
}

async function handleCallbackQuery(query) {
  const data = query.data || "";
  if (data.startsWith("apply_")) {
    const jobId = parseInt(data.replace("apply_", ""), 10);
    if (jobId) await handleApplyCallback(query, jobId);
  }
}

// ─── Bot startup (long-polling) ───────────────────────────────────────────────

async function startTelegramBot() {
  if (!TELEGRAM_TOKEN) {
    console.log("[TelegramBot] No TELEGRAM_BOT_TOKEN — bot disabled.");
    return;
  }

  console.log("[TelegramBot] Starting polling...");
  let offset = 0;

  async function poll() {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${offset}&timeout=25&allowed_updates=["message","callback_query"]`,
        { signal: AbortSignal.timeout(30000) }
      );
      const data = await res.json();
      if (!data.ok || !data.result?.length) return;

      for (const update of data.result) {
        offset = update.update_id + 1;
        if (update.message) handleMessage(update.message).catch(console.error);
        if (update.callback_query) handleCallbackQuery(update.callback_query).catch(console.error);
      }
    } catch (_) {}
  }

  setInterval(poll, 3000);
  poll();
}

module.exports = { notifyTelegram, notifyMatchingSeekers, startTelegramBot };
