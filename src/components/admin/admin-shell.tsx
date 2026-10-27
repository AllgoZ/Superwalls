"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";
import { Bell, ChevronRight, ChevronsLeft, ChevronsRight, ExternalLink, LogOut, Menu } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ADMIN_NAV, ROLE_LABEL, type AdminSummary } from "@/lib/admin/permissions";
import { cn } from "@/lib/utils";
import { AdminProvider } from "./admin-provider";
import { navIcon } from "./nav-icons";

export interface AttentionItem {
  id: string;
  label: string;
  count: number;
  href: string;
  tone: "warning" | "danger" | "info";
}

const COLLAPSE_KEY = "sw-admin-sidebar-collapsed";
const COLLAPSE_EVENT = "sw-admin-sidebar";

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

const SEGMENT_LABEL: Record<string, string> = {
  admin: "Dashboard",
  products: "Products",
  new: "New",
  categories: "Categories",
  orders: "Orders",
  customers: "Customers",
  inventory: "Inventory",
  history: "History",
  promotions: "Promotions",
  content: "Banners & sections",
  pages: "Pages",
  faqs: "FAQs",
  reports: "Reports",
  settings: "Settings",
  store: "Store",
  delivery: "Delivery",
  contact: "Contact & support",
  notifications: "Notifications",
  team: "Team",
  "activity-logs": "Activity log",
  "no-access": "No access",
};

function useBreadcrumbs() {
  const pathname = usePathname();
  return useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments.map((segment, index) => ({
      href: `/${segments.slice(0, index + 1).join("/")}`,
      label: SEGMENT_LABEL[segment] ?? (segment.length > 14 ? `${segment.slice(0, 12)}…` : segment),
    }));
  }, [pathname]);
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  // /admin/settings must not stay highlighted while /admin/settings/team is open.
  if (href === "/admin/settings") return pathname === "/admin/settings" || ["store", "delivery", "contact", "notifications"].some((leaf) => pathname.startsWith(`/admin/settings/${leaf}`));
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNav({ admin, collapsed, onNavigate }: { admin: AdminSummary; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const allowed = new Set(admin.permissions);
  const groups = ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.anyOf.some((permission) => allowed.has(permission))),
  })).filter((group) => group.items.length > 0);

  return (
    <nav aria-label="Admin" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.label}>
          {!collapsed ? <p className="mb-1.5 px-2 text-[0.68rem] font-bold tracking-wider text-muted-foreground uppercase">{group.label}</p> : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = navIcon(item.icon);
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      collapsed && "justify-center",
                      active ? "bg-primary text-primary-foreground" : "text-ink/80 hover:bg-muted hover:text-ink",
                    )}
                  >
                    <Icon className="size-[1.1rem] shrink-0" aria-hidden />
                    {!collapsed ? <span className="truncate">{item.label}</span> : <span className="sr-only">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Notifications({ items }: { items: AttentionItem[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon-sm" className="relative" aria-label={`Notifications${total ? `, ${total} need attention` : ""}`} />}>
        <Bell className="size-[1.1rem]" aria-hidden />
        {total > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-brand-yellow px-1 text-[0.6rem] font-extrabold text-ink">
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-bold text-ink">Needs attention</p>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing needs attention right now.</p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted">
                  <span className="text-ink">{item.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-bold",
                      item.tone === "danger" ? "bg-danger-soft text-danger" : item.tone === "warning" ? "bg-brand-yellow-soft text-[#7a5b00]" : "bg-brand-blue-soft text-brand-blue",
                    )}
                  >
                    {item.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ProfileMenu({ admin }: { admin: AdminSummary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const initials = (admin.displayName || admin.email).slice(0, 2).toUpperCase();

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu" />}>
        <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{initials}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-36 truncate text-xs font-semibold text-ink">{admin.displayName || admin.email}</span>
          <span className="block text-[0.68rem] font-medium text-muted-foreground">{ROLE_LABEL[admin.role]}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block truncate text-sm font-semibold text-ink">{admin.displayName || "Signed in"}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{admin.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<a href="/" target="_blank" rel="noreferrer" />}>
          <ExternalLink className="size-4" aria-hidden /> View storefront
        </DropdownMenuItem>
        <DropdownMenuItem onClick={signOut} disabled={busy}>
          <LogOut className="size-4" aria-hidden /> {busy ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminShell({ admin, attention, children }: { admin: AdminSummary; attention: AttentionItem[]; children: ReactNode }) {
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const crumbs = useBreadcrumbs();

  function toggle() {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1");
    } catch {
      toast.message("Sidebar preference couldn't be saved in this browser.");
    }
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  }

  return (
    <AdminProvider admin={admin}>
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-white transition-[width] duration-200 lg:flex print:hidden",
            collapsed ? "w-[4.25rem]" : "w-64",
          )}
        >
          <div className={cn("flex h-14 items-center border-b px-4", collapsed && "justify-center px-0")}>
            {collapsed ? <LogoMark className="h-7" /> : <Logo />}
          </div>
          <SidebarNav admin={admin} collapsed={collapsed} />
          <div className="border-t p-3">
            <Button variant="ghost" size="sm" className={cn("w-full", collapsed ? "px-0" : "justify-start")} onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {collapsed ? <ChevronsRight aria-hidden /> : <ChevronsLeft aria-hidden />}
              {collapsed ? null : "Collapse"}
            </Button>
          </div>
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 gap-0 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Admin navigation</SheetTitle>
            <div className="flex h-14 items-center border-b px-4">
              <Logo />
            </div>
            <SidebarNav admin={admin} collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-white/95 px-3 backdrop-blur sm:px-5 print:hidden">
            <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu aria-hidden />
            </Button>
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
              <ol className="flex items-center gap-1 text-sm">
                {crumbs.map((crumb, index) => {
                  const last = index === crumbs.length - 1;
                  return (
                    <li key={crumb.href} className={cn("flex min-w-0 items-center gap-1", !last && "hidden sm:flex")}>
                      {index > 0 ? <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
                      {last ? (
                        <span className="truncate font-semibold text-ink" aria-current="page">{crumb.label}</span>
                      ) : (
                        <Link href={crumb.href} className="truncate text-muted-foreground hover:text-ink">{crumb.label}</Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
            <Notifications items={attention} />
            <ProfileMenu admin={admin} />
          </header>
          <main id="main" className="flex-1 px-3 py-5 sm:px-6 sm:py-6">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </AdminProvider>
  );
}

