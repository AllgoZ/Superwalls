"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, Copy, ExternalLink, Eye, EyeOff, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminCall } from "@/lib/admin/client";
import { PermissionGuard } from "./admin-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { useAdminAction } from "./use-admin-action";

export function ProductActions({ id, status, featured }: { id: string; status: "published" | "unpublished" | "archived"; featured: boolean }) {
  const { run, busy, router } = useAdminAction();
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);

  return (
    <>
      <PermissionGuard permission="catalog.write">
        {status === "published" ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => adminCall("products.setStatus", { ids: [id], status: "unpublished" }), { success: "Unpublished" })}>
            <EyeOff aria-hidden /> Unpublish
          </Button>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => run(() => adminCall("products.setStatus", { ids: [id], status: "published" }), { success: status === "archived" ? "Restored and published" : "Published" })}>
            <Eye aria-hidden /> {status === "archived" ? "Restore & publish" : "Publish"}
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => adminCall("products.setFeatured", { id, featured: !featured }), { success: featured ? "Removed from featured" : "Marked as featured" })}>
          <Star className={featured ? "fill-brand-yellow text-brand-yellow" : undefined} aria-hidden /> {featured ? "Featured" : "Feature"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            const copy = await run(() => adminCall<{ id: string }>("products.duplicate", { id }), { success: "Duplicated as an unpublished draft", refresh: false });
            if (copy) router.push(`/admin/products/${copy.id}`);
          }}
        >
          <Copy aria-hidden /> Duplicate
        </Button>
        {status !== "archived" ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm("archive")}>
            <Archive aria-hidden /> Archive
          </Button>
        ) : null}
      </PermissionGuard>
      <PermissionGuard permission="catalog.delete">
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirm("delete")}>
          <Trash2 aria-hidden /> Delete
        </Button>
      </PermissionGuard>
      {status === "published" ? (
        <Link href={`/products/${id}`} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-muted">
          <ExternalLink className="size-4" aria-hidden /> View on store
        </Link>
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        destructive
        title={confirm === "delete" ? "Delete this product?" : "Archive this product?"}
        description={
          confirm === "delete"
            ? "This can't be undone. If the product appears in any past order it can't be deleted; archive it instead."
            : "It will disappear from the storefront but stay in past orders. You can restore it later."
        }
        confirmLabel={confirm === "delete" ? "Delete" : "Archive"}
        onConfirm={async () => {
          if (confirm === "delete") {
            await adminCall("products.delete", { ids: [id] });
            router.push("/admin/products");
          } else {
            await adminCall("products.setStatus", { ids: [id], status: "archived" });
          }
          router.refresh();
        }}
      />
    </>
  );
}
