import "server-only";
import { ApiError } from "./errors";

export interface AuthUser {
  id: string;
  email: string | null;
  /**
   * The email, but only when Supabase has actually verified the user owns it. Anything that links data
   * to an email address (claiming guest orders) must use this, never `email`.
   */
  verifiedEmail: string | null;
}

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new ApiError("BACKEND_NOT_CONFIGURED", "The store backend is not configured yet.");
  return { url, key };
}

let autoconfirmCache: { value: boolean; at: number } | null = null;

/** True when the project auto-confirms emails, in which case `email_confirmed_at` proves nothing. */
async function emailsAreAutoConfirmed(): Promise<boolean> {
  if (autoconfirmCache && Date.now() - autoconfirmCache.at < 10 * 60_000) return autoconfirmCache.value;
  const { url, key } = supabaseConfig();
  try {
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, cache: "no-store" });
    const settings = (await response.json()) as { mailer_autoconfirm?: boolean };
    // Fail closed: if we cannot tell, treat emails as unverified.
    const value = response.ok ? settings.mailer_autoconfirm !== false : true;
    autoconfirmCache = { value, at: Date.now() };
    return value;
  } catch {
    return true;
  }
}

/**
 * Identifies the caller from `Authorization: Bearer <supabase access token>`.
 * The token is verified by Supabase Auth itself (never decoded locally), so it cannot be forged.
 * Returns null for anonymous callers; throws 401 for a token that is present but invalid.
 */
export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new ApiError("UNAUTHENTICATED", "Please sign in again.");

  const user = await authUserFromToken(match[1]!);
  if (!user) throw new ApiError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  return user;
}

/** Asks Supabase Auth to validate an access token. Null when it is invalid or expired. Shared with the admin session. */
export async function authUserFromToken(token: string): Promise<AuthUser | null> {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const user = (await response.json()) as { id?: string; email?: string; email_confirmed_at?: string | null };
  if (!user.id) return null;

  const confirmed = Boolean(user.email && user.email_confirmed_at) && !(await emailsAreAutoConfirmed());
  return { id: user.id, email: user.email ?? null, verifiedEmail: confirmed ? (user.email ?? null) : null };
}

export { emailsAreAutoConfirmed };

export async function requireAuthUser(request: Request): Promise<AuthUser> {
  const user = await getAuthUser(request);
  if (!user) throw new ApiError("UNAUTHENTICATED", "Please sign in to continue.");
  return user;
}
