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
      <section className="landing-hero">
        <div className="landing-copy">
          <h1>{t("home.hero.title")}</h1>
          <p>{t("home.hero.subtitle")}</p>
          <div className="landing-actions">
            <Link to="/market" className="landing-btn landing-btn-green">
              {t("home.hero.cta")}
            </Link>
            <a href="#how" className="landing-btn landing-btn-light">
              {t("home.hero.how")}
            </a>
          </div>
        </div>

        <aside className="landing-preview-card" aria-label="Превью карточки">
          <div className="landing-preview-dots">
            <span style={{background: "#FF605C"}}/>
            <span style={{background: "#FFBD44"}}/>
            <span style={{background: "#00CA4E"}}/>
          </div>
          <div className="landing-preview-grid"></div>
        </aside>
      </section>

      <section className="landing-split" id="how">
        <div>
          <h2>{t("home.how.title")}</h2>
          <p>
            {t("home.how.subtitle")}
            <br />{t("home.how.fast")}
          </p>
          <Link to="/market" className="landing-btn landing-btn-dark">
            {t("home.how.cta")}
          </Link>
        </div>
        <div className="landing-texture" aria-hidden="true" />
      </section>

      <section className="landing-split landing-split-alt">
        <div className="landing-gradient" aria-hidden="true" />
        <div>
          <h2>{t("home.deadline.title")}</h2>
          <p>
            {t("home.deadline.subtitle")}
          </p>
          <Link to="/publish" className="landing-btn landing-btn-dark">
            {t("home.deadline.cta")}
          </Link>
        </div>
      </section>

      <section className="landing-split" id="ai">
        <div>
          <p style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--md-primary)", marginBottom: "0.5rem" }}>
            🤖 ИИ на aqsha.
          </p>
          <h2 style={{ marginBottom: "1rem" }}>Умный подбор вакансий</h2>
          <p style={{ marginBottom: "0.75rem", lineHeight: 1.6 }}>
            Укажите свои навыки в профиле — и Claude AI проанализирует все активные вакансии на платформе. Для каждой вакансии ИИ рассчитывает процент совместимости и объясняет, почему она подходит именно вам.
          </p>
          <p style={{ marginBottom: "1.25rem", lineHeight: 1.6, color: "var(--md-on-surface-variant)" }}>
            Не нужно просматривать десятки объявлений вручную — ИИ сортирует их по релевантности и показывает только подходящие.
          </p>
          <Link to="/ai-match" className="landing-btn landing-btn-green">
            Попробовать AI Подбор →
          </Link>
        </div>
        <div className="landing-texture" aria-hidden="true" style={{ background: "linear-gradient(135deg, var(--md-primary-container) 0%, var(--md-secondary-container) 100%)" }} />
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <strong>aqsha.</strong>
          <p style={{ whiteSpace: "pre-line" }}>
            {t("home.footer.desc")}
          </p>
          <div className="landing-socials">
            <a
              href="https://www.instagram.com/aqsha.hh/"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram aqsha.hh"
              title="Instagram aqsha.hh"
              className="instagram-icon-link"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                <circle cx="12" cy="12" r="4.2" />
                <circle cx="17.2" cy="6.8" r="1.05" />
              </svg>
            </a>
          </div>
        </div>

        <div>
          <h3>{t("home.footer.service")}</h3>
          <ul>
            <li>
              <Link to="/">{t("home.footer.service.home")}</Link>
            </li>
            <li>
              <Link to="/market">{t("home.footer.service.publish")}</Link>
            </li>
            <li>
              <Link to="/market">{t("home.footer.service.ads")}</Link>
            </li>
          </ul>
        </div>

        <div>
          <h3>{t("home.footer.info")}</h3>
          <ul>
            <li>
              <a href="#">{t("home.footer.info.about")}</a>
            </li>
            <li>
              <a href="#">{t("home.footer.info.how")}</a>
            </li>
            <li>
              <a href="#">{t("home.footer.info.rules")}</a>
            </li>
            <li>
              <a href="#">{t("home.footer.info.privacy")}</a>
            </li>
          </ul>
        </div>

        <div>
          <h3>{t("home.footer.support")}</h3>
          <ul>
            <li>
              <a href="#">{t("home.footer.support.feedback")}</a>
            </li>
            <li>
              <a href="#">{t("home.footer.support.problem")}</a>
            </li>
            <li>
              <a href="mailto:support@aqsha.kz">{t("home.footer.support.contacts")}</a>
            </li>
          </ul>
        </div>
      </footer>

      <p className="landing-metric">{t("home.metric", { count: totalAds })}</p>
    </div>
  );
}
