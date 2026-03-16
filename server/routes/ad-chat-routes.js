const { Router } = require("express");
const { all, get, run } = require("../db/client");
const { asyncHandler } = require("../lib/async-handler");
const { badRequest, forbidden, notFound } = require("../lib/http-error");
const { parsePositiveInt, requireText } = require("../lib/validators");
const { authMiddleware } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");
const { createNotification } = require("../lib/notifications");
const { sendEventToUser } = require("./stream-routes");

const adChatRouter = Router();

function toMessageDto(row) {
  return {
    id: row.id,
    adId: row.ad_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    message: row.message,
    isRead: Boolean(row.is_read),
    clientId: row.client_id,
    createdAt: row.created_at,
  };
}

// GET /api/ads/:id/chats — список покупателей, написавших по объявлению (только для автора)
adChatRouter.get(
  "/ads/:id/chats",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const adId = parsePositiveInt(req.params.id, "id");
    const ad = await get("SELECT id, user_id FROM ads WHERE id = ?", [adId]);
    if (!ad) throw notFound("Объявление не найдено");
    if (ad.user_id !== req.user.id) throw forbidden("Только автор может просматривать список чатов");

    const chats = await all(`
      SELECT 
        m.client_id AS id,
        u.name as name,
        COUNT(CASE WHEN m.is_read = 0 AND m.sender_id != ? THEN 1 END) as unread_count,
        MAX(m.created_at) as last_message_at
      FROM ad_messages m
      JOIN users u ON m.client_id = u.id
      WHERE m.ad_id = ? AND m.client_id IS NOT NULL
      GROUP BY m.client_id
      ORDER BY last_message_at DESC
    `, [req.user.id, adId]);

    res.json(chats);
  })
);

// GET /api/ads/:id/messages — получить историю чата
// Доступно: автор объявления, пользователь написавший хоть одно сообщение, или админ
adChatRouter.get(
  "/ads/:id/messages",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const adId = parsePositiveInt(req.params.id, "id");

    const ad = await get("SELECT id, user_id, title FROM ads WHERE id = ?", [adId]);
    if (!ad) {
      throw notFound("Объявление не найдено");
    }

    const isOwner = ad.user_id === req.user.id;
    const isAdmin = req.user.isAdmin;

    let clientId;
    if (isOwner || isAdmin) {
      clientId = req.query.clientId ? parseInt(req.query.clientId, 10) : null;
      if (!clientId && isOwner) {
        return res.json({
          adId,
          adTitle: ad.title,
          ownerId: ad.user_id,
          messages: [],
        });
      }
    } else {
      clientId = req.user.id;
    }

    // Если админ и нет clientId, показываем все (старое поведение), иначе фильтруем
    let queryArgs = [adId];
    let queryCond = "WHERE ad_messages.ad_id = ?";
    if (clientId) {
      queryCond += " AND ad_messages.client_id = ?";
      queryArgs.push(clientId);
    }

    const messages = await all(
      `
        SELECT ad_messages.*, users.name as sender_name
        FROM ad_messages
        JOIN users ON users.id = ad_messages.sender_id
        ${queryCond}
        ORDER BY ad_messages.created_at ASC
      `,
      queryArgs
    );

    res.json({
      adId,
      adTitle: ad.title,
      ownerId: ad.user_id,
      messages: messages.map(toMessageDto),
    });
  })
);

