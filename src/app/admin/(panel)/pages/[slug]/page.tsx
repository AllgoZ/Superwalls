import { notFound } from "next/navigation";
import { AdminBadge } from "@/components/admin/admin-badge";
import { PageEditor } from "@/components/admin/page-editor";
import { PageHeader } from "@/components/admin/page-header";
import { PAGE_META, PAGE_SLUGS, type PageSlug } from "@/lib/admin/schemas/content";
import { listPages } from "@/lib/server/admin/queries/content";
import { requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Edit page" };

export default async function EditPagePage({ params }: PageProps<"/admin/pages/[slug]">) {
  const admin = await requireAdmin("content.read");
  const { slug } = await params;
  if (!(PAGE_SLUGS as readonly string[]).includes(slug)) notFound();
  const page = (await listPages(admin)).find((p) => p.slug === slug)!;
  const meta = PAGE_META[slug as PageSlug];

  return (
    <>
      <PageHeader
        title={meta.label}
        description={
          <span className="inline-flex items-center gap-2">
            <span className="font-mono">{meta.path}</span>
            {page.status === "published" ? <AdminBadge tone="success">Published</AdminBadge> : page.status === "draft" ? <AdminBadge tone="warning">Draft</AdminBadge> : <AdminBadge tone="neutral">Not created</AdminBadge>}
          </span>
        }
      />
      <PageEditor key={page.updatedAt ?? "new"} slug={slug as PageSlug} initial={page} published={page.status === "published"} />
    </>
  );
}
