import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import {
  getConversationMessages,
  getMyConversations,
  sendConversationMessage,
} from "../api/conversations";
import { formatDateTime, formatPrice } from "../lib/formatters";
import type { Conversation, ConversationMessage, User } from "../types";

type DialogsPageProps = {
  token: string | null;
  user: User | null;
};

export function DialogsPage({ token, user }: DialogsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedConversation = searchParams.get("conversation");
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!token) return;
    let isActive = true;
    setIsLoadingConversations(true);
    setError("");
    getMyConversations(token)
      .then((items) => { if (isActive) setConversations(items); })
      .catch((err: unknown) => {
        if (!isActive) return;
        setError(err instanceof ApiError ? err.message : "Не удалось загрузить диалоги");
      })
      .finally(() => { if (isActive) setIsLoadingConversations(false); });
    return () => { isActive = false; };
  }, [token]);

  useEffect(() => {
    if (!conversations.length) { setActiveConversationId(null); return; }
    const reqId = Number(requestedConversation);
    const nextId = reqId && conversations.some((c) => c.id === reqId) ? reqId : conversations[0]?.id || null;
    setActiveConversationId(nextId);
  }, [conversations, requestedConversation]);

  useEffect(() => {
    if (!token || !activeConversationId) { setMessages([]); return; }
    let isActive = true;
    setIsLoadingMessages(true);
    setError("");
    getConversationMessages(activeConversationId, token)
      .then((res) => { if (isActive) setMessages(res.messages); })
      .catch((err: unknown) => {
        if (!isActive) return;
        setError(err instanceof ApiError ? err.message : "Не удалось загрузить сообщения");
      })
      .finally(() => { if (isActive) setIsLoadingMessages(false); });
    return () => { isActive = false; };
  }, [activeConversationId, token]);

  // Auto-scroll to bottom when messages load or new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [activeConversationId, conversations]
  );

  function selectConversation(id: number) {
    setActiveConversationId(id);
    setSearchParams({ conversation: String(id) });
  }

  async function handleSendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!token || !activeConversationId) return;
    const trimmed = messageText.trim();
    if (!trimmed) return;
    setIsSending(true);
    setError("");
    try {
      const response = await sendConversationMessage(activeConversationId, trimmed, token);
      setMessages((prev) => [...prev, response.message]);
      setMessageText("");
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? {
                ...c,
                lastMessage: {
                  body: response.message.body,
                  createdAt: response.message.createdAt,
                  senderId: user?.id || response.message.senderId,
                },
                updatedAt: response.message.createdAt,
              }
            : c
        )
      );
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Не удалось отправить сообщение");
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  if (!token) {
    return (
      <section className="section-grid">
        <p className="error-box">Для работы с диалогами нужно авторизоваться.</p>
        <Link className="primary" to="/profile">Перейти в профиль</Link>
      </section>
    );
  }

  return (
    <section className="dialogs-page">
      <div className="dialogs-sidebar">
        <div>
          <p className="eyebrow">Диалоги</p>
          <h1>Чаты</h1>
        </div>

        {isLoadingConversations && <p className="muted" style={{ padding: "1rem 1.5rem" }}>Загрузка...</p>}
        {!isLoadingConversations && conversations.length === 0 && (
          <p className="muted" style={{ padding: "1rem 1.5rem", fontSize: "0.875rem" }}>
            Пока нет диалогов. Откройте карточку услуги и начните переписку.
          </p>
        )}

        <div className="dialogs-list">
          {conversations.map((conversation) => {
            const hasUnread = (conversation.unreadCount ?? 0) > 0;
            return (
              <button
                key={conversation.id}
                className={`dialog-list-item ${conversation.id === activeConversationId ? "active" : ""}`}
                onClick={() => selectConversation(conversation.id)}
              >
                <div className="dialog-list-head">
                  <strong style={{ fontWeight: hasUnread ? 700 : 500 }}>{conversation.peer.name}</strong>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    {hasUnread && (
                      <span style={{
                        background: "var(--md-primary)",
                        color: "var(--md-on-primary)",
                        borderRadius: "999px",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        minWidth: "18px",
                        height: "18px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 4px",
                      }}>
                        {conversation.unreadCount}
                      </span>
                    )}
                    <span className="muted" style={{ fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                      {formatDateTime(conversation.lastMessage?.createdAt || conversation.updatedAt || "")}
                    </span>
                  </div>
                </div>
                <p className="dialog-list-ad">{conversation.ad.title}</p>
                <p className="muted" style={{
                  fontSize: "0.8rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                  fontWeight: hasUnread ? 600 : 400,
                }}>
                  {conversation.lastMessage?.body || "Диалог создан, отправьте сообщение"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="dialogs-thread">
        {!activeConversation ? (
          <div className="dialogs-empty">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>💬</div>
              <p className="muted">Выберите диалог слева.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="thread-header">
              <div>
                <strong>{activeConversation.peer.name}</strong>
                <p className="muted">{activeConversation.ad.title}</p>
              </div>
              <div className="thread-meta">
                <span>{formatPrice(activeConversation.ad.price)}</span>
                <Link to={`/ad/${activeConversation.ad.id}`} style={{ fontSize: "0.85rem" }}>
                  Открыть объявление →
                </Link>
              </div>
            </div>

            <div className="thread-messages">
              {isLoadingMessages && (
                <p className="muted" style={{ textAlign: "center", margin: "auto" }}>Загрузка переписки...</p>
              )}
              {!isLoadingMessages && messages.length === 0 && (
                <div style={{ textAlign: "center", margin: "auto" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👋</div>
                  <p className="muted">Сообщений пока нет. Начните разговор.</p>
                </div>
              )}
              {messages.map((message) => (
                <article key={message.id} className={`message-bubble ${message.isMine ? "mine" : ""}`}>
                  {!message.isMine && (
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, opacity: 0.7, display: "block", marginBottom: "2px" }}>
                      {message.senderName}
                    </span>
                  )}
                  <p style={{ margin: 0, wordBreak: "break-word" }}>{message.body}</p>
                  <span>{formatDateTime(message.createdAt)}</span>
                </article>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form className="thread-form" onSubmit={handleSendMessage} style={{ alignItems: "flex-end" }}>
              <textarea
                ref={textareaRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Напишите сообщение... (Enter — отправить, Shift+Enter — новая строка)"
                maxLength={1000}
                rows={1}
                style={{
                  flex: 1,
                  borderRadius: "var(--md-shape-lg)",
                  padding: "0.625rem 1.25rem",
                  fontSize: "0.9375rem",
                  background: "var(--md-surface-container-high)",
                  border: "1px solid var(--md-outline-variant)",
                  resize: "none",
                  maxHeight: "120px",
                  overflowY: "auto",
                  lineHeight: "1.5",
                  fontFamily: "inherit",
                }}
              />
              <button className="primary" type="submit" disabled={isSending || !messageText.trim()}>
                {isSending ? "..." : "Отправить"}
              </button>
            </form>
          </>
        )}

        {error && <p className="error-box" style={{ margin: "0.5rem 1rem" }}>{error}</p>}
      </div>
    </section>
  );
}
