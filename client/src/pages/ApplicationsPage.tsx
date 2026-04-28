import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyApplications } from "../api/applications";
import type { Application } from "../types";
import { ApiError } from "../api/client";
import { formatPrice } from "../lib/formatters";

type ApplicationsPageProps = {
  token: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pending:  { label: "Отправлен",  bg: "color-mix(in srgb,#6366f1 15%,transparent)", color: "#4338ca", border: "color-mix(in srgb,#6366f1 35%,transparent)" },
  viewed:   { label: "Просмотрен", bg: "color-mix(in srgb,#f59e0b 12%,transparent)", color: "#92400e", border: "color-mix(in srgb,#f59e0b 35%,transparent)" },
  accepted: { label: "Принят ✅",  bg: "color-mix(in srgb,#22c55e 12%,transparent)", color: "#166534", border: "color-mix(in srgb,#22c55e 35%,transparent)" },
  rejected: { label: "Отклонён",   bg: "color-mix(in srgb,#ef4444 12%,transparent)", color: "#991b1b", border: "color-mix(in srgb,#ef4444 35%,transparent)" },
};

export function ApplicationsPage({ token }: ApplicationsPageProps) {
  const [apps, setApps] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    getMyApplications(token)
      .then(setApps)
      .catch((err: unknown) => {
        if (err instanceof ApiError) setError(err.message);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  if (!token) {
    return (
      <section className="section-grid">
        <p className="error-box">Войдите в профиль, чтобы видеть отклики.</p>
        <Link className="primary" to="/profile">Войти</Link>
      </section>
    );
  }

  return (
    <section className="section-grid">
      <div>
        <p className="eyebrow">Мои отклики</p>
        <h1>История откликов</h1>
      </div>

      {isLoading && <p className="muted">Загрузка откликов...</p>}
      {error && <p className="error-box">{error}</p>}

      {!isLoading && !error && apps.length === 0 && (
        <div className="ai-empty">
          <p className="muted" style={{ fontSize: "1.05rem" }}>Пока нет откликов.</p>
          <p className="muted" style={{ marginTop: "0.4rem" }}>Найдите подходящую вакансию и откликнитесь!</p>
          <Link to="/market" className="primary" style={{ marginTop: "1.25rem", display: "inline-flex" }}>
            Найти вакансии
          </Link>
        </div>
      )}

      <div className="applications-list">
        {apps.map((app) => {
          const st = STATUS_CONFIG[app.status] ?? { label: app.status, bg: "var(--md-surface-container)", color: "var(--md-on-surface-variant)", border: "var(--md-outline-variant)" };
          return (
            <div key={app.id} className="application-card">
              <div className="application-head">
                <div>
                  <div className="application-title">{app.job?.title ?? "Вакансия"}</div>
                  <div className="application-sub">
                    {[app.job?.category, app.job?.microrayon, app.job?.employerName].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="application-meta">
                  {(app.job?.salary ?? 0) > 0 && (
                    <span className="application-salary">
                      {formatPrice(app.job!.salary)}/мес
                    </span>
                  )}
                  <span
                    className="application-status"
                    style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}
                  >
                    {st.label}
                  </span>
                </div>
              </div>

              {app.coverLetter && (
                <div className="application-letter">«{app.coverLetter}»</div>
              )}

              <div className="application-foot">
                <span className="application-date">
                  Отправлен: {new Date(app.createdAt).toLocaleDateString("ru-RU")}
                </span>
                <Link to={`/ad/${app.jobId}`} className="application-link">
                  Открыть вакансию →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
