import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAiMatchJobs } from "../api/ads";
import type { AiMatchResult, AiMatch } from "../types";
import { ApiError } from "../api/client";
import { formatPrice } from "../lib/formatters";

type AiMatchPageProps = {
  token: string | null;
};

function MatchScore({ score }: { score: number }) {
  const color = score >= 70 ? "var(--md-primary)" : score >= 40 ? "#f59e0b" : "var(--md-tertiary)";
  const radius = 20;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;

  return (
    <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="var(--md-surface-container-high)" strokeWidth="5" />
        <circle
          cx="28" cy="28" r={radius} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 0.6s" }}
        />
      </svg>
      <span style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.72rem", fontWeight: 800, color,
      }}>
        {score}%
      </span>
    </div>
  );
}

export function AiMatchPage({ token }: AiMatchPageProps) {
  const navigate = useNavigate();
  const [result, setResult] = useState<AiMatchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    getAiMatchJobs(token)
      .then(setResult)
      .catch((err: unknown) => {
        if (err instanceof ApiError) setError(err.message);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  if (!token) {
    return (
      <section className="section-grid">
        <div>
          <p className="eyebrow">AI Подбор</p>
          <h1>Умный подбор вакансий</h1>
        </div>
        <div style={{
          background: "var(--md-secondary-container)",
          border: "1px solid var(--md-outline-variant)",
          borderRadius: "var(--md-shape-xl)",
          padding: "2.5rem",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🤖</div>
          <p style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--md-on-surface)" }}>
            Войдите, чтобы получить AI-рекомендации
          </p>
          <p className="muted" style={{ marginBottom: "1.5rem" }}>
            Укажите навыки в профиле — AI автоматически подберёт вакансии Мангистау, подходящие именно вам.
          </p>
          <Link to="/profile" className="primary">Войти / Зарегистрироваться</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section-grid">
      <div>
        <p className="eyebrow">AI Подбор</p>
        <h1>Вакансии для вас</h1>
        {result?.userSkills && (
          <p className="muted" style={{ marginTop: "0.35rem", fontSize: "0.9rem" }}>
            Ваши навыки: <strong style={{ color: "var(--md-on-surface)" }}>{result.userSkills}</strong>
          </p>
        )}
      </div>

      {!result?.userSkills && !isLoading && !error && (
        <div className="ai-no-skills">
          <p>⚠️ Укажите навыки в профиле</p>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Для точного AI-матчинга добавьте свои навыки в разделе профиля.
          </p>
          <Link to="/profile" className="ai-no-skills-link">
            Перейти в профиль →
          </Link>
        </div>
      )}

      {isLoading && (
        <div className="ai-loading">
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🤖</div>
          <p className="muted">AI анализирует вакансии...</p>
        </div>
      )}

      {error && <p className="error-box">{error}</p>}

      {result && result.matches.length === 0 && (
        <div className="ai-empty">
          <p className="muted">Активных вакансий не найдено. Загляните позже.</p>
          <Link to="/market" className="primary" style={{ marginTop: "1rem", display: "inline-flex" }}>
            Смотреть все вакансии
          </Link>
        </div>
      )}

      {result && result.matches.length > 0 && (
        <div className="ai-match-list">
          {result.matches.map((match: AiMatch) => (
            <div
              key={match.id}
              className="ai-match-card"
              onClick={() => navigate(`/ad/${match.id}`)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") navigate(`/ad/${match.id}`); }}
            >
              <MatchScore score={match.matchScore} />

              <div className="ai-match-body">
                <div className="ai-match-head">
                  <div>
                    <div className="ai-match-title">{match.title}</div>
                    <div className="ai-match-sub">
                      {[match.category, match.microrayon, match.employmentType].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {match.salary > 0 && (
                    <span className="ai-match-salary">{formatPrice(match.salary)}/мес</span>
                  )}
                </div>

                <div className="ai-match-reason">🤖 {match.matchReason}</div>

                <div className="ai-match-foot">
                  <span className="ai-match-employer">
                    {match.employerName} · {new Date(match.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                  <span className="ai-match-open">Открыть →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
