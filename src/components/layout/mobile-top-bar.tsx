import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CartButton } from "@/components/cart/cart-button";

interface MobileTopBarProps {
  title: string;
  backHref: string;
  backLabel: string;
  /** Hide the cart shortcut (e.g. on the cart page itself). */
  hideCart?: boolean;
}

/** Compact top bar for focused mobile screens (product, cart, checkout). Hidden on desktop. */
export function MobileTopBar({ title, backHref, backLabel, hideCart }: MobileTopBarProps) {
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b bg-white/95 px-2 backdrop-blur md:hidden">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-soft"
      >
        <ArrowLeft className="size-5" aria-hidden />
      </Link>
      <p className="flex-1 truncate text-base font-bold text-ink">{title}</p>
      {hideCart ? null : <CartButton />}
    </div>
  );
}
