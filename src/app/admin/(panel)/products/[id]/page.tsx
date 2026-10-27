import { notFound } from "next/navigation";
import { AdminBadge, PRODUCT_STATUS_BADGE } from "@/components/admin/admin-badge";
import { PageHeader } from "@/components/admin/page-header";
import { ProductActions } from "@/components/admin/product-actions";
import { ProductForm } from "@/components/admin/product-form";
import { valuesFromDetail } from "@/lib/admin/product-values";
import { getProductDetail, listCategories } from "@/lib/server/admin/queries/products";
import { can, requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  const admin = await requireAdmin("catalog.read");
  const { id } = await params;
  const [product, categories] = await Promise.all([getProductDetail(admin, id), listCategories(admin)]);
  if (!product) notFound();
  const status = PRODUCT_STATUS_BADGE[product.status];

  return (
    <>
      <PageHeader
        title={product.name}
        description={
          <span className="inline-flex items-center gap-2">
            <AdminBadge tone={status.tone}>{status.label}</AdminBadge>
            <span className="font-mono">{product.id}</span>
          </span>
        }
        actions={<ProductActions id={product.id} status={product.status} featured={product.isFeatured} />}
      />
      <ProductForm
        key={product.updatedAt}
        mode="edit"
        initial={valuesFromDetail(product)}
        categories={categories.filter((c) => c.isActive || c.id === product.categoryId).map((c) => ({ id: c.id, name: c.name }))}
        canWrite={can(admin, "catalog.write")}
      />
    </>
  );
}
