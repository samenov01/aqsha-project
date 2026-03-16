const { Router } = require("express");
const { all, get, run } = require("../db/client");
const { asyncHandler } = require("../lib/async-handler");
const { badRequest, forbidden, notFound } = require("../lib/http-error");
const { parsePositiveInt, requireText } = require("../lib/validators");
const { authMiddleware } = require("../middleware/auth");
const { createNotification } = require("../lib/notifications");
const { sendEventToUser } = require("./stream-routes");

const ordersRouter = Router();

function toOrderDto(row, currentUserId) {
  const review =
    row.review_rating !== null && row.review_rating !== undefined
      ? {
          rating: row.review_rating,
          comment: row.review_comment || "",
          createdAt: row.review_created_at,
        }
      : null;

  return {
    id: row.id,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentPaidAt: row.payment_paid_at,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    role: row.client_id === currentUserId ? "client" : "provider",
    service: {
      id: row.service_id,
      title: row.service_title,
      category: row.service_category,
      price: row.service_price,
    },
    client: {
      id: row.client_id,
      name: row.client_name,
    },
    provider: {
      id: row.provider_id,
      name: row.provider_name,
    },
    review,
  };
}

async function getOrderWithAccess(orderId, userId, isAdmin = false) {
  const row = await get(
    `
      SELECT service_orders.*, services.title as service_title, services.category as service_category, services.price as service_price,
             client.name as client_name, provider.name as provider_name,
             reviews.rating as review_rating, reviews.comment as review_comment, reviews.created_at as review_created_at
      FROM service_orders
      JOIN services ON services.id = service_orders.service_id
      JOIN users client ON client.id = service_orders.client_id
      JOIN users provider ON provider.id = service_orders.provider_id
      LEFT JOIN service_reviews reviews ON reviews.order_id = service_orders.id
      WHERE service_orders.id = ?
    `,
    [orderId]
  );

  if (!row) return null;
  if (!isAdmin && row.client_id !== userId && row.provider_id !== userId) return "forbidden";
  return row;
}

ordersRouter.post(
  "/orders",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const serviceId = parsePositiveInt(req.body.serviceId, "serviceId");

    const service = await get(
      "SELECT id, user_id, university FROM services WHERE id = ?",
      [serviceId]
    );
    if (!service) {
      throw notFound("Профиль не найден");
    }

    if (service.user_id === req.user.id) {
      throw badRequest("Нельзя заказать свою услугу");
    }

    const existing = await get(
      `
        SELECT id FROM service_orders
        WHERE service_id = ? AND client_id = ? AND status IN ('pending', 'accepted')
      `,
      [serviceId, req.user.id]
    );
    if (existing) {
      throw badRequest("У вас уже есть активный заказ по этой услуге");
    }

    const orderResult = await run(
      `
        INSERT INTO service_orders (service_id, client_id, provider_id, status)
        VALUES (?, ?, ?, 'pending')
      `,
      [serviceId, req.user.id, service.user_id]
    );

    const order = await getOrderWithAccess(orderResult.lastID, req.user.id);
    await createNotification(
      service.user_id,
      "order",
      "Новый заказ",
      `Новый заказ по услуге #${serviceId}.`,
      `/orders/${orderResult.lastID}`
    );
    res.status(201).json(toOrderDto(order, req.user.id));
  })
);

ordersRouter.get(
  "/orders",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const rows = await all(
      `
        SELECT service_orders.*, services.title as service_title, services.category as service_category, services.price as service_price,
               client.name as client_name, provider.name as provider_name,
               reviews.rating as review_rating, reviews.comment as review_comment, reviews.created_at as review_created_at
        FROM service_orders
        JOIN services ON services.id = service_orders.service_id
        JOIN users client ON client.id = service_orders.client_id
        JOIN users provider ON provider.id = service_orders.provider_id
        LEFT JOIN service_reviews reviews ON reviews.order_id = service_orders.id
        WHERE service_orders.client_id = ? OR service_orders.provider_id = ?
        ORDER BY service_orders.created_at DESC
      `,
      [req.user.id, req.user.id]
    );

    res.json(rows.map((row) => toOrderDto(row, req.user.id)));
  })
);

ordersRouter.get(
  "/orders/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const orderId = parsePositiveInt(req.params.id, "id");
    const row = await getOrderWithAccess(orderId, req.user.id, req.user.isAdmin);
    if (!row) {
      throw notFound("Заказ не найден");
    }
    if (row === "forbidden") {
      throw forbidden("Нет доступа к заказу");
    }

    res.json(toOrderDto(row, req.user.id));
  })
);

