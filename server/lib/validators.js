const { badRequest } = require("./http-error");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[<>]/g, "");
}

function requireText(value, fieldName, { min = 1, max = 255 } = {}) {
  const text = normalizeText(value);
  if (!text) {
    throw badRequest(`Поле \"${fieldName}\" обязательно`);
  }
  if (text.length < min || text.length > max) {
    throw badRequest(`Поле \"${fieldName}\" должно быть от ${min} до ${max} символов`);
  }
  return text;
}

function optionalText(value, { max = 255 } = {}) {
  const text = normalizeText(value);
  if (!text) return "";
  if (text.length > max) {
    throw badRequest(`Слишком длинное значение: максимум ${max} символов`);
  }
  return text;
}

function requireEmail(value) {
  const email = normalizeText(value).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw badRequest("Некорректный email");
  }
  if (email.length > 120) {
    throw badRequest("Email слишком длинный");
  }
  return email;
}

function requirePassword(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 72) {
    throw badRequest("Пароль должен содержать от 8 до 72 символов");
  }
  return value;
}

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest(`Некорректное значение поля \"${fieldName}\"`);
  }
  return parsed;
}

function parsePrice(value) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10_000_000) {
    throw badRequest("Некорректная цена");
  }
  return Math.round(parsed);
}

function parseLimit(value, defaultValue = 24) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return defaultValue;
  return Math.min(parsed, 60);
}

module.exports = {
  normalizeText,
  requireText,
  optionalText,
  requireEmail,
  requirePassword,
  parsePositiveInt,
  parsePrice,
  parseLimit,
};
