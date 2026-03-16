const { Router } = require("express");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");
const { authMiddleware } = require("../middleware/auth");

// Map<Number(userId), Set<Response>>
const sseClients = new Map();

function sendEventToUser(userId, eventName, data) {
  const connections = sseClients.get(Number(userId));
  if (!connections) return;

  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of connections) {
    res.write(payload);
    if (typeof res.flush === "function") {
      res.flush();
    }
  }
}

function broadcastOnlineUsers() {
  const onlineIds = Array.from(sseClients.keys());
  const payload = `event: online_users\ndata: ${JSON.stringify(onlineIds)}\n\n`;
  for (const set of sseClients.values()) {
    for (const res of set) {
      res.write(payload);
      if (typeof res.flush === "function") {
        res.flush();
      }
    }
  }
}

const streamRouter = Router();

streamRouter.get("/stream", (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const userId = Number(decoded.id);

  // Set headers for SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no", // Disable Nginx/proxy buffering
  });
  
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }
  
  // Send an initial padding/comment to prevent rendering delays
  res.write(": connected\n\n");
  if (typeof res.flush === "function") res.flush();

  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  const clientSet = sseClients.get(userId);
  clientSet.add(res);

  broadcastOnlineUsers();

  // Keep-alive ping every 15 seconds
  const pingInterval = setInterval(() => {
    res.write(": ping\n\n");
    if (typeof res.flush === "function") res.flush();
  }, 15000);

  req.on("close", () => {
    clearInterval(pingInterval);
    if (sseClients.has(userId)) {
      const set = sseClients.get(userId);
      set.delete(res);
      if (set.size === 0) {
        sseClients.delete(userId);
        broadcastOnlineUsers();
      }
    }
  });
});

streamRouter.get("/stream/online", (req, res) => {
  const onlineIds = Array.from(sseClients.keys());
  res.json({ online: onlineIds });
});

streamRouter.post(
  "/stream/typing",
  authMiddleware,
  (req, res) => {
    const recipientId = Number(req.body.recipientId);
    const isTyping = Boolean(req.body.isTyping);
    const contextId = req.body.contextId;
    
    sendEventToUser(recipientId, "typing", {
      senderId: req.user.id,
      isTyping,
      contextId
    });
    
    res.json({ ok: true });
  }
);

module.exports = {
  streamRouter,
  sendEventToUser,
};
