import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
  jwtExpiry,
  sessionCookieOptions,
} from "@/lib/admin/cookies";

/**
 * Admin only: keeps the httpOnly session fresh and bounces visitors without any session to the login page.
 * This is a convenience, not the security boundary: every page and every operation re-verifies the session and
 * the admin's permissions on the server (src/lib/server/admin/session.ts).
 */
export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };

interface Refreshed {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

async function refresh(refreshToken: string): Promise<Refreshed | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!body.access_token || !body.refresh_token) return null;
    return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresIn: body.expires_in ?? 3600 };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const access = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(ADMIN_REFRESH_COOKIE)?.value;

  let refreshed: Refreshed | null = null;
  let refreshFailed = false;
  const expiresSoon = !access || jwtExpiry(access) - Math.floor(Date.now() / 1000) < 60;
  if (expiresSoon && refreshToken && pathname !== "/api/admin/auth/logout") {
    refreshed = await refresh(refreshToken);
    refreshFailed = !refreshed;
    // Make the new token visible to the page / handler that runs after this proxy.
    if (refreshed) {
      request.cookies.set(ADMIN_ACCESS_COOKIE, refreshed.accessToken);
      request.cookies.set(ADMIN_REFRESH_COOKIE, refreshed.refreshToken);
    } else {
      request.cookies.delete(ADMIN_ACCESS_COOKIE);
      request.cookies.delete(ADMIN_REFRESH_COOKIE);
    }
  }

  const hasSession = Boolean(request.cookies.get(ADMIN_ACCESS_COOKIE)?.value);
  const isLoginPage = pathname === "/admin/login";
  if (!hasSession && !isApi && !isLoginPage) {
    const login = new URL("/admin/login", request.url);
    if (pathname !== "/admin") login.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(login);
    if (refreshFailed) {
      redirect.cookies.delete(ADMIN_ACCESS_COOKIE);
      redirect.cookies.delete(ADMIN_REFRESH_COOKIE);
    }
    return redirect;
  }

  const response = NextResponse.next({ request });
  if (refreshed) {
    response.cookies.set(ADMIN_ACCESS_COOKIE, refreshed.accessToken, sessionCookieOptions(refreshed.expiresIn));
    response.cookies.set(ADMIN_REFRESH_COOKIE, refreshed.refreshToken, sessionCookieOptions(REFRESH_COOKIE_MAX_AGE));
  } else if (refreshFailed) {
    response.cookies.delete(ADMIN_ACCESS_COOKIE);
    response.cookies.delete(ADMIN_REFRESH_COOKIE);
  }
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "same-origin");
  return response;
}
