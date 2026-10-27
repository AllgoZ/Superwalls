import Link from "next/link";
import { Download } from "lucide-react";
import { AdminBadge } from "@/components/admin/admin-badge";
import { FilterBar } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyRows, TableCard, TableScroll } from "@/components/admin/table-card";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/formatters/date";
import { formatINR } from "@/lib/formatters/money";
import { listCustomers } from "@/lib/server/admin/queries/customers";
import { can, requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const admin = await requireAdmin("customers.read");
  const params = await searchParams;
  const data = await listCustomers(admin, params);
  const exportQuery = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && k !== "page" ? [[k, v]] : []))).toString();
  const filtered = Object.keys(params).some((key) => key !== "page" && key !== "sort");

  return (
    <>
      <PageHeader
        title="Customers"
        description="Registered customers and guests who have ordered. Purchase value counts paid, uncancelled orders net of refunds."
        actions={
          can(admin, "reports.export") ? (
            <a href={`/api/admin/export/customers${exportQuery ? `?${exportQuery}` : ""}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Download aria-hidden /> Export CSV
            </a>
          ) : null
        }
      />
      <TableCard>
        <FilterBar
          searchPlaceholder="Search name, email or phone"
          filters={[
            { key: "type", label: "Customer type", options: [{ value: "all", label: "Registered & guests" }, { value: "registered", label: "Registered" }, { value: "guest", label: "Guests" }] },
            { key: "segment", label: "Segment", options: [{ value: "all", label: "Everyone" }, { value: "buyers", label: "Has paid orders" }, { value: "repeat", label: "Repeat customers" }] },
            {
              key: "sort",
              label: "Sort",
              neutral: "recent",
              options: [
                { value: "recent", label: "Most recent" },
                { value: "value", label: "Highest value" },
                { value: "orders", label: "Most orders" },
                { value: "name", label: "Name A–Z" },
              ],
            },
          ]}
        />
        {data.rows.length === 0 ? (
          <EmptyRows title={filtered ? "No customers match these filters" : "No customers yet"} description="Customers appear here when they register or place an order." />
        ) : (
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Purchase value</TableHead>
                  <TableHead>Last order</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Link href={`/admin/customers/${customer.id}`} className="block font-semibold text-ink hover:text-primary hover:underline">
                        {customer.name || "(no name)"}
                      </Link>
                      <span className="text-xs break-all text-muted-foreground">{customer.email}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{customer.phone || "—"}</TableCell>
                    <TableCell>
                      <AdminBadge tone={customer.type === "guest" ? "neutral" : "info"}>{customer.type === "guest" ? "Guest" : "Registered"}</AdminBadge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{customer.orderCount}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatINR(customer.purchaseValuePaise)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{customer.registeredAt ? formatDate(customer.registeredAt) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        )}
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/admin/customers" searchParams={params} />
      </TableCard>
    </>
  );
}
