import { cookies } from "next/headers";
import { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE } from "@/lib/admin/cookies";
import { writeAudit } from "@/lib/server/admin/audit";
import { assertSameOrigin } from "@/lib/server/admin/op";
import { getAdminContext } from "@/lib/server/admin/session";
import { revokeAdminSession } from "@/lib/server/admin/sign-in";
import { clientIp, handle, json } from "@/lib/server/http";

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const jar = await cookies();
    const token = jar.get(ADMIN_ACCESS_COOKIE)?.value;
    const admin = await getAdminContext();
    if (admin) {
      await writeAudit(admin, { action: "admin.logout", entityType: "admin_member", entityId: admin.userId, summary: "Signed out" }, clientIp(request));
    }
    if (token) await revokeAdminSession(token);
    jar.delete(ADMIN_ACCESS_COOKIE);
    jar.delete(ADMIN_REFRESH_COOKIE);
    return json({ data: { ok: true } });
  });
}
