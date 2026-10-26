import { Hero } from "@/components/shop/hero";
import { PromoBand, SiteFooter, TrustStrip } from "@/components/shop/home-sections";
import { ProductCard } from "@/components/shop/product-card";
import { getProducts } from "@/lib/services/products";

export default async function HomePage() {
  const products = await getProducts();

  return (
    <div className="space-y-8 md:space-y-12">
      <Hero />

      <section
        id="products"
        aria-labelledby="products-heading"
        className="scroll-mt-header px-4 sm:px-6"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 id="products-heading" className="text-xl font-extrabold text-ink md:text-2xl">
              Our Products
            </h2>
            <p className="text-xs text-muted-foreground">Demo catalog</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 2} />
            ))}
          </div>
        </div>
      </section>

      <TrustStrip />
      <PromoBand />
      <SiteFooter />
    </div>
  );
}
