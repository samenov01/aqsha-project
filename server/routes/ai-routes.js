const { Router } = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const { all, get } = require("../db/client");
const { asyncHandler } = require("../lib/async-handler");
const { authMiddleware } = require("../middleware/auth");

const aiRouter = Router();
const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

aiRouter.get(
  "/ai/match",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await get(
      "SELECT id, name, university, skills, bio FROM users WHERE id = ?",
      [req.user.id]
    );

    const userSkills = (user.skills || "").trim();
    const userBio = (user.bio || "").trim();

    const ads = await all(
      `SELECT id, title, category, price, description, created_at,
              u.name as employer_name
       FROM ads
       JOIN users u ON u.id = ads.user_id
       WHERE ads.status = 'active'
       ORDER BY ads.created_at DESC
       LIMIT 50`,
      []
    );

    if (!ads.length) {
      return res.json({ userSkills, matches: [] });
    }

    const candidateProfile = [
      userSkills ? `Навыки: ${userSkills}` : "",
      userBio ? `О себе: ${userBio}` : "",
      `Университет: ${user.university}`,
    ]
      .filter(Boolean)
      .join("\n");

    const adsJson = ads.map((a) => ({
      id: a.id,
      title: a.title,
      category: a.category,
      salary: a.price,
      description: a.description.slice(0, 400),
      employer: a.employer_name,
    }));

    const prompt = `Ты — ИИ-рекрутер. Тебе дан профиль соискателя и список вакансий.
Твоя задача — оценить каждую вакансию по совместимости с соискателем и вернуть результат строго в JSON.

## Профиль соискателя
${candidateProfile || "Навыки не указаны"}

## Вакансии (JSON)
${JSON.stringify(adsJson, null, 2)}

## Инструкции
- Для КАЖДОЙ вакансии рассчитай matchScore (0-100): насколько соискатель подходит.
- Если навыки не указаны — ставь matchScore 10-30 (низкий, но не 0).
- Напиши matchReason — 1 предложение на русском, почему эта вакансия подходит или не подходит.
- Отсортируй по matchScore убыванию.
- Верни ТОЛЬКО валидный JSON без markdown, без объяснений:

{
  "matches": [
    {
      "id": <number>,
      "matchScore": <0-100>,
      "matchReason": "<string>"
    }
  ]
}`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    let aiResult;
    try {
      const raw = message.content[0].text.trim();
      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}") + 1;
      aiResult = JSON.parse(raw.slice(jsonStart, jsonEnd));
    } catch {
      return res.status(502).json({ error: "AI вернул неверный формат" });
    }

    const scoreMap = new Map(
      aiResult.matches.map((m) => [m.id, { score: m.matchScore, reason: m.matchReason }])
    );

    const adMap = new Map(ads.map((a) => [a.id, a]));

    const matches = aiResult.matches
      .map((m) => {
        const ad = adMap.get(m.id);
        if (!ad) return null;
        return {
          id: ad.id,
          title: ad.title,
          category: ad.category,
          salary: ad.price,
          employerName: ad.employer_name,
          createdAt: ad.created_at,
          matchScore: scoreMap.get(m.id)?.score ?? 0,
          matchReason: scoreMap.get(m.id)?.reason ?? "",
        };
      })
      .filter(Boolean);

    res.json({ userSkills: userSkills || null, matches });
  })
);

/* PATCH /api/auth/me/skills — update user skills & bio */
aiRouter.patch(
  "/auth/me/skills",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const skills = String(req.body.skills ?? "").slice(0, 500);
    const bio = String(req.body.bio ?? "").slice(0, 1000);

    await require("../db/client").run(
      "UPDATE users SET skills = ?, bio = ? WHERE id = ?",
      [skills, bio, req.user.id]
    );

    res.json({ ok: true });
  })
);

module.exports = { aiRouter };
