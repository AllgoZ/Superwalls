import { PageHeader } from "@/components/admin/page-header";
import { ContactSettingsForm } from "@/components/admin/settings-forms";
import { getAllSettings } from "@/lib/server/admin/queries/settings";
import { requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Contact settings" };

export default async function ContactSettingsPage() {
  const admin = await requireAdmin("settings.manage");
  const settings = await getAllSettings(admin);
  return (
    <>
      <PageHeader title="Contact & support" description="How customers reach you." />
      <div className="max-w-4xl">
        <ContactSettingsForm initial={settings.contact} />
      </div>
    </>
  );
}
