import Link from "next/link";
import { ProductImage } from "@/components/common/product-image";
import { Price } from "@/components/common/price";
import { getStockState } from "@/lib/commerce/pricing";
import type { Product } from "@/lib/types";
import { AddToCart } from "./add-to-cart";

export function ProductCard({ product, priority }: { product: Product; priority?: boolean }) {
  const stock = getStockState(product);
  const image = product.images[0];

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border bg-white transition-shadow hover:shadow-md">
      <Link
        href={`/products/${product.id}`}
        className="relative block focus-visible:outline-offset-[-2px]"
        aria-label={`View details for ${product.name}`}
      >
        <ProductImage
          src={image?.src}
          alt={image?.alt ?? product.name}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          priority={priority}
          className="transition-transform duration-300 group-hover:scale-[1.02]"
        />
        {stock === "low_stock" ? (
          <span className="absolute right-2 bottom-2 rounded-full bg-brand-yellow px-2 py-0.5 text-[0.7rem] font-bold text-ink">
            Only {product.stock} left
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold text-ink">
            <Link href={`/products/${product.id}`}>{product.name}</Link>
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {product.unit} · {product.tagline}
          </p>
        </div>
        <div className="mt-auto flex flex-col gap-3">
          <Price
            pricePaise={product.pricePaise}
            compareAtPricePaise={product.compareAtPricePaise}
            size="sm"
          />
          <AddToCart product={product} />
        </div>
      </div>
    </article>
  );
}
