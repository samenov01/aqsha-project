const { Router } = require("express");
const { all, get } = require("../db/client");
const { asyncHandler } = require("../lib/async-handler");
const { parsePositiveInt } = require("../lib/validators");
const { authMiddleware } = require("../middleware/auth");
const { notFound } = require("../lib/http-error");

const aiRouter = Router();

// --- Semantic keyword matching with prefix/substring support ---
function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\wа-яёa-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function tokenScore(candidateToken, jobTokens) {
  // Exact match
  if (jobTokens.has(candidateToken)) return 1.0;
  // Prefix match (min 4 chars): "дизайнер" matches "дизайн", "программист" matches "программ"
  const prefixLen = Math.max(4, Math.floor(candidateToken.length * 0.7));
  if (candidateToken.length >= prefixLen) {
    const prefix = candidateToken.slice(0, prefixLen);
    for (const jt of jobTokens) {
      if (jt.startsWith(prefix) || candidateToken.startsWith(jt.slice(0, prefixLen))) {
        return 0.75;
      }
    }
  }
  return 0;
}

function computeMatchScore(jobText, candidateText) {
  const jobTokens = new Set(tokenize(jobText));
  const candidateTokens = tokenize(candidateText);

  if (!jobTokens.size || !candidateTokens.length) return 0;

  let matchWeight = 0;
  for (const ct of candidateTokens) {
    matchWeight += tokenScore(ct, jobTokens);
  }

  // Precision-based: "какая доля МОИХ навыков нашлась в этой вакансии"
  // Works well for single-skill ("Дизайнер") and multi-skill profiles
  return Math.round((matchWeight / candidateTokens.length) * 100);
}

// --- Claude AI semantic matching ---
async function callClaude(prompt) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch (err) {
    console.error("[AI] Claude API error:", err.message);
    return null;
  }
}

