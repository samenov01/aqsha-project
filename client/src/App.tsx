import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getAds, getMeta } from "./api/ads";
import { getMe } from "./api/auth";
import { getUnreadCount } from "./api/notifications";
import { SiteLayout } from "./components/layout/SiteLayout";
import { removeKeys, saveJson, storageKeys, loadJson } from "./lib/storage";
import { HomePage } from "./pages/HomePage";
import { MarketPage } from "./pages/MarketPage";
import { ServicesPage } from "./pages/ServicesPage";
import { ServicePublishPage } from "./pages/ServicePublishPage";
import { ServiceDetailsPage } from "./pages/ServiceDetailsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { OrderDetailsPage } from "./pages/OrderDetailsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { PublishPage } from "./pages/PublishPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdDetailsPage } from "./pages/AdDetailsPage";
import { ServiceEditPage } from "./pages/ServiceEditPage";
import { AdminAdsPage } from "./pages/AdminAdsPage";
import { WalletPage } from "./pages/WalletPage";
import { PublicProfilePage } from "./pages/PublicProfilePage";
import { FavoritesPage } from "./pages/FavoritesPage";
import { NewsPage } from "./pages/NewsPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { AiMatchPage } from "./pages/AiMatchPage";
import type { Ad, User } from "./types";
import { I18nProvider } from "./i18n";

const fallbackCategories = [
  "Рестораны и общепит",
  "Строительство и недвижимость",
  "Продажи и торговля",
  "Красота и здоровье",
  "IT, интернет и дизайн",
  "Транспорт и логистика",
  "Охрана и безопасность",
  "Административный персонал",
  "Образование и наука",
  "Медицина и фармацевтика",
  "Производство и сырьё",
  "Бухгалтерия и финансы",
  "Маркетинг и реклама",
  "Рабочий персонал",
  "Другое",
];

