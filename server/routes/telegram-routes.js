const { Router } = require("express");
const { run, get } = require("../db/client");
const { asyncHandler } = require("../lib/async-handler");
const { authMiddleware } = require("../middleware/auth");

const telegramRouter = Router();

// POST /api/telegram/link-token — generate a 6-digit one-time code (5 min TTL)
telegramRouter.post(
  "/telegram/link-token",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await run("DELETE FROM telegram_link_tokens WHERE user_id = ?", [req.user.id]);
    await run(
      "INSERT INTO telegram_link_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [req.user.id, token, expiresAt]
    );

    res.json({ token, expiresAt });
  })
);

// GET /api/telegram/status — is Telegram linked for current user?
telegramRouter.get(
  "/telegram/status",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await get("SELECT telegram_chat_id FROM users WHERE id = ?", [req.user.id]);
    res.json({ linked: Boolean(user?.telegram_chat_id) });
  })
);

// DELETE /api/telegram/unlink — unlink Telegram account
telegramRouter.delete(
  "/telegram/unlink",
  authMiddleware,
  asyncHandler(async (req, res) => {
    await run("UPDATE users SET telegram_chat_id = '' WHERE id = ?", [req.user.id]);
    res.json({ ok: true });
  })
);

module.exports = { telegramRouter };
