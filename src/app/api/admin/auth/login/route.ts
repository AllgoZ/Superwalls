import { cookies } from "next/headers";
import { z } from "zod";
import { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE, REFRESH_COOKIE_MAX_AGE, sessionCookieOptions } from "@/lib/admin/cookies";
import { writeAudit } from "@/lib/server/admin/audit";
import { assertSameOrigin } from "@/lib/server/admin/op";
import { signInAdmin } from "@/lib/server/admin/sign-in";
import { clientIp, enforceRateLimit, handle, json, readJson } from "@/lib/server/http";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const ip = clientIp(request);
    await enforceRateLimit("admin-login-ip", ip, 30, 600);
    const body = await readJson(request, schema, 2_000);
    // Per IP+email, so an outsider cannot lock a real admin out from elsewhere.
    await enforceRateLimit("admin-login", `${ip}|${body.email}`, 8, 600);

    const session = await signInAdmin(body.email, body.password);

    const jar = await cookies();
    jar.set(ADMIN_ACCESS_COOKIE, session.accessToken, sessionCookieOptions(session.expiresIn));
    jar.set(ADMIN_REFRESH_COOKIE, session.refreshToken, sessionCookieOptions(REFRESH_COOKIE_MAX_AGE));

    await writeAudit(
      { userId: session.userId, email: session.email },
      { action: "admin.login", entityType: "admin_member", entityId: session.userId, summary: "Signed in to the admin panel" },
      ip,
    );
    return json({ data: { ok: true } });
  });
}
