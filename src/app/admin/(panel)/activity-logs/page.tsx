import { FilterBar } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyRows, TableCard, TableScroll } from "@/components/admin/table-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatters/date";
import { ACTIVITY_GROUPS, listActivity } from "@/lib/server/admin/queries/activity";
import { requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Activity log" };

export default async function ActivityLogsPage({ searchParams }: PageProps<"/admin/activity-logs">) {
  const admin = await requireAdmin("activity.view");
  const params = await searchParams;
  const data = await listActivity(admin, params);
  const filtered = Object.keys(params).some((key) => key !== "page");

  return (
    <>
      <PageHeader title="Activity log" description="A permanent record of sensitive actions. Entries can't be edited or deleted. Passwords, tokens and payment secrets are never recorded." />
      <TableCard>
        <FilterBar searchPlaceholder="Search summary, person or record" filters={[{ key: "group", label: "Area", options: ACTIVITY_GROUPS }]} dates={[{ key: "from", label: "From" }, { key: "to", label: "To" }]} />
        {data.rows.length === 0 ? (
          <EmptyRows title={filtered ? "No activity matches these filters" : "No activity yet"} description="Sign-ins and changes made in the admin panel are recorded here." />
        ) : (
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>What happened</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="align-top whitespace-nowrap text-muted-foreground">{formatDateTime(row.at)}</TableCell>
                    <TableCell className="align-top break-all">{row.actor ?? "System"}</TableCell>
                    <TableCell className="align-top"><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.action}</code></TableCell>
                    <TableCell className="max-w-xl align-top">
                      <p className="text-ink">{row.summary}</p>
                      {row.entityType ? <p className="text-xs text-muted-foreground">{row.entityType}{row.entityId ? ` · ${row.entityId}` : ""}{row.ip ? ` · ${row.ip}` : ""}</p> : null}
                      {Object.keys(row.metadata).length > 0 ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs font-semibold text-primary">Details</summary>
                          <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-[0.7rem] leading-snug">{JSON.stringify(row.metadata, null, 2)}</pre>
                        </details>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        )}
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/admin/activity-logs" searchParams={params} />
      </TableCard>
    </>
  );
}
