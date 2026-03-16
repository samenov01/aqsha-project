const multer = require("multer");
const { HttpError } = require("../lib/http-error");

function notFoundHandler(_req, _res, next) {
  next(new HttpError(404, "Маршрут не найден"));
}

function errorHandler(err, _req, res, _next) {
  if (err?.message === "Not allowed by CORS") {
    res.status(403).json({ error: "Origin запрещен политикой CORS" });
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "Файл слишком большой (максимум 5MB)" });
      return;
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({ error: "Можно загрузить максимум 10 файлов" });
      return;
    }
    res.status(400).json({ error: "Ошибка загрузки файла" });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
