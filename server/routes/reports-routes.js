const { Router } = require("express");
const { all, get, run } = require("../db/client");
const { asyncHandler } = require("../lib/async-handler");
const { badRequest, notFound } = require("../lib/http-error");
const { parsePositiveInt } = require("../lib/validators");
const { authMiddleware } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");

const reportsRouter = Router();

const VALID_TARGET_TYPES = ["ad", "service", "user"];
const VALID_REASONS = ["spam", "fraud", "inappropriate", "duplicate", "other"];

reportsRouter.post(
  "/reports",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const targetType = String(req.body.targetType || "");
    if (!VALID_TARGET_TYPES.includes(targetType)) {
      throw badRequest("Некорректный тип объекта");
    }

    const targetId = parsePositiveInt(req.body.targetId, "targetId");
    const reason = String(req.body.reason || "");
    if (!VALID_REASONS.includes(reason)) {
      throw badRequest("Выберите причину жалобы");
    }

    const comment = String(req.body.comment || "").slice(0, 500);

    // Prevent duplicate reports from same user
    const existing = await get(
      "SELECT id FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'pending'",
      [req.user.id, targetType, targetId]
    );
    if (existing) {
      return res.status(201).json({ ok: true });
    }

    await run(
      "INSERT INTO reports (reporter_id, target_type, target_id, reason, comment) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, targetType, targetId, reason, comment]
    );

    res.status(201).json({ ok: true });
  })
);

reportsRouter.get(
  "/admin/reports",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rows = await all(
      `SELECT r.*, u.name as reporter_name
       FROM reports r
       JOIN users u ON u.id = r.reporter_id
       ORDER BY r.created_at DESC
       LIMIT 200`
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        reporterName: row.reporter_name,
        targetType: row.target_type,
        targetId: row.target_id,
        reason: row.reason,
        comment: row.comment || "",
        status: row.status,
        createdAt: row.created_at,
      }))
    );
  })
);

reportsRouter.patch(
  "/admin/reports/:id",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const reportId = parsePositiveInt(req.params.id, "id");
    const status = String(req.body.status || "");

    if (!["reviewed", "dismissed"].includes(status)) {
      throw badRequest("Некорректный статус");
    }

    const report = await get("SELECT id FROM reports WHERE id = ?", [reportId]);
    if (!report) throw notFound("Жалоба не найдена");

    await run("UPDATE reports SET status = ? WHERE id = ?", [status, reportId]);
    res.json({ ok: true });
  })
);

module.exports = { reportsRouter };
