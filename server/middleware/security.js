const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { CORS_ORIGINS, NODE_ENV } = require("../config");

const authLimiter = (req, res, next) => next();

const apiLimiter = (req, res, next) => next();

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
