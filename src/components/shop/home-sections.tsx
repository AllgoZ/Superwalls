import Link from "next/link";
import { Banknote, MessageCircle, PackageSearch, Tag } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { commerceConfig } from "@/lib/config/commerce";
import { siteConfig } from "@/lib/config/site";
import { formatINR } from "@/lib/formatters";

const TRUST_ITEMS = [
  {
    icon: Banknote,
    title: "Cash on Delivery",
    text: "Pay when your order arrives.",
  },
  {
    icon: PackageSearch,
    title: "Track in the Orders tab",
    text: "See every order's status in one place.",
  },
  {
    icon: MessageCircle,
    title: "Help when you need it",
    text: "Reach support from your profile.",
  },
] as const;

export function TrustStrip() {
  return (
    <section aria-label="Why order with us" className="px-4 sm:px-6">
      <ul className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-3">
        {TRUST_ITEMS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-start gap-3 rounded-2xl bg-soft p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-blue">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">{title}</p>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Small promo band driven by the (demo) commerce config, so it never drifts from the cart's rules. */
export function PromoBand() {
  const threshold = commerceConfig.freeDeliveryThresholdPaise;
  if (threshold === null) return null;

  return (
    <section aria-label="Delivery offer" className="px-4 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-2xl bg-brand-yellow-soft p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-ink">
          <Tag className="size-5" aria-hidden />
        </span>
        <p className="text-sm text-ink">
          <span className="font-bold">Free delivery on orders above {formatINR(threshold)}.</span>{" "}
          <span className="text-muted-foreground">Demo offer; final policy to be confirmed.</span>
        </p>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-4 border-t bg-soft">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="text-sm text-muted-foreground">{siteConfig.tagline}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm font-medium text-ink">
            <li>
              <Link href="/orders" className="hover:text-brand-blue">
                My Orders
              </Link>
            </li>
            <li>
              <Link href="/profile" className="hover:text-brand-blue">
                Profile
              </Link>
            </li>
            <li>
              <Link href="/help" className="hover:text-brand-blue">
                Help &amp; Support
              </Link>
            </li>
            <li>
              <Link href="/cart" className="hover:text-brand-blue">
                Cart
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-brand-blue">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-brand-blue">
                Terms &amp; Conditions
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <p className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
        {siteConfig.name} · Demo storefront with sample products and prices.
      </p>
    </footer>
  );
}
