import Link from "next/link";
import { AdminBadge } from "@/components/admin/admin-badge";
import { PageHeader } from "@/components/admin/page-header";
import { TableCard } from "@/components/admin/table-card";
import { PAGE_META } from "@/lib/admin/schemas/content";
import { formatDateTime } from "@/lib/formatters/date";
import { listPages } from "@/lib/server/admin/queries/content";
import { requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Pages" };

export default async function PagesPage() {
  const admin = await requireAdmin("content.read");
  const pages = await listPages(admin);
  return (
    <>
      <PageHeader title="Pages" description="Policies and information pages. Publish one and it goes live at its address straight away." />
      <TableCard>
        <ul className="divide-y">
          {pages.map((page) => {
            const meta = PAGE_META[page.slug];
            return (
              <li key={page.slug} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <Link href={`/admin/pages/${page.slug}`} className="font-bold text-ink hover:text-primary hover:underline">{meta.label}</Link>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{meta.path}</span>
                    {page.updatedAt ? ` · updated ${formatDateTime(page.updatedAt)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {page.status === "published" ? <AdminBadge tone="success">Published</AdminBadge> : page.status === "draft" ? <AdminBadge tone="warning">Draft</AdminBadge> : <AdminBadge tone="neutral">{page.slug === "privacy" || page.slug === "terms" ? "Built-in text" : "Not created"}</AdminBadge>}
                  <Link href={`/admin/pages/${page.slug}`} className="text-sm font-semibold text-primary hover:underline">Edit</Link>
                </div>
              </li>
            );
          })}
        </ul>
      </TableCard>
    </>
  );
}
