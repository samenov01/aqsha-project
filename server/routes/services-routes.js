const fs = require("fs");
const path = require("path");
const { Router } = require("express");
const { all, get, run } = require("../db/client");
const { CATEGORIES, DEFAULT_UNIVERSITY, DEMO_IMAGE } = require("../constants");
const { asyncHandler } = require("../lib/async-handler");
const { badRequest, forbidden, notFound } = require("../lib/http-error");
const {
  normalizeText,
  parseLimit,
  parsePositiveInt,
  parsePrice,
  requireText,
} = require("../lib/validators");
const { authMiddleware } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { UPLOAD_DIR } = require("../config");

const servicesRouter = Router();

function isCategoryAllowed(category) {
  return CATEGORIES.includes(category);
}

async function getServiceImagesMap(serviceIds) {
  if (!serviceIds.length) {
    return {};
  }

  const placeholders = serviceIds.map(() => "?").join(",");
  const rows = await all(
    `SELECT service_id, url FROM service_images WHERE service_id IN (${placeholders})`,
    serviceIds
  );

  return rows.reduce((acc, row) => {
    if (!acc[row.service_id]) acc[row.service_id] = [];
    acc[row.service_id].push(row.url);
    return acc;
  }, {});
}

async function getServiceRatingsMap(serviceIds) {
  if (!serviceIds.length) {
    return {};
  }

  const placeholders = serviceIds.map(() => "?").join(",");
  const rows = await all(
    `
      SELECT service_id, AVG(rating) as rating_avg, COUNT(*) as rating_count
      FROM service_reviews
      WHERE service_id IN (${placeholders})
      GROUP BY service_id
    `,
    serviceIds
  );

  return rows.reduce((acc, row) => {
    acc[row.service_id] = {
      avg: row.rating_avg ? Number(row.rating_avg) : 0,
      count: row.rating_count || 0,
    };
    return acc;
  }, {});
}

function toServiceDto(row, imagesMap, ratingsMap) {
  const rating = ratingsMap[row.id] || { avg: 0, count: 0 };

  return {
    id: row.id,
    title: row.title,
    category: row.category,
    price: row.price,
    university: row.university,
    description: row.description,
    phone: row.contact_phone || "",
    whatsapp: row.contact_whatsapp || "",
    telegram: row.contact_telegram || "",
    createdAt: row.created_at,
    images: imagesMap[row.id] || [],
    ratingAvg: rating.avg,
    ratingCount: rating.count,
    user: {
      id: row.user_id,
      name: row.owner_name,
      university: row.owner_university,
      verified: Boolean(row.owner_verified),
    },
  };
}

