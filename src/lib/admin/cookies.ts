/**
 * Admin session cookie names and helpers shared by `proxy.ts` (which cannot import server-only modules)
 * and the server session code. The cookies are httpOnly: page scripts can never read the tokens.
 */
export const ADMIN_ACCESS_COOKIE = "sw_admin_at";
export const ADMIN_REFRESH_COOKIE = "sw_admin_rt";

/** Refresh tokens are long-lived; the access token's own expiry is what really bounds a session. */
export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** Reads `exp` (seconds) from a JWT WITHOUT verifying it. Only used to decide when to refresh, never to trust. */
export function jwtExpiry(token: string): number {
  try {
    const payload = token.split(".")[1];
    if (!payload) return 0;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof json.exp === "number" ? json.exp : 0;
  } catch {
    return 0;
  }
}

/** Only same-site admin paths are valid post-login destinations (prevents open redirects). */
export function safeAdminNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/admin") || value.startsWith("/admin/login") || value.startsWith("//") || value.includes("\\")) {
    return "/admin";
  }
  return value;
}
