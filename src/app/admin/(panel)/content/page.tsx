import Link from "next/link";
import { BannersManager } from "@/components/admin/banners-manager";
import { FooterForm } from "@/components/admin/footer-form";
import { PageHeader } from "@/components/admin/page-header";
import { SectionsManager } from "@/components/admin/sections-manager";
import { getFooter, listBanners, listSections } from "@/lib/server/admin/queries/content";
import { requireAdmin } from "@/lib/server/admin/session";
import { cn } from "@/lib/utils";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Banners & sections" };

const TABS = [
  { key: "banners", label: "Homepage banners" },
  { key: "sections", label: "Homepage sections" },
  { key: "footer", label: "Footer" },
] as const;

export default async function ContentPage({ searchParams }: PageProps<"/admin/content">) {
  const admin = await requireAdmin("content.read");
  const params = await searchParams;
  const requested = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab = TABS.find((t) => t.key === requested)?.key ?? "banners";

  return (
    <>
      <PageHeader title="Banners & sections" description="Edit what customers see on the homepage and in the footer. Changes go live immediately." />
      <div className="mb-5 flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="Content areas">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={`/admin/content?tab=${item.key}`}
            role="tab"
            aria-selected={tab === item.key}
            className={cn("shrink-0 border-b-2 px-4 py-2 text-sm font-semibold", tab === item.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-ink")}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {tab === "banners" ? <BannersManager banners={await listBanners(admin)} /> : null}
      {tab === "sections" ? <SectionsManager sections={await listSections(admin)} /> : null}
      {tab === "footer" ? <FooterForm initial={await getFooter(admin)} /> : null}
    </>
  );
}
