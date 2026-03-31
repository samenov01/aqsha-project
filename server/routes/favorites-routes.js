const { Router } = require("express");
const { all, get, run } = require("../db/client");
const { asyncHandler } = require("../lib/async-handler");
const { badRequest } = require("../lib/http-error");
const { parsePositiveInt } = require("../lib/validators");
const { authMiddleware } = require("../middleware/auth");

const favoritesRouter = Router();

favoritesRouter.get(
  "/favorites",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const rows = await all(
      `SELECT f.id, f.ad_id, f.service_id, f.created_at,
              a.title as ad_title, a.price as ad_price, a.category as ad_category, a.status as ad_status,
              (SELECT url FROM images WHERE ad_id = a.id LIMIT 1) as ad_image,
              s.title as service_title, s.price as service_price, s.category as service_category,
              (SELECT url FROM service_images WHERE service_id = s.id LIMIT 1) as service_image
       FROM favorites f
       LEFT JOIN ads a ON a.id = f.ad_id
       LEFT JOIN services s ON s.id = f.service_id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        adId: row.ad_id,
        serviceId: row.service_id,
        createdAt: row.created_at,
        ad: row.ad_id
          ? {
              title: row.ad_title,
              price: row.ad_price,
              category: row.ad_category,
              status: row.ad_status,
              image: row.ad_image || "",
            }
          : null,
        service: row.service_id
          ? {
              title: row.service_title,
              price: row.service_price,
              category: row.service_category,
              image: row.service_image || "",
            }
          : null,
      }))
    );
  })
);

favoritesRouter.post(
  "/favorites",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { adId, serviceId } = req.body;
    if (!adId && !serviceId) throw badRequest("Укажите adId или serviceId");
    if (adId && serviceId) throw badRequest("Укажите только adId или serviceId");

    const parsedAdId = adId ? parsePositiveInt(adId, "adId") : null;
    const parsedServiceId = serviceId ? parsePositiveInt(serviceId, "serviceId") : null;

    const existing = await get(
      "SELECT id FROM favorites WHERE user_id = ? AND ad_id IS ? AND service_id IS ?",
      [req.user.id, parsedAdId, parsedServiceId]
    );
    if (existing) return res.json({ ok: true, id: existing.id });

    const result = await run(
      "INSERT INTO favorites (user_id, ad_id, service_id) VALUES (?, ?, ?)",
      [req.user.id, parsedAdId, parsedServiceId]
    );

    res.status(201).json({ ok: true, id: result.lastID });
  })
);

favoritesRouter.delete(
  "/favorites",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { adId, serviceId } = req.query;
    if (!adId && !serviceId) throw badRequest("Укажите adId или serviceId");

    const parsedAdId = adId ? parseInt(String(adId), 10) : null;
    const parsedServiceId = serviceId ? parseInt(String(serviceId), 10) : null;

    await run(
      "DELETE FROM favorites WHERE user_id = ? AND ad_id IS ? AND service_id IS ?",
      [req.user.id, parsedAdId, parsedServiceId]
    );

    res.json({ ok: true });
  })
);

// Get IDs of favorited items for the current user (for syncing client state)
favoritesRouter.get(
  "/favorites/ids",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const rows = await all(
      "SELECT ad_id, service_id FROM favorites WHERE user_id = ?",
      [req.user.id]
    );
    const adIds = rows.filter((r) => r.ad_id).map((r) => r.ad_id);
    const serviceIds = rows.filter((r) => r.service_id).map((r) => r.service_id);
    res.json({ adIds, serviceIds });
  })
);

module.exports = { favoritesRouter };