function cleanupUploadedFiles(files) {
  for (const file of files || []) {
    const filePath = path.join(UPLOAD_DIR, file.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

servicesRouter.get(
  "/services",
  asyncHandler(async (req, res) => {
    const search = normalizeText(req.query.search).toLowerCase();
    const category = normalizeText(req.query.category);
    const minPrice = req.query.minPrice ? parsePrice(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? parsePrice(req.query.maxPrice) : null;
    const limit = parseLimit(req.query.limit, 24);
    const minRating = req.query.minRating ? Number(req.query.minRating) : null;
    const sort = normalizeText(req.query.sort);

    if (category && !isCategoryAllowed(category)) {
      throw badRequest("Неизвестная категория");
    }

    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      throw badRequest("Минимальная цена не может быть больше максимальной");
    }

    if (minRating !== null) {
      if (!Number.isFinite(minRating) || minRating < 0 || minRating > 5) {
        throw badRequest("Некорректное значение рейтинга");
      }
    }

    const params = [DEFAULT_UNIVERSITY];
    let sql = `
      SELECT services.*, users.name AS owner_name, users.university AS owner_university, users.is_verified AS owner_verified
      FROM services
      JOIN users ON users.id = services.user_id
      LEFT JOIN (
        SELECT service_id, AVG(rating) as rating_avg
        FROM service_reviews
        GROUP BY service_id
      ) ratings ON ratings.service_id = services.id
      WHERE services.university = ?
    `;

    if (search) {
      sql += " AND (LOWER(services.title) LIKE ? OR LOWER(services.description) LIKE ?)";
      const searchQuery = `%${search}%`;
      params.push(searchQuery, searchQuery);
    }

    if (category) {
      sql += " AND services.category = ?";
      params.push(category);
    }

    if (minPrice !== null) {
      sql += " AND services.price >= ?";
      params.push(minPrice);
    }

    if (maxPrice !== null) {
      sql += " AND services.price <= ?";
      params.push(maxPrice);
    }

    if (minRating !== null) {
      sql += " AND COALESCE(ratings.rating_avg, 0) >= ?";
      params.push(minRating);
    }

    let orderBy = "services.created_at DESC";
    if (sort === "price_asc") {
      orderBy = "services.price ASC, services.created_at DESC";
    } else if (sort === "price_desc") {
      orderBy = "services.price DESC, services.created_at DESC";
    } else if (sort === "rating_desc") {
      orderBy = "COALESCE(ratings.rating_avg, 0) DESC, services.created_at DESC";
    }

    sql += ` ORDER BY ${orderBy} LIMIT ?`;
    params.push(limit);

    const rows = await all(sql, params);
    const ids = rows.map((row) => row.id);
    const imagesMap = await getServiceImagesMap(ids);
    const ratingsMap = await getServiceRatingsMap(ids);

    res.json(rows.map((row) => toServiceDto(row, imagesMap, ratingsMap)));
  })
);

servicesRouter.get(
  "/services/:id",
  asyncHandler(async (req, res) => {
    const serviceId = parsePositiveInt(req.params.id, "id");

    const row = await get(
      `
        SELECT services.*, users.name AS owner_name, users.university AS owner_university, users.is_verified AS owner_verified
        FROM services
        JOIN users ON users.id = services.user_id
        WHERE services.id = ?
      `,
      [serviceId]
    );

    if (!row || row.university !== DEFAULT_UNIVERSITY) {
      throw notFound("Профиль не найден");
    }

    const imagesMap = await getServiceImagesMap([row.id]);
    const ratingsMap = await getServiceRatingsMap([row.id]);

    const reviews = await all(
      `
        SELECT service_reviews.*, users.name AS client_name
        FROM service_reviews
        JOIN users ON users.id = service_reviews.client_id
        WHERE service_reviews.service_id = ?
        ORDER BY service_reviews.created_at DESC
        LIMIT 20
      `,
      [row.id]
    );

    const service = toServiceDto(row, imagesMap, ratingsMap);
    service.reviews = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.created_at,
      client: {
        id: review.client_id,
        name: review.client_name,
      },
    }));

    res.json(service);
  })
);

