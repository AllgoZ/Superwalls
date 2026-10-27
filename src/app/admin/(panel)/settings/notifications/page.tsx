import { PageHeader } from "@/components/admin/page-header";
import { NotificationSettingsForm } from "@/components/admin/settings-forms";
import { getAllSettings } from "@/lib/server/admin/queries/settings";
import { requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  const admin = await requireAdmin("settings.manage");
  const settings = await getAllSettings(admin);
  return (
    <>
      <PageHeader title="Notifications" description="Preferences for future customer and staff messages." />
      <div className="max-w-4xl">
        <NotificationSettingsForm initial={settings.notifications} />
      </div>
    </>
  );
}
