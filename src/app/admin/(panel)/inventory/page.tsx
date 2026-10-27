import Link from "next/link";
import { Boxes, History, Lock, PackageCheck, PackageX, TriangleAlert } from "lucide-react";
import { FilterBar } from "@/components/admin/filter-bar";
import { InventoryTable } from "@/components/admin/inventory-table";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyRows, TableCard } from "@/components/admin/table-card";
import { buttonVariants } from "@/components/ui/button";
import { inventoryOverview, listInventory } from "@/lib/server/admin/queries/inventory";
import { requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  const admin = await requireAdmin("inventory.read");
  const params = await searchParams;
  const [overview, data] = await Promise.all([inventoryOverview(admin), listInventory(admin, params)]);
  const filtered = Object.keys(params).some((key) => key !== "page");

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Available stock = on hand − units held for open checkouts. Adjustments are recorded and can't push stock below those holds."
        actions={
          <Link href="/admin/inventory/history" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <History aria-hidden /> Stock history
          </Link>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Active products" value={overview.activeProducts} icon={<Boxes />} />
        <MetricCard label="Available units" value={overview.availableUnits} icon={<PackageCheck />} hint="Sellable right now" />
        <MetricCard label="Reserved units" value={overview.reservedUnits} icon={<Lock />} hint="Held for unpaid checkouts" />
        <MetricCard label="Low stock" value={overview.lowStock} icon={<TriangleAlert />} tone={overview.lowStock > 0 ? "warning" : "default"} />
        <MetricCard label="Out of stock" value={overview.outOfStock} icon={<PackageX />} tone={overview.outOfStock > 0 ? "danger" : "default"} hint={`${overview.movementsLast7Days} movements in 7 days`} />
      </div>
      <TableCard>
        <FilterBar
          searchPlaceholder="Search name, SKU or slug"
          filters={[
            {
              key: "view",
              label: "Stock view",
              options: [
                { value: "all", label: "All products" },
                { value: "attention", label: "Needs attention" },
                { value: "low", label: "Low stock" },
                { value: "out", label: "Out of stock" },
                { value: "reserved", label: "Has active reservations" },
              ],
            },
          ]}
        />
        {data.rows.length === 0 ? (
          <EmptyRows title={filtered ? "No products match these filters" : "No products yet"} description="Add products first, then manage their stock here." />
        ) : (
          <InventoryTable rows={data.rows} />
        )}
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/admin/inventory" searchParams={params} />
      </TableCard>
    </>
  );
}
