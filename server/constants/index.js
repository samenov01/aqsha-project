const DEFAULT_UNIVERSITY = "Yessenov University (Aktau)";

const CATEGORIES = [
  "Учебные работы под ключ",
  "Презентации / слайды",
  "Куизы / тесты / NEO / ответы на сессию",
  "Аренда микронаушника / петлички",
  "Моб. интернет / GB (Beeline/Tele2/Activ)",
  "Билеты / ивенты",
  "Аренда квартиры / комнаты",
  "Справки / деканат / пересдача",
];

const UPLOAD_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const DEMO_IMAGE = "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=60";

const AD_STATUSES = ["active", "archived", "sold"];

module.exports = {
  DEFAULT_UNIVERSITY,
  CATEGORIES,
  AD_STATUSES,
  UPLOAD_MIME_TYPES,
  DEMO_IMAGE,
};
