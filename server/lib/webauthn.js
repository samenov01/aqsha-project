function bufferToBase64Url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function base64UrlToBuffer(value) {
  return Buffer.from(value, "base64url");
}

function parseTransports(value) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch (_error) {
    return undefined;
  }
}

module.exports = {
  bufferToBase64Url,
  base64UrlToBuffer,
  parseTransports,
};