const fallbackEmploymentTypes = ["Полная занятость", "Частичная занятость", "Проектная работа", "Стажировка", "Вахтовый метод"];
const fallbackExperienceLevels = ["Без опыта", "От 1 года", "От 3 лет", "От 6 лет"];
const fallbackMicrorayons = [
  "1 мкр","2 мкр","3 мкр","3А мкр","3Б мкр",
  "4 мкр","5 мкр","6 мкр","7 мкр","8 мкр","9 мкр",
  "10 мкр","11 мкр","12 мкр","13 мкр","14 мкр","15 мкр",
  "16 мкр","17 мкр",
  "18 мкр","19 мкр","19А мкр",
  "20 мкр","20А мкр",
  "21 мкр","22 мкр","23 мкр","24 мкр","25 мкр",
  "26 мкр","27 мкр","28 мкр","28А мкр","29 мкр","29А мкр",
  "30 мкр","31 мкр","31А мкр","31Б мкр",
  "32 мкр","32А мкр","32Б мкр","32В мкр",
  "33 мкр","34 мкр","34А мкр",
  "35 мкр","36 мкр","37 мкр","38 мкр","39 мкр",
  "Шыгыс 1","Шыгыс 2","Шыгыс 3",
  "Приморский","Рауан","Самал","Акшукур",
  "Центр","Другое",
];

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(storageKeys.token));
  const [user, setUser] = useState<User | null>(() => {
    if (!localStorage.getItem(storageKeys.token)) return null;
    return loadJson<User | null>(storageKeys.user, null);
  });
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    const initial = loadJson<number[]>(storageKeys.favorites, []);
    return new Set(initial);
  });
  const [notificationsCount, setNotificationsCount] = useState(0);

  const [categories, setCategories] = useState<string[]>(fallbackCategories);
  const [employmentTypes, setEmploymentTypes] = useState<string[]>(fallbackEmploymentTypes);
  const [experienceLevels, setExperienceLevels] = useState<string[]>(fallbackExperienceLevels);
  const [microrayons, setMicrorayons] = useState<string[]>(fallbackMicrorayons);
  const [defaultUniversity, setDefaultUniversity] = useState("Актау");
  const [homeAds, setHomeAds] = useState<Ad[]>([]);

  useEffect(() => {
    getMeta()
      .then((meta) => {
        setCategories(meta.categories);
        if (meta.employmentTypes) setEmploymentTypes(meta.employmentTypes);
        if (meta.experienceLevels) setExperienceLevels(meta.experienceLevels);
        if (meta.microrayons) setMicrorayons(meta.microrayons);
        setDefaultUniversity(meta.defaultUniversity);
      })
      .catch(() => undefined);

    getAds({ limit: 6 })
      .then(setHomeAds)
      .catch(() => setHomeAds([]));
  }, []);

  useEffect(() => {
    if (!token) {
      removeKeys([storageKeys.user, storageKeys.token]);
      setNotificationsCount(0);
      return;
    }

    localStorage.setItem(storageKeys.token, token);
    getMe(token)
      .then((response) => setUser(response.user))
      .catch(() => { setToken(null); setUser(null); });

    getUnreadCount(token)
      .then((data) => setNotificationsCount(data.count))
      .catch(() => setNotificationsCount(0));
  }, [token]);

  useEffect(() => {
    if (user) saveJson(storageKeys.user, user);
  }, [user]);

  useEffect(() => {
    saveJson(storageKeys.favorites, Array.from(favorites));
  }, [favorites]);

  function toggleFavorite(id: number) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function onAuth(nextUser: User, nextToken: string) {
    setUser(nextUser);
    setToken(nextToken);
  }

  function onLogout() {
    setUser(null);
    setToken(null);
    removeKeys([storageKeys.user, storageKeys.token]);
  }

  const favoritesCount = useMemo(() => favorites.size, [favorites]);

  const refreshNotifications = useCallback(() => {
    if (!token) { setNotificationsCount(0); return; }
    getUnreadCount(token)
      .then((data) => setNotificationsCount(data.count))
      .catch(() => setNotificationsCount(0));
  }, [token]);

  return (
    <I18nProvider>
      <SiteLayout user={user} favoritesCount={favoritesCount} notificationsCount={notificationsCount}>
        <Routes>
          <Route path="/" element={<HomePage ads={homeAds} />} />
          <Route
            path="/market"
            element={
              <MarketPage
                categories={categories}
                employmentTypes={employmentTypes}
                experienceLevels={experienceLevels}
                microrayons={microrayons}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
              />
            }
          />
          <Route path="/services" element={<ServicesPage categories={categories} token={token} />} />
          <Route
            path="/services/new"
            element={<ServicePublishPage token={token} categories={categories} defaultUniversity={defaultUniversity} />}
          />
          <Route path="/services/:id" element={<ServiceDetailsPage token={token} user={user} />} />
          <Route
            path="/services/:id/edit"
            element={<ServiceEditPage token={token} categories={categories} defaultUniversity={defaultUniversity} />}
          />
          <Route path="/orders" element={<OrdersPage token={token} />} />
          <Route path="/orders/:id" element={<OrderDetailsPage token={token} user={user} />} />
          <Route path="/notifications" element={<NotificationsPage token={token} onRefresh={refreshNotifications} />} />
          <Route
            path="/wallet"
            element={<WalletPage token={token} user={user} updateUser={(updates) => setUser((prev) => (prev ? { ...prev, ...updates } : null))} />}
          />
          <Route path="/admin/ads" element={<AdminAdsPage token={token} user={user} />} />
          <Route
            path="/publish"
            element={
              <PublishPage
                token={token}
                categories={categories}
                employmentTypes={employmentTypes}
                experienceLevels={experienceLevels}
                microrayons={microrayons}
                defaultUniversity={defaultUniversity}
              />
            }
          />
          <Route
            path="/profile"
            element={
              <ProfilePage
                key={token || "guest"}
                user={user}
                token={token}
                microrayons={microrayons}
                onLogin={onAuth}
                onLogout={onLogout}
                onUpdateUser={(updates) => setUser((prev) => (prev ? { ...prev, ...updates } : null))}
              />
            }
          />
          <Route
            path="/ad/:id"
            element={<AdDetailsPage favorites={favorites} onToggleFavorite={toggleFavorite} token={token} user={user} />}
          />
          <Route path="/users/:id" element={<PublicProfilePage />} />
          <Route path="/favorites" element={<FavoritesPage token={token} />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/applications" element={<ApplicationsPage token={token} />} />
          <Route path="/ai-match" element={<AiMatchPage token={token} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SiteLayout>
    </I18nProvider>
  );
}
