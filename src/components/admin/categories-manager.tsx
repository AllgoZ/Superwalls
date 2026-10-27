"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { ImageOff, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { adminCall } from "@/lib/admin/client";
import { categorySchema } from "@/lib/admin/schemas/catalog";
import { slugify } from "@/lib/admin/slug";
import type { AdminCategory } from "@/lib/server/admin/queries/products";
import { useCan } from "./admin-provider";
import { AdminBadge } from "./admin-badge";
import { ConfirmDialog } from "./confirm-dialog";
import { ImageUploader } from "./image-uploader";
import { EmptyRows, TableCard, TableScroll } from "./table-card";
import { useAdminAction } from "./use-admin-action";

interface Draft {
  id?: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  sortOrder: string;
  isActive: boolean;
}

const BLANK: Draft = { name: "", slug: "", description: "", imageUrl: null, sortOrder: "0", isActive: true };

export function CategoriesManager({ categories }: { categories: AdminCategory[] }) {
  const canWrite = useCan("catalog.write");
  const canDelete = useCan("catalog.delete");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AdminCategory | null>(null);
  const { run, busy, router } = useAdminAction();

  function open(next: Draft) {
    setDraft(next);
    setSlugTouched(Boolean(next.id));
    setError(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const parsed = categorySchema.safeParse({ ...draft, sortOrder: Number(draft.sortOrder) });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    const ok = await run(() => adminCall("categories.save", parsed.data), { success: draft.id ? "Category saved" : "Category created" });
    if (ok) setDraft(null);
  }

  return (
    <>
      {canWrite ? (
        <div className="mb-4 flex justify-end">
          <Button size="sm" onClick={() => open({ ...BLANK, sortOrder: String((categories.at(-1)?.sortOrder ?? 0) + 10) })}>
            <Plus aria-hidden /> Add category
          </Button>
        </div>
      ) : null}
      <TableCard>
        {categories.length === 0 ? (
          <EmptyRows title="No categories yet" description="Categories group products on the storefront. A small catalog may only need a few." />
        ) : (
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="text-right">Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="relative size-10 overflow-hidden rounded-md border bg-muted">
                        {category.imageUrl ? <Image src={category.imageUrl} alt="" fill unoptimized sizes="40px" className="object-cover" /> : <ImageOff className="m-2.5 size-5 text-muted-foreground" aria-hidden />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-ink">{category.name}</span>
                      {category.description ? <span className="block max-w-72 truncate text-xs text-muted-foreground">{category.description}</span> : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{category.slug}</TableCell>
                    <TableCell className="text-right tabular-nums">{category.productCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{category.sortOrder}</TableCell>
                    <TableCell>
                      <AdminBadge tone={category.isActive ? "success" : "neutral"}>{category.isActive ? "Active" : "Inactive"}</AdminBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        {canWrite ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${category.name}`}
                            onClick={() =>
                              open({ id: category.id, name: category.name, slug: category.slug, description: category.description, imageUrl: category.imageUrl, sortOrder: String(category.sortOrder), isActive: category.isActive })
                            }
                          >
                            <Pencil aria-hidden />
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button variant="ghost" size="icon-sm" className="text-danger" aria-label={`Delete ${category.name}`} onClick={() => setRemoving(category)}>
                            <Trash2 aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        )}
      </TableCard>

      <Dialog open={draft !== null} onOpenChange={(next) => !next && !busy && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit category" : "Add category"}</DialogTitle>
            <DialogDescription>Categories appear as filters on the storefront.</DialogDescription>
          </DialogHeader>
          {draft ? (
            <form onSubmit={save} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="cat-name" className="text-xs font-semibold">Name</Label>
                <Input
                  id="cat-name"
                  value={draft.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setDraft({ ...draft, name, slug: slugTouched ? draft.slug : slugify(name) });
                  }}
                  className="h-10 text-sm"
                  maxLength={60}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-slug" className="text-xs font-semibold">Slug</Label>
                <Input
                  id="cat-slug"
                  value={draft.slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setDraft({ ...draft, slug: event.target.value.toLowerCase() });
                  }}
                  className="h-10 font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-desc" className="text-xs font-semibold">Description</Label>
                <Textarea id="cat-desc" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} className="text-sm" maxLength={500} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Image</Label>
                <ImageUploader single folder="categories" label="Category image" images={draft.imageUrl ? [{ src: draft.imageUrl, alt: "" }] : []} onChange={(images) => setDraft({ ...draft, imageUrl: images[0]?.src ?? null })} />
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cat-order" className="text-xs font-semibold">Display order</Label>
                  <Input id="cat-order" inputMode="numeric" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} className="h-10 w-28 text-sm" />
                </div>
                <label className="flex items-center gap-2 pb-2 text-sm font-semibold">
                  Active
                  <Switch checked={draft.isActive} onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })} aria-label="Active" />
                </label>
              </div>
              {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
              <DialogFooter>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={busy}>Cancel</Button>
                <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Save category"}</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        destructive
        title={`Delete "${removing?.name}"?`}
        description={removing && removing.productCount > 0 ? `${removing.productCount} product(s) still use this category. Move them to another category first.` : "This can't be undone."}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!removing) return;
          await adminCall("categories.delete", { id: removing.id });
          router.refresh();
        }}
      />
    </>
  );
}
