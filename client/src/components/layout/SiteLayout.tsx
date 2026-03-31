import { useEffect, useState } from "react";
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

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("theme");
      return saved === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  const toggleLang = () => {
    setLang(lang === "ru" ? "kk" : "ru");
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  function toggleTheme(e: React.MouseEvent<HTMLButtonElement>) {
    const next = theme === "dark" ? "light" : "dark";

    document.documentElement.style.setProperty("--vt-x", `${e.clientX}px`);
    document.documentElement.style.setProperty("--vt-y", `${e.clientY}px`);

    const apply = () => {
      // Update DOM synchronously so View Transition captures the new state
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      setTheme(next);
    };

    if (!document.startViewTransition) { apply(); return; }
    document.startViewTransition(apply);
  }

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
          <NavLink to="/favorites">Избранное</NavLink>
          <NavLink to="/news">Жаңалықтар</NavLink>
          {user?.isAdmin && <NavLink to="/admin/ads">{t("nav.admin")}</NavLink>}
        </nav>

        <div className="topbar-actions">
          <button
            className="theme-toggle"
            type="button"
            onClick={(e) => toggleTheme(e)}
            aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
            title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
          >
            {theme === "dark" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          <button 
            type="button" 
            onClick={toggleLang}
            className="theme-toggle"
            title="Сменить язык / Тілді ауыстыру"
            style={{ fontSize: "0.8rem", fontWeight: 700, width: "auto", padding: "0 0.6rem" }}
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
