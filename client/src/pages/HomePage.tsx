import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";
import type { Ad } from "../types";

type HomePageProps = {
  ads: Ad[];
};

export function HomePage({ ads }: HomePageProps) {
  const totalAds = ads.length;
  const { t } = useTranslation();

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-copy">
          <p className="eyebrow" style={{ marginBottom: "1rem" }}>
            Мангистауская область · Актау
          </p>
          <h1>{t("home.hero.title")}</h1>
          <p style={{ marginTop: "1.25rem" }}>{t("home.hero.subtitle")}</p>
          <div className="landing-actions">
            <Link to="/market" className="landing-btn landing-btn-green">
              {t("home.hero.cta")}
            </Link>
            <Link to="/publish" className="landing-btn landing-btn-light">
              {t("home.hero.post")}
            </Link>
          </div>
          <div className="landing-stats">
            {[
              { value: `${totalAds || "6"}+`, label: t("home.stats.jobs") },
              { value: "50+",  label: t("home.stats.companies") },
              { value: "200+", label: t("home.stats.seekers") },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="landing-stat-value">{stat.value}</div>
                <div className="landing-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <aside className="landing-preview-card" aria-label="Превью платформы">
          <div className="landing-preview-dots">
            <span style={{ background: "var(--md-primary)" }} />
            <span style={{ background: "var(--md-tertiary)" }} />
            <span style={{ background: "var(--md-secondary)" }} />
          </div>
          {[
            { title: "Официант / Бармен", cat: "Кафе / Рестораны", mkt: "5 мкр", salary: "150 000 ₸", score: 92 },
            { title: "Frontend Developer", cat: "IT / Разработка", mkt: "Центр", salary: "350 000 ₸", score: 87 },
            { title: "Кассир в магазин", cat: "Торговля / Склад", mkt: "9 мкр", salary: "120 000 ₸", score: 74 },
          ].map((job) => (
            <div key={job.title} className="landing-job-item">
              <div>
                <div className="landing-job-title">{job.title}</div>
                <div className="landing-job-meta">{job.cat} · {job.mkt}</div>
                <div className="landing-job-salary">{job.salary}/мес</div>
              </div>
              <div className="landing-ai-badge">AI {job.score}%</div>
            </div>
          ))}
        </aside>
      </section>

      {/* ── Возможности ──────────────────────────────────────────── */}
      <section className="landing-section" id="features">
        <h2 className="landing-section-title">Всё для поиска работы в Актау</h2>
        <p className="landing-section-sub">
          Платформа объединяет соискателей, работодателей и фрилансеров в одном месте
        </p>
        <div className="landing-features-grid">
          {[
            { icon: "🤖", title: "AI-матчинг", desc: "Искусственный интеллект анализирует ваши навыки и автоматически подбирает лучшие вакансии с оценкой совместимости." },
            { icon: "💼", title: "Биржа труда", desc: "Сотни актуальных вакансий в Актау. Удобные фильтры по категории, опыту, зарплате и микрорайону." },
            { icon: "⭐", title: "Услуги", desc: "Закажите услуги у проверенных фрилансеров или предложите свои. Рейтинги, отзывы и безопасные расчёты." },
            { icon: "🔔", title: "Уведомления", desc: "Мгновенные уведомления о новых вакансиях, откликах и сообщениях в реальном времени." },
            { icon: "🔒", title: "Безопасность", desc: "Верификация пользователей, Face ID авторизация и защищённые платёжные операции." },
            { icon: "📱", title: "Telegram-бот", desc: "Следите за новыми вакансиями прямо в Telegram. Мгновенные оповещения о свежих объявлениях." },
          ].map((f) => (
            <div key={f.title} className="landing-feature-card">
              <div className="landing-feature-icon">{f.icon}</div>
              <div className="landing-feature-title">{f.title}</div>
              <div className="landing-feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Как это работает ─────────────────────────────────────── */}
      <section className="landing-steps-section" id="how">
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <h2 className="landing-section-title">{t("home.how.title")}</h2>
          <p className="landing-section-sub" style={{ marginBottom: 0 }}>
            Три простых шага до новой работы
          </p>
        </div>
        <div className="landing-steps-grid">
          {[
            { num: "01", icon: "👤", title: t("home.how.step1.title"), desc: t("home.how.step1.desc") },
            { num: "02", icon: "🤖", title: t("home.how.step2.title"), desc: t("home.how.step2.desc") },
            { num: "03", icon: "✅", title: t("home.how.step3.title"), desc: t("home.how.step3.desc") },
          ].map((step) => (
            <div key={step.num} className="landing-step-card">
              <div className="landing-step-num">{step.num}</div>
              <div className="landing-step-icon">{step.icon}</div>
              <div className="landing-step-title">{step.title}</div>
              <div className="landing-step-desc">{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI-матчинг ───────────────────────────────────────────── */}
      <section className="landing-split landing-split-alt">
        <div>
          <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>AI-МАТЧИНГ</p>
          <h2>Умный подбор вакансий</h2>
          <p style={{ marginTop: "0.75rem" }}>
            Платформа анализирует ваши навыки и автоматически ранжирует вакансии по совместимости.
            Не нужно просматривать сотни объявлений — AI находит лучшие варианты за секунды.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "2rem" }}>
            <Link to="/ai-match" className="landing-btn landing-btn-green">
              Попробовать AI подбор
            </Link>
            <Link to="/profile" className="landing-btn landing-btn-light">
              Указать навыки
            </Link>
          </div>
        </div>
        <div className="landing-gradient" aria-hidden="true">🤖</div>
      </section>

      {/* ── Для работодателей ────────────────────────────────────── */}
      <section className="landing-split">
        <div className="landing-texture" aria-hidden="true" />
        <div>
          <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>ДЛЯ РАБОТОДАТЕЛЕЙ</p>
          <h2>{t("home.employers.title")}</h2>
          <p style={{ marginTop: "0.75rem" }}>{t("home.employers.subtitle")}</p>
          <Link to="/publish" className="landing-btn landing-btn-dark" style={{ marginTop: "2rem", display: "inline-flex" }}>
            {t("home.employers.cta")}
          </Link>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────── */}
      <div className="landing-cta-banner">
        <h2>Начните прямо сейчас</h2>
        <p>
          Присоединяйтесь к платформе, которая помогает людям Актау находить работу и строить карьеру
        </p>
        <div className="landing-cta-actions">
          <Link to="/market" className="landing-cta-btn-filled">
            Найти работу
          </Link>
          <Link to="/publish" className="landing-cta-btn-outline">
            Разместить вакансию
          </Link>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <strong>aqsha.</strong>
          <p style={{ whiteSpace: "pre-line", marginTop: "0.25rem" }}>
            {t("home.footer.desc")}
          </p>
          <div className="landing-socials">
            <a
              href="https://t.me/jumysai_aktau"
              target="_blank"
              rel="noreferrer"
              aria-label="Telegram"
              className="instagram-icon-link"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.7 8c-.12.56-.46.7-.94.43l-2.6-1.91-1.25 1.2c-.14.14-.26.26-.53.26l.18-2.59 4.72-4.27c.21-.18-.05-.28-.32-.1L7.76 14.32l-2.5-.78c-.54-.17-.56-.54.12-.8l9.8-3.78c.45-.16.84.11.46 1.04z"/>
              </svg>
            </a>
          </div>
        </div>

        <div>
          <h3>{t("home.footer.service")}</h3>
          <ul>
            <li><Link to="/">{t("home.footer.service.home")}</Link></li>
            <li><Link to="/publish">{t("home.footer.service.publish")}</Link></li>
            <li><Link to="/market">{t("home.footer.service.ads")}</Link></li>
          </ul>
        </div>

        <div>
          <h3>{t("home.footer.info")}</h3>
          <ul>
            <li><a href="#">{t("home.footer.info.about")}</a></li>
            <li><a href="#how">{t("home.footer.info.how")}</a></li>
            <li><a href="#">{t("home.footer.info.rules")}</a></li>
            <li><a href="#">{t("home.footer.info.privacy")}</a></li>
          </ul>
        </div>

        <div>
          <h3>{t("home.footer.support")}</h3>
          <ul>
            <li><a href="#">{t("home.footer.support.feedback")}</a></li>
            <li><a href="#">{t("home.footer.support.problem")}</a></li>
            <li><a href="mailto:support@jumysai.kz">{t("home.footer.support.contacts")}</a></li>
          </ul>
        </div>
      </footer>

      <p className="landing-metric">{t("home.metric", { count: totalAds })}</p>
    </div>
  );
}
