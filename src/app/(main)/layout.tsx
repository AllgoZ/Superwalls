import { BottomNav } from "@/components/layout/bottom-nav";
import { SiteHeader } from "@/components/layout/site-header";

/** Main app shell: header, content, and the persistent mobile bottom navigation. */
export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="pb-nav flex-1 md:pb-16">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
