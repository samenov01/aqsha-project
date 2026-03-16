import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getServices } from "../api/services";
import { useTranslation } from "../i18n";
import { ApiError } from "../api/client";
import { ServiceCard } from "../components/common/ServiceCard";
import type { Service } from "../types";

type ServicesPageProps = {
  categories: string[];
  token: string | null;
};

export function ServicesPage({ categories, token }: ServicesPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const filters = useMemo(
    () => ({
      search: searchParams.get("search") || "",
      category: searchParams.get("category") || "",
      minRating: searchParams.get("minRating") || "",
      sort: searchParams.get("sort") || "",
    }),
    [searchParams]
  );

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setError("");

    getServices({ ...filters, limit: 36 })
      .then((items) => {
        if (isActive) setServices(items);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && isActive) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [filters]);

  function updateFilter(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(name, value);
    } else {
      next.delete(name);
    }
    setSearchParams(next);
  }

  function resetFilters() {
    setSearchParams({});
  }

  return (
    <div className="page-stack">
      <section className="market-header">
        <div className="section-head-row">
          <div>
            <p className="eyebrow">{t("services.eyebrow")}</p>
            <h1>{t("services.title")}</h1>
          </div>
          <div className="section-actions">
            {token ? (
              <Link className="primary" to="/services/new">
                {t("services.create_btn")}
              </Link>
            ) : (
              <Link className="ghost" to="/profile">
                {t("services.login_btn")}
              </Link>
            )}
          </div>
        </div>

        <div className="market-block-stack">
          <div className="market-block search-block">
            <div className="search-bar" role="group" aria-label="Поиск и университет">
              <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7.5" strokeWidth="2" fill="none" />
                <path d="M20 20l-3.6-3.6" strokeWidth="2" fill="none" />
              </svg>
              <input
                className="search-field"
                type="search"
                placeholder={t("services.search.placeholder")}
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                aria-label="Поиск"
              />
              <div className="search-divider" aria-hidden="true" />
              <select
                className="search-university-select"
                disabled
                value="Есенов"
                aria-label="Университет"
              >
                <option value="Есенов">Есенов</option>
              </select>
            </div>
          </div>

          <div className="market-block">
            <div className="filters-head">
              <p className="eyebrow market-block-title">{t("services.filters.title")}</p>
              <button className="ghost small" onClick={resetFilters}>
                {t("services.filters.reset")}
              </button>
            </div>
            <div className="filters-grid">
              <label className="input-wrap">
                <span>{t("services.filters.category")}</span>
                <select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}>
                  <option value="">{t("services.filters.all")}</option>
                  {categories.map((category) => (
                    <option value={category} key={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-wrap">
                <span>{t("services.filters.sort")}</span>
                <select value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}>
                  <option value="">{t("services.sort.default")}</option>
                  <option value="rating_desc">{t("services.sort.rating")}</option>
                </select>
              </label>
              <label className="input-wrap">
                <span>{t("services.filters.rating_from")}</span>
                <select value={filters.minRating} onChange={(event) => updateFilter("minRating", event.target.value)}>
                  <option value="">{t("services.rating.any")}</option>
                  <option value="5">5</option>
                  <option value="4">4</option>
                  <option value="3">3</option>
                  <option value="2">2</option>
                  <option value="1">1</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="ads-stack">
        {isLoading && <p className="muted">{t("services.loading")}</p>}
        {error && <p className="error-box">{error}</p>}

        {!isLoading && !error && services.length === 0 && (
          <p className="muted">{t("services.empty")}</p>
        )}

        <div className="service-grid">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      </section>
    </div>
  );
}
