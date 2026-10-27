import Link from "next/link";
import { FilterBar } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyRows, TableCard, TableScroll } from "@/components/admin/table-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MOVEMENT_KIND_LABEL } from "@/lib/admin/schemas/promotions";
import { formatDateTime } from "@/lib/formatters/date";
import { listMovements } from "@/lib/server/admin/queries/inventory";
import { can, requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Stock history" };

export default async function InventoryHistoryPage({ searchParams }: PageProps<"/admin/inventory/history">) {
  const admin = await requireAdmin("inventory.read");
  const params = await searchParams;
  const data = await listMovements(admin, params);
  const canSeeOrders = can(admin, "orders.read");
  const filtered = Object.keys(params).some((key) => key !== "page");

  return (
    <>
      <PageHeader title="Stock history" description="Every change to on-hand stock: who, when, how much and why. Entries can't be edited." />
      <TableCard>
        <FilterBar
          searchPlaceholder="Search product name, slug or SKU"
          filters={[
            {
              key: "kind",
              label: "Movement type",
              options: [{ value: "all", label: "All types" }, ...Object.entries(MOVEMENT_KIND_LABEL).map(([value, label]) => ({ value, label }))],
            },
          ]}
          dates={[{ key: "from", label: "From" }, { key: "to", label: "To" }]}
        />
        {data.rows.length === 0 ? (
          <EmptyRows title={filtered ? "No movements match these filters" : "No stock movements yet"} description="Adjustments, restocks, sales and cancellations appear here." />
        ) : (
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Before</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((move) => (
                  <TableRow key={move.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(move.at)}</TableCell>
                    <TableCell className="max-w-56">
                      <Link href={`/admin/products/${move.productId}`} className="block truncate font-medium text-ink hover:text-primary hover:underline">{move.productName}</Link>
                    </TableCell>
                    <TableCell>{MOVEMENT_KIND_LABEL[move.kind] ?? move.kind}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{move.before}</TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${move.change < 0 ? "text-danger" : "text-success"}`}>{move.change > 0 ? `+${move.change}` : move.change}</TableCell>
                    <TableCell className="text-right tabular-nums">{move.after}</TableCell>
                    <TableCell className="max-w-72 text-muted-foreground">
                      {move.reason}
                      {move.orderNumber ? (
                        <>
                          {" "}
                          {canSeeOrders && move.orderId ? (
                            <Link href={`/admin/orders/${move.orderId}`} className="font-mono text-xs font-semibold text-primary hover:underline">{move.orderNumber}</Link>
                          ) : (
                            <span className="font-mono text-xs">{move.orderNumber}</span>
                          )}
                        </>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{move.by ?? (move.kind === "sale" ? "Payment" : "System")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        )}
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/admin/inventory/history" searchParams={params} />
      </TableCard>
    </>
  );
}
