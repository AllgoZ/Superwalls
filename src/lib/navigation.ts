/** Accepts only same-site relative paths for post-login redirects (blocks open redirects like //evil.com). */
export function safeNextPath(value: string | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
