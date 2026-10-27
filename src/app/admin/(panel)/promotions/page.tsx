import { PageHeader } from "@/components/admin/page-header";
import { PromotionsManager } from "@/components/admin/promotions-manager";
import { listPromotions } from "@/lib/server/admin/queries/promotions";
import { requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Promotions" };

export default async function PromotionsPage() {
  const admin = await requireAdmin("promotions.read");
  const promotions = await listPromotions(admin);
  return (
    <>
      <PageHeader title="Promotions" description="Discount codes. Validity, minimum order and usage limits are enforced on the server when a customer pays." />
      <PromotionsManager promotions={promotions} />
    </>
  );
}