servicesRouter.post(
  "/services",
  authMiddleware,
  upload.array("images", 10),
  asyncHandler(async (req, res) => {
    try {
      const title = requireText(req.body.title, "Заголовок", { min: 5, max: 120 });
      const category = requireText(req.body.category, "Категория", { min: 2, max: 120 });
      const description = requireText(req.body.description, "Описание", { min: 20, max: 1500 });

      if (!isCategoryAllowed(category)) {
        throw badRequest("Выберите категорию из списка");
      }

      const price = parsePrice(req.body.price);
      const phone = normalizeText(req.body.phone) || "";
      const whatsapp = normalizeText(req.body.whatsapp) || "";
      const telegram = normalizeText(req.body.telegram) || "";

      const serviceResult = await run(
        `INSERT INTO services (
          user_id, title, category, price, university, description, contact_phone, contact_whatsapp, contact_telegram
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          title,
          category,
          price,
          DEFAULT_UNIVERSITY,
          description,
          phone,
          whatsapp,
          telegram,
        ]
      );

      const imageUrls = [];
      if (req.files?.length) {
        for (const file of req.files) {
          const url = `/uploads/${file.filename}`;
          imageUrls.push(url);
          await run("INSERT INTO service_images (service_id, url) VALUES (?, ?)", [
            serviceResult.lastID,
            url,
          ]);
        }
      } else {
        imageUrls.push(DEMO_IMAGE);
        await run("INSERT INTO service_images (service_id, url) VALUES (?, ?)", [
          serviceResult.lastID,
          DEMO_IMAGE,
        ]);
      }

      const created = await get(
        `
          SELECT services.*, users.name AS owner_name, users.university AS owner_university
          FROM services
          JOIN users ON users.id = services.user_id
          WHERE services.id = ?
        `,
        [serviceResult.lastID]
      );

      const imagesMap = { [created.id]: imageUrls };
      const ratingsMap = { [created.id]: { avg: 0, count: 0 } };
      res.status(201).json(toServiceDto(created, imagesMap, ratingsMap));
    } catch (error) {
      cleanupUploadedFiles(req.files);
      throw error;
    }
  })
);

servicesRouter.get(
  "/my/services",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const rows = await all(
      `
        SELECT services.*, users.name AS owner_name, users.university AS owner_university, users.is_verified AS owner_verified
        FROM services
        JOIN users ON users.id = services.user_id
        WHERE services.user_id = ?
        ORDER BY services.created_at DESC
        LIMIT 100
      `,
      [req.user.id]
    );

    const ids = rows.map((row) => row.id);
    const imagesMap = await getServiceImagesMap(ids);
    const ratingsMap = await getServiceRatingsMap(ids);

    res.json(rows.map((row) => toServiceDto(row, imagesMap, ratingsMap)));
  })
);

servicesRouter.delete(
  "/services/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const serviceId = parsePositiveInt(req.params.id, "id");

    const service = await get("SELECT id, user_id FROM services WHERE id = ?", [serviceId]);
    if (!service) {
      throw notFound("Профиль не найден");
    }

    if (service.user_id !== req.user.id) {
      throw forbidden("Удалять можно только свои профили");
    }

    const images = await all("SELECT url FROM service_images WHERE service_id = ?", [serviceId]);

    await run("DELETE FROM services WHERE id = ?", [serviceId]);

    for (const image of images) {
      if (image.url.startsWith("/uploads/")) {
        const filePath = path.join(UPLOAD_DIR, path.basename(image.url));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    res.json({ ok: true });
  })
);

servicesRouter.patch(
  "/services/:id",
  authMiddleware,
  upload.array("images", 10),
  asyncHandler(async (req, res) => {
    const serviceId = parsePositiveInt(req.params.id, "id");

    try {
      const service = await get("SELECT id, user_id FROM services WHERE id = ?", [serviceId]);
      if (!service) {
        throw notFound("Профиль не найден");
      }

      if (service.user_id !== req.user.id) {
        throw forbidden("Редактировать можно только свои профили");
      }

      const title = requireText(req.body.title, "Заголовок", { min: 5, max: 120 });
      const category = requireText(req.body.category, "Категория", { min: 2, max: 120 });
      const description = requireText(req.body.description, "Описание", { min: 20, max: 1500 });

      if (!isCategoryAllowed(category)) {
        throw badRequest("Выберите категорию из списка");
      }

      const price = parsePrice(req.body.price);
      const phone = normalizeText(req.body.phone) || "";
      const whatsapp = normalizeText(req.body.whatsapp) || "";
      const telegram = normalizeText(req.body.telegram) || "";

      await run(
        `UPDATE services SET title = ?, category = ?, price = ?, description = ?, contact_phone = ?, contact_whatsapp = ?, contact_telegram = ? WHERE id = ?`,
        [title, category, price, description, phone, whatsapp, telegram, serviceId]
      );

      if (req.files?.length) {
        const oldImages = await all("SELECT url FROM service_images WHERE service_id = ?", [serviceId]);
        await run("DELETE FROM service_images WHERE service_id = ?", [serviceId]);

        for (const image of oldImages) {
          if (image.url.startsWith("/uploads/")) {
            const filePath = path.join(UPLOAD_DIR, path.basename(image.url));
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        }

        for (const file of req.files) {
          const url = `/uploads/${file.filename}`;
          await run("INSERT INTO service_images (service_id, url) VALUES (?, ?)", [serviceId, url]);
        }
      }

      const updated = await get(
        `
          SELECT services.*, users.name AS owner_name, users.university AS owner_university, users.is_verified AS owner_verified
          FROM services
          JOIN users ON users.id = services.user_id
          WHERE services.id = ?
        `,
        [serviceId]
      );

      const imagesMap = await getServiceImagesMap([serviceId]);
      const ratingsMap = await getServiceRatingsMap([serviceId]);

      res.json(toServiceDto(updated, imagesMap, ratingsMap));
    } catch (error) {
      cleanupUploadedFiles(req.files);
      throw error;
    }
  })
);

module.exports = {
  servicesRouter,
};
