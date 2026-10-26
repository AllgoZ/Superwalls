import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleAlert, CircleCheck } from "lucide-react";
import { Price } from "@/components/common/price";
import { DemoTag } from "@/components/common/status-badge";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { ProductGallery } from "@/components/shop/product-gallery";
import { PurchasePanel } from "@/components/shop/purchase-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { getStockState } from "@/lib/commerce/pricing";
import { getProductById, getProducts } from "@/lib/services/products";

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({ id: product.id }));
}

export async function generateMetadata({ params }: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  return { title: product ? product.name : "Product not found" };
}

function ProductSkeleton() {
  return (
    <div className="mx-auto max-w-6xl md:grid md:grid-cols-2 md:gap-10 md:px-6 md:pt-8" aria-busy="true">
      <Skeleton className="aspect-square w-full rounded-none md:rounded-3xl" />
      <div className="space-y-3 px-4 pt-5 md:px-0">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-7 w-1/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}

export default function ProductPage({ params }: PageProps<"/products/[id]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      {params.then(({ id }) => (
        <ProductContent id={id} />
      ))}
    </Suspense>
  );
}

async function ProductContent({ id }: { id: string }) {
  const product = await getProductById(id);
  if (!product) notFound();

  const stock = getStockState(product);
  const stockClass =
    stock === "out_of_stock"
      ? "text-danger"
      : stock === "low_stock"
        ? "text-[#7a5b00]"
        : "text-success";

  return (
    <>
      <MobileTopBar title={product.name} backHref="/#products" backLabel="Back to products" />
      <div className="mx-auto max-w-6xl pb-32 md:grid md:grid-cols-2 md:gap-10 md:px-6 md:pt-8 md:pb-0">
        <div className="md:col-span-2">
          <Link
            href="/#products"
            className="mb-2 hidden items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline md:inline-flex"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to shopping
          </Link>
        </div>

        <ProductGallery images={product.images} name={product.name} />

        <div className="space-y-5 px-4 pt-5 md:px-0 md:pt-0">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-muted-foreground">{product.unit}</p>
              {product.isDemo ? <DemoTag /> : null}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink md:text-3xl">{product.name}</h1>
            <Price
              pricePaise={product.pricePaise}
              compareAtPricePaise={product.compareAtPricePaise}
              size="lg"
            />
            <p className="text-xs text-muted-foreground">Demo price</p>
          </div>

          <p className={`flex items-center gap-2 text-sm font-semibold ${stockClass}`}>
            {stock === "in_stock" ? (
              <CircleCheck className="size-4" aria-hidden />
            ) : (
              <CircleAlert className="size-4" aria-hidden />
            )}
            {stock === "out_of_stock"
              ? "Out of stock"
              : stock === "low_stock"
                ? `Only ${product.stock} left`
                : "In stock"}
          </p>

          <section aria-labelledby="about-heading">
            <h2 id="about-heading" className="mb-1 text-base font-bold text-ink">
              About this product
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
          </section>

          <PurchasePanel product={product} />
        </div>
      </div>
    </>
  );
}
