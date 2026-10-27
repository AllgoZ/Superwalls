import { FaqsManager } from "@/components/admin/faqs-manager";
import { PageHeader } from "@/components/admin/page-header";
import { listFaqs } from "@/lib/server/admin/queries/content";
import { requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "FAQs" };

export default async function FaqsPage() {
  const admin = await requireAdmin("content.read");
  const faqs = await listFaqs(admin);
  return (
    <>
      <PageHeader title="FAQs" description="Questions and answers on the storefront Help page." />
      <FaqsManager faqs={faqs} />
    </>
  );
}
