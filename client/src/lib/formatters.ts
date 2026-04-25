export function formatPrice(price: number): string {
  if (!price) return "Договорная";
  return `${price.toLocaleString("ru-RU")} ₸`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function clipText(value: string, max = 140): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}
