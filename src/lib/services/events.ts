/**
 * Tiny pub/sub so hooks can refetch after a service mutation (new order,
 * profile edit, sign-in...). Services call `emitDataChange()` after writes.
 */
const EVENT_NAME = "sw:data-change";

export function emitDataChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function subscribeDataChange(listener: () => void): () => void {
  window.addEventListener(EVENT_NAME, listener);
  // Also react to changes made in another tab.
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT_NAME, listener);
    window.removeEventListener("storage", listener);
  };
}
