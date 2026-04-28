/**
 * Telegram Bot for JumysAI — employment platform for Mangystau.
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
    `👋 Добро пожаловать в *JumysAI*!\n\n` +
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

// ─── Claude AI helper for Telegram bot ────────────────────────────────────────

async function callClaudeForBot(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (data.error) {
      console.error("[TelegramBot] Claude API error:", data.error);
      return null;
    }
    return data.content?.[0]?.text || null;
  } catch (err) {
    console.error("[TelegramBot] Claude API request failed:", err.message);
    return null;
  }
}

function parseJsonArray(text) {
  if (!text) return null;
  try {
    const stripped = text.replace(/```(?:json)?/gi, "").trim();
    const match = stripped.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Simple token-based pre-scoring (fallback when Claude is unavailable)
function tokenMatchScore(jobText, userSkills) {
  const jobTokens = new Set(
    (jobText || "").toLowerCase().replace(/[^\wа-яёa-z0-9\s]/gi, " ").split(/\s+/).filter((w) => w.length > 2)
  );
  const userTokens = (userSkills || "").toLowerCase().replace(/[^\wа-яёa-z0-9\s]/gi, " ").split(/\s+/).filter((w) => w.length > 2);
  if (!jobTokens.size || !userTokens.length) return 0;
  let matchWeight = 0;
  for (const ut of userTokens) {
    if (jobTokens.has(ut)) { matchWeight += 1; continue; }
    const prefixLen = Math.max(4, Math.floor(ut.length * 0.7));
    if (ut.length >= prefixLen) {
      const prefix = ut.slice(0, prefixLen);
      for (const jt of jobTokens) {
        if (jt.startsWith(prefix) || ut.startsWith(jt.slice(0, prefixLen))) { matchWeight += 0.75; break; }
      }
    }
  }
  return Math.round((matchWeight / userTokens.length) * 100);
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

  await sendMessage(chatId, `🔄 Анализирую вакансии с помощью AI...`);

  const jobs = await all(
    `SELECT id, title, category, price, microrayon, employment_type, skills, description
     FROM ads WHERE status = 'active'
     ORDER BY created_at DESC LIMIT 50`
  );

  if (!jobs.length) {
    await sendMessage(chatId, `😔 Активных вакансий пока нет. Загляните позже!`);
    return;
  }

  // Pre-score with token matching
  const prescored = jobs.map((job) => {
    const jobText = `${job.title} ${job.category} ${job.skills || ""} ${job.description || ""}`;
    const tfidf = tokenMatchScore(jobText, user.skills);
    const locBonus = user.preferred_microrayon && job.microrayon === user.preferred_microrayon ? 20 : 0;
    return { ...job, _tfidf: tfidf, _locBonus: locBonus };
  });

  // Pick top 10 candidates for Claude
  const hasTfIdfSignal = prescored.some((j) => j._tfidf > 0);
  let top;
  if (hasTfIdfSignal) {
    prescored.sort((a, b) => b._tfidf - a._tfidf);
    top = prescored.slice(0, 10);
  } else {
    top = prescored.slice(0, 10);
  }

  // Try Claude AI semantic matching
  let claudeResults = null;
  if (process.env.ANTHROPIC_API_KEY) {
    const jobsSummary = top.map((j, i) =>
      `${i + 1}. ${j.title} | ${j.category} | навыки: ${j.skills || "—"}`
    ).join("\n");

    const prompt = `Ты AI-рекрутер платформы JumysAI (Казахстан). Отвечай ТОЛЬКО валидным JSON, без markdown, без пояснений.

Соискатель: "${user.skills}"

Вакансии:
${jobsSummary}

Верни JSON-массив ровно из ${top.length} объектов — по одному на каждую вакансию по порядку:
[{"score":75,"reason":"Навык дизайна совпадает со сферой IT/Дизайн"},{"score":5,"reason":"Строительство не связано с профилем"}]

score: 0–100. reason: одно короткое предложение на русском.`;

    const text = await callClaudeForBot(prompt);
    const parsed = parseJsonArray(text);
    if (parsed && Math.abs(parsed.length - top.length) <= 1) {
      while (parsed.length < top.length) parsed.push({ score: null, reason: null });
      claudeResults = parsed.slice(0, top.length);
    }
  }

  const aiPowered = Boolean(claudeResults);

  // Combine scores
  const scored = top.map((job, i) => {
    const claude = claudeResults?.[i];
    let skillsFinal;
    if (claude?.score != null) {
      skillsFinal = claude.score;
    } else {
      skillsFinal = Math.max(job._tfidf, user.skills ? 20 : 0);
    }
    const locScore = (!job.microrayon || !user.preferred_microrayon) ? 50
      : job.microrayon === user.preferred_microrayon ? 100 : 15;
    const finalScore = Math.min(100, Math.round(skillsFinal * 0.8 + locScore * 0.2));
    const reason = claude?.reason || (finalScore >= 50 ? "Совпадение по ключевым навыкам" : "Частичное совпадение");
    return { ...job, score: finalScore, reason };
  });

  scored.sort((a, b) => b.score - a.score);
  const results = scored.filter((j) => j.score > 10).slice(0, 5);

  if (!results.length) {
    await sendMessage(chatId,
      `🔍 Подходящих вакансий не найдено.\nДобавьте больше навыков в профиле или смотрите все вакансии:\n${PLATFORM_URL}/market`
    );
    return;
  }

  const header = aiPowered
    ? `🤖 *AI-подборка вакансий для ${user.name}:*`
    : `📋 *Подборка вакансий для ${user.name}:*\n_(AI недоступен — используется базовый подбор)_`;
  await sendMessage(chatId, header);

  for (const job of results) {
    const salary = job.price ? `${Number(job.price).toLocaleString("ru")} ₸/мес` : "по договорённости";
    const reasonLine = job.reason ? `\n💡 ${job.reason}` : "";
    await sendMessage(
      chatId,
      `*${job.title}* — ${job.score}% совпадение\n💼 ${job.category}  📍 ${job.microrayon || "Актау"}\n💰 ${salary}${reasonLine}`,
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
    `ℹ️ *JumysAI — помощь*\n\n` +
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
