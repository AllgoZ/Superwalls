import { PageHeader } from "@/components/admin/page-header";
import { StoreSettingsForm } from "@/components/admin/settings-forms";
import { getAllSettings } from "@/lib/server/admin/queries/settings";
import { requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Store settings" };

export default async function StoreSettingsPage() {
  const admin = await requireAdmin("settings.manage");
  const settings = await getAllSettings(admin);
  return (
    <>
      <PageHeader title="Store settings" description="Business details shown to customers." />
      <div className="max-w-4xl">
        <StoreSettingsForm initial={settings.store} />
      </div>
    </>
  );
}
