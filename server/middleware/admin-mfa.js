const jwt = require("jsonwebtoken");
const { ADMIN_MFA_SECRET } = require("../config");
const { forbidden } = require("../lib/http-error");

function requireAdminMfa(req, _res, next) {
  const token = req.headers["x-admin-mfa"];
  if (!token) {
    return next(forbidden("Требуется подтверждение FaceID"));
  }

  try {
    const payload = jwt.verify(String(token), ADMIN_MFA_SECRET);
    if (!payload?.adminMfa || payload.id !== req.user?.id) {
      throw new Error("Invalid admin MFA token");
    }
    req.adminMfa = payload;
    return next();
  } catch (_error) {
    return next(forbidden("Недействительное подтверждение FaceID"));
  }
}

module.exports = {
  requireAdminMfa,
};
