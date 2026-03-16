const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Router } = require("express");
const { JWT_SECRET, ADMIN_EMAILS, WEBAUTHN_RP_ID, WEBAUTHN_ORIGIN, WEBAUTHN_RP_NAME } = require("../config");
const { run, get, all } = require("../db/client");
const { DEFAULT_UNIVERSITY } = require("../constants");
const { asyncHandler } = require("../lib/async-handler");
const { requireText, requireEmail, requirePassword } = require("../lib/validators");
const { badRequest, unauthorized } = require("../lib/http-error");
const { bufferToBase64Url, base64UrlToBuffer, parseTransports } = require("../lib/webauthn");
const { authMiddleware } = require("../middleware/auth");

const authRouter = Router();

const CHALLENGE_TTL_MIN = 5;
let webauthnModule;

async function loadWebauthn() {
  if (webauthnModule) return webauthnModule;
  const mod = await import("@simplewebauthn/server");
  webauthnModule = mod.default ? { ...mod.default, ...mod } : mod;
  return webauthnModule;
}

function isExpired(isoDate) {
  return Date.now() > new Date(isoDate).getTime();
}

async function setChallenge(userId, type, challenge) {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MIN * 60 * 1000).toISOString();
  await run("DELETE FROM webauthn_challenges WHERE user_id = ? AND type = ?", [userId, type]);
  await run(
    "INSERT INTO webauthn_challenges (user_id, type, challenge, expires_at) VALUES (?, ?, ?, ?)",
    [userId, type, challenge, expiresAt]
  );
}

async function getChallenge(userId, type) {
  return get(
    "SELECT challenge, expires_at FROM webauthn_challenges WHERE user_id = ? AND type = ? ORDER BY id DESC LIMIT 1",
    [userId, type]
  );
}

async function clearChallenge(userId, type) {
  await run("DELETE FROM webauthn_challenges WHERE user_id = ? AND type = ?", [userId, type]);
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || "").toLowerCase());
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    university: user.university,
    isVerified: Boolean(user.is_verified),
    isAdmin: isAdminEmail(user.email),
  };
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const name = requireText(req.body.name, "Имя", { min: 2, max: 80 });
    const email = requireEmail(req.body.email);
    const password = requirePassword(req.body.password);

    const existing = await get("SELECT id FROM users WHERE email = ?", [email]);
    if (existing) {
      throw badRequest("Пользователь с таким email уже существует");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO users (name, email, university, password_hash) VALUES (?, ?, ?, ?)",
      [name, email, DEFAULT_UNIVERSITY, passwordHash]
    );

    const user = {
      id: result.lastID,
      name,
      email,
      university: DEFAULT_UNIVERSITY,
      isVerified: false,
      isAdmin: isAdminEmail(email),
    };
    const token = signToken(user);

    res.status(201).json({ user, token });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const email = requireEmail(req.body.email);
    const password = requirePassword(req.body.password);

    const user = await get("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) {
      throw unauthorized("Неверный email или пароль");
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw unauthorized("Неверный email или пароль");
    }

    const safe = safeUser(user);
    const token = signToken(safe);
    res.json({ user: safe, token });
  })
);

authRouter.get(
  "/me",
  authMiddleware,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

/* ─── Passkey: status ─── */

authRouter.get(
  "/passkey/status",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const row = await get(
      "SELECT COUNT(*) as count FROM webauthn_credentials WHERE user_id = ?",
      [req.user.id]
    );
    res.json({ registered: row?.count > 0 });
  })
);

/* ─── Passkey: register (requires auth) ─── */

authRouter.post(
  "/passkey/register/options",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { generateRegistrationOptions } = await loadWebauthn();
    const credentials = await all(
      "SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?",
      [req.user.id]
    );

    const options = await generateRegistrationOptions({
      rpName: WEBAUTHN_RP_NAME,
      rpID: WEBAUTHN_RP_ID,
      userID: new TextEncoder().encode(String(req.user.id)),
      userName: req.user.email,
      timeout: 60_000,
      attestationType: "none",
      excludeCredentials: credentials.map((cred) => ({
        id: cred.credential_id,
        type: "public-key",
        transports: parseTransports(cred.transports),
      })),
    });

    await setChallenge(req.user.id, "registration", options.challenge);
    res.json(options);
  })
);

