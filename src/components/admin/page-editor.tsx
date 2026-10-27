"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ExternalLink, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminCall } from "@/lib/admin/client";
import { PAGE_META, pageSchema, type PageSlug } from "@/lib/admin/schemas/content";
import { useCan } from "./admin-provider";
import { MarkdownEditor } from "./markdown-editor";
import { SectionCard } from "./table-card";
import { useAdminAction } from "./use-admin-action";

export function PageEditor({
  slug,
  initial,
  published,
}: {
  slug: PageSlug;
  initial: { title: string; contentMd: string; seoTitle: string; seoDescription: string };
  published: boolean;
}) {
  const canWrite = useCan("content.write");
  const meta = PAGE_META[slug];
  const [title, setTitle] = useState(initial.title || meta.label);
  const [content, setContent] = useState(initial.contentMd);
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle);
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription);
  const [error, setError] = useState<string | null>(null);
  const { run, busy } = useAdminAction();

  async function save(status: "draft" | "published", event?: FormEvent) {
    event?.preventDefault();
    const parsed = pageSchema.safeParse({ slug, title, contentMd: content, seoTitle, seoDescription, status });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    if (status === "published" && !content.trim()) {
      setError("A published page needs some content.");
      return;
    }
    setError(null);
    await run(() => adminCall("pages.save", parsed.data), { success: status === "published" ? "Page published" : "Draft saved" });
  }

  return (
    <form onSubmit={(event) => save(published ? "published" : "draft", event)} className="space-y-5" noValidate>
      <fieldset disabled={!canWrite || busy} className="contents">
        <SectionCard title="Content">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pg-title" className="text-xs font-semibold">Page title</Label>
              <Input id="pg-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className="h-10 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pg-content" className="text-xs font-semibold">Page content (Markdown)</Label>
              <MarkdownEditor id="pg-content" value={content} onChange={setContent} disabled={!canWrite || busy} />
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Search engine listing" description="Optional. Falls back to the page title.">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pg-seo-title" className="text-xs font-semibold">SEO title</Label>
              <Input id="pg-seo-title" value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} maxLength={120} className="h-10 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pg-seo-desc" className="text-xs font-semibold">SEO description</Label>
              <Textarea id="pg-seo-desc" value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} rows={2} maxLength={320} className="text-sm" />
            </div>
          </div>
        </SectionCard>
      </fieldset>

      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => save("draft")}>
            <Save aria-hidden /> Save as draft
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => save("published")}>
            {published ? "Save & keep published" : "Publish"}
          </Button>
          {published ? (
            <>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => run(() => adminCall("pages.unpublish", { slug }), { success: "Page unpublished" })}>
                Unpublish
              </Button>
              <Link href={meta.path} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-muted">
                <ExternalLink className="size-4" aria-hidden /> View on store
              </Link>
            </>
          ) : null}
        </div>
      ) : (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">You have read-only access to pages.</p>
      )}
    </form>
  );
}
