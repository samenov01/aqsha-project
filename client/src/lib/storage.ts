const storageKeys = {
  user: "aqsha_user",
  token: "aqsha_token",
  favorites: "aqsha_favorites",
};

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function saveJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeKeys(keys: string[]): void {
  keys.forEach((key) => localStorage.removeItem(key));
}

export { storageKeys };
