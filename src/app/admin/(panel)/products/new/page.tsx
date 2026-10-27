import { ProductForm } from "@/components/admin/product-form";
import { EMPTY_PRODUCT } from "@/lib/admin/product-values";
import { PageHeader } from "@/components/admin/page-header";
import { listCategories } from "@/lib/server/admin/queries/products";
import { requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  const admin = await requireAdmin("catalog.write");
  const categories = await listCategories(admin);
  return (
    <>
      <PageHeader title="Add product" description="New products start unpublished unless you switch Published on." />
      <ProductForm mode="create" initial={EMPTY_PRODUCT} categories={categories.filter((c) => c.isActive).map((c) => ({ id: c.id, name: c.name }))} canWrite />
    </>
  );
}