ordersRouter.patch(
  "/orders/:id/status",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const orderId = parsePositiveInt(req.params.id, "id");
    const status = String(req.body.status || "");
    if (!["accepted", "frozen", "under_review"].includes(status)) {
      throw badRequest("Некорректный статус");
    }

    const row = await getOrderWithAccess(orderId, req.user.id, req.user.isAdmin);
    if (!row) {
      throw notFound("Заказ не найден");
    }
    if (row === "forbidden") {
      throw forbidden("Нет доступа к заказу");
    }

    if (row.provider_id !== req.user.id) {
      throw forbidden("Только исполнитель может менять статус");
    }

    if (status === "accepted" && row.status !== "pending" && row.status !== "frozen") {
      throw badRequest("Невозможно перевести в этот статус");
    }
    if (status === "frozen" && row.status !== "accepted") {
      throw badRequest("Заморозить можно только заказ в работе");
    }
    if (status === "under_review" && row.status !== "accepted") {
      throw badRequest("Сначала подтвердите заказ");
    }

    if (status === "under_review") {
      await run(
        "UPDATE service_orders SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
        [status, orderId]
      );
    } else {
      await run("UPDATE service_orders SET status = ? WHERE id = ?", [status, orderId]);
    }

    if (status === "accepted" && row.status === "pending") {
      await createNotification(
        row.client_id,
        "order",
        "Заказ подтверждён",
        `Исполнитель подтвердил заказ по услуге #${row.service_id}.`,
        `/orders/${orderId}`
      );
    }
    if (status === "accepted" && row.status === "frozen") {
      await createNotification(
        row.client_id,
        "order",
        "Заказ возобновлен",
        `Исполнитель возобновил работу над заказом #${row.service_id}.`,
        `/orders/${orderId}`
      );
    }
    if (status === "frozen") {
      await createNotification(
        row.client_id,
        "order",
        "Заказ заморожен",
        `Исполнитель временно приостановил (заморозил) заказ по услуге #${row.service_id}.`,
        `/orders/${orderId}`
      );
    }
    if (status === "under_review") {
      await createNotification(
        row.client_id,
        "order",
        "Работа завершена (На проверке)",
        `Исполнитель завершил заказ по услуге #${row.service_id}. Ожидает проверки администратором.`,
        `/orders/${orderId}`
      );
    }

    const updated = await getOrderWithAccess(orderId, req.user.id, req.user.isAdmin);
    res.json(toOrderDto(updated, req.user.id));
  })
);

ordersRouter.get(
  "/orders/:id/messages",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const orderId = parsePositiveInt(req.params.id, "id");
    const row = await getOrderWithAccess(orderId, req.user.id, req.user.isAdmin);
    if (!row) {
      throw notFound("Заказ не найден");
    }
    if (row === "forbidden") {
      throw forbidden("Нет доступа к заказу");
    }

    const messages = await all(
      `
        SELECT service_messages.*, users.name as sender_name
        FROM service_messages
        JOIN users ON users.id = service_messages.sender_id
        WHERE service_messages.order_id = ?
        ORDER BY service_messages.created_at ASC
      `,
      [orderId]
    );

    res.json(
      messages.map((message) => ({
        id: message.id,
        orderId: message.order_id,
        senderId: message.sender_id,
        senderName: message.sender_name,
        message: message.message,
        isRead: Boolean(message.is_read),
        createdAt: message.created_at,
      }))
    );
  })
);

ordersRouter.post(
  "/orders/:id/messages",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const orderId = parsePositiveInt(req.params.id, "id");
    const row = await getOrderWithAccess(orderId, req.user.id, req.user.isAdmin);
    if (!row) {
      throw notFound("Заказ не найден");
    }
    if (row === "forbidden") {
      throw forbidden("Нет доступа к заказу");
    }

    const message = requireText(req.body.message, "Сообщение", { min: 1, max: 1000 });

    const result = await run(
      "INSERT INTO service_messages (order_id, sender_id, message) VALUES (?, ?, ?)",
      [orderId, req.user.id, message]
    );

    const created = await get(
      `
        SELECT service_messages.*, users.name as sender_name
        FROM service_messages
        JOIN users ON users.id = service_messages.sender_id
        WHERE service_messages.id = ?
      `,
      [result.lastID]
    );

    const recipientId = req.user.id === row.client_id ? row.provider_id : row.client_id;
    await createNotification(
      recipientId,
      "message",
      "Новое сообщение",
      `Новое сообщение по заказу #${row.id}.`,
      `/orders/${orderId}`
    );

    const dto = {
      id: created.id,
      orderId: created.order_id,
      senderId: created.sender_id,
      senderName: created.sender_name,
      message: created.message,
      isRead: Boolean(created.is_read),
      createdAt: created.created_at,
    };

    sendEventToUser(recipientId, "chat_message", dto);

    res.status(201).json(dto);
  })
);

