import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";
import { getOrders } from "../api/orders";
import { ApiError } from "../api/client";
import type { ServiceOrder } from "../types";
import { formatPrice } from "../lib/formatters";

type OrdersPageProps = {
  token: string | null;
};

export function OrdersPage({ token }: OrdersPageProps) {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const statusLabels: Record<ServiceOrder["status"], string> = {
    pending: t("orders.status.pending"),
    accepted: t("orders.status.accepted"),
    frozen: t("orders.status.frozen"),
    under_review: t("orders.status.under_review"),
    completed: t("orders.status.completed"),
  };
  const paymentLabels: Record<string, string> = {
    unpaid: t("orders.payment.unpaid"),
    paid: t("orders.payment.paid"),
  };

  useEffect(() => {
    if (!token) return;
    let isActive = true;
    setIsLoading(true);
    setError("");

    getOrders(token)
      .then((items) => {
        if (isActive) setOrders(items);
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
  }, [token]);

  if (!token) {
    return (
      <section className="section-grid">
        <p className="error-box">{t("orders.auth_warning")}</p>
        <Link className="primary" to="/profile">
          {t("publish.login_btn")}
        </Link>
      </section>
    );
  }

  return (
    <section className="section-grid">
      <div>
        <p className="eyebrow">{t("orders.eyebrow")}</p>
        <h1>{t("orders.title")}</h1>
      </div>

      {isLoading && <p className="muted">{t("orders.loading")}</p>}
      {error && <p className="error-box">{error}</p>}

      {!isLoading && !error && orders.length === 0 && <p className="muted">{t("orders.empty")}</p>}

      <div className="orders-grid">
        {orders.map((order) => (
          <article key={order.id} className="order-card">
            <div>
              <h3>{order.service.title}</h3>
              <p className="muted">{order.service.category}</p>
              <p className="price">{formatPrice(order.service.price)}</p>
            </div>
            <div className="order-meta">
              <span className={`status-chip status-${order.status}`}>{statusLabels[order.status]}</span>
              {order.paymentStatus && (
                <span
                  className={`status-chip ${
                    order.paymentStatus === "paid" ? "status-paid" : "status-unpaid"
                  }`}
                >
                  {paymentLabels[order.paymentStatus]}
                </span>
              )}
              <span className="muted">
                {order.role === "client" ? t("orders.role.provider", { name: order.provider.name }) : t("orders.role.client", { name: order.client.name })}
              </span>
            </div>
            <Link className="ghost small" to={`/orders/${order.id}`}>
              {t("orders.btn.open")}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
