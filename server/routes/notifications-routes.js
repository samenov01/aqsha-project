const { Router } = require("express");
const { all, get, run } = require("../db/client");
const { asyncHandler } = require("../lib/async-handler");
const { notFound } = require("../lib/http-error");
const { parsePositiveInt } = require("../lib/validators");
const { authMiddleware } = require("../middleware/auth");

const notificationsRouter = Router();

notificationsRouter.get(
  "/notifications",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const rows = await all(
      `
        SELECT * FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `,
      [req.user.id]
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        link: row.link,
        isRead: Boolean(row.is_read),
        createdAt: row.created_at,
      }))
    );
  })
);

notificationsRouter.get(
  "/notifications/unread-count",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const row = await get(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0",
      [req.user.id]
    );
    res.json({ count: row?.count || 0 });
  })
);

notificationsRouter.patch(
  "/notifications/:id/read",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const notificationId = parsePositiveInt(req.params.id, "id");

    const existing = await get(
      "SELECT id FROM notifications WHERE id = ? AND user_id = ?",
      [notificationId, req.user.id]
    );

    if (!existing) {
      throw notFound("Уведомление не найдено");
    }

    await run("UPDATE notifications SET is_read = 1 WHERE id = ?", [notificationId]);
    res.json({ ok: true });
  })
);

notificationsRouter.patch(
  "/notifications/read-all",
  authMiddleware,
  asyncHandler(async (req, res) => {
    await run("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [req.user.id]);
    res.json({ ok: true });
  })
);

module.exports = {
  notificationsRouter,
};
