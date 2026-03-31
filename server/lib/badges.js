const { run, get } = require("../db/client");

const BADGE_LABELS = {
  first_deal: "Первая сделка",
  deals_10: "10 сделок",
  deals_50: "50 сделок",
  top_rated: "Топ исполнитель",
};

async function awardBadge(userId, badge) {
  const result = await run(
    "INSERT OR IGNORE INTO user_badges (user_id, badge) VALUES (?, ?)",
    [userId, badge]
  );
  return result.changes > 0;
}

async function checkAndAwardBadges(providerId) {
  const countRow = await get(
    "SELECT COUNT(*) as count FROM service_orders WHERE provider_id = ? AND status = 'completed'",
    [providerId]
  );
  const count = countRow?.count || 0;

  if (count >= 1) await awardBadge(providerId, "first_deal");
  if (count >= 10) await awardBadge(providerId, "deals_10");
  if (count >= 50) await awardBadge(providerId, "deals_50");

  const ratingRow = await get(
    `SELECT ROUND(AVG(rating), 1) as avg, COUNT(*) as count
     FROM service_reviews
     WHERE provider_id = ? AND reviewer_type = 'client'`,
    [providerId]
  );
  if ((ratingRow?.count || 0) >= 5 && (ratingRow?.avg || 0) >= 4.5) {
    await awardBadge(providerId, "top_rated");
  }
}

module.exports = { checkAndAwardBadges, BADGE_LABELS };
