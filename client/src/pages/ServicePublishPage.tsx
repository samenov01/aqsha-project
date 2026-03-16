import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { createService } from "../api/services";
import { ApiError } from "../api/client";

type ServicePublishPageProps = {
  token: string | null;
  categories: string[];
  defaultUniversity: string;
};

export function ServicePublishPage({ token, categories, defaultUniversity }: ServicePublishPageProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounter = useRef(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [imageError, setImageError] = useState("");
  const [form, setForm] = useState({
    title: "",
    category: "",
    price: "",
    description: "",
    phone: "",
    whatsapp: "",
    telegram: "",
  });

  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    setPreviews(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [images]);

  if (!token) {
    return (
      <section className="section-grid">
        <p className="error-box">{t("service_publish.auth_warning")}</p>
        <Link className="primary" to="/profile">
          {t("publish.login_btn")}
        </Link>
      </section>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setIsSubmitting(true);
    setError("");

    try {
      await createService(
        {
          title: form.title.trim(),
          category: form.category,
          price: form.price,
          description: form.description.trim(),
          phone: form.phone.trim(),
          whatsapp: form.whatsapp.trim(),
          telegram: form.telegram.trim(),
          images,
        },
        token
      );

      navigate("/market");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof TypeError && err.message.includes("fetch")) {
        setError(t("service_publish.error.server"));
      } else {
        setError(t("service_publish.error.create_failed"));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const maxImages = 10;

  const addImages = (incoming: FileList | File[]) => {
    const files = Array.from(incoming).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;
    setImages((prev) => {
      const available = maxImages - prev.length;
      if (files.length > available) {
        setImageError(t("publish.error.max_images"));
      } else {
        setImageError("");
      }
      return [...prev, ...files.slice(0, Math.max(0, available))];
    });
  };

  const removeImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, index) => index !== indexToRemove));
    setImageError("");
  };

  const handleDragEnter = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (event.dataTransfer.files?.length) {
      addImages(event.dataTransfer.files);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) {
      addImages(event.target.files);
    }
  };

  return (
    <section className="section-grid service-publish">
      <div>
        <p className="eyebrow">{t("service_publish.eyebrow")}</p>
        <h1>{t("service_publish.title")}</h1>
      </div>

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="input-wrap">
            <span>{t("publish.form.title")}</span>
            <input
              required
              minLength={5}
              maxLength={120}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
        </div>

        <div className="form-grid three">
          <label className="input-wrap">
            <span>{t("publish.form.price")}</span>
            <input
              type="number"
              min="0"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
            />
          </label>

          <label className="input-wrap">
            <span>{t("publish.form.category")}</span>
            <select
              required
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              <option value="">{t("publish.form.category.select")}</option>
              {categories.map((category) => (
                <option value={category} key={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="input-wrap">
            <span>{t("publish.form.university")}</span>
            <input
              disabled
              value={defaultUniversity}
              style={{
                color: "#94a3b8",
                background: "rgba(148, 163, 184, 0.12)",
                cursor: "not-allowed",
              }}
            />
          </label>
        </div>

        <label className="input-wrap">
          <span>{t("publish.form.description")}</span>
          <textarea
            required
            minLength={20}
            maxLength={1500}
            rows={5}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            style={{
              resize: "vertical",
              maxWidth: "100%",
              boxSizing: "border-box",
            }}
          />
        </label>

        <div className="form-grid three">
          <label className="input-wrap">
            <span>{t("publish.form.phone")}</span>
            <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>

          <label className="input-wrap">
            <span>{t("publish.form.whatsapp")}</span>
            <input value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} />
          </label>

          <label className="input-wrap">
            <span>{t("publish.form.telegram")}</span>
            <input value={form.telegram} onChange={(event) => setForm({ ...form, telegram: event.target.value })} />
          </label>
        </div>

        <label
          className="input-wrap"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? "#2563eb" : "#cbd5e1"}`,
              background: isDragging ? "rgba(37, 99, 235, 0.08)" : "rgba(148, 163, 184, 0.12)",
              padding: "16px",
              minHeight: "220px",
              borderRadius: "12px",
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 0.2s ease, background 0.2s ease",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: previews.length > 0 ? "flex-start" : "center",
              gap: "12px",
              width: "100%",
              maxWidth: "100%",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
            aria-label={t("publish.form.images.upload", { count: images.length, max: maxImages })}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                padding: "10px 16px",
                borderRadius: "999px",
                border: `1px solid ${isDragging ? "rgba(37, 99, 235, 0.5)" : "rgba(148, 163, 184, 0.6)"}`,
                background: isDragging ? "rgba(37, 99, 235, 0.12)" : "rgba(148, 163, 184, 0.18)",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke={isDragging ? "#2563eb" : "#64748b"}
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 16V4" />
                <path d="m7 9 5-5 5 5" />
                <path d="M20 16v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3" />
              </svg>
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke={isDragging ? "#2563eb" : "#64748b"}
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 16l4-4 4 4 4-4 6 6" />
                <circle cx="9" cy="9" r="1.5" />
              </svg>
            </div>
            {previews.length > 0 && (
              <div
                className="preview-grid"
                style={{
                  display: "flex",
                  gap: "12px",
                  overflowX: "auto",
                  overflowY: "hidden",
                  paddingBottom: "6px",
                  scrollSnapType: "x mandatory",
                  WebkitOverflowScrolling: "touch",
                  maxWidth: "100%",
                  width: "100%",
                  minWidth: 0,
                  boxSizing: "border-box",
                }}
              >
                {previews.map((preview, index) => (
                  <div key={preview} style={{ flex: "0 0 auto", scrollSnapAlign: "start", position: "relative" }}>
                    <img
                      src={preview}
                      alt={`preview-${index + 1}`}
                      style={{
                        width: "180px",
                        height: "140px",
                        objectFit: "cover",
                        borderRadius: "10px",
                        display: "block",
                      }}
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        removeImage(index);
                      }}
                      aria-label={t("publish.form.images.remove")}
                      style={{
                        position: "absolute",
                        top: "6px",
                        right: "6px",
                        width: "28px",
                        height: "28px",
                        borderRadius: "999px",
                        border: "none",
                        background: "rgba(15, 23, 42, 0.72)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M18 6L6 18" />
                        <path d="M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </label>

        {imageError && <p className="error-box">{imageError}</p>}

        {error && <p className="error-box">{error}</p>}

        <button className="primary" disabled={isSubmitting}>
          {isSubmitting ? t("publish.form.submitting") : t("service_publish.form.submit")}
        </button>
      </form>
    </section>
  );
}
