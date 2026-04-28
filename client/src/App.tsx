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
import { AiMatchPage } from "./pages/AiMatchPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { DialogsPage } from "./pages/DialogsPage";
import { FreelancerProfilePage } from "./pages/FreelancerProfilePage";
import type { Ad, User } from "./types";
import { I18nProvider } from "./i18n";

const fallbackCategories = [
  "Учебные работы под ключ",
  "Презентации / слайды",
  "Куизы / тесты / NEO / ответы на сессию",
  "Аренда микронаушника / петлички",
  "Моб. интернет / GB (Beeline/Tele2/Activ)",
  "Билеты / ивенты",
  "Аренда квартиры / комнаты",
  "Справки / деканат / пересдача",
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
  const [defaultUniversity, setDefaultUniversity] = useState("Yessenov University (Aktau)");
  const [homeAds, setHomeAds] = useState<Ad[]>([]);

  useEffect(() => {
    getMeta()
      .then((meta) => {
        setCategories(meta.categories);
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
      .then((response) => {
        setUser(response.user);
      })
      .catch(() => {
        setToken(null);
        setUser(null);
      });

    getUnreadCount(token)
      .then((data) => setNotificationsCount(data.count))
      .catch(() => setNotificationsCount(0));
  }, [token]);

  useEffect(() => {
    if (user) {
      saveJson(storageKeys.user, user);
    }
  }, [user]);

  useEffect(() => {
    saveJson(storageKeys.favorites, Array.from(favorites));
  }, [favorites]);

  function toggleFavorite(id: number) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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
    if (!token) {
      setNotificationsCount(0);
      return;
    }
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
            element={<MarketPage categories={categories} favorites={favorites} onToggleFavorite={toggleFavorite} />}
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
          <Route path="/wallet" element={<WalletPage token={token} user={user} updateUser={(updates) => setUser((prev) => (prev ? { ...prev, ...updates } : null))} />} />
          <Route path="/admin/ads" element={<AdminAdsPage token={token} user={user} />} />
          <Route
            path="/publish"
            element={<PublishPage token={token} categories={categories} defaultUniversity={defaultUniversity} />}
          />
          <Route
            path="/profile"
            element={<ProfilePage key={token || "guest"} user={user} token={token} onLogin={onAuth} onLogout={onLogout} />}
          />
          <Route path="/ad/:id" element={<AdDetailsPage favorites={favorites} onToggleFavorite={toggleFavorite} token={token} user={user} />} />
          <Route path="/users/:id" element={<PublicProfilePage />} />
          <Route path="/favorites" element={<FavoritesPage token={token} />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/ai-match" element={<AiMatchPage token={token} />} />
          <Route path="/applications" element={<ApplicationsPage token={token} />} />
          <Route path="/dialogs" element={<DialogsPage token={token} user={user} />} />
          <Route path="/freelancer/:id" element={<FreelancerProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SiteLayout>
    </I18nProvider>
  );
}
