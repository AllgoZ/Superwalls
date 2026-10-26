import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { CartButton } from "@/components/cart/cart-button";
import { DesktopNav } from "./desktop-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="px-4 sm:px-6">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4">
          <Link href="/" aria-label="SuperWalls home" className="rounded-md">
            <Logo />
          </Link>
          <DesktopNav />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