authRouter.post(
  "/passkey/register/verify",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { verifyRegistrationResponse } = await loadWebauthn();

    const challengeRow = await getChallenge(req.user.id, "registration");
    if (!challengeRow || isExpired(challengeRow.expires_at)) {
      throw unauthorized("Сессия регистрации FaceID истекла");
    }

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: WEBAUTHN_ORIGIN,
      expectedRPID: WEBAUTHN_RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw unauthorized("Не удалось подтвердить FaceID");
    }

    const { credential, counter } = verification.registrationInfo;
    const transports = Array.isArray(req.body.response?.transports)
      ? req.body.response.transports
      : [];

    await run(
      `INSERT OR REPLACE INTO webauthn_credentials (user_id, credential_id, public_key, counter, transports)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.user.id,
        credential.id,
        bufferToBase64Url(credential.publicKey),
        counter,
        JSON.stringify(transports),
      ]
    );

    await clearChallenge(req.user.id, "registration");
    res.json({ ok: true, registered: true });
  })
);

/* ─── Passkey: login (no auth required) ─── */

authRouter.post(
  "/passkey/login/options",
  asyncHandler(async (_req, res) => {
    const { generateAuthenticationOptions } = await loadWebauthn();

    const options = await generateAuthenticationOptions({
      rpID: WEBAUTHN_RP_ID,
      userVerification: "required",
      timeout: 60_000,
    });

    /* For passkey login we don't know the userId yet.
       Store challenge with a sentinel id = 0 keyed by the challenge itself. */
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MIN * 60 * 1000).toISOString();
    await run(
      "INSERT INTO webauthn_challenges (user_id, type, challenge, expires_at) VALUES (?, ?, ?, ?)",
      [0, "login", options.challenge, expiresAt]
    );

    res.json(options);
  })
);

authRouter.post(
  "/passkey/login/verify",
  asyncHandler(async (req, res) => {
    const { verifyAuthenticationResponse } = await loadWebauthn();

    const body = req.body;
    const credentialId = body?.id || body?.rawId;
    if (!credentialId) {
      throw badRequest("Некорректный ответ WebAuthn");
    }

    /* Look up stored credential */
    const storedCredential = await get(
      "SELECT user_id, credential_id, public_key, counter FROM webauthn_credentials WHERE credential_id = ?",
      [credentialId]
    );
    if (!storedCredential) {
      throw unauthorized("Passkey не найден");
    }

    /* Client sends the challenge in the response; decode it from clientDataJSON */
    const clientDataRaw = Buffer.from(body.response.clientDataJSON, "base64url");
    const clientData = JSON.parse(clientDataRaw.toString("utf8"));
    const receivedChallenge = clientData.challenge;

    /* Verify challenge is valid */
    const challengeRow = await get(
      "SELECT id, challenge, expires_at FROM webauthn_challenges WHERE user_id = 0 AND type = 'login' AND challenge = ? ORDER BY id DESC LIMIT 1",
      [receivedChallenge]
    );
    if (!challengeRow || isExpired(challengeRow.expires_at)) {
      throw unauthorized("Сессия FaceID истекла");
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: WEBAUTHN_ORIGIN,
      expectedRPID: WEBAUTHN_RP_ID,
      credential: {
        id: storedCredential.credential_id,
        publicKey: base64UrlToBuffer(storedCredential.public_key),
        counter: storedCredential.counter,
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      throw unauthorized("Не удалось подтвердить FaceID");
    }

    await run("UPDATE webauthn_credentials SET counter = ? WHERE credential_id = ?", [
      verification.authenticationInfo.newCounter,
      storedCredential.credential_id,
    ]);
    await run("DELETE FROM webauthn_challenges WHERE id = ?", [challengeRow.id]);

    /* Load user and return JWT */
    const user = await get("SELECT * FROM users WHERE id = ?", [storedCredential.user_id]);
    if (!user) {
      throw unauthorized("Пользователь не найден");
    }

    const safe = safeUser(user);
    const token = signToken(safe);
    res.json({ user: safe, token });
  })
);

/* ─── Camera FaceID ─── */

authRouter.get(
  "/faceid/status",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const row = await get(
      "SELECT COUNT(*) as count FROM face_descriptors WHERE user_id = ?",
      [req.user.id]
    );
    res.json({ registered: row?.count > 0 });
  })
);

authRouter.post(
  "/faceid/register",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const descriptor = req.body?.descriptor;
    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
      throw badRequest("Некорректный дескриптор лица");
    }

    /* Remove old face descriptors for this user so only latest is kept */
    await run("DELETE FROM face_descriptors WHERE user_id = ?", [req.user.id]);

    await run(
      "INSERT INTO face_descriptors (user_id, descriptor) VALUES (?, ?)",
      [req.user.id, JSON.stringify(descriptor)]
    );

    res.json({ ok: true, registered: true });
  })
);

authRouter.post(
  "/faceid/login",
  asyncHandler(async (req, res) => {
    const descriptor = req.body?.descriptor;
    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
      throw badRequest("Некорректный дескриптор лица");
    }

    const rows = await all("SELECT user_id, descriptor FROM face_descriptors");
    if (!rows.length) {
      throw unauthorized("Нет зарегистрированных лиц");
    }

    /* Find best match by Euclidean distance */
    let bestMatch = null;
    let bestDistance = Infinity;
    const THRESHOLD = 0.42; // Усиленная проверка (было 0.6)

    for (const row of rows) {
      const stored = JSON.parse(row.descriptor);
      let sum = 0;
      for (let i = 0; i < 128; i++) {
        const diff = descriptor[i] - stored[i];
        sum += diff * diff;
      }
      const distance = Math.sqrt(sum);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = row;
      }
    }

    if (!bestMatch || bestDistance > THRESHOLD) {
      throw unauthorized("Лицо не распознано");
    }

    const user = await get("SELECT * FROM users WHERE id = ?", [bestMatch.user_id]);
    if (!user) {
      throw unauthorized("Пользователь не найден");
    }

    const safe = safeUser(user);
    const token = signToken(safe);
    res.json({ user: safe, token, distance: Math.round(bestDistance * 100) / 100 });
  })
);

module.exports = {
  authRouter,
};
