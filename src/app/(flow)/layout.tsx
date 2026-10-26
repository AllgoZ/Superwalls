import { SiteHeader } from "@/components/layout/site-header";

/**
 * Focused flows (product, cart, checkout). No bottom nav, so a sticky action
 * bar can own the bottom of the screen. Mobile pages render their own
 * MobileTopBar; the full header only shows from `md` up.
 */
export default function FlowLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="hidden md:block">
        <SiteHeader />
      </div>
      <main id="main" className="flex-1 md:pb-16">
        {children}
      </main>
    </>
  );
}
