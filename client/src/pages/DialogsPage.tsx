import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
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

  useEffect(() => {
    if (!token) return;

    let isActive = true;
    setIsLoadingConversations(true);
    setError("");

    getMyConversations(token)
      .then((items) => {
        if (!isActive) return;
        setConversations(items);
      })
      .catch((err: unknown) => {
        if (!isActive) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Не удалось загрузить диалоги");
        }
      })
      .finally(() => {
        if (isActive) setIsLoadingConversations(false);
      });

    return () => {
      isActive = false;
    };
  }, [token]);

  useEffect(() => {
    if (!conversations.length) {
      setActiveConversationId(null);
      return;
    }

    const requestedConversationId = Number(requestedConversation);
    const nextConversationId =
      requestedConversationId && conversations.some((item) => item.id === requestedConversationId)
        ? requestedConversationId
        : conversations[0]?.id || null;

    setActiveConversationId(nextConversationId);
  }, [conversations, requestedConversation]);

  useEffect(() => {
    if (!token || !activeConversationId) {
      setMessages([]);
      return;
    }

    let isActive = true;
    setIsLoadingMessages(true);
    setError("");

    getConversationMessages(activeConversationId, token)
      .then((response) => {
        if (!isActive) return;
        setMessages(response.messages);
      })
      .catch((err: unknown) => {
        if (!isActive) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Не удалось загрузить сообщения");
        }
      })
      .finally(() => {
        if (isActive) setIsLoadingMessages(false);
      });

    return () => {
      isActive = false;
    };
  }, [activeConversationId, token]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
    [activeConversationId, conversations]
  );

  function selectConversation(id: number) {
    setActiveConversationId(id);
    setSearchParams({ conversation: String(id) });
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        prev.map((conversation) =>
          conversation.id === activeConversationId
            ? {
                ...conversation,
                lastMessage: {
                  body: response.message.body,
                  createdAt: response.message.createdAt,
                  senderId: user?.id || response.message.senderId,
                },
                updatedAt: response.message.createdAt,
              }
            : conversation
        )
      );
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Не удалось отправить сообщение");
      }
    } finally {
      setIsSending(false);
    }
  }

  if (!token) {
    return (
      <section className="section-grid">
        <p className="error-box">Для работы с диалогами нужно авторизоваться.</p>
        <Link className="primary" to="/profile">
          Перейти в профиль
        </Link>
      </section>
    );
  }

  return (
    <section className="dialogs-page">
      <div className="dialogs-sidebar">
        <div>
          <p className="eyebrow">Диалоги</p>
          <h1>Чаты с клиентами и фрилансерами</h1>
        </div>

        {isLoadingConversations && <p className="muted">Загрузка диалогов...</p>}
        {!isLoadingConversations && conversations.length === 0 && (
          <p className="muted">Пока нет диалогов. Откройте карточку услуги и начните переписку.</p>
        )}

        <div className="dialogs-list">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={`dialog-list-item ${conversation.id === activeConversationId ? "active" : ""}`}
              onClick={() => selectConversation(conversation.id)}
            >
              <div className="dialog-list-head">
                <strong>{conversation.peer.name}</strong>
                <span className="muted">{formatDateTime(conversation.lastMessage?.createdAt || conversation.updatedAt || "")}</span>
              </div>
              <p className="dialog-list-ad">{conversation.ad.title}</p>
              <p className="muted">{conversation.lastMessage?.body || "Диалог создан, отправьте сообщение"}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="dialogs-thread">
        {!activeConversation ? (
          <div className="dialogs-empty">
            <p className="muted">Выберите диалог слева.</p>
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
                <Link to={`/ad/${activeConversation.ad.id}`}>Открыть объявление</Link>
              </div>
            </div>

            <div className="thread-messages">
              {isLoadingMessages && <p className="muted">Загрузка переписки...</p>}
              {!isLoadingMessages && messages.length === 0 && (
                <p className="muted">Сообщений пока нет. Начните разговор.</p>
              )}
              {messages.map((message) => (
                <article key={message.id} className={`message-bubble ${message.isMine ? "mine" : ""}`}>
                  <p>{message.body}</p>
                  <span>{formatDateTime(message.createdAt)}</span>
                </article>
              ))}
            </div>

            <form className="thread-form" onSubmit={handleSendMessage}>
              <input
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                placeholder="Напишите сообщение..."
                minLength={1}
                maxLength={1000}
                required
              />
              <button className="primary" type="submit" disabled={isSending}>
                {isSending ? "Отправка..." : "Отправить"}
              </button>
            </form>
          </>
        )}

        {error && <p className="error-box">{error}</p>}
      </div>
    </section>
  );
}
