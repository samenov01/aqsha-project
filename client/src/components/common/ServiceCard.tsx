import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../i18n";
import type { Service } from "../../types";
type ServiceCardProps = {
  service: Service;
};

export function ServiceCard({ service }: ServiceCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const ratingText =
    service.ratingCount && service.ratingCount > 0
      ? `${service.ratingAvg?.toFixed(1)} (${service.ratingCount})`
      : t("service_card.no_rating");

  return (
    <article
      className="service-card"
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/services/${service.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(`/services/${service.id}`);
        }
      }}
    >
      <div className="service-avatar">
        <img
          src={
            service.images?.[0] ||
            "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=60"
          }
          alt={service.user?.name || service.title}
          loading="lazy"
        />
      </div>
      <div className="service-card-body">
        <div className="service-head">
          <h3>{service.user?.name || t("service_card.default_name")}</h3>
          {service.user?.verified && <span className="verified-badge small">{t("service_card.verified")}</span>}
        </div>
        <p className="service-title">{service.title}</p>
        <div className="badge-row">
          <span className="pill">{service.category}</span>
        </div>
        <div className="service-meta">
          <div className="service-rating">
            <span className="service-rating-star">★</span>
            <span>{ratingText}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
