import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";
import { deleteAd, getMyAds, updateAdStatus } from "../api/ads";
import { login, register, getFaceIdStatus, registerFaceId, loginWithFaceId } from "../api/auth";
import { ApiError } from "../api/client";
import { FaceCamera } from "../components/FaceCamera";
import { IconUser, IconWallet, IconCrown, IconAward, IconStar, IconSprout, IconLogOut, IconSun, IconMoon, IconChevronRight, IconCheckCircle } from "../components/icons/Icons";
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

  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    const nextTheme = theme === "light" ? "dark" : "light";
    document.documentElement.style.setProperty("--vt-x", `${e.clientX}px`);
    document.documentElement.style.setProperty("--vt-y", `${e.clientY}px`);

    const apply = () => {
      setTheme(nextTheme);
      localStorage.setItem("theme", nextTheme);
      document.documentElement.setAttribute("data-theme", nextTheme);
    };

    if (!document.startViewTransition) { apply(); return; }
    document.startViewTransition(apply);
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

      {!user ? (
        <div className="m3-auth-container">
          <div className="m3-auth-card">
            <div className="m3-auth-header">
              <p className="eyebrow">{t("profile.title")}</p>
              <h1>{t("profile.auth.title")}</h1>
            </div>

            <div className="m3-tabs-segmented">
              <button 
                className={tab === "login" ? "active" : ""} 
                onClick={() => setTab("login")}
              >
                {t("profile.tabs.login")}
              </button>
              <button 
                className={tab === "register" ? "active" : ""} 
                onClick={() => setTab("register")}
              >
                {t("profile.tabs.register")}
              </button>
            </div>

            {error && <p className="error-box" style={{ margin: 0 }}>{error}</p>}
            {message && <p className="success-box" style={{ margin: 0 }}>{message}</p>}

            {tab === "login" ? (
              <form className="m3-auth-actions" onSubmit={handleLogin}>
                <div className="m3-text-field">
                  <label>{t("profile.email")}</label>
                  <input required type="email" name="email" placeholder="email@example.com" />
                </div>
                <div className="m3-text-field">
                  <label>{t("profile.password")}</label>
                  <input required type="password" name="password" minLength={8} placeholder="••••••••" />
                </div>
                
                <button className="primary" type="submit" style={{ marginTop: '0.5rem' }}>
                  {t("profile.login.btn")}
                </button>

                <div style={{ textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: "0.85rem", margin: '0.25rem 0' }}>
                  {t("profile.login.or")}
                </div>

                <button
                  className="m3-faceid-tonal"
                  type="button"
                  onClick={() => setShowCamera("login")}
                >
                  <IconUser size={20} />
                  {t("profile.login.faceid")}
                </button>
              </form>
            ) : (
              <form className="m3-auth-actions" onSubmit={handleRegister}>
                <div className="m3-text-field">
                  <label>{t("profile.register.name")}</label>
                  <input required name="name" minLength={2} placeholder={t("profile.register.name")} />
                </div>
                <div className="m3-text-field">
                  <label>{t("profile.email")}</label>
                  <input required type="email" name="email" placeholder="email@example.com" />
                </div>
                <div className="m3-text-field">
                  <label>{t("profile.password")}</label>
                  <input required type="password" name="password" minLength={8} placeholder="••••••••" />
                </div>
                <button className="primary" type="submit" style={{ marginTop: '0.5rem' }}>
                  {t("profile.register.btn")}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <div className="m3-profile-wrap">
          {error && <p className="error-box" style={{marginBottom: 0}}>{error}</p>}
          {message && <p className="success-box" style={{marginBottom: 0}}>{message}</p>}
          
          {/* 1. M3 Profile Header */}
          <div className="m3-profile-header">
            <div className="m3-avatar-large">
              <IconUser size={48} />
            </div>
            <h1 className="m3-profile-name">{user.name}</h1>
            {user.rank && (
              <span style={{ 
                background: user.rank === "Новичок" ? "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)" : 
                            user.rank === "Опытный" ? "linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)" : 
                            user.rank === "Профессионал" ? "linear-gradient(135deg, #f6d365 0%, #fda085 100%)" :
                            "linear-gradient(135deg, #ff0844 0%, #ffb199 100%)",
                color: user.rank === "Новичок" ? "#0D47A1" : user.rank === "Опытный" ? "#4A148C" : user.rank === "Профессионал" ? "#E65100" : "white",
                padding: "4px 14px", 
                borderRadius: "var(--md-radius-full)", 
                fontSize: "0.85rem", 
                fontWeight: "bold",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                margin: "0.25rem 0 0.75rem 0"
              }}>
                {user.rank === "Мастер" ? <IconCrown size={16} /> : user.rank === "Профессионал" ? <IconAward size={16} /> : user.rank === "Опытный" ? <IconStar size={16} /> : <IconSprout size={16} />}
                {user.rank}
              </span>
            )}
            <p className="m3-profile-email">{user.email}</p>
            <p className="m3-profile-uni">{user.university}</p>
          </div>

          {/* 2. M3 Stat Grid */}
          <div className="m3-stat-grid">
            <Link to="/wallet" className="m3-stat-card">
              <div className="m3-stat-icon">
                <IconWallet size={24} />
              </div>
              <span className="label">{t("nav.wallet")}</span>
              <span className="value m3-text-primary">{user.balance || 0} ₸</span>
            </Link>
            
            {(user.completedOrders !== undefined) && (
              <div className="m3-stat-card">
                <div className="m3-stat-icon" style={{ background: "var(--md-surface-variant)", color: "var(--md-on-surface-variant)" }}>
                  <IconCheckCircle size={24} />
                </div>
                <span className="label">{t("profile.completed.orders").split(" ")[0]}</span>
                <span className="value">{user.completedOrders}</span>
              </div>
            )}
          </div>

          {/* 3. M3 Settings List Card */}
          <div className="m3-list-card">
            {/* FaceID */}
            <button 
              className="m3-list-item" 
              onClick={() => setShowCamera("register")}
              type="button"
            >
              <div className="m3-list-item-icon">
                <IconUser size={20} />
              </div>
              <div className="m3-list-item-content">
                <span className="m3-list-item-title">{t("profile.faceid.title")}</span>
                <span className="m3-list-item-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {faceRegistered && <IconCheckCircle size={14} style={{ color: 'var(--md-primary)' }} />}
                  {faceRegistered === null ? t("profile.faceid.checking") : 
                   faceRegistered ? t("profile.faceid.connected") : t("profile.faceid.connect_prompt")}
                </span>
              </div>
              <div className={`m3-list-item-action ${faceRegistered ? "success" : ""}`}>
                {faceRegistered ? t("profile.faceid.re_record") : t("profile.faceid.connect_btn")}
              </div>
            </button>

            {/* Theme Toggle */}
            <button 
              className="m3-list-item"
              onClick={toggleTheme}
              type="button"
            >
              <div className="m3-list-item-icon">
                {theme === "light" ? <IconSun size={20} /> : <IconMoon size={20} />}
              </div>
              <div className="m3-list-item-content">
                <span className="m3-list-item-title">{t("theme.appearance")}</span>
                <span className="m3-list-item-subtitle">
                  {theme === "light" ? t("theme.light") : t("theme.dark")}
                </span>
              </div>
              <div className="m3-list-item-action">
                {t("theme.change")} <IconChevronRight size={18} style={{marginLeft: "4px"}} />
              </div>
            </button>

            {/* Logout */}
            <button 
              className="m3-list-item danger"
              onClick={onLogout}
              type="button"
            >
              <div className="m3-list-item-icon">
                <IconLogOut size={20} />
              </div>
              <div className="m3-list-item-content">
                <span className="m3-list-item-title">{t("profile.logout")}</span>
              </div>
            </button>
          </div>

          {/* 4. My Ads Section */}
          <section style={{ marginTop: "1rem" }}>
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
      )}
    </div>
  );
}
