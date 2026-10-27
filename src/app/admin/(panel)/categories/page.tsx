import { CategoriesManager } from "@/components/admin/categories-manager";
import { PageHeader } from "@/components/admin/page-header";
import { listCategories } from "@/lib/server/admin/queries/products";
import { requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const admin = await requireAdmin("catalog.read");
  const categories = await listCategories(admin);
  return (
    <>
      <PageHeader title="Categories" description="Group products so customers can find them. Keep it simple: a few clear categories." />
      <CategoriesManager categories={categories} />
    </>
  );
}
