const path = require("path");
const dotenv = require("dotenv");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
dotenv.config({ path: path.join(ROOT_DIR, ".env"), quiet: true });

const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "aqsha-dev-secret-change-me";
const ADMIN_MFA_SECRET = process.env.ADMIN_MFA_SECRET || JWT_SECRET;
const ADMIN_MFA_TTL_MIN = Number(process.env.ADMIN_MFA_TTL_MIN) || 15;
const WEBAUTHN_RP_ID = process.env.WEBAUTHN_RP_ID || "localhost";
const WEBAUTHN_ORIGIN = process.env.WEBAUTHN_ORIGIN || "http://localhost:5173";
const WEBAUTHN_RP_NAME = process.env.WEBAUTHN_RP_NAME || "Aqsha Admin";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const DATA_DIR = path.join(ROOT_DIR, "data");
const DB_PATH = path.join(DATA_DIR, "aqsha.db");
const UPLOAD_DIR = path.join(ROOT_DIR, "uploads");
const CLIENT_DIST = path.join(ROOT_DIR, "client", "dist");

const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = {
  ROOT_DIR,
  NODE_ENV,
  PORT,
  JWT_SECRET,
  ADMIN_MFA_SECRET,
  ADMIN_MFA_TTL_MIN,
  WEBAUTHN_RP_ID,
  WEBAUTHN_ORIGIN,
  WEBAUTHN_RP_NAME,
  ADMIN_EMAILS,
  DATA_DIR,
  DB_PATH,
  UPLOAD_DIR,
  CLIENT_DIST,
  CORS_ORIGINS,
};
