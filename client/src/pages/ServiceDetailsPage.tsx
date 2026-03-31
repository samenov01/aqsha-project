import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getServiceById } from "../api/services";
import { useTranslation } from "../i18n";
import { createOrder } from "../api/orders";
import { createReport } from "../api/reports";
import { ApiError } from "../api/client";
import { formatPrice } from "../lib/formatters";
import { IconStar } from "../components/icons/Icons";
import type { Service, User } from "../types";

type ServiceDetailsPageProps = {
  token: string | null;
  user: User | null;
};

export function ServiceDetailsPage({ token, user }: ServiceDetailsPageProps) {
  const params = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [mainImage, setMainImage] = useState("");
  const [error, setError] = useState("");
  const [isOrdering, setIsOrdering] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reportComment, setReportComment] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const serviceId = Number(params.id);
    if (!serviceId || Number.isNaN(serviceId)) {
      setError(t("service_details.error.invalid_id"));
      return;
    }
    let isActive = true;
    setError("");

    getServiceById(serviceId)
      .then((data) => {
        if (!isActive) return;
        setService(data);
        setMainImage(data.images?.[0] || "");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && isActive) {
          setError(err.message);
        }
      });

    return () => {
      isActive = false;
    };
  }, [params.id]);

  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !service) return;
    try {
      await createReport("service", service.id, reportReason, reportComment, token);
      setReportSent(true);
      setShowReportForm(false);
    } catch (_err) {
      // ignore
    }
  }

  async function handleOrder() {
    if (!token || !service) return;
    setIsOrdering(true);
    setError("");
    try {
      const order = await createOrder(service.id, token);
      navigate(`/orders/${order.id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("service_details.error.order_failed"));
      }
    } finally {
      setIsOrdering(false);
    }
  }

  if (error) {
    return (
      <section className="section-grid">
        <p className="error-box">{error}</p>
        <Link to="/services" className="ghost">
          {t("service_details.btn.back")}
        </Link>
      </section>
    );
  }

  if (!service) {
    return (
      <section className="section-grid">
        <p className="muted">{t("service_details.loading")}</p>
      </section>
    );
  }

  const ratingText =
    service.ratingCount && service.ratingCount > 0
      ? t("service_details.rating.text", { avg: service.ratingAvg?.toFixed(1) || "0.0", count: String(service.ratingCount) })
      : t("service_details.rating.empty");

  const isOwner = user?.id === service.user?.id;
  const hasPrice = service.price > 0;
  const priceLabel = hasPrice ? t("service_details.price.from", { price: formatPrice(service.price) }) : t("service_details.price.empty");
  const fallbackImage =
    service.images?.[0] ||
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=60";
  const displayImage = mainImage || fallbackImage;

  return (
    <section className="service-details">
      <div className="service-profile-card">
        <div className="service-profile-header">
          <div className="service-profile-avatar">
            <img src={displayImage} alt={service.user?.name || service.title} />
          </div>
          <div className="service-profile-info">
            <div className="service-profile-name">
              <h1>{service.user?.name || t("service_details.default_name")}</h1>
              {service.user?.verified && <span className="verified-badge small">{t("service_details.verified")}</span>}
            </div>
            <p className="service-profile-title">{service.title}</p>
            <div className="badge-row">
              <span className="pill">{service.category}</span>
            </div>
            <div className="service-meta">
              <div className="service-rating service-rating-large">
                <IconStar size={14} className="service-rating-star" />
                <span>{ratingText}</span>
              </div>
              <span className="service-price">{priceLabel}</span>
            </div>
          </div>
        </div>

        {service.images.length > 1 && (
          <div className="service-profile-gallery">
            <div className="thumb-row">
              {service.images.map((image) => (
                <button
                  type="button"
                  className={`thumb ${displayImage === image ? "active" : ""}`}
                  key={image}
                  onClick={() => setMainImage(image)}
                >
                  <img src={image} alt="preview" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="service-profile-about">
          <h2>{t("service_details.about")}</h2>
          <p>{service.description}</p>
        </div>
      </div>

      <aside className="service-profile-actions">
        <div className="service-action-card">
          <span className="price big">{priceLabel}</span>
          <div className="service-rating service-rating-large">
            <IconStar size={14} className="service-rating-star" />
            <span>{ratingText}</span>
          </div>

          <div className="hero-actions">
            {!token && (
              <Link className="primary" to="/profile">
                {t("service_details.btn.login_to_order")}
              </Link>
            )}
            {token && !isOwner && (
              <button className="primary" onClick={handleOrder} disabled={isOrdering}>
                {isOrdering ? t("service_details.btn.ordering") : t("service_details.btn.order")}
              </button>
            )}
            {token && isOwner && (
              <Link className="ghost" to={`/services/${service.id}/edit`}>
                {t("service_details.btn.edit")}
              </Link>
            )}
            <Link className="ghost" to="/services">
              {t("service_details.btn.back")}
            </Link>
            {token && !isOwner && !reportSent && (
              <button
                className="ghost"
                style={{ color: "var(--md-error, #b00020)", fontSize: "0.8rem", marginTop: "0.5rem" }}
                onClick={() => setShowReportForm((v) => !v)}
              >
                Пожаловаться
              </button>
            )}
            {reportSent && (
              <p className="muted" style={{ fontSize: "0.8rem" }}>Жалоба отправлена</p>
            )}
          </div>

          {showReportForm && (
            <form onSubmit={handleReport} style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border)" }}
              >
                <option value="spam">Спам</option>
                <option value="fraud">Мошенничество</option>
                <option value="inappropriate">Неприемлемый контент</option>
                <option value="duplicate">Дубликат</option>
                <option value="other">Другое</option>
              </select>
              <textarea
                rows={2}
                value={reportComment}
                onChange={(e) => setReportComment(e.target.value)}
                placeholder="Дополнительный комментарий (необязательно)"
                style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border)", resize: "vertical" }}
              />
              <button className="primary" type="submit" style={{ fontSize: "0.85rem" }}>
                Отправить жалобу
              </button>
            </form>
          )}
          
          {(service.phone || service.whatsapp || service.telegram) && (
            <div className="contact-methods" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1.5rem" }}>
              <p className="eyebrow">{t("service_details.contact.title")}</p>
              {service.phone && (
                <a href={`tel:${service.phone}`} className="ghost" style={{ justifyContent: "center" }}>
                  {t("service_details.contact.phone")}{service.phone}
                </a>
              )}
              {service.whatsapp && (
                <a
                  href={`https://wa.me/${service.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ghost"
                  style={{ justifyContent: "center" }}
                >
                  WhatsApp
                </a>
              )}
              {service.telegram && (
                <a
                  href={`https://t.me/${service.telegram.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ghost"
                  style={{ justifyContent: "center" }}
                >
                  Telegram
                </a>
              )}
            </div>
          )}
        </div>
      </aside>

      <div className="service-reviews">
        <h2>{t("service_details.reviews.title")}</h2>
        {service.reviews && service.reviews.length > 0 ? (
          <div className="review-list">
            {service.reviews.map((review) => (
              <article key={review.id} className="review-card">
                <div className="review-head">
                  <strong>{review.client.name}</strong>
                  <span className="review-rating"><IconStar size={12} style={{ verticalAlign: '-1px' }} /> {review.rating}</span>
                </div>
                <p className="muted">{review.comment}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">{t("service_details.reviews.empty")}</p>
        )}
      </div>
    </section>
  );
}
