import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyRows, TableCard } from "@/components/admin/table-card";
import { FilterBar } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { ProductsTable } from "@/components/admin/products-table";
import { buttonVariants } from "@/components/ui/button";
import { listCategories, listProducts } from "@/lib/server/admin/queries/products";
import { can, requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const admin = await requireAdmin("catalog.read");
  const params = await searchParams;
  const [data, categories] = await Promise.all([listProducts(admin, params), listCategories(admin)]);
  const filtered = Object.keys(params).some((key) => key !== "page" && key !== "sort");

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything customers can buy. Changes appear on the storefront immediately."
        actions={
          can(admin, "catalog.write") ? (
            <Link href="/admin/products/new" className={buttonVariants({ size: "sm" })}>
              <Plus aria-hidden /> Add product
            </Link>
          ) : null
        }
      />
      <TableCard>
        <FilterBar
          searchPlaceholder="Search name, SKU or slug"
          filters={[
            { key: "category", label: "Category", options: [{ value: "all", label: "All categories" }, { value: "none", label: "No category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))] },
            {
              key: "status",
              label: "Status",
              options: [
                { value: "all", label: "Active & inactive" },
                { value: "published", label: "Published" },
                { value: "unpublished", label: "Unpublished" },
                { value: "archived", label: "Archived" },
              ],
            },
            {
              key: "stock",
              label: "Stock",
              options: [
                { value: "all", label: "Any stock" },
                { value: "in", label: "In stock" },
                { value: "low", label: "Low stock" },
                { value: "out", label: "Out of stock" },
              ],
            },
            {
              key: "sort",
              label: "Sort",
              neutral: "created_desc",
              options: [
                { value: "created_desc", label: "Newest first" },
                { value: "created_asc", label: "Oldest first" },
                { value: "name_asc", label: "Name A–Z" },
                { value: "name_desc", label: "Name Z–A" },
                { value: "price_asc", label: "Price low–high" },
                { value: "price_desc", label: "Price high–low" },
                { value: "stock_asc", label: "Stock low–high" },
                { value: "stock_desc", label: "Stock high–low" },
              ],
            },
          ]}
        />
        {data.rows.length === 0 ? (
          <EmptyRows
            title={filtered ? "No products match these filters" : "No products yet"}
            description={filtered ? "Try a different search or clear the filters." : "Add your first product to start selling."}
            action={!filtered && can(admin, "catalog.write") ? <Link href="/admin/products/new" className={buttonVariants({ size: "sm" })}>Add product</Link> : undefined}
          />
        ) : (
          <ProductsTable rows={data.rows} />
        )}
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/admin/products" searchParams={params} />
      </TableCard>
    </>
  );
}
