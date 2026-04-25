const { Router } = require("express");
const { all, get, run } = require("../db/client");
const { asyncHandler } = require("../lib/async-handler");
const { authMiddleware } = require("../middleware/auth");
const { badRequest, forbidden, notFound } = require("../lib/http-error");
const { optionalText, parsePositiveInt, requireText } = require("../lib/validators");

const chatRouter = Router();

function toConversationDto(row, currentUserId) {
  const isFreelancer = row.freelancer_id === currentUserId;
  const peer = isFreelancer
    ? {
        id: row.client_id,
        name: row.client_name,
        avatarUrl: row.client_avatar_url || "",
      }
    : {
        id: row.freelancer_id,
        name: row.freelancer_name,
        avatarUrl: row.freelancer_avatar_url || "",
      };

  return {
    id: row.id,
    role: isFreelancer ? "freelancer" : "client",
    ad: {
      id: row.ad_id,
      title: row.ad_title,
      category: row.ad_category,
      price: Number(row.ad_price || 0),
    },
    peer,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessage: row.last_message_body
      ? {
          body: row.last_message_body,
          createdAt: row.last_message_created_at,
          senderId: row.last_message_sender_id,
        }
      : null,
  };
}

async function getConversationDetails(conversationId) {
  return get(
    `SELECT
      c.id,
      c.ad_id,
      c.client_id,
      c.freelancer_id,
      c.created_at,
      c.updated_at,
      ads.title AS ad_title,
      ads.category AS ad_category,
      ads.price AS ad_price,
      freelancer.name AS freelancer_name,
      freelancer.avatar_url AS freelancer_avatar_url,
      client.name AS client_name,
      client.avatar_url AS client_avatar_url,
      last_message.body AS last_message_body,
      last_message.created_at AS last_message_created_at,
      last_message.sender_id AS last_message_sender_id
    FROM conversations c
    JOIN ads ON ads.id = c.ad_id
    JOIN users AS freelancer ON freelancer.id = c.freelancer_id
    JOIN users AS client ON client.id = c.client_id
    LEFT JOIN messages AS last_message ON last_message.id = (
      SELECT m.id
      FROM messages m
      WHERE m.conversation_id = c.id
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT 1
    )
    WHERE c.id = ?`,
    [conversationId]
  );
}

function assertConversationMember(conversation, userId) {
  if (conversation.client_id !== userId && conversation.freelancer_id !== userId) {
    throw forbidden("Диалог недоступен");
  }
}

chatRouter.get(
  "/my/conversations",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const rows = await all(
      `SELECT
        c.id,
        c.ad_id,
        c.client_id,
        c.freelancer_id,
        c.created_at,
        c.updated_at,
        ads.title AS ad_title,
        ads.category AS ad_category,
        ads.price AS ad_price,
        freelancer.name AS freelancer_name,
        freelancer.avatar_url AS freelancer_avatar_url,
        client.name AS client_name,
        client.avatar_url AS client_avatar_url,
        last_message.body AS last_message_body,
        last_message.created_at AS last_message_created_at,
        last_message.sender_id AS last_message_sender_id
      FROM conversations c
      JOIN ads ON ads.id = c.ad_id
      JOIN users AS freelancer ON freelancer.id = c.freelancer_id
      JOIN users AS client ON client.id = c.client_id
      LEFT JOIN messages AS last_message ON last_message.id = (
        SELECT m.id
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      )
      WHERE c.client_id = ? OR c.freelancer_id = ?
      ORDER BY COALESCE(last_message.created_at, c.updated_at) DESC, c.id DESC`,
      [req.user.id, req.user.id]
    );

    res.json(rows.map((row) => toConversationDto(row, req.user.id)));
  })
);

chatRouter.post(
  "/ads/:id/conversations",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const adId = parsePositiveInt(req.params.id, "id");
    const ad = await get("SELECT id, user_id FROM ads WHERE id = ?", [adId]);

    if (!ad) {
      throw notFound("Объявление не найдено");
    }

    if (ad.user_id === req.user.id) {
      throw badRequest("Нельзя открыть диалог с самим собой");
    }

    const maybeMessage = optionalText(req.body.message, { max: 1000 });
    if (maybeMessage && maybeMessage.length < 2) {
      throw badRequest("Сообщение должно содержать минимум 2 символа");
    }

    const existingConversation = await get(
      "SELECT id FROM conversations WHERE ad_id = ? AND client_id = ?",
      [adId, req.user.id]
    );

    let conversationId = existingConversation?.id;
    if (!conversationId) {
      const created = await run(
        `INSERT INTO conversations (ad_id, client_id, freelancer_id)
         VALUES (?, ?, ?)`,
        [adId, req.user.id, ad.user_id]
      );
      conversationId = created.lastID;
    }

    if (maybeMessage) {
      await run(
        `INSERT INTO messages (conversation_id, sender_id, body)
         VALUES (?, ?, ?)`,
        [conversationId, req.user.id, maybeMessage]
      );
      await run("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [conversationId]);
    }

    const conversation = await getConversationDetails(conversationId);
    res.status(existingConversation ? 200 : 201).json({
      conversation: toConversationDto(conversation, req.user.id),
    });
  })
);

chatRouter.get(
  "/conversations/:id/messages",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const conversationId = parsePositiveInt(req.params.id, "id");
    const conversation = await getConversationDetails(conversationId);

    if (!conversation) {
      throw notFound("Диалог не найден");
    }

    assertConversationMember(conversation, req.user.id);

    const rows = await all(
      `SELECT
        m.id,
        m.body,
        m.created_at,
        m.sender_id,
        u.name AS sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC, m.id ASC`,
      [conversationId]
    );

    res.json({
      conversation: toConversationDto(conversation, req.user.id),
      messages: rows.map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        sender: {
          id: row.sender_id,
          name: row.sender_name,
        },
        isMine: row.sender_id === req.user.id,
      })),
    });
  })
);

chatRouter.post(
  "/conversations/:id/messages",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const conversationId = parsePositiveInt(req.params.id, "id");
    const conversation = await getConversationDetails(conversationId);

    if (!conversation) {
      throw notFound("Диалог не найден");
    }

    assertConversationMember(conversation, req.user.id);
    const body = requireText(req.body.body, "Сообщение", { min: 1, max: 1000 });

    const inserted = await run(
      `INSERT INTO messages (conversation_id, sender_id, body)
       VALUES (?, ?, ?)`,
      [conversationId, req.user.id, body]
    );

    await run("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [conversationId]);

    const message = await get(
      `SELECT
        m.id,
        m.body,
        m.created_at,
        m.sender_id,
        u.name AS sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?`,
      [inserted.lastID]
    );

    res.status(201).json({
      message: {
        id: message.id,
        body: message.body,
        createdAt: message.created_at,
        sender: {
          id: message.sender_id,
          name: message.sender_name,
        },
        isMine: message.sender_id === req.user.id,
      },
    });
  })
);

module.exports = {
  chatRouter,
};
