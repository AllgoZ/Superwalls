"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { isNavItemActive, NAV_ITEMS } from "./nav-items";

function DesktopNavView({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Primary" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isNavItemActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "bg-brand-blue-soft text-brand-blue"
                    : "text-muted-foreground hover:bg-soft hover:text-ink",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DesktopNavWithPath() {
  return <DesktopNavView pathname={usePathname()} />;
}

/**
 * `usePathname` is runtime data under Cache Components, so it sits behind
 * Suspense; the fallback is the same nav with no active item.
 */
export function DesktopNav() {
  return (
    <Suspense fallback={<DesktopNavView pathname="" />}>
      <DesktopNavWithPath />
    </Suspense>
  );
}
