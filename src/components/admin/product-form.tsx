"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { adminCall } from "@/lib/admin/client";
import { parseRupees } from "@/lib/admin/money";
import { productCreateSchema, productUpdateSchema } from "@/lib/admin/schemas/catalog";
import { slugify } from "@/lib/admin/slug";
import type { ProductFormValues } from "@/lib/admin/product-values";
import { ImageUploader } from "./image-uploader";
import { SimpleSelect } from "./simple-select";
import { SectionCard } from "./table-card";
import { useAdminAction } from "./use-admin-action";

function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor?: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold">
        {label}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function ProductForm({
  mode,
  initial,
  categories,
  canWrite,
}: {
  mode: "create" | "edit";
  initial: ProductFormValues;
  categories: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const [values, setValues] = useState<ProductFormValues>(initial);
  const [slug, setSlug] = useState(initial.id ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [initialStock, setInitialStock] = useState("0");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy, router } = useAdminAction();

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  function onName(name: string) {
    set("name", name);
    if (mode === "create" && !slugTouched) setSlug(slugify(name));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const price = parseRupees(values.price);
    const compareAt = values.compareAt.trim() ? parseRupees(values.compareAt) : null;
    const found: Record<string, string> = {};
    if (price === null) found.pricePaise = "Enter a valid price, like 199 or 199.50.";
    if (values.compareAt.trim() && compareAt === null) found.compareAtPricePaise = "Enter a valid price, like 249 or 249.50.";
    const stockNumber = Number(initialStock);
    if (mode === "create" && (!Number.isInteger(stockNumber) || stockNumber < 0)) found.initialStock = "Enter a whole number, 0 or more.";
    const threshold = Number(values.lowStockThreshold);
    if (!Number.isInteger(threshold) || threshold < 0) found.lowStockThreshold = "Enter a whole number, 0 or more.";

    const payload = {
      name: values.name,
      sku: values.sku || null,
      tagline: values.tagline,
      description: values.description,
      unit: values.unit,
      categoryId: values.categoryId,
      pricePaise: price ?? 0,
      compareAtPricePaise: compareAt,
      images: values.images,
      lowStockThreshold: threshold,
      isActive: values.isActive,
      isFeatured: values.isFeatured,
      seoTitle: values.seoTitle,
      seoDescription: values.seoDescription,
    };
    const parsed =
      mode === "create"
        ? productCreateSchema.safeParse({ ...payload, slug, initialStock: stockNumber })
        : productUpdateSchema.safeParse({ ...payload, id: values.id });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!found[key]) found[key] = issue.message;
      }
    }
    setErrors(found);
    if (Object.keys(found).length > 0 || !parsed.success) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const result = await run(
      () => adminCall<{ id: string }>(mode === "create" ? "products.create" : "products.update", parsed.data),
      { success: mode === "create" ? "Product created" : "Product saved", refresh: mode === "edit" },
    );
    if (result && mode === "create") router.push(`/admin/products/${result.id}`);
  }

  const readOnly = !canWrite;

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <fieldset disabled={readOnly || busy} className="contents">
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-5">
            <SectionCard title="Basics">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Product name" htmlFor="name" error={errors.name}>
                    <Input id="name" value={values.name} onChange={(event) => onName(event.target.value)} className="h-10 text-sm" maxLength={120} />
                  </Field>
                </div>
                <Field
                  label="URL slug"
                  htmlFor="slug"
                  error={errors.slug}
                  hint={mode === "create" ? "Becomes the product link. It can't be changed after saving." : "Permanent: carts, orders and links depend on it."}
                >
                  <Input
                    id="slug"
                    value={mode === "create" ? slug : (values.id ?? "")}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setSlug(event.target.value.toLowerCase());
                    }}
                    readOnly={mode === "edit"}
                    className="h-10 font-mono text-sm"
                  />
                </Field>
                <Field label="SKU" htmlFor="sku" error={errors.sku} hint="Optional. Must be unique.">
                  <Input id="sku" value={values.sku} onChange={(event) => set("sku", event.target.value)} className="h-10 text-sm" maxLength={40} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Short description" htmlFor="tagline" error={errors.tagline} hint="One line shown on product cards.">
                    <Input id="tagline" value={values.tagline} onChange={(event) => set("tagline", event.target.value)} className="h-10 text-sm" maxLength={160} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Full description" htmlFor="description" error={errors.description}>
                    <Textarea id="description" value={values.description} onChange={(event) => set("description", event.target.value)} rows={6} className="text-sm" maxLength={5000} />
                  </Field>
                </div>
                <Field label="Pack size / unit" htmlFor="unit" error={errors.unit} hint='For example "1 L" or "500 g".'>
                  <Input id="unit" value={values.unit} onChange={(event) => set("unit", event.target.value)} className="h-10 text-sm" maxLength={40} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Images" description="The first image is the primary one shown on cards and at the top of the product page.">
              <ImageUploader images={values.images} onChange={(images) => set("images", images)} folder="products" />
              {errors.images ? <p className="mt-2 text-xs font-medium text-danger">{errors.images}</p> : null}
            </SectionCard>

            <SectionCard title="Search engine listing" description="Optional. Falls back to the product name and short description.">
              <div className="grid gap-4">
                <Field label="SEO title" htmlFor="seoTitle" error={errors.seoTitle}>
                  <Input id="seoTitle" value={values.seoTitle} onChange={(event) => set("seoTitle", event.target.value)} className="h-10 text-sm" maxLength={120} />
                </Field>
                <Field label="SEO description" htmlFor="seoDescription" error={errors.seoDescription}>
                  <Textarea id="seoDescription" value={values.seoDescription} onChange={(event) => set("seoDescription", event.target.value)} rows={3} className="text-sm" maxLength={320} />
                </Field>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-5">
            <SectionCard title="Pricing">
              <div className="grid gap-4">
                <Field label="Selling price (₹)" htmlFor="price" error={errors.pricePaise} hint="Stored exactly, in paise.">
                  <Input id="price" inputMode="decimal" value={values.price} onChange={(event) => set("price", event.target.value)} className="h-10 text-sm" placeholder="199.00" />
                </Field>
                <Field label="Original price (₹)" htmlFor="compareAt" error={errors.compareAtPricePaise} hint="Optional. Shown struck through when higher than the selling price.">
                  <Input id="compareAt" inputMode="decimal" value={values.compareAt} onChange={(event) => set("compareAt", event.target.value)} className="h-10 text-sm" placeholder="249.00" />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Inventory">
              <div className="grid gap-4">
                {mode === "create" ? (
                  <Field label="Opening stock" htmlFor="initialStock" error={errors.initialStock} hint="Later changes are made under Inventory so every movement is recorded.">
                    <Input id="initialStock" inputMode="numeric" value={initialStock} onChange={(event) => setInitialStock(event.target.value)} className="h-10 text-sm" />
                  </Field>
                ) : (
                  <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                    <span className="font-semibold text-ink">{values.stock ?? 0}</span> on hand, <span className="font-semibold text-ink">{values.reserved ?? 0}</span> reserved.{" "}
                    <Link href={`/admin/inventory?q=${encodeURIComponent(values.id ?? "")}`} className="font-semibold text-primary hover:underline">
                      Adjust stock
                    </Link>
                  </p>
                )}
                <Field label="Low-stock alert at" htmlFor="lowStockThreshold" error={errors.lowStockThreshold} hint="Flag this product when available units fall to this number.">
                  <Input id="lowStockThreshold" inputMode="numeric" value={values.lowStockThreshold} onChange={(event) => set("lowStockThreshold", event.target.value)} className="h-10 text-sm" />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Organisation">
              <div className="grid gap-4">
                <Field label="Category" htmlFor="category">
                  <SimpleSelect
                    id="category"
                    value={values.categoryId ?? "none"}
                    onValueChange={(value) => set("categoryId", value === "none" ? null : value)}
                    options={[{ value: "none", label: "No category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                    className="h-10"
                  />
                </Field>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="block font-semibold text-ink">Published</span>
                    <span className="block text-xs text-muted-foreground">Visible and purchasable on the storefront.</span>
                  </span>
                  <Switch checked={values.isActive} onCheckedChange={(checked) => set("isActive", checked)} aria-label="Published" />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="block font-semibold text-ink">Featured</span>
                    <span className="block text-xs text-muted-foreground">Highlight on the homepage.</span>
                  </span>
                  <Switch checked={values.isFeatured} onCheckedChange={(checked) => set("isFeatured", checked)} aria-label="Featured" />
                </label>
              </div>
            </SectionCard>
          </div>
        </div>
      </fieldset>

      {canWrite ? (
        <div className="sticky bottom-0 z-10 -mx-3 flex items-center justify-end gap-2 border-t bg-white/95 px-3 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <Link href="/admin/products" className="text-sm font-semibold text-muted-foreground hover:text-ink">
            Cancel
          </Link>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            {mode === "create" ? "Create product" : "Save changes"}
          </Button>
        </div>
      ) : (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">You have read-only access to products.</p>
      )}
    </form>
  );
}
