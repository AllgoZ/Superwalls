import { writeAudit } from "@/lib/server/admin/audit";
import { EXPORTS } from "@/lib/server/admin/exports";
import { requireAdminApi } from "@/lib/server/admin/session";
import { ApiError } from "@/lib/server/errors";
import { clientIp, enforceRateLimit, handle } from "@/lib/server/http";

/** CSV download. Requires every permission the export lists; each download is audited because it moves data out. */
export async function GET(request: Request, context: RouteContext<"/api/admin/export/[kind]">) {
  return handle(async () => {
    const { kind } = await context.params;
    const def = Object.hasOwn(EXPORTS, kind) ? EXPORTS[kind] : undefined;
    const admin = await requireAdminApi();
    if (!def) throw new ApiError("NOT_FOUND", "Unknown export.");
    for (const permission of def.permissions) await requireAdminApi(permission);
    await enforceRateLimit("admin-export", admin.userId, 20, 60);

    const url = new URL(request.url);
    const searchParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      searchParams[key] = value;
    });
    const csv = await def.build(admin, searchParams);

    const stamp = new Date().toISOString().slice(0, 10);
    await writeAudit(admin, { action: `export.${kind}`, entityType: "export", entityId: kind, summary: `Exported ${kind} as CSV`, metadata: { filters: searchParams } }, clientIp(request));
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="superwalls-${def.filename}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
