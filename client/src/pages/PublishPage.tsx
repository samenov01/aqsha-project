import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { createAd } from "../api/ads";
import { ApiError } from "../api/client";

type PublishPageProps = {
  token: string | null;
  categories: string[];
  employmentTypes?: string[];
  experienceLevels?: string[];
  microrayons?: string[];
  defaultUniversity: string;
};

export function PublishPage({
  token,
  categories,
  employmentTypes = [],
  experienceLevels = [],
  microrayons = [],
}: PublishPageProps) {
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
    employmentType: "",
    experienceLevel: "",
    microrayon: "",
    skills: "",
    description: "",
    phone: "",
    whatsapp: "",
    telegram: "",
  });

  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => { urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [images]);

  const maxImages = 5;

  const addImages = (incoming: FileList | File[]) => {
    const files = Array.from(incoming).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    setImages((prev) => {
      const available = maxImages - prev.length;
      if (files.length > available) setImageError(t("publish.error.max_images"));
      else setImageError("");
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
    if (dragCounter.current <= 0) setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (event.dataTransfer.files?.length) addImages(event.dataTransfer.files);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) addImages(event.target.files);
  };

  if (!token) {
    return (
      <section className="section-grid">
        <p className="error-box">{t("publish.auth_warning")}</p>
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
      await createAd(
        {
          title: form.title.trim(),
          category: form.category,
          price: form.price,
          description: form.description.trim(),
          phone: form.phone.trim(),
          whatsapp: form.whatsapp.trim(),
          telegram: form.telegram.trim(),
          employmentType: form.employmentType,
          experienceLevel: form.experienceLevel,
          microrayon: form.microrayon,
          skills: form.skills.trim(),
          images,
        },
        token
      );
      navigate("/market");
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError(t("publish.error.create_failed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="section-grid">
      <div>
        <p className="eyebrow">{t("publish.eyebrow")}</p>
        <h1>{t("publish.title")}</h1>
      </div>

      <form className="form-card" onSubmit={handleSubmit}>

        {/* Название вакансии */}
        <div className="form-grid">
          <label className="input-wrap">
            <span>{t("publish.form.title")}</span>
            <input
              required
              minLength={5}
              maxLength={120}
              placeholder="Например: Официант, Кассир, Frontend Developer"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
        </div>

        {/* Сфера + зарплата */}
        <div className="form-grid three">
          <label className="input-wrap">
            <span>{t("publish.form.category")}</span>
            <select
              required
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="">{t("publish.form.category.select")}</option>
              {categories.map((category) => (
                <option value={category} key={category}>{category}</option>
              ))}
            </select>
          </label>

          <label className="input-wrap">
            <span>{t("publish.form.salary")}</span>
            <input
              type="number"
              min="0"
              placeholder="150000"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </label>

          <label className="input-wrap">
            <span>{t("publish.form.microrayon")}</span>
            <select
              value={form.microrayon}
              onChange={(e) => setForm({ ...form, microrayon: e.target.value })}
            >
              <option value="">{t("publish.form.microrayon.select")}</option>
              {microrayons.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Тип занятости + опыт */}
        <div className="form-grid three">
          <label className="input-wrap">
            <span>{t("publish.form.employment_type")}</span>
            <select
              value={form.employmentType}
              onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
            >
              <option value="">{t("publish.form.employment_type.select")}</option>
              {employmentTypes.map((et) => (
                <option key={et} value={et}>{et}</option>
              ))}
            </select>
          </label>

          <label className="input-wrap">
            <span>{t("publish.form.experience")}</span>
            <select
              value={form.experienceLevel}
              onChange={(e) => setForm({ ...form, experienceLevel: e.target.value })}
            >
              <option value="">{t("publish.form.experience.select")}</option>
              {experienceLevels.map((el) => (
                <option key={el} value={el}>{el}</option>
              ))}
            </select>
          </label>

          <label className="input-wrap">
            <span>{t("publish.form.skills")}</span>
            <input
              maxLength={300}
              placeholder={t("publish.form.skills.placeholder")}
              value={form.skills}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
            />
          </label>
        </div>

        {/* Описание */}
        <label className="input-wrap">
          <span>{t("publish.form.description")}</span>
          <textarea
            required
            minLength={20}
            maxLength={2000}
            rows={6}
            placeholder="Опишите обязанности, условия работы, график, требования к кандидату..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={{ resize: "vertical", maxWidth: "100%", boxSizing: "border-box" }}
          />
        </label>

        {/* Контакты */}
        <div className="form-grid three">
          <label className="input-wrap">
            <span>{t("publish.form.phone")}</span>
            <input
              placeholder="+7 777 123 45 67"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="input-wrap">
            <span>{t("publish.form.whatsapp")}</span>
            <input
              placeholder="+7 777 123 45 67"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            />
          </label>
          <label className="input-wrap">
            <span>{t("publish.form.telegram")}</span>
            <input
              placeholder="@username"
              value={form.telegram}
              onChange={(e) => setForm({ ...form, telegram: e.target.value })}
            />
          </label>
        </div>

        {/* Фото */}
        <label
          className="input-wrap"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span>{t("publish.form.images.upload", { count: images.length, max: maxImages })}</span>
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
              minHeight: "120px",
              borderRadius: "12px",
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 0.2s, background 0.2s",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            {previews.length === 0 ? (
              <span style={{ opacity: 0.5, fontSize: "0.9rem" }}>Нажмите или перетащите фото сюда</span>
            ) : (
              previews.map((preview, index) => (
                <div key={preview} style={{ position: "relative" }}>
                  <img
                    src={preview}
                    alt={`preview-${index + 1}`}
                    style={{ width: "120px", height: "90px", objectFit: "cover", borderRadius: "8px", display: "block" }}
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeImage(index); }}
                    aria-label={t("publish.form.images.remove")}
                    style={{
                      position: "absolute", top: "4px", right: "4px",
                      width: "24px", height: "24px", borderRadius: "999px",
                      border: "none", background: "rgba(15,23,42,0.72)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </label>

        {imageError && <p className="error-box">{imageError}</p>}
        {error && <p className="error-box">{error}</p>}

        <button className="primary" disabled={isSubmitting}>
          {isSubmitting ? t("publish.form.submitting") : t("publish.form.submit")}
        </button>
      </form>
    </section>
  );
}
