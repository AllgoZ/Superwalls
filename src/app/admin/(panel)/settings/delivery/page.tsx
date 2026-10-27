import { PageHeader } from "@/components/admin/page-header";
import { DeliverySettingsForm } from "@/components/admin/settings-forms";
import { getAllSettings } from "@/lib/server/admin/queries/settings";
import { requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Delivery settings" };

export default async function DeliverySettingsPage() {
  const admin = await requireAdmin("settings.manage");
  const settings = await getAllSettings(admin);
  return (
    <>
      <PageHeader title="Delivery settings" description="Applied by the server at checkout. The cart shows the same numbers." />
      <div className="max-w-4xl">
        <DeliverySettingsForm initial={settings.delivery} />
      </div>
    </>
  );
}
