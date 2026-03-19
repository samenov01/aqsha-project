import { useEffect, useState, useRef } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import Confetti from "react-confetti";
import { useTranslation } from "../i18n";
import {
  createReview,
  getOrderById,
  getOrderMessages,
  sendOrderMessage,
  updateOrderStatus,
  updatePaymentStatus,
  markOrderMessagesRead,
} from "../api/orders";
import { approveAdminOrder } from "../api/admin";
import { sendTypingStatus } from "../api/stream";
import { ApiError } from "../api/client";
import { IconCheck, IconCheckCheck, IconCheckCircle } from "../components/icons/Icons";
import type { ServiceMessage, ServiceOrder, User } from "../types";
import { formatPrice } from "../lib/formatters";

type OrderDetailsPageProps = {
  token: string | null;
  user?: User | null;
};

export function OrderDetailsPage({ token, user }: OrderDetailsPageProps) {
  const params = useParams();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [messages, setMessages] = useState<ServiceMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
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
    const orderId = Number(params.id);
    if (!orderId || Number.isNaN(orderId)) {
      setError(t("order.error.invalid_id"));
      return;
    }
    let isActive = true;
    setError("");

    Promise.all([getOrderById(orderId, token), getOrderMessages(orderId, token)])
      .then(([orderData, messagesData]) => {
        if (!isActive) return;
        setOrder(orderData);
        setMessages(messagesData);

        const myId = orderData.role === "client" ? orderData.client.id : orderData.provider.id;
        const hasUnreadFromOther = messagesData.some((m) => m.senderId !== myId && !m.isRead);
        if (hasUnreadFromOther) {
          markOrderMessagesRead(orderId, token).catch(console.error);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && isActive) {
          setError(err.message);
        }
      });

    const es = new EventSource(`/api/stream?token=${token}`);

    es.addEventListener("chat_message", (e) => {
      if (!isActive) return;
      try {
        const newMsg = JSON.parse(e.data);
        if (newMsg.orderId === orderId) {
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          
          setOrder((currentOrder) => {
            if (!currentOrder) return currentOrder;
            const currentMyId = currentOrder.role === "client" ? currentOrder.client.id : currentOrder.provider.id;
            if (newMsg.senderId !== currentMyId) {
              markOrderMessagesRead(orderId, token).catch(console.error);
            }
            return currentOrder;
          });
        }
      } catch (err) {
        console.error("Failed to parse SSE", err);
      }
    });

    es.addEventListener("chat_read", (e) => {
      if (!isActive) return;
      try {
        const data = JSON.parse(e.data);
        if (data.orderId === orderId) {
          setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
        }
      } catch (err) {
        console.error("Failed to parse SSE", err);
      }
    });

    es.addEventListener("online_users", (e) => {
      if (!isActive) return;
      try {
        setOnlineUsers(new Set(JSON.parse(e.data)));
      } catch (err) {}
    });

    es.addEventListener("typing", (e) => {
      if (!isActive) return;
      try {
        const data = JSON.parse(e.data);
        if (data.contextId === `order_${orderId}`) {
          setTypingUsers(prev => {
            const next = new Set(prev);
            if (data.isTyping) next.add(data.senderId);
            else next.delete(data.senderId);
            return next;
          });
        }
      } catch (err) {}
    });

    return () => {
      isActive = false;
      es.close();
    };
  }, [params.id, token]);

  if (!token) {
    return (
      <section className="section-grid">
        <p className="error-box">{t("order.auth_warning")}</p>
        <Link className="primary" to="/profile">
          {t("publish.login_btn")}
        </Link>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section-grid">
        <p className="error-box">{error}</p>
        <Link className="ghost" to="/orders">
          {t("order.back")}
        </Link>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="section-grid">
        <p className="muted">{t("order.loading")}</p>
      </section>
    );
  }

  const myId = order.role === "client" ? order.client.id : order.provider.id;
  const counterpartId = order.role === "client" ? order.provider.id : order.client.id;

  async function handleSendMessage() {
    if (!token || !order || !messageText.trim()) return;
    setIsSending(true);
    setError("");
    try {
      const created = await sendOrderMessage(order.id, messageText.trim(), token);
      setMessages((prev) => [...prev, created]);
      setMessageText("");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setIsSending(false);
    }
  }

  function handleMessageInput(val: string) {
    setMessageText(val);
    if (!token || !order) return;
    sendTypingStatus(counterpartId, true, `order_${order.id}`, token).catch(() => {});
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(counterpartId, false, `order_${order.id}`, token).catch(() => {});
    }, 2000);
  }

  async function handleUpdateStatus(nextStatus: ServiceOrder["status"]) {
    if (!token || !order) return;
    setIsUpdating(true);
    setError("");
    try {
      const updated = await updateOrderStatus(order.id, nextStatus, token);
      setOrder(updated);

      if (nextStatus === "under_review" || nextStatus === "completed") {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAdminApprove() {
    if (!token || !order) return;
    setIsUpdating(true);
    setError("");
    try {
      await approveAdminOrder(order.id, token);
      const updated = await getOrderById(order.id, token);
      setOrder(updated);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function handlePayment() {
    if (!token || !order) return;
    setIsUpdating(true);
    setError("");
    try {
      const updated = await updatePaymentStatus(order.id, "paid", token);
      setOrder(updated);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !order) return;
    setIsReviewing(true);
    setError("");
    try {
      await createReview(order.id, Number(rating), comment || "Спасибо!", token);
      const updated = await getOrderById(order.id, token);
      setOrder(updated);
      setComment("");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setIsReviewing(false);
    }
  }

  const counterpart =
    order.role === "client" ? t("orders.role.provider", { name: order.provider.name }) : t("orders.role.client", { name: order.client.name });

  return (
    <div className="page-stack">
      {showConfetti && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 9999, pointerEvents: "none" }}>
          <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={500} />
        </div>
      )}
      <section className="section-grid">
        <div className="order-head">
          <div>
            <p className="eyebrow">{t("order.eyebrow")}</p>
            <h1>{order.service.title}</h1>
            <p className="muted">{order.service.category}</p>
          </div>
          <div className="order-head-meta">
            <span className="price big">{formatPrice(order.service.price)}</span>
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
            <span className="muted">{counterpart}</span>
          </div>
        </div>

        {order.role === "provider" && order.status === "pending" && (
          <button className="primary" onClick={() => handleUpdateStatus("accepted")} disabled={isUpdating}>
            {isUpdating ? t("order.btn.accepting") : t("order.btn.accept")}
          </button>
        )}

        {order.role === "provider" && order.status === "accepted" && (
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <button className="primary" onClick={() => handleUpdateStatus("under_review")} disabled={isUpdating}>
              {isUpdating ? t("order.btn.reviewing") : t("order.btn.review")}
            </button>
            <button className="ghost" onClick={() => handleUpdateStatus("frozen")} disabled={isUpdating}>
              {isUpdating ? t("order.btn.freezing") : t("order.btn.freeze")}
            </button>
          </div>
        )}

        {order.role === "provider" && order.status === "frozen" && (
          <button className="primary" onClick={() => handleUpdateStatus("accepted")} disabled={isUpdating}>
            {isUpdating ? t("order.btn.unfreezing") : t("order.btn.unfreeze")}
          </button>
        )}

        {user?.isAdmin && order.status === "under_review" && (
          <div className="admin-actions" style={{ background: "var(--md-surface-container)", padding: "1rem", borderRadius: "12px", border: "1px dashed var(--md-primary)", marginTop: "1rem" }}>
            <p className="eyebrow" style={{ color: "var(--md-primary)" }}>{t("order.admin.action")}</p>
            <p style={{ marginBottom: "1rem" }}>{t("order.admin.desc")}</p>
            <button className="primary" onClick={handleAdminApprove} disabled={isUpdating}>
              {isUpdating ? t("order.admin.approving") : t("order.admin.approve")}
            </button>
          </div>
        )}

        {order.role === "client" && order.status === "accepted" && order.paymentStatus !== "paid" && (
          <div style={{ marginTop: "1rem" }}>
            <button className="primary" onClick={handlePayment} disabled={isUpdating}>
              {isUpdating ? t("order.btn.paying") : t("order.btn.pay")}
            </button>
          </div>
        )}

        {order.role === "client" && order.paymentStatus === "paid" && order.status !== "completed" && (
          <div style={{ marginTop: "1rem", background: "var(--md-surface-container)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border)" }}>
            <p className="muted" style={{ display: "flex", gap: "0.5rem", alignItems: "center", margin: 0 }}>
              <IconCheckCircle size={16} style={{ color: "var(--md-primary)" }} /> {t("order.msg.paid")}
            </p>
          </div>
        )}

        {/* Payment logic handled by Admin Approval */}

        {error && <p className="error-box">{error}</p>}
      </section>

      <section className="section-grid">
        <div className="section-head-row">
          <div>
            <p className="eyebrow">{t("order.chat.eyebrow")}</p>
            <h2>{t("order.chat.title")}</h2>
          </div>
        </div>

        <div className="chat-box">
          {messages.length === 0 ? (
            <p className="muted">{t("order.chat.empty")}</p>
          ) : (
            messages.map((message) => {
              const isOwn = message.senderId === (order.role === "client" ? order.client.id : order.provider.id);
              return (
                <div key={message.id} className={`chat-message ${isOwn ? "own" : ""}`}>
                  <div className="chat-bubble">
                    <strong>
                      {message.senderName}
                      {onlineUsers.has(message.senderId) && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block", marginLeft: 6 }} />}
                    </strong>
                    <p>{message.message}</p>
                    {isOwn && (
                      <div style={{ textAlign: "right", fontSize: "0.75rem", opacity: 0.7, marginTop: "0.2rem" }}>
                        {message.isRead ? <IconCheckCheck size={14} /> : <IconCheck size={14} />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {typingUsers.size > 0 && Array.from(typingUsers).some(id => id !== myId) && (
            <p className="muted" style={{ fontSize: "0.85rem", padding: "0 0.5rem", marginTop: "1rem", marginBottom: "0.5rem", display: "flex", alignItems: "baseline", gap: "4px" }}>
              {t("order.chat.typing")}
            </p>
          )}
        </div>

        <div className="chat-input" style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
          <input
            style={{ flex: 1, padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--md-outline-variant)", background: "var(--bg-light)" }}
            value={messageText}
            onChange={(event) => handleMessageInput(event.target.value)}
            placeholder={t("order.chat.placeholder")}
            disabled={isSending}
          />
          <button className="primary" onClick={handleSendMessage} disabled={isSending || !messageText.trim()}>
            {isSending ? t("order.chat.sending") : t("order.chat.send")}
          </button>
        </div>
      </section>

      {order.status === "completed" && order.role === "client" && !order.review && (
        <section className="section-grid">
          <div>
            <p className="eyebrow">{t("order.review.eyebrow")}</p>
            <h2>{t("order.review.title")}</h2>
          </div>
          <form className="form-card" onSubmit={handleReviewSubmit}>
            <label className="input-wrap">
              <span>{t("order.review.rating")}</span>
              <select value={rating} onChange={(event) => setRating(event.target.value)}>
                <option value="5">5</option>
                <option value="4">4</option>
                <option value="3">3</option>
                <option value="2">2</option>
                <option value="1">1</option>
              </select>
            </label>
            <label className="input-wrap">
              <span>{t("order.review.comment")}</span>
              <textarea
                rows={4}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={t("order.review.comment_placeholder")}
              />
            </label>
            <button className="primary" type="submit" disabled={isReviewing}>
              {isReviewing ? t("order.review.submitting") : t("order.review.submit")}
            </button>
          </form>
        </section>
      )}

      {order.review && (
        <section className="section-grid">
          <div>
            <p className="eyebrow">{t("order.review.my_eyebrow")}</p>
            <h2>{t("order.review.my_title")}</h2>
          </div>
          <div className="review-card">
            <div className="review-head">
              <strong>{t("order.review.my_rating", { rating: String(order.review.rating) })}</strong>
            </div>
            <p className="muted">{order.review.comment}</p>
          </div>
        </section>
      )}
    </div>
  );
}
