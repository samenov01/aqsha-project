class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function badRequest(message) {
  return new HttpError(400, message);
}

function unauthorized(message = "Требуется авторизация") {
  return new HttpError(401, message);
}

function forbidden(message = "Недостаточно прав") {
  return new HttpError(403, message);
}

function notFound(message = "Ресурс не найден") {
  return new HttpError(404, message);
}

module.exports = {
  HttpError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
};
