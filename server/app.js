const fs = require("fs");
const path = require("path");
const express = require("express");
const { CLIENT_DIST, UPLOAD_DIR } = require("./config");
const { authRouter } = require("./routes/auth-routes");
const { adsRouter } = require("./routes/ads-routes");
const { adChatRouter } = require("./routes/ad-chat-routes");
const { servicesRouter } = require("./routes/services-routes");
const { ordersRouter } = require("./routes/orders-routes");
const { notificationsRouter } = require("./routes/notifications-routes");
const { adminRouter } = require("./routes/admin-routes");
const { streamRouter } = require("./routes/stream-routes");
const { walletRouter } = require("./routes/wallet-routes");
const { reportsRouter } = require("./routes/reports-routes");
const { favoritesRouter } = require("./routes/favorites-routes");
const { profileRouter } = require("./routes/profile-routes");
const { newsRouter } = require("./routes/news-routes");
const { aiRouter } = require("./routes/ai-routes");
const { errorHandler, notFoundHandler } = require("./middleware/error-handler");
const {
  apiLimiter,
  authLimiter,
  corsMiddleware,
  helmetMiddleware,
} = require("./middleware/security");

function createApp() {
  const app = express();

  app.disable("x-powered-by");

  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  app.use(
    "/uploads",
    express.static(UPLOAD_DIR, {
      index: false,
      maxAge: "1d",
      fallthrough: false,
    })
  );

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", apiLimiter);
  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api", adsRouter);
  app.use("/api", adChatRouter);
  app.use("/api", servicesRouter);
  app.use("/api", ordersRouter);
  app.use("/api", notificationsRouter);
  app.use("/api", adminRouter);
  app.use("/api", streamRouter);
  app.use(walletRouter);
  app.use("/api", reportsRouter);
  app.use("/api", favoritesRouter);
  app.use("/api", profileRouter);
  app.use("/api", newsRouter);
  app.use("/api", aiRouter);

  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));

    app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
      res.sendFile(path.join(CLIENT_DIST, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