// POST /api/ads/:id/messages — отправить сообщение
// Только авторизованные пользователи, которые НЕ являются автором объявления
adChatRouter.post(
  "/ads/:id/messages",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const adId = parsePositiveInt(req.params.id, "id");

    const ad = await get("SELECT id, user_id FROM ads WHERE id = ?", [adId]);
    if (!ad) {
      throw notFound("Объявление не найдено");
    }

    const isOwner = ad.user_id === req.user.id;
    const messageText = requireText(req.body.message, "Сообщение", { min: 1, max: 1000 });

    let clientId;
    if (isOwner) {
      clientId = req.body.clientId ? parseInt(req.body.clientId, 10) : null;
      if (!clientId) throw badRequest("Не указан получатель (clientId)");
      
      const participation = await get(
        "SELECT id FROM ad_messages WHERE ad_id = ? AND client_id = ? AND sender_id != ? LIMIT 1",
        [adId, clientId, req.user.id]
      );
      
      if (!participation) {
        throw badRequest("Вы не можете писать первым в этом диалоге");
      }
    } else {
      clientId = req.user.id;
    }

    const result = await run(
      "INSERT INTO ad_messages (ad_id, sender_id, message, client_id) VALUES (?, ?, ?, ?)",
      [adId, req.user.id, messageText, clientId]
    );

    const created = await get(
      `
        SELECT ad_messages.*, users.name as sender_name
        FROM ad_messages
        JOIN users ON users.id = ad_messages.sender_id
        WHERE ad_messages.id = ?
      `,
      [result.lastID]
    );

    const dto = toMessageDto(created);

    if (isOwner) {
      // Owner is replying
      await createNotification(
        clientId,
        "chat",
        "Новое сообщение по объявлению",
        `Владелец добавил комментарий в объявление #${adId}.`,
        `/ad/${adId}`
      );
      sendEventToUser(clientId, "chat_message", dto);
    } else {
      // Buyer is writing
      await createNotification(
        ad.user_id,
        "chat",
        "Новое сообщение в чате",
        `Вам написали по объявлению #${adId}.`,
        `/ad/${adId}`
      );
      sendEventToUser(ad.user_id, "chat_message", dto);
    }

    res.status(201).json(dto);
  })
);

adChatRouter.patch(
  "/ads/:id/messages/read",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const adId = parsePositiveInt(req.params.id, "id");
    
    const ad = await get("SELECT id, user_id FROM ads WHERE id = ?", [adId]);
    if (!ad) {
      throw notFound("Объявление не найдено");
    }

    const isOwner = ad.user_id === req.user.id;
    let clientId;

    if (isOwner) {
      clientId = req.body.clientId ? parseInt(req.body.clientId, 10) : null;
      if (!clientId) return res.json({ ok: true });
    } else {
      clientId = req.user.id;
    }

    // Find unread messages from OTHERS in THIS specific chat
    const unread = await all(
      "SELECT DISTINCT sender_id FROM ad_messages WHERE ad_id = ? AND client_id = ? AND sender_id != ? AND is_read = 0",
      [adId, clientId, req.user.id]
    );

    if (unread.length > 0) {
      await run(
        "UPDATE ad_messages SET is_read = 1 WHERE ad_id = ? AND client_id = ? AND sender_id != ?",
        [adId, clientId, req.user.id]
      );

      for (const unreadRow of unread) {
        sendEventToUser(unreadRow.sender_id, "chat_read", { adId, clientId });
      }
    }

    res.json({ ok: true });
  })
);

// GET /api/admin/ad-chats — список всех объявлений с активными чатами (только для админа)
adChatRouter.get(
  "/admin/ad-chats",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rows = await all(
      `
        SELECT
          ads.id,
          ads.title,
          ads.status,
          ads.created_at,
          users.name AS owner_name,
          COUNT(ad_messages.id) AS message_count,
          MAX(ad_messages.created_at) AS last_message_at
        FROM ads
        JOIN users ON users.id = ads.user_id
        JOIN ad_messages ON ad_messages.ad_id = ads.id
        GROUP BY ads.id
        ORDER BY last_message_at DESC
        LIMIT 100
      `
    );

    res.json(rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      ownerName: row.owner_name,
      messageCount: row.message_count,
      lastMessageAt: row.last_message_at,
      createdAt: row.created_at,
    })));
  })
);

// GET /api/admin/ad-chats/:id — просмотр конкретного чата (только для админа)
adChatRouter.get(
  "/admin/ad-chats/:id",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const adId = parsePositiveInt(req.params.id, "id");

    const ad = await get(
      `
        SELECT ads.*, users.name AS owner_name
        FROM ads
        JOIN users ON users.id = ads.user_id
        WHERE ads.id = ?
      `,
      [adId]
    );

    if (!ad) {
      throw notFound("Объявление не найдено");
    }

    const messages = await all(
      `
        SELECT ad_messages.*, users.name as sender_name
        FROM ad_messages
        JOIN users ON users.id = ad_messages.sender_id
        WHERE ad_messages.ad_id = ?
        ORDER BY ad_messages.created_at ASC
      `,
      [adId]
    );

    res.json({
      adId,
      adTitle: ad.title,
      ownerId: ad.user_id,
      ownerName: ad.owner_name,
      messages: messages.map(toMessageDto),
    });
  })
);

module.exports = {
  adChatRouter,
};
