"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { isNavItemActive, NAV_ITEMS } from "./nav-items";

/** Persistent mobile navigation. Hidden from `md` up, where the top nav takes over. */
function BottomNavView({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Primary"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-white md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isNavItemActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors",
                  active ? "text-brand-blue" : "text-muted-foreground hover:text-ink",
                )}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute top-0 h-1 w-8 rounded-b-full bg-brand-yellow"
                  />
                ) : null}
                <Icon className="size-6" strokeWidth={active ? 2.5 : 2} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function BottomNavWithPath() {
  return <BottomNavView pathname={usePathname()} />;
}

/**
 * `usePathname` is runtime data under Cache Components, so it sits behind
 * Suspense; the fallback is the same nav with no active item.
 */
export function BottomNav() {
  return (
    <Suspense fallback={<BottomNavView pathname="" />}>
      <BottomNavWithPath />
    </Suspense>
  );
}
