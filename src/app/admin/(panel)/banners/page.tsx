import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

/** Banners live under "Banners & sections"; this keeps the short address working. */
export default async function BannersRedirectPage() {
  await requireAdmin("content.read");
  redirect("/admin/content?tab=banners");
}
