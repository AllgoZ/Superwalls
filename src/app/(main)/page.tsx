import Link from "next/link";
import { Suspense } from "react";
import { ProductCardSkeleton } from "@/components/common/states";
import { Hero } from "@/components/shop/hero";
import { HeroBanners } from "@/components/shop/hero-banners";
import { BrandIntro, FeatureStrip, PromoStrip, SiteFooter, SupportCallout } from "@/components/shop/home-sections";
import { ProductCard } from "@/components/shop/product-card";
import { resolveSupport } from "@/lib/config/support";
import { getActiveCategories, getHomeBanners, getPublicSettings, getVisibleSections, type PublicCategory, type PublicSection } from "@/lib/server/content";
import { getProducts } from "@/lib/services/products";
import { cn } from "@/lib/utils";

function CategoryChips({ categories, active }: { categories: PublicCategory[]; active?: string }) {
  if (categories.length === 0) return null;
  const chip = "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors";
  return (
    <nav aria-label="Product categories" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      <Link href="/#products" aria-current={!active ? "true" : undefined} className={cn(chip, !active ? "border-brand-blue bg-brand-blue text-white" : "bg-white text-ink hover:border-brand-blue")}>
        All
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/?category=${encodeURIComponent(category.slug)}#products`}
          aria-current={active === category.slug ? "true" : undefined}
          className={cn(chip, active === category.slug ? "border-brand-blue bg-brand-blue text-white" : "bg-white text-ink hover:border-brand-blue")}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}

/** Stock changes with every order, so the grid is fetched per request and streamed in behind the static shell. */
async function ProductsSection({
  featured,
  categories,
  searchParams,
}: {
  featured?: PublicSection;
  categories: PublicCategory[];
  searchParams: PageProps<"/">["searchParams"];
}) {
  const { category: requested } = await searchParams;
  const slug = typeof requested === "string" ? requested : undefined;
  const selected = categories.find((category) => category.slug === slug);
  const all = await getProducts();
  const products = selected ? all.filter((product) => product.categoryId === selected.id) : all;
  const featuredProducts = featured && !selected ? all.filter((product) => product.isFeatured) : [];

  return (
    <>
      <CategoryChips categories={categories} active={selected?.slug} />
      <div className="space-y-8">
        {featured && featuredProducts.length > 0 ? (
          <div>
            <h3 className="mb-3 text-lg font-extrabold text-ink md:text-xl">{featured.title || "Featured products"}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {featuredProducts.slice(0, 4).map((product) => (
                <ProductCard key={`featured-${product.id}`} product={product} />
              ))}
            </div>
          </div>
        ) : null}
        {products.length === 0 ? (
          <p className="rounded-2xl bg-soft px-4 py-10 text-center text-sm text-muted-foreground">No products in this category yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 2} />
            ))}
          </div>
        )}
        {all.some((product) => product.isDemo) ? <p className="text-xs text-muted-foreground">Demo catalog</p> : null}
      </div>
    </>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  // All of these are cached and tagged, so they sit in the static shell and refresh the moment an admin edits them.
  const [banners, sections, settings, categories] = await Promise.all([getHomeBanners(), getVisibleSections(), getPublicSettings(), getActiveCategories()]);
  const byKey = new Map(sections.map((section) => [section.key, section]));
  const hero = byKey.get("hero");
  const support = resolveSupport(settings.contact);
  const below = sections.filter((section) => ["promo_strip", "brand_intro", "why_choose", "benefits", "support"].includes(section.key));

  return (
    <div className="space-y-8 md:space-y-12">
      {banners.length > 0 ? (
        <HeroBanners banners={banners} />
      ) : hero ? (
        <Hero heading={hero.title} subtitle={hero.body} ctaLabel={hero.ctaLabel} ctaHref={hero.ctaHref} />
      ) : null}

      <section id="products" aria-labelledby="products-heading" className="scroll-mt-header px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 id="products-heading" className="text-xl font-extrabold text-ink md:text-2xl">
              Our Products
            </h2>
          </div>
          <Suspense fallback={<ProductGridSkeleton />}>
            <ProductsSection featured={byKey.get("featured_products")} categories={categories} searchParams={searchParams} />
          </Suspense>
        </div>
      </section>

      {below.map((section) => {
        switch (section.key) {
          case "promo_strip":
            return <PromoStrip key={section.key} section={section} thresholdPaise={settings.delivery.freeDeliveryThresholdPaise} />;
          case "brand_intro":
            return <BrandIntro key={section.key} section={section} />;
          case "why_choose":
          case "benefits":
            return <FeatureStrip key={section.key} section={section} />;
          case "support":
            return <SupportCallout key={section.key} section={section} support={support} />;
          default:
            return null;
        }
      })}

      <SiteFooter settings={settings} />
    </div>
  );
}