function parseJsonArray(text) {
  if (!text) return null;
  try {
    // Strip markdown code fences if present
    const stripped = text.replace(/```(?:json)?/gi, "").trim();
    const match = stripped.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function enhanceJobMatches(userSkills, userMicrorayon, jobs) {
  if (!process.env.ANTHROPIC_API_KEY || !jobs.length) return null;

  const jobsSummary = jobs.map((j, i) => {
    const salary = j.price ? `${Number(j.price).toLocaleString("ru")} ₸/мес` : "договорная";
    const desc = (j.description || "").slice(0, 120).replace(/\n/g, " ");
    return `${i + 1}. "${j.title}" | ${j.category} | ${salary} | район: ${j.microrayon || "?"} | ${desc}`;
  }).join("\n");

  const prompt = `Ты — AI-рекрутер платформы Aqsha (Актау, Казахстан).

Соискатель:
- Навыки: "${userSkills || "не указаны"}"
- Предпочтительный район: "${userMicrorayon || "любой"}"

Активные вакансии:
${jobsSummary}

Оцени каждую вакансию для этого соискателя.

Правила оценки:
- score 70–100: навыки хорошо совпадают с требованиями вакансии
- score 40–69: частичное совпадение или смежная сфера
- score 10–39: слабое совпадение, но попробовать можно
- score 0–9: совершенно не подходит

Учитывай район: если совпадает — небольшой бонус.

Ответь ТОЛЬКО JSON-массивом ровно из ${jobs.length} объектов (по порядку вакансий), без markdown:
[{"score":82,"reason":"Опыт продаж напрямую соответствует вакансии менеджера"},{"score":12,"reason":"Нефтедобыча не связана с навыками соискателя"},...]`;

  const text = await callClaude(prompt);
  const result = parseJsonArray(text);
  if (!result) return null;
  if (Math.abs(result.length - jobs.length) > 1) return null;
  while (result.length < jobs.length) result.push({ score: null, reason: null });
  return result.slice(0, jobs.length);
}

async function enhanceCandidateMatches(job, candidates) {
  if (!process.env.ANTHROPIC_API_KEY || !candidates.length) return null;

  const candidatesSummary = candidates.slice(0, 6).map((c, i) =>
    `${i + 1}. Навыки: "${c.skills}"`
  ).join("\n");

  const prompt = `Ты — AI-матчер кандидатов платформы Aqsha.

Вакансия: "${job.title}" | Требует: "${job.skills || job.description?.slice(0, 100)}"

Кандидаты:
${candidatesSummary}

Оцени каждого кандидата для этой вакансии.
Ответь СТРОГО JSON-массивом (без markdown):
[{"score":80,"reason":"Опыт React соответствует стеку вакансии"},...]

Правила: score 0–100, reason на русском, 1 предложение.`;

  const text = await callClaude(prompt);
  return parseJsonArray(text);
}

// Location bonus: same microrayon = 10 pts bonus, different = 0
function locationScore(jobMicrorayon, userMicrorayon) {
  if (!jobMicrorayon || !userMicrorayon) return 0;
  return jobMicrorayon === userMicrorayon ? 10 : 0;
}

function buildDefaultReason(skills, description, experienceLevel, candidateSkills, score) {
  const jobKeywords = (skills || description || "").toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2);
  const candidateSet = new Set((candidateSkills || "").toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2));
  const matched = jobKeywords.filter((w) => candidateSet.has(w));

  if (score >= 70) {
    return `Отличное совпадение! Общие навыки: ${matched.slice(0, 4).join(", ")}.`;
  } else if (score >= 40) {
    return `Частичное совпадение. Общие навыки: ${matched.slice(0, 3).join(", ") || "не найдены"}. Рекомендуем откликнуться.`;
  }
  return experienceLevel === "Без опыта"
    ? "Опыт не требуется — отличный вариант для старта!"
    : "Слабое совпадение навыков, но мотивация в письме может решить.";
}

// GET /api/ai/match/jobs — top jobs for current seeker
aiRouter.get(
  "/ai/match/jobs",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await get(
      "SELECT id, skills, preferred_microrayon FROM users WHERE id = ?",
      [req.user.id]
    );

    const jobs = await all(
      `SELECT ads.*, users.name AS owner_name
       FROM ads JOIN users ON users.id = ads.user_id
       WHERE ads.status = 'active'
       ORDER BY ads.created_at DESC LIMIT 100`
    );

    const userSkills = user?.skills || "";
    const userMicrorayon = user?.preferred_microrayon || "";

    // Step 1: TF-IDF pre-score all jobs
    const prescored = jobs.map((job) => {
      const jobText = `${job.title} ${job.category} ${job.skills} ${job.description}`;
      const skillsScore = computeMatchScore(jobText, userSkills);
      const locBonus = locationScore(job.microrayon, userMicrorayon);
      return { ...job, _skillsScore: skillsScore + locBonus };
    });

    // Step 2: pick top-10 for Claude — always send all available jobs (max 10)
    prescored.sort((a, b) => b._skillsScore - a._skillsScore);
    const top = prescored.slice(0, 10);

    // Step 3: Claude semantic scoring
    const claudeResults = await enhanceJobMatches(userSkills, userMicrorayon, top);
    const aiPowered = Boolean(claudeResults);

    const matches = top.map((job, i) => {
      const claude = claudeResults?.[i];

      let finalScore;
      if (claude?.score != null) {
        // Claude score is authoritative; add small district bonus
        const districtBonus = (userMicrorayon && job.microrayon === userMicrorayon) ? 5 : 0;
        finalScore = Math.min(100, claude.score + districtBonus);
      } else {
        // Fallback: pure TF-IDF, no artificial inflation
        finalScore = job._skillsScore;
      }

      let reason = claude?.reason || buildDefaultReason(job.skills, job.description, job.experience_level, userSkills, job._skillsScore);
      if (userMicrorayon && job.microrayon === userMicrorayon && claude?.reason) {
        reason += ` Вакансия в вашем районе (${job.microrayon}).`;
      }

      return {
        id: job.id,
        title: job.title,
        category: job.category,
        salary: job.price,
        employmentType: job.employment_type,
        experienceLevel: job.experience_level,
        microrayon: job.microrayon,
        employerName: job.owner_name,
        createdAt: job.created_at,
        matchScore: finalScore,
        matchReason: reason,
        aiPowered,
      };
    });

    // Sort by score, filter out truly irrelevant (score < 10) only if there are better options
    matches.sort((a, b) => b.matchScore - a.matchScore);
    const hasGoodMatches = matches.some((m) => m.matchScore >= 30);
    const filtered = hasGoodMatches ? matches.filter((m) => m.matchScore >= 10) : matches;

    res.json({
      userSkills,
      userMicrorayon,
      aiPowered,
      matches: filtered,
    });
  })
);

// GET /api/ai/match/candidates/:jobId — top candidates for a job posting
aiRouter.get(
  "/ai/match/candidates/:jobId",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const jobId = parsePositiveInt(req.params.jobId, "jobId");

    const job = await get(
      "SELECT id, user_id, title, category, skills, description, experience_level, microrayon FROM ads WHERE id = ?",
      [jobId]
    );
    if (!job) throw notFound("Вакансия не найдена");

    const candidates = await all(
      `SELECT id, name, skills, preferred_microrayon FROM users
       WHERE role = 'seeker' AND skills IS NOT NULL AND skills != ''
       LIMIT 200`
    );

    const jobText = `${job.title} ${job.category} ${job.skills} ${job.description}`;

    const prescored = candidates.map((c) => {
      const skillsScore = computeMatchScore(jobText, c.skills || "");
      const locScore = locationScore(job.microrayon, c.preferred_microrayon || "");
      const combined = Math.round(skillsScore * 0.8 + locScore * 0.2);
      return { ...c, _skillsScore: skillsScore, _locScore: locScore, _combined: combined };
    });

    prescored.sort((a, b) => b._combined - a._combined);
    const top = prescored.slice(0, 10);

    const claudeResults = await enhanceCandidateMatches(job, top);
    const aiPowered = Boolean(claudeResults);

    const matches = top.map((c, i) => {
      const claude = claudeResults?.[i];
      const skillsFinal = claude?.score != null ? claude.score : c._skillsScore;
      const finalScore = Math.min(100, Math.round(skillsFinal * 0.75 + c._locScore * 0.25));
      const reason = claude?.reason || buildDefaultReason(job.skills, job.description, job.experience_level, c.skills, c._combined);

      return {
        id: c.id,
        name: c.name,
        skills: c.skills,
        matchScore: finalScore,
        matchReason: reason,
        aiPowered,
      };
    });

    matches.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      jobTitle: job.title,
      aiPowered,
      matches,
    });
  })
);

module.exports = { aiRouter };
