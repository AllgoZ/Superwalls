import type { PublicPage } from "@/lib/server/content";
import { Markdown } from "./markdown";

/** A published CMS page, laid out like the other content pages. */
export function CmsPageView({ page }: { page: PublicPage }) {
  return (
    <article className="mx-auto max-w-2xl space-y-4 px-4 py-5 sm:px-6 md:pt-8">
      <h1 className="text-2xl font-extrabold text-ink">{page.title}</h1>
      <Markdown>{page.contentMd}</Markdown>
    </article>
  );
}
