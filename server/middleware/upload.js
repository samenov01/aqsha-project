const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { UPLOAD_DIR } = require("../config");
const { UPLOAD_MIME_TYPES } = require("../constants");
const { badRequest } = require("../lib/http-error");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname).toLowerCase() || ".bin";
    const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!UPLOAD_MIME_TYPES.has(file.mimetype)) {
    cb(badRequest("Допустимы только JPG, PNG и WEBP"));
    return;
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    files: 10,
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = {
  upload,
};
