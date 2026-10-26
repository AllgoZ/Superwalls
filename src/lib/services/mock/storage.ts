/** Demo-mode persistence: JSON in localStorage, safe on the server and when storage is blocked. */

export const STORAGE_KEYS = {
  orders: "sw-demo:orders",
  orderKeys: "sw-demo:order-keys",
  profile: "sw-demo:profile",
  addresses: "sw-demo:addresses",
  session: "sw-demo:session",
} as const;

export function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStored<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: demo data simply won't persist.
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