ordersRouter.patch(
  "/orders/:id/messages/read",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const orderId = parsePositiveInt(req.params.id, "id");
    const row = await getOrderWithAccess(orderId, req.user.id, req.user.isAdmin);
    if (!row || row === "forbidden") {
      throw notFound("Заказ не найден"); // Simplify error
    }

    // Find unread messages from OTHERS
    const unread = await all(
      "SELECT DISTINCT sender_id FROM service_messages WHERE order_id = ? AND sender_id != ? AND is_read = 0",
      [orderId, req.user.id]
    );

    if (unread.length > 0) {
      await run(
        "UPDATE service_messages SET is_read = 1 WHERE order_id = ? AND sender_id != ?",
        [orderId, req.user.id]
      );

      for (const unreadRow of unread) {
        sendEventToUser(unreadRow.sender_id, "chat_read", { orderId });
      }
    }

    res.json({ ok: true });
  })
);

ordersRouter.post(
  "/orders/:id/review",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const orderId = parsePositiveInt(req.params.id, "id");
    const row = await getOrderWithAccess(orderId, req.user.id, req.user.isAdmin);
    if (!row) {
      throw notFound("Заказ не найден");
    }
    if (row === "forbidden") {
      throw forbidden("Нет доступа к заказу");
    }

    if (row.client_id !== req.user.id) {
      throw forbidden("Оставить отзыв может только клиент");
    }

    if (row.status !== "completed") {
      throw badRequest("Оценку можно оставить только после завершения заказа");
    }

    const rating = parsePositiveInt(req.body.rating, "rating");
    if (rating < 1 || rating > 5) {
      throw badRequest("Оценка должна быть от 1 до 5");
    }

    const comment = requireText(req.body.comment || "Спасибо!", "Комментарий", { min: 1, max: 400 });

    const existing = await get("SELECT id FROM service_reviews WHERE order_id = ?", [orderId]);
    if (existing) {
      throw badRequest("Отзыв уже оставлен");
    }

    await run(
      `
        INSERT INTO service_reviews (order_id, service_id, client_id, provider_id, rating, comment)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [orderId, row.service_id, row.client_id, row.provider_id, rating, comment]
    );

    await createNotification(
      row.provider_id,
      "review",
      "Новый отзыв",
      `Клиент оставил отзыв по заказу #${orderId}.`
    );

    res.status(201).json({ ok: true });
  })
);

ordersRouter.patch(
  "/orders/:id/payment",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const orderId = parsePositiveInt(req.params.id, "id");
    const status = String(req.body.status || "");

    if (!["paid"].includes(status)) {
      throw badRequest("Некорректный статус оплаты");
    }

    const row = await getOrderWithAccess(orderId, req.user.id, req.user.isAdmin);
    if (!row) {
      throw notFound("Заказ не найден");
    }
    if (row === "forbidden") {
      throw forbidden("Нет доступа к заказу");
    }

    if (row.client_id !== req.user.id) {
      throw forbidden("Оплату подтверждает только клиент");
    }

    if (row.payment_status === "paid") {
      throw badRequest("Оплата уже подтверждена");
    }

    const user = await get("SELECT balance FROM users WHERE id = ?", [req.user.id]);
    const price = Number(row.service_price) || 0;

    if (price > 0 && user.balance < price) {
      throw badRequest("Недостаточно средств на балансе");
    }

    if (price > 0) {
      await run("UPDATE users SET balance = balance - ? WHERE id = ?", [price, req.user.id]);
      await run(
        "INSERT INTO transactions (user_id, amount, type, description) VALUES (?, ?, 'expense', ?)",
        [req.user.id, price, `Резерв средств по заказу #${orderId}`]
      );
    }

    await run(
      "UPDATE service_orders SET payment_status = ?, payment_paid_at = CURRENT_TIMESTAMP WHERE id = ?",
      [status, orderId]
    );

    await createNotification(
      row.provider_id,
      "payment",
      "Оплата подтверждена",
      `Клиент зарезервировал оплату по заказу #${orderId}.`
    );

    const updated = await getOrderWithAccess(orderId, req.user.id, req.user.isAdmin);
    res.json(toOrderDto(updated, req.user.id));
  })
);

module.exports = {
  ordersRouter,
};
