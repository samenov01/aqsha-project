const fs = require("fs");
const path = require("path");
const { Router } = require("express");
const { all, get, run } = require("../db/client");
const { CATEGORIES, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, MICRORAYONS, DEFAULT_UNIVERSITY, DEMO_IMAGE, AD_STATUSES } = require("../constants");
const { asyncHandler } = require("../lib/async-handler");
const { badRequest, forbidden, notFound } = require("../lib/http-error");
const { normalizeText, optionalText, parseLimit, parsePositiveInt, parsePrice, requireText } = require("../lib/validators");
const { authMiddleware } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { UPLOAD_DIR } = require("../config");
const { notifyMatchingSeekers } = require("../telegram-bot");

const adsRouter = Router();

function isCategoryAllowed(category) {
  return CATEGORIES.includes(category);
}

async function getImagesMap(adIds) {
  if (!adIds.length) return {};
  const placeholders = adIds.map(() => "?").join(",");
  const rows = await all(`SELECT ad_id, url FROM images WHERE ad_id IN (${placeholders})`, adIds);
  return rows.reduce((acc, row) => {
    if (!acc[row.ad_id]) acc[row.ad_id] = [];
    acc[row.ad_id].push(row.url);
    return acc;
  }, {});
}

function toAdDto(row, imagesMap) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    price: row.price,
    university: row.university,
    description: row.description,
    status: row.status,
    employmentType: row.employment_type || "",
    experienceLevel: row.experience_level || "",
    microrayon: row.microrayon || "",
    skills: row.skills || "",
    contacts: {
      phone: row.contact_phone,
      whatsapp: row.contact_whatsapp,
      telegram: row.contact_telegram,
    },
    user: {
      id: row.user_id,
      name: row.owner_name,
      university: row.owner_university,
      verified: Boolean(row.owner_verified),
      role: row.owner_role || "employer",
    },
    createdAt: row.created_at,
    images: imagesMap[row.id] || [],
  };
}

