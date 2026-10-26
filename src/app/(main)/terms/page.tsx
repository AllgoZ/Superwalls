import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 px-4 py-5 sm:px-6 md:pt-8">
      <h1 className="text-2xl font-extrabold text-ink">Terms &amp; Conditions</h1>
      <p className="rounded-xl bg-brand-yellow-soft px-3 py-2 text-sm text-ink">
        Placeholder page. SuperWalls will replace this with its actual terms before launch.
      </p>
      <h2 className="text-lg font-bold text-ink">Demo storefront</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Products, prices, delivery charges, discounts and orders shown here are sample data for
        demonstration. No real order is placed and no payment is taken.
      </p>
      <h2 className="text-lg font-bold text-ink">Final terms</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The final terms will cover ordering, pricing, payments, delivery, returns and cancellations, as
        confirmed by SuperWalls.
      </p>
    </article>
  );
}
