import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAdById } from "../api/ads";
import { useTranslation } from "../i18n";
import { getAdMessages, sendAdMessage, markAdMessagesRead, getAdChats } from "../api/adChat";
import { applyToJob } from "../api/applications";
import { createReport } from "../api/reports";
import { sendTypingStatus } from "../api/stream";
import type { AdChatParticipant } from "../api/adChat";
import { ApiError } from "../api/client";
import { formatPrice } from "../lib/formatters";
import { IconX, IconCheck, IconCheckCheck } from "../components/icons/Icons";
import type { Ad, AdMessage } from "../types";
import type { User } from "../types";

type AdDetailsPageProps = {
  favorites: Set<number>;
  onToggleFavorite: (id: number) => void;
  token: string | null;
  user: User | null;
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

export function AdDetailsPage({ favorites, onToggleFavorite, token, user }: AdDetailsPageProps) {
  const params = useParams();
  const [ad, setAd] = useState<Ad | null>(null);
  const [mainImage, setMainImage] = useState("");
  const [error, setError] = useState("");

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatParticipants, setChatParticipants] = useState<AdChatParticipant[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const selectedClientIdRef = useRef<number | null>(null);

  const [messages, setMessages] = useState<AdMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reportComment, setReportComment] = useState("");
  const [reportSent, setReportSent] = useState(false);

  // Apply (отклик)
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [applySuccess, setApplySuccess] = useState("");

  const { t } = useTranslation();

  useEffect(() => {
    selectedClientIdRef.current = selectedClientId;
  }, [selectedClientId]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const adId = Number(params.id);
    if (!adId || Number.isNaN(adId)) {
      setError(t("ad_details.error.invalid_id"));
      return;
    }
    let isActive = true;
    setError("");

    getAdById(adId)
      .then((data) => {
        if (!isActive) return;
        setAd(data);
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

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, chatOpen]);

  function openChat() {
    if (!token || !ad) return;
    setChatOpen(true);
    if (user && ad.user?.id === user.id) {
       setSelectedClientId(null);
       loadParticipants();
    } else {
       loadMessages();
    }
  }

  function loadParticipants() {
    if (!token || !ad) return;
    setChatLoading(true);
    setChatError("");
    getAdChats(ad.id, token)
      .then(setChatParticipants)
      .catch((err) => { if (err instanceof ApiError) setChatError(err.message); })
      .finally(() => setChatLoading(false));
  }

  function loadMessages(clientId?: number) {
    if (!token || !ad) return;
    setChatLoading(true);
    setChatError("");
    getAdMessages(ad.id, token, clientId)
      .then((data) => {
        setMessages(data.messages);
        if (data.messages.some((m) => m.senderId !== user?.id && !m.isRead)) {
          markAdMessagesRead(ad.id, token, clientId).catch(console.error);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setMessages([]);
        } else if (err instanceof ApiError) {
          setChatError(err.message);
        }
      })
      .finally(() => setChatLoading(false));
  }

  function handleSelectParticipant(clientId: number) {
    setSelectedClientId(clientId);
    loadMessages(clientId);
    
    // Сразу сбрасываем счетчик непрочитанных локально для плавности
    setChatParticipants((prev) => 
      prev.map((p) => p.id === clientId ? { ...p, unread_count: 0 } : p)
    );
  }

  useEffect(() => {
    if (!token || !ad || !chatOpen) return;
    let isActive = true;

    const es = new EventSource(`/api/stream?token=${token}`);

    es.addEventListener("chat_message", (e) => {
      if (!isActive) return;
      try {
        const newMsg = JSON.parse(e.data);
        if (newMsg.adId === ad.id) {
          const isOwnerHere = user && ad.user?.id === user.id;
          if (isOwnerHere) {
            if (selectedClientIdRef.current === newMsg.clientId) {
              setMessages((prev) => {
                if (prev.find((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
              if (newMsg.senderId !== user?.id) {
                markAdMessagesRead(ad.id, token, selectedClientIdRef.current!).catch(console.error);
              }
            } else {
              loadParticipants();
            }
          } else {
            setMessages((prev) => {
              if (prev.find((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            if (newMsg.senderId !== user?.id) {
              markAdMessagesRead(ad.id, token).catch(console.error);
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    });

    es.addEventListener("chat_read", (e) => {
      if (!isActive) return;
      try {
        const data = JSON.parse(e.data);
        if (data.adId === ad.id) {
          const isOwnerHere = user && ad.user?.id === user.id;
          if (!isOwnerHere || data.clientId === selectedClientIdRef.current) {
            setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
          }
        }
      } catch (err) {
        console.error(err);
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
        if (data.contextId === `ad_${ad.id}`) {
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
  }, [token, ad, chatOpen, user?.id]);

  async function handleSend() {
    if (!token || !ad || !chatInput.trim()) return;
    setChatSending(true);
    setChatError("");
    try {
      const clientIdToPass = (ad.user?.id === user?.id) ? (selectedClientId || undefined) : undefined;
      const sent = await sendAdMessage(ad.id, chatInput.trim(), token, clientIdToPass);
      setChatInput("");
      setMessages((prev) => [...prev, sent]);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setChatError(err.message);
      } else {
        setChatError(t("ad_details.chat.send_failed"));
      }
    } finally {
      setChatSending(false);
    }
  }

  function handleChatInput(val: string) {
    setChatInput(val);
    if (!token || !ad || !user) return;
    const isOwner = ad.user?.id === user.id;
    const recipientId = isOwner ? selectedClientId : ad.user?.id;
    if (recipientId) {
       sendTypingStatus(recipientId, true, `ad_${ad.id}`, token).catch(() => {});
       if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
       typingTimeoutRef.current = setTimeout(() => {
          sendTypingStatus(recipientId, false, `ad_${ad.id}`, token).catch(() => {});
       }, 2000);
    }
  }

  const isOwner = ad && user && ad.user?.id === user.id;

  if (error) {
    return (
      <section className="section-grid">
        <p className="error-box">{error}</p>
        <Link to="/market" className="ghost">
          {t("ad_details.btn.back_market")}
        </Link>
      </section>
    );
  }

  if (!ad) {
    return (
      <section className="section-grid">
        <p className="muted">{t("ad_details.loading")}</p>
      </section>
    );
  }

  return (
    <section className="ad-details">
      <div className="ad-details-media">
        <img src={mainImage} alt={ad.title} className="main-ad-image" />
        <div className="thumb-row">
          {ad.images.map((image) => (
            <button
              type="button"
              className={`thumb ${mainImage === image ? "active" : ""}`}
              key={image}
              onClick={() => setMainImage(image)}
            >
              <img src={image} alt="preview" />
            </button>
          ))}
        </div>
      </div>

      <div className="ad-details-info">
        <div className="badge-row">
          <span className="pill">{ad.category}</span>
          {ad.status && ad.status !== "active" && (
            <span className={`status-chip status-${ad.status}`}>{ad.status === "sold" ? t("ad_details.status.sold") : t("ad_details.status.archived")}</span>
          )}
        </div>
        <h1>{ad.title}</h1>
        <p className="price big">{formatPrice(ad.price)}</p>
        <div className="owner-row">
          <p className="muted">{ad.user?.name}</p>
          {ad.user?.verified && <span className="verified-badge small">{t("ad_details.verified")}</span>}
        </div>
        <p>{ad.description}</p>

        {/* Job meta badges */}
        {(ad.employmentType || ad.experienceLevel || ad.microrayon) && (
          <div className="job-meta-badges">
            {ad.employmentType && (
              <span className="job-meta-badge type">💼 {ad.employmentType}</span>
            )}
            {ad.experienceLevel && (
              <span className="job-meta-badge exp">🎯 Опыт: {ad.experienceLevel}</span>
            )}
            {ad.microrayon && (
              <span className="job-meta-badge place">📍 {ad.microrayon}</span>
            )}
          </div>
        )}

        {ad.skills && (
          <div className="skills-section">
            <span className="skills-label">Требуемые навыки</span>
            <div className="skills-tags">
              {ad.skills.split(",").map((s) => s.trim()).filter(Boolean).map((skill) => (
                <span key={skill} className="skill-tag">{skill}</span>
              ))}
            </div>
          </div>
        )}

        <div className="contacts-grid">
          {ad.contacts.phone && <span className="contact-item">{t("ad_details.contacts.phone")}{ad.contacts.phone}</span>}
          {ad.contacts.whatsapp && <span className="contact-item">{t("ad_details.contacts.whatsapp")}{ad.contacts.whatsapp}</span>}
          {ad.contacts.telegram && <span className="contact-item">{t("ad_details.contacts.telegram")}{ad.contacts.telegram}</span>}
        </div>

        {/* Apply button (only for non-owners) */}
        {!isOwner && token && ad.status === "active" && (
          <div>
            {applySuccess ? (
              <div className="apply-success-box">✅ {applySuccess}</div>
            ) : applied ? (
              <button className="primary" disabled style={{ opacity: 0.6, width: "100%" }}>
                {t("ad_details.btn.applied")}
              </button>
            ) : (
              <>
                {!showApplyForm ? (
                  <button className="primary" type="button" style={{ width: "100%" }} onClick={() => setShowApplyForm(true)}>
                    {t("ad_details.btn.apply")}
                  </button>
                ) : (
                  <div className="apply-card">
                    <label className="input-wrap">
                      <span>{t("ad_details.apply.cover_label")}</span>
                      <textarea
                        rows={4}
                        maxLength={1000}
                        placeholder={t("ad_details.apply.cover_placeholder")}
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                      />
                    </label>
                    {applyError && <p className="error-box">{applyError}</p>}
                    <div style={{ display: "flex", gap: "0.6rem" }}>
                      <button
                        className="primary"
                        type="button"
                        disabled={isApplying}
                        onClick={async () => {
                          if (!token || !ad) return;
                          setIsApplying(true);
                          setApplyError("");
                          try {
                            await applyToJob(ad.id, coverLetter, token);
                            setApplied(true);
                            setApplySuccess(t("ad_details.apply.success"));
                            setShowApplyForm(false);
                          } catch (err: unknown) {
                            if (err instanceof ApiError) setApplyError(err.message);
                            else setApplyError("Ошибка при отклике");
                          } finally {
                            setIsApplying(false);
                          }
                        }}
                      >
                        {isApplying ? t("ad_details.btn.applying") : t("ad_details.btn.apply")}
                      </button>
                      <button className="ghost" type="button" onClick={() => setShowApplyForm(false)}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Chat Section */}
        {token ? (
          <div className="ad-chat-wrap">
            {!chatOpen ? (
              <button
                className="primary ad-chat-open-btn"
                onClick={openChat}
                type="button"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {isOwner ? t("ad_details.chat.btn.incoming") : t("ad_details.chat.btn.write")}
              </button>
            ) : (
              <div className="ad-chat-box">
                <div className="ad-chat-header">
                  {isOwner && selectedClientId ? (
                    <button type="button" className="ghost small" onClick={() => setSelectedClientId(null)} style={{marginRight: '8px', padding: '0 4px', fontSize: '0.9rem', color: 'var(--text-muted)'}}>
                      {t("ad_details.chat.btn.back")}
                    </button>
                  ) : (
                    <span className="ad-chat-title">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      {isOwner ? t("ad_details.chat.title.incoming") : t("ad_details.chat.title.with_seller", { name: ad.user?.name ?? t("ad_details.chat.title.seller_fallback") })}
                    </span>
                  )}
                  {isOwner && selectedClientId && (
                     <span className="ad-chat-title" style={{marginLeft: 'auto', marginRight: 'auto', fontWeight: 600, fontSize: '0.9rem'}}>
                        {t("ad_details.chat.title.with_buyer")}
                     </span>
                  )}
                  <button
                    type="button"
                    className="ad-chat-close"
                    onClick={() => setChatOpen(false)}
                    title={t("ad_details.chat.close")}
                    aria-label={t("ad_details.chat.close")}
                    style={{marginLeft: isOwner && selectedClientId ? 0 : 'auto'}}
                  >
                    <IconX size={18} />
                  </button>
                </div>

                {isOwner && !selectedClientId ? (
                  <div className="ad-chat-participants" style={{ flex: 1, overflowY: "auto" }}>
                    {chatLoading && <p className="muted" style={{ padding: "1rem" }}>{t("ad_details.chat.loading")}</p>}
                    {!chatLoading && chatParticipants.length === 0 && (
                       <p className="muted" style={{ padding: "1rem", textAlign: "center" }}>{t("ad_details.chat.empty_incoming")}</p>
                    )}
                    {!chatLoading && chatParticipants.map(p => (
                      <div key={p.id} className="participant-row" onClick={() => handleSelectParticipant(p.id)}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <strong style={{ fontSize: "0.95rem" }}>{p.name}</strong>
                          <span className="muted" style={{ fontSize: "0.75rem", marginTop: "2px" }}>{formatTime(p.last_message_at)}</span>
                        </div>
                        {p.unread_count > 0 && (
                          <span className="nav-badge">{p.unread_count}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="ad-chat-messages">
                  {chatLoading && <p className="muted" style={{ padding: "0.7rem", fontSize: "0.85rem" }}>{t("ad_details.chat.loading")}</p>}
                  {!chatLoading && messages.length === 0 && (
                    <p className="muted" style={{ padding: "0.7rem", fontSize: "0.85rem", textAlign: "center" }}>
                      {isOwner ? t("ad_details.chat.empty_incoming") : t("ad_details.chat.empty_write")}
                    </p>
                  )}
                  {messages.map((msg) => {
                    const isMine = user && msg.senderId === user.id;
                    return (
                      <div key={msg.id} className={`ad-chat-msg ${isMine ? "mine" : "theirs"}`}>
                        {!isMine && (
                          <span className="ad-chat-sender">
                            {msg.senderName}
                            {onlineUsers.has(msg.senderId) && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block", marginLeft: 4 }} />}
                          </span>
                        )}
                        <div className="ad-chat-bubble">
                          {msg.message}
                          {isMine && (
                            <div style={{ textAlign: "right", fontSize: "0.75rem", opacity: 0.7, marginTop: "0.2rem" }}>
                              {msg.isRead ? <IconCheckCheck size={14} /> : <IconCheck size={14} />}
                            </div>
                          )}
                        </div>
                        <span className="ad-chat-time">{formatTime(msg.createdAt)}</span>
                      </div>
                    );
                  })}
                  {typingUsers.size > 0 && Array.from(typingUsers).some(id => id !== user?.id) && (
                    <p className="muted" style={{ fontSize: "0.85rem", padding: "0 0.5rem", marginTop: "-0.5rem", marginBottom: "0.5rem", display: "flex", alignItems: "baseline", gap: "4px" }}>
                      {t("ad_details.chat.typing")}
                    </p>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {chatError && <p className="error-box" style={{ margin: "0.4rem 0.8rem", fontSize: "0.83rem" }}>{chatError}</p>}

                {(!isOwner || messages.length > 0) && (
                  <form
                    className="ad-chat-form"
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  >
                    <input
                      className="ad-chat-input"
                      type="text"
                      placeholder={t("ad_details.chat.input_placeholder")}
                      value={chatInput}
                      onChange={(e) => handleChatInput(e.target.value)}
                      maxLength={1000}
                      disabled={chatSending}
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className="ad-chat-send"
                      disabled={chatSending || !chatInput.trim()}
                      aria-label={t("ad_details.chat.btn.send")}
                      title={t("ad_details.chat.btn.send")}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </form>
                )}
                </>
              )}
              </div>
            )}
          </div>
        ) : (
          <div className="ad-chat-wrap">
            <p className="muted" style={{ fontSize: "0.88rem" }}>
              <Link to="/profile" style={{ color: "var(--md-primary)", fontWeight: 600 }}>{t("ad_details.chat.auth_login")}</Link>{t("ad_details.chat.auth_prompt")}
            </p>
          </div>
        )}

        <div className="hero-actions" style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--md-outline-variant)' }}>
          <button className={`fav ${favorites.has(ad.id) ? "active" : ""}`} onClick={() => onToggleFavorite(ad.id)} style={{ flex: 1 }}>
            {favorites.has(ad.id) ? t("ad_details.btn.remove_fav") : t("ad_details.btn.add_fav")}
          </button>
          <Link className="ghost" to="/market" style={{ flex: 1, textAlign: 'center' }}>
            {t("ad_details.btn.back_market")}
          </Link>
        </div>

        {token && !isOwner && (
          <div className="report-section">
            {reportSent ? (
              <p className="muted" style={{ fontSize: "0.8rem" }}>Жалоба отправлена</p>
            ) : (
              <button
                className="ghost"
                style={{ color: "var(--md-error)", fontSize: "0.8rem", width: "100%", borderColor: "var(--md-error)" }}
                onClick={() => setShowReportForm((v) => !v)}
              >
                Пожаловаться на объявление
              </button>
            )}
            {showReportForm && (
              <form
                className="report-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!token) return;
                  await createReport("ad", ad.id, reportReason, reportComment, token);
                  setReportSent(true);
                  setShowReportForm(false);
                }}
              >
                <label className="input-wrap">
                  <span>Причина</span>
                  <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                    <option value="spam">Спам</option>
                    <option value="fraud">Мошенничество</option>
                    <option value="inappropriate">Неприемлемый контент</option>
                    <option value="duplicate">Дубликат</option>
                    <option value="other">Другое</option>
                  </select>
                </label>
                <label className="input-wrap">
                  <span>Комментарий (необязательно)</span>
                  <textarea rows={2} value={reportComment} onChange={(e) => setReportComment(e.target.value)} placeholder="Дополнительные детали..." />
                </label>
                <button className="primary" type="submit" style={{ fontSize: "0.85rem" }}>
                  Отправить жалобу
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