function cleanupUploadedFiles(files) {
  for (const file of files || []) {
    const filePath = path.join(UPLOAD_DIR, file.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

adsRouter.get("/meta", (_req, res) => {
  res.json({
    categories: CATEGORIES,
    employmentTypes: EMPLOYMENT_TYPES,
    experienceLevels: EXPERIENCE_LEVELS,
    microrayons: MICRORAYONS,
    defaultUniversity: DEFAULT_UNIVERSITY,
  });
});

adsRouter.get(
  "/ads",
  asyncHandler(async (req, res) => {
    const search = normalizeText(req.query.search).toLowerCase();
    const category = normalizeText(req.query.category);
    const employmentType = normalizeText(req.query.employmentType);
    const experienceLevel = normalizeText(req.query.experienceLevel);
    const microrayon = normalizeText(req.query.microrayon);
    const minPrice = req.query.minPrice ? parsePrice(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? parsePrice(req.query.maxPrice) : null;
    const limit = parseLimit(req.query.limit, 36);
    const sort = normalizeText(req.query.sort);

    if (category && !isCategoryAllowed(category)) {
      throw badRequest("Неизвестная категория");
    }

    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      throw badRequest("Минимальная зарплата не может быть больше максимальной");
    }

    const params = [];
    let sql = `
      SELECT ads.*, users.name AS owner_name, users.university AS owner_university,
             users.is_verified AS owner_verified, users.role AS owner_role
      FROM ads
      JOIN users ON users.id = ads.user_id
      WHERE ads.status = 'active'
    `;

    if (search) {
      sql += " AND (LOWER(ads.title) LIKE ? OR LOWER(ads.description) LIKE ? OR LOWER(ads.skills) LIKE ?)";
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    if (category) {
      sql += " AND ads.category = ?";
      params.push(category);
    }

    if (employmentType) {
      sql += " AND ads.employment_type = ?";
      params.push(employmentType);
    }

    if (experienceLevel) {
      sql += " AND ads.experience_level = ?";
      params.push(experienceLevel);
    }

    if (microrayon) {
      sql += " AND ads.microrayon = ?";
      params.push(microrayon);
    }

    if (minPrice !== null) {
      sql += " AND ads.price >= ?";
      params.push(minPrice);
    }

    if (maxPrice !== null) {
      sql += " AND ads.price <= ?";
      params.push(maxPrice);
    }

    let orderBy = "ads.created_at DESC";
    if (sort === "price_asc") orderBy = "ads.price ASC, ads.created_at DESC";
    else if (sort === "price_desc") orderBy = "ads.price DESC, ads.created_at DESC";

    sql += ` ORDER BY ${orderBy} LIMIT ?`;
    params.push(limit);

    const rows = await all(sql, params);
    const imagesMap = await getImagesMap(rows.map((r) => r.id));
    res.json(rows.map((r) => toAdDto(r, imagesMap)));
  })
);

adsRouter.get(
  "/ads/:id",
  asyncHandler(async (req, res) => {
    const adId = parsePositiveInt(req.params.id, "id");
    const row = await get(
      `SELECT ads.*, users.name AS owner_name, users.university AS owner_university,
              users.is_verified AS owner_verified, users.role AS owner_role
       FROM ads JOIN users ON users.id = ads.user_id WHERE ads.id = ?`,
      [adId]
    );

    if (!row) throw notFound("Вакансия не найдена");

    const imagesMap = await getImagesMap([row.id]);
    res.json(toAdDto(row, imagesMap));
  })
);

adsRouter.post(
  "/ads",
  authMiddleware,
  upload.array("images", 5),
  asyncHandler(async (req, res) => {
    try {
      const title = requireText(req.body.title, "Название вакансии", { min: 5, max: 120 });
      const category = requireText(req.body.category, "Сфера", { min: 2, max: 120 });
      const description = requireText(req.body.description, "Описание", { min: 20, max: 2000 });

      if (!isCategoryAllowed(category)) throw badRequest("Выберите сферу из списка");

      const price = parsePrice(req.body.price);
      const phone = optionalText(req.body.phone, { max: 32 });
      const whatsapp = optionalText(req.body.whatsapp, { max: 32 });
      const telegram = optionalText(req.body.telegram, { max: 64 });
      const employmentType = optionalText(req.body.employmentType, { max: 64 });
      const experienceLevel = optionalText(req.body.experienceLevel, { max: 64 });
      const microrayon = optionalText(req.body.microrayon, { max: 64 });
      const skills = optionalText(req.body.skills, { max: 500 });

      const adResult = await run(
        `INSERT INTO ads (
          user_id, title, category, price, university, description,
          contact_phone, contact_whatsapp, contact_telegram,
          employment_type, experience_level, microrayon, skills
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id, title, category, price, DEFAULT_UNIVERSITY, description,
          phone, whatsapp, telegram,
          employmentType, experienceLevel, microrayon, skills,
        ]
      );

      const imageUrls = [];
      if (req.files?.length) {
        for (const file of req.files) {
          const url = `/uploads/${file.filename}`;
          imageUrls.push(url);
          await run("INSERT INTO images (ad_id, url) VALUES (?, ?)", [adResult.lastID, url]);
        }
      } else {
        imageUrls.push(DEMO_IMAGE);
        await run("INSERT INTO images (ad_id, url) VALUES (?, ?)", [adResult.lastID, DEMO_IMAGE]);
      }

      const created = await get(
        `SELECT ads.*, users.name AS owner_name, users.university AS owner_university, users.role AS owner_role
         FROM ads JOIN users ON users.id = ads.user_id WHERE ads.id = ?`,
        [adResult.lastID]
      );

      // Fire-and-forget: notify matching seekers via Telegram
      notifyMatchingSeekers({
        id: adResult.lastID,
        title,
        category,
        price,
        description,
        microrayon: microrayon || "",
        skills: skills || "",
      }).catch(() => {});

      res.status(201).json(toAdDto(created, { [created.id]: imageUrls }));
    } catch (error) {
      cleanupUploadedFiles(req.files);
      throw error;
    }
  })
);

adsRouter.get(
  "/my/ads",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const rows = await all(
      `SELECT ads.*, users.name AS owner_name, users.university AS owner_university,
              users.is_verified AS owner_verified, users.role AS owner_role
       FROM ads JOIN users ON users.id = ads.user_id
       WHERE ads.user_id = ? ORDER BY ads.created_at DESC LIMIT 100`,
      [req.user.id]
    );
    const imagesMap = await getImagesMap(rows.map((r) => r.id));
    res.json(rows.map((r) => toAdDto(r, imagesMap)));
  })
);

adsRouter.delete(
  "/ads/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const adId = parsePositiveInt(req.params.id, "id");
    const ad = await get("SELECT id, user_id FROM ads WHERE id = ?", [adId]);
    if (!ad) throw notFound("Вакансия не найдена");
    if (ad.user_id !== req.user.id && !req.user.isAdmin) throw forbidden("Удалять можно только свои вакансии");

    const images = await all("SELECT url FROM images WHERE ad_id = ?", [adId]);
    await run("DELETE FROM ads WHERE id = ?", [adId]);

    for (const image of images) {
      if (image.url.startsWith("/uploads/")) {
        const filePath = path.join(UPLOAD_DIR, path.basename(image.url));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }

    res.json({ ok: true });
  })
);

adsRouter.patch(
  "/ads/:id/status",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const adId = parsePositiveInt(req.params.id, "id");
    const status = normalizeText(req.body.status);

    if (!AD_STATUSES.includes(status)) throw badRequest("Некорректный статус");

    const ad = await get("SELECT id, user_id FROM ads WHERE id = ?", [adId]);
    if (!ad) throw notFound("Вакансия не найдена");
    if (ad.user_id !== req.user.id && !req.user.isAdmin) throw forbidden("Недостаточно прав");

    await run("UPDATE ads SET status = ? WHERE id = ?", [status, adId]);
    res.json({ ok: true });
  })
);

module.exports = { adsRouter };
