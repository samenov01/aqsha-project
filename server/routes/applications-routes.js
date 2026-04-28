const { Router } = require("express");
const { all, get, run } = require("../db/client");
const { asyncHandler } = require("../lib/async-handler");
const { badRequest, forbidden, notFound } = require("../lib/http-error");
const { optionalText, parsePositiveInt } = require("../lib/validators");
const { authMiddleware } = require("../middleware/auth");
const { createNotification } = require("../lib/notifications");
const { notifyTelegram } = require("../telegram-bot");

const applicationsRouter = Router();

// POST /api/jobs/:id/apply — откликнуться на вакансию
applicationsRouter.post(
  "/jobs/:id/apply",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const jobId = parsePositiveInt(req.params.id, "id");
    const coverLetter = optionalText(req.body.coverLetter, { max: 1000 });

    const job = await get(
      "SELECT id, user_id, title FROM ads WHERE id = ? AND status = 'active'",
      [jobId]
    );
    if (!job) throw notFound("Вакансия не найдена");

    if (job.user_id === req.user.id) {
      throw badRequest("Нельзя откликнуться на собственную вакансию");
    }

    const existing = await get(
      "SELECT id FROM applications WHERE job_id = ? AND applicant_id = ?",
      [jobId, req.user.id]
    );
    if (existing) throw badRequest("Вы уже откликались на эту вакансию");

    await run(
      "INSERT INTO applications (job_id, applicant_id, cover_letter) VALUES (?, ?, ?)",
      [jobId, req.user.id, coverLetter]
    );

    // Уведомляем работодателя
    await createNotification(job.user_id, "new_application", "Новый отклик на вашу вакансию", `${req.user.name} откликнулся на «${job.title}»`, `/ad/${jobId}`);

    // Telegram-уведомление работодателю
    const employer = await get("SELECT telegram_chat_id FROM users WHERE id = ?", [job.user_id]);
    if (employer?.telegram_chat_id) {
      await notifyTelegram(
        employer.telegram_chat_id,
        `🔔 Новый отклик!\n*${req.user.name}* откликнулся на вашу вакансию «${job.title}»\n\nОткройте платформу, чтобы просмотреть отклик.`
      );
    }

    res.status(201).json({ ok: true });
  })
);

// GET /api/jobs/:id/applications — список откликов по вакансии (для работодателя)
applicationsRouter.get(
  "/jobs/:id/applications",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const jobId = parsePositiveInt(req.params.id, "id");

    const job = await get("SELECT id, user_id FROM ads WHERE id = ?", [jobId]);
    if (!job) throw notFound("Вакансия не найдена");
    if (job.user_id !== req.user.id && !req.user.isAdmin) {
      throw forbidden("Доступ запрещён");
    }

    const rows = await all(
      `SELECT a.id, a.job_id, a.cover_letter, a.status, a.created_at,
              u.id AS user_id, u.name AS applicant_name, u.email AS applicant_email,
              u.skills AS applicant_skills
       FROM applications a
       JOIN users u ON u.id = a.applicant_id
       WHERE a.job_id = ?
       ORDER BY a.created_at DESC`,
      [jobId]
    );

    // Отмечаем непросмотренные как просмотренные
    await run(
      "UPDATE applications SET status = 'viewed' WHERE job_id = ? AND status = 'pending'",
      [jobId]
    );

    res.json(
      rows.map((r) => ({
        id: r.id,
        jobId: r.job_id,
        coverLetter: r.cover_letter,
        status: r.status,
        createdAt: r.created_at,
        applicant: {
          id: r.user_id,
          name: r.applicant_name,
          email: r.applicant_email,
          skills: r.applicant_skills || "",
        },
      }))
    );
  })
);

// GET /api/my/applications — мои отклики (для соискателя)
applicationsRouter.get(
  "/my/applications",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const rows = await all(
      `SELECT a.id, a.job_id, a.cover_letter, a.status, a.created_at,
              ads.title AS job_title, ads.category AS job_category, ads.price AS job_salary,
              ads.microrayon, ads.employment_type,
              u.name AS employer_name
       FROM applications a
       JOIN ads ON ads.id = a.job_id
       JOIN users u ON u.id = ads.user_id
       WHERE a.applicant_id = ?
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );

    res.json(
      rows.map((r) => ({
        id: r.id,
        jobId: r.job_id,
        coverLetter: r.cover_letter,
        status: r.status,
        createdAt: r.created_at,
        job: {
          id: r.job_id,
          title: r.job_title,
          category: r.job_category,
          salary: r.job_salary,
          microrayon: r.microrayon,
          employmentType: r.employment_type,
          employerName: r.employer_name,
        },
      }))
    );
  })
);

// PATCH /api/applications/:id/status — принять/отклонить отклик (работодатель)
applicationsRouter.patch(
  "/applications/:id/status",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const appId = parsePositiveInt(req.params.id, "id");
    const { status } = req.body;

    if (!["accepted", "rejected"].includes(status)) {
      throw badRequest("Некорректный статус. Допустимо: accepted, rejected");
    }

    const app = await get(
      `SELECT a.id, a.applicant_id, a.job_id, ads.user_id AS job_owner_id, ads.title AS job_title
       FROM applications a JOIN ads ON ads.id = a.job_id WHERE a.id = ?`,
      [appId]
    );
    if (!app) throw notFound("Отклик не найден");
    if (app.job_owner_id !== req.user.id && !req.user.isAdmin) {
      throw forbidden("Доступ запрещён");
    }

    await run("UPDATE applications SET status = ? WHERE id = ?", [status, appId]);

    const label = status === "accepted" ? "принят ✅" : "отклонён";
    await createNotification(
      app.applicant_id,
      "application_status",
      `Ваш отклик ${label}`,
      `Работодатель ${status === "accepted" ? "принял" : "отклонил"} ваш отклик на «${app.job_title}»`,
      `/ad/${app.job_id}`
    );

    res.json({ ok: true });
  })
);

module.exports = { applicationsRouter };
