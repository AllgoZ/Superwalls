"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Archive, Copy, Eye, EyeOff, ImageOff, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminCall } from "@/lib/admin/client";
import { formatDate } from "@/lib/formatters/date";
import { formatINR } from "@/lib/formatters/money";
import type { AdminProductRow } from "@/lib/server/admin/queries/products";
import { useCan } from "./admin-provider";
import { AdminBadge, PRODUCT_STATUS_BADGE, STOCK_BADGE } from "./admin-badge";
import { ConfirmDialog } from "./confirm-dialog";
import { TableScroll } from "./table-card";
import { useAdminAction } from "./use-admin-action";

type Pending = { kind: "delete" | "archive"; ids: string[] } | null;

export function ProductsTable({ rows }: { rows: AdminProductRow[] }) {
  const canWrite = useCan("catalog.write");
  const canDelete = useCan("catalog.delete");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending>(null);
  const { run, busy, router } = useAdminAction();

  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function setStatus(ids: string[], status: "published" | "unpublished" | "archived", success: string) {
    await run(() => adminCall("products.setStatus", { ids, status }), { success });
    setSelected(new Set());
  }

  return (
    <>
      {canWrite && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b bg-brand-blue-soft px-4 py-2 text-sm">
          <span className="font-semibold text-primary">{selected.size} selected</span>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus([...selected], "published", "Published")}>
            <Eye aria-hidden /> Publish
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus([...selected], "unpublished", "Unpublished")}>
            <EyeOff aria-hidden /> Unpublish
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setPending({ kind: "archive", ids: [...selected] })}>
            <Archive aria-hidden /> Archive
          </Button>
          {canDelete ? (
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => setPending({ kind: "delete", ids: [...selected] })}>
              <Trash2 aria-hidden /> Delete
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      <TableScroll>
        <Table>
          <TableHeader>
            <TableRow>
              {canWrite ? (
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={(checked) => setSelected(checked ? new Set(rows.map((r) => r.id)) : new Set())} aria-label="Select all products on this page" />
                </TableHead>
              ) : null}
              <TableHead className="w-14">Image</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Original</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const status = PRODUCT_STATUS_BADGE[row.status];
              const stock = STOCK_BADGE[row.stockState];
              return (
                <TableRow key={row.id} data-state={selected.has(row.id) ? "selected" : undefined}>
                  {canWrite ? (
                    <TableCell>
                      <Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggle(row.id)} aria-label={`Select ${row.name}`} />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <div className="relative size-10 overflow-hidden rounded-md border bg-muted">
                      {row.imageSrc ? (
                        <Image src={row.imageSrc} alt="" fill unoptimized sizes="40px" className="object-cover" />
                      ) : (
                        <ImageOff className="m-2.5 size-5 text-muted-foreground" aria-hidden />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-64">
                    <Link href={`/admin/products/${row.id}`} className="block truncate font-semibold text-ink hover:text-primary hover:underline">
                      {row.name}
                    </Link>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {row.isFeatured ? <Star className="size-3 fill-brand-yellow text-brand-yellow" aria-label="Featured" /> : null}
                      <span className="truncate font-mono">{row.id}</span>
                      {row.isDemo ? <AdminBadge tone="neutral">Demo</AdminBadge> : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.sku ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{row.categoryName ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatINR(row.pricePaise)}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{row.compareAtPricePaise ? formatINR(row.compareAtPricePaise) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <span className="block font-semibold tabular-nums">{row.available}</span>
                    <AdminBadge tone={stock.tone}>{stock.label}</AdminBadge>
                  </TableCell>
                  <TableCell>
                    <AdminBadge tone={status.tone}>{status.label}</AdminBadge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.name}`} />}>
                        <MoreHorizontal aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem render={<Link href={`/admin/products/${row.id}`} />}>
                          <Pencil className="size-4" aria-hidden /> {canWrite ? "Edit" : "View"}
                        </DropdownMenuItem>
                        {canWrite ? (
                          <>
                            {row.status === "published" ? (
                              <DropdownMenuItem onClick={() => setStatus([row.id], "unpublished", "Unpublished")}>
                                <EyeOff className="size-4" aria-hidden /> Unpublish
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => setStatus([row.id], "published", "Published")}>
                                <Eye className="size-4" aria-hidden /> Publish
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => run(() => adminCall("products.setFeatured", { id: row.id, featured: !row.isFeatured }), { success: row.isFeatured ? "Removed from featured" : "Marked as featured" })}>
                              <Star className="size-4" aria-hidden /> {row.isFeatured ? "Remove featured" : "Mark featured"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                const copy = await run(() => adminCall<{ id: string }>("products.duplicate", { id: row.id }), { success: "Duplicated as an unpublished draft", refresh: false });
                                if (copy) router.push(`/admin/products/${copy.id}`);
                              }}
                            >
                              <Copy className="size-4" aria-hidden /> Duplicate
                            </DropdownMenuItem>
                            {row.status !== "archived" ? (
                              <DropdownMenuItem onClick={() => setPending({ kind: "archive", ids: [row.id] })}>
                                <Archive className="size-4" aria-hidden /> Archive
                              </DropdownMenuItem>
                            ) : null}
                          </>
                        ) : null}
                        {canDelete ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-danger" onClick={() => setPending({ kind: "delete", ids: [row.id] })}>
                              <Trash2 className="size-4" aria-hidden /> Delete
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableScroll>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        destructive
        title={pending?.kind === "delete" ? `Delete ${pending.ids.length} product${pending.ids.length === 1 ? "" : "s"}?` : `Archive ${pending?.ids.length ?? 0} product${pending?.ids.length === 1 ? "" : "s"}?`}
        description={
          pending?.kind === "delete"
            ? "This can't be undone. Products that appear in past orders can't be deleted; archive them instead."
            : "Archived products disappear from the storefront but stay in past orders. You can restore them later."
        }
        confirmLabel={pending?.kind === "delete" ? "Delete" : "Archive"}
        onConfirm={async () => {
          if (!pending) return;
          if (pending.kind === "archive") {
            await adminCall("products.setStatus", { ids: pending.ids, status: "archived" });
          } else {
            await adminCall("products.delete", { ids: pending.ids });
          }
          setSelected(new Set());
          router.refresh();
        }}
      />
    </>
  );
}
