import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "../../i18n";
import type { User } from "../../types";

type SiteLayoutProps = {
  children: ReactNode;
  user?: User | null;
  favoritesCount: number;
  notificationsCount?: number;
};

export function SiteLayout({ children, user, favoritesCount, notificationsCount = 0 }: SiteLayoutProps) {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const userName = user?.name;
  const { t, lang, setLang } = useTranslation();

  const toggleLang = () => {
    setLang(lang === "ru" ? "kk" : "ru");
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  return (
    <div className={`app-shell ${isHome ? "app-shell-home" : ""}`}>
      <header className="topbar topbar-glass">
        <Link to="/" className="brand-text">
          <img src="/aqsha.png" alt="logo" className="brand-logo" />
          <span className="brand-logo-text">aqsha.</span>
        </Link>

        <nav className="main-nav">
          <NavLink to="/" end>
            {t("nav.home")}
          </NavLink>
          <NavLink to="/market">{t("nav.market")}</NavLink>
          <NavLink to="/services">{t("nav.services")}</NavLink>
          <NavLink to="/orders">{t("nav.orders")}</NavLink>
          <NavLink to="/notifications" className="nav-with-badge">
            {t("nav.notifications")}
            {notificationsCount > 0 && <span className="nav-badge">{notificationsCount}</span>}
          </NavLink>
          {user?.isAdmin && <NavLink to="/admin/ads">{t("nav.admin")}</NavLink>}
        </nav>

        <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
          <button 
            type="button" 
            onClick={toggleLang}
            style={{ 
              background: "var(--bg-soft)", 
              border: "1px solid var(--line)", 
              padding: "4px 8px", 
              borderRadius: "8px", 
              cursor: "pointer", 
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "var(--c-text)",
              transition: "all 0.2s"
            }}
            title="Сменить язык / Тілді ауыстыру"
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand)" }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)" }}
          >
            {lang === "ru" ? "KK" : "RU"}
          </button>
          
          <Link
            className="header-profile"
            to="/profile"
            aria-label={`${userName || t("nav.profile")}. Избранных: ${favoritesCount}`}
          >
            {userName || t("nav.profile")}
          </Link>
          <Link className="header-cta" to="/publish">
            {t("nav.publish")}
          </Link>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
