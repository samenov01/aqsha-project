const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { CORS_ORIGINS, NODE_ENV } = require("../config");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком много попыток, повторите через 15 минут" },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком много запросов" },
});

const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (NODE_ENV !== "production" || CORS_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
});

const helmetMiddleware = helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: NODE_ENV === "production" ? undefined : false,
});

module.exports = {
  authLimiter,
  apiLimiter,
  corsMiddleware,
  helmetMiddleware,
};
