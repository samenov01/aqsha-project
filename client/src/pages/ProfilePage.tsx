import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";
import { deleteAd, getMyAds, updateAdStatus } from "../api/ads";
import { login, register, getFaceIdStatus, registerFaceId, loginWithFaceId } from "../api/auth";
import { ApiError } from "../api/client";
import { FaceCamera } from "../components/FaceCamera";
import type { Ad, User } from "../types";
import { formatPrice } from "../lib/formatters";

type ProfilePageProps = {
  user: User | null;
  token: string | null;
  onLogin: (nextUser: User, token: string) => void;
  onLogout: () => void;
};

export function ProfilePage({ user, token, onLogin, onLogout }: ProfilePageProps) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [myAds, setMyAds] = useState<Ad[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(false);
  const { t } = useTranslation();

  /* FaceID state */
  const [faceRegistered, setFaceRegistered] = useState<boolean | null>(null);
  const [showCamera, setShowCamera] = useState<"register" | "login" | null>(null);

  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  useEffect(() => {
    if (!token) return;

    setIsLoadingAds(true);
    getMyAds(token)
      .then(setMyAds)
      .catch(() => setMyAds([]))
      .finally(() => setIsLoadingAds(false));
  }, [token]);

  /* Check face registration status */
  useEffect(() => {
    if (!token) {
      setFaceRegistered(null);
      return;
    }
    getFaceIdStatus(token)
      .then((data) => setFaceRegistered(data.registered))
      .catch(() => setFaceRegistered(null));
  }, [token]);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await register({
        name: String(formData.get("name") || ""),
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
      });

      onLogin(response.user, response.token);
      setMessage(t("profile.msg.register_success"));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await login({
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
      });

      onLogin(response.user, response.token);
      setMessage(t("profile.msg.login_success"));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  }

  /* FaceID register: camera captures face → sends descriptor to server */
  async function handleFaceRegisterDescriptor(descriptor: number[]) {
    if (!token) return;
    setError("");
    setMessage("");

    try {
      await registerFaceId(token, descriptor);
      setFaceRegistered(true);
      setMessage(t("profile.msg.faceid_success"));
      // Ждём 1.5 секунды, чтобы показать галочку, затем закрываем камеру
      setTimeout(() => setShowCamera(null), 1500);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("profile.msg.faceid_error"));
      }
      throw err; // Бросаем ошибку дальше, чтобы FaceCamera продолжила сканирование
    }
  }

  /* FaceID login: camera captures face → sends descriptor to server → receives JWT */
  async function handleFaceLoginDescriptor(descriptor: number[]) {
    setError("");
    setMessage("");

    try {
      const result = await loginWithFaceId(descriptor);
      onLogin(result.user, result.token);
      setMessage(t("profile.msg.faceid_login_success"));
      // Ждём 1.5 секунды, чтобы показать галочку, затем закрываем камеру
      setTimeout(() => setShowCamera(null), 1500);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("profile.msg.faceid_login_error"));
      }
      throw err; // Бросаем ошибку дальше, чтобы FaceCamera продолжила сканирование
    }
  }

  async function handleDelete(adId: number) {
    if (!token) return;

    try {
      await deleteAd(adId, token);
      setMyAds((prev) => prev.filter((ad) => ad.id !== adId));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  }

  async function handleStatusChange(adId: number, status: "active" | "archived" | "sold") {
    if (!token) return;
    setError("");
    try {
      await updateAdStatus(adId, status, token);
      setMyAds((prev) =>
        prev.map((ad) => (ad.id === adId ? { ...ad, status } : ad))
      );
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  }

  return (
    <div className="profile-grid">
      {/* Camera overlay */}
      {showCamera && (
        <FaceCamera
          actionLabel={showCamera === "register" ? t("facecamera.register.title") : t("facecamera.login.title")}
          onDescriptor={showCamera === "register" ? handleFaceRegisterDescriptor : handleFaceLoginDescriptor}
          onCancel={() => setShowCamera(null)}
        />
      )}

      <section className="section-grid">
        <div>
          <p className="eyebrow">{t("profile.title")}</p>
          <h1>{t("profile.auth.title")}</h1>
        </div>

        {!user ? (
          <>
            <div className="tabs">
              <button className={tab === "login" ? "active" : ""} onClick={() => setTab("login")}>
                {t("profile.tabs.login")}
              </button>
              <button className={tab === "register" ? "active" : ""} onClick={() => setTab("register")}>
                {t("profile.tabs.register")}
              </button>
            </div>

            {tab === "login" ? (
              <form className="form-card" onSubmit={handleLogin}>
                <label className="input-wrap">
                  <span>{t("profile.email")}</span>
                  <input required type="email" name="email" />
                </label>
                <label className="input-wrap">
                  <span>{t("profile.password")}</span>
                  <input required type="password" name="password" minLength={8} />
                </label>
                <button className="primary" type="submit">
                  {t("profile.login.btn")}
                </button>
                <div style={{ textAlign: "center", margin: "0.5rem 0", color: "var(--c-muted)", fontSize: "0.85rem" }}>
                  {t("profile.login.or")}
                </div>
                <button
                  className="faceid-btn"
                  type="button"
                  onClick={() => setShowCamera("login")}
                >
                  <span className="faceid-icon">👤</span>
                  {t("profile.login.faceid")}
                </button>
              </form>
            ) : (
              <form className="form-card" onSubmit={handleRegister}>
                <label className="input-wrap">
                  <span>{t("profile.register.name")}</span>
                  <input required name="name" minLength={2} />
                </label>
                <label className="input-wrap">
                  <span>{t("profile.email")}</span>
                  <input required type="email" name="email" />
                </label>
                <label className="input-wrap">
                  <span>{t("profile.password")}</span>
                  <input required type="password" name="password" minLength={8} />
                </label>
                <button className="primary" type="submit">
                  {t("profile.register.btn")}
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="profile-card" style={{ position: "relative" }}>
            <Link 
              to="/wallet"
              style={{
                position: "absolute",
                top: "1.5rem",
                right: "1.5rem",
                background: "var(--bg-soft)",
                padding: "0.5rem 1rem",
                borderRadius: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                textDecoration: "none",
                color: "var(--c-text)",
                border: "1px solid var(--line)",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.borderColor = "var(--brand)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "var(--line)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <span style={{ fontSize: "1.5rem" }}>💳</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--c-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("nav.wallet")}</span>
                <strong style={{ color: "var(--brand)", fontSize: "1.1rem" }}>{user.balance || 0} ₸</strong>
              </div>
            </Link>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem", paddingRight: "10rem" }}>
              <strong style={{ fontSize: "1.2rem" }}>{user.name}</strong>
              {user.rank && (
                <span style={{ 
                  background: user.rank === "Новичок" ? "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)" : 
                              user.rank === "Опытный" ? "linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)" : 
                              user.rank === "Профессионал" ? "linear-gradient(135deg, #f6d365 0%, #fda085 100%)" :
                              "linear-gradient(135deg, #ff0844 0%, #ffb199 100%)",
                  color: user.rank === "Новичок" ? "#0D47A1" : user.rank === "Опытный" ? "#4A148C" : user.rank === "Профессионал" ? "#E65100" : "white",
                  padding: "2px 8px", 
                  borderRadius: "12px", 
                  fontSize: "0.8rem", 
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}>
                  {user.rank === "Мастер" ? "👑" : user.rank === "Профессионал" ? "🌟" : user.rank === "Опытный" ? "⭐" : "🌱"}
                  {user.rank}
                </span>
              )}
            </div>
            <p style={{ margin: 0 }}>{user.email}</p>
            <p className="muted" style={{ margin: "0.25rem 0" }}>{user.university}</p>
            {user.completedOrders !== undefined && (
              <p style={{ fontSize: "0.85rem", color: "var(--brand)", fontWeight: 600, marginTop: "0.5rem", marginBottom: "1rem" }}>
                {t("profile.completed.orders", { count: user.completedOrders })}
              </p>
            )}

            {/* FaceID section */}
            <div className="faceid-section">
              <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>{t("profile.faceid.title")}</p>
              {faceRegistered === null && <p className="muted">{t("profile.faceid.checking")}</p>}
              {faceRegistered === true && (
                <>
                  <p className="success-box" style={{ marginBottom: "0.5rem" }}>
                    {t("profile.faceid.connected")}
                  </p>
                  <button className="ghost small" onClick={() => setShowCamera("register")}>
                    {t("profile.faceid.re_record")}
                  </button>
                </>
              )}
              {faceRegistered === false && (
                <>
                  <p className="muted" style={{ marginBottom: "0.5rem" }}>
                    {t("profile.faceid.connect_prompt")}
                  </p>
                  <button
                    className="faceid-btn"
                    onClick={() => setShowCamera("register")}
                  >
                    <span className="faceid-icon">👤</span>
                    {t("profile.faceid.connect_btn")}
                  </button>
                </>
              )}
            </div>

            <div className="theme-toggle-section" style={{ marginTop: "1rem", marginBottom: "1rem" }}>
              <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>{t("theme.appearance")}</p>
              <button 
                className="ghost" 
                onClick={toggleTheme}
                style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem" }}
              >
                <span>{theme === "light" ? t("theme.light") : t("theme.dark")}</span>
                <span style={{ fontSize: "0.85rem", color: "var(--brand)" }}>{t("theme.change")}</span>
              </button>
            </div>

            <button className="ghost" onClick={onLogout}>
              {t("profile.logout")}
            </button>
          </div>
        )}

        {error && <p className="error-box">{error}</p>}
        {message && <p className="success-box">{message}</p>}
      </section>

      <section className="section-grid">
        <div className="section-head-row">
          <div>
            <p className="eyebrow">{t("profile.ads.eyebrow")}</p>
            <h2>{t("profile.ads.title")}</h2>
          </div>
        </div>

        {isLoadingAds && <p className="muted">{t("common.loading")}</p>}

        {!isLoadingAds && myAds.length === 0 && <p className="muted">{t("profile.ads.empty")}</p>}

        <div className="my-ads-grid">
          {myAds.map((ad) => (
            <article key={ad.id} className="small-ad-card">
              <h3>{ad.title}</h3>
              <p className="muted">{ad.category}</p>
              <p className="price">{formatPrice(ad.price)}</p>
              <div className="status-row">
                <span className={`status-chip status-${ad.status || "active"}`}>
                  {ad.status === "sold" ? t("profile.ads.status.sold") : ad.status === "archived" ? t("profile.ads.status.archived.chip") : t("profile.ads.status.active")}
                </span>
              </div>
              <label className="input-wrap">
                <span>{t("profile.ads.status")}</span>
                <select
                  value={ad.status || "active"}
                  onChange={(event) => handleStatusChange(ad.id, event.target.value as "active" | "archived" | "sold")}
                >
                  <option value="active">{t("profile.ads.status.active")}</option>
                  <option value="sold">{t("profile.ads.status.sold")}</option>
                  <option value="archived">{t("profile.ads.status.archived")}</option>
                </select>
              </label>
              <button className="ghost small" onClick={() => handleDelete(ad.id)}>
                {t("common.delete")}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
