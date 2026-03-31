const { Router } = require("express");
const { all, get } = require("../db/client");
const { asyncHandler } = require("../lib/async-handler");
const { notFound } = require("../lib/http-error");
const { parsePositiveInt } = require("../lib/validators");

const profileRouter = Router();

profileRouter.get(
  "/users/:id/profile",
  asyncHandler(async (req, res) => {
    const userId = parsePositiveInt(req.params.id, "id");

    const user = await get(
      "SELECT id, name, university, is_verified, created_at FROM users WHERE id = ?",
      [userId]
    );
    if (!user) throw notFound("Пользователь не найден");

    const ads = await all(
      `SELECT id, title, category, price, status, created_at,
              (SELECT url FROM images WHERE ad_id = ads.id LIMIT 1) as image
       FROM ads
       WHERE user_id = ? AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );

    const services = await all(
      `SELECT s.id, s.title, s.category, s.price, s.created_at,
              (SELECT url FROM service_images WHERE service_id = s.id LIMIT 1) as image,
              ROUND(AVG(r.rating), 1) as rating_avg,
              COUNT(r.id) as rating_count
       FROM services s
       LEFT JOIN service_reviews r ON r.service_id = s.id AND r.reviewer_type = 'client'
       WHERE s.user_id = ?
       GROUP BY s.id
       ORDER BY s.created_at DESC
       LIMIT 20`,
      [userId]
    );

    const stats = await get(
      `SELECT
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders
       FROM service_orders
       WHERE provider_id = ?`,
      [userId]
    );

    const ratingStats = await get(
      `SELECT ROUND(AVG(rating), 1) as avg, COUNT(*) as count
       FROM service_reviews
       WHERE provider_id = ? AND reviewer_type = 'client'`,
      [userId]
    );

    const badges = await all(
      "SELECT badge, earned_at FROM user_badges WHERE user_id = ? ORDER BY earned_at ASC",
      [userId]
    );

    const reviews = await all(
      `SELECT r.rating, r.comment, r.created_at, u.name as client_name
       FROM service_reviews r
       JOIN users u ON u.id = r.client_id
       WHERE r.provider_id = ? AND r.reviewer_type = 'client'
       ORDER BY r.created_at DESC
       LIMIT 10`,
      [userId]
    );

    res.json({
      id: user.id,
      name: user.name,
      university: user.university,
      isVerified: Boolean(user.is_verified),
      joinedAt: user.created_at,
      stats: {
        completedOrders: stats?.completed_orders || 0,
        ratingAvg: ratingStats?.avg || null,
        ratingCount: ratingStats?.count || 0,
      },
      badges: badges.map((b) => ({ badge: b.badge, earnedAt: b.earned_at })),
      ads: ads.map((a) => ({
        id: a.id,
        title: a.title,
        category: a.category,
        price: a.price,
        status: a.status,
        createdAt: a.created_at,
        image: a.image || "",
      })),
      services: services.map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category,
        price: s.price,
        createdAt: s.created_at,
        image: s.image || "",
        ratingAvg: s.rating_avg || null,
        ratingCount: s.rating_count || 0,
      })),
      reviews: reviews.map((r) => ({
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
        clientName: r.client_name,
      })),
    });
  })
);

module.exports = { profileRouter };
