export function formatPrice(price: number): string {
  if (!price) return "Договорная";
  return `${price.toLocaleString("ru-RU")} ₸`;
}

export function clipText(value: string, max = 140): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}
