import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Server-rendered pager that preserves the other filters in the URL. */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  function href(target: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      const single = Array.isArray(value) ? value[0] : value;
      if (single && key !== "page") params.set(key, single);
    }
    if (target > 1) params.set("page", String(target));
    const text = params.toString();
    return text ? `${basePath}?${text}` : basePath;
  }

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm print:hidden">
      <p className="text-muted-foreground">{total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`}</p>
      <div className="flex items-center gap-1">
        <Link
          href={href(page - 1)}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")}
        >
          <ChevronLeft aria-hidden /> Prev
        </Link>
        <span className="px-2 text-muted-foreground">
          Page {page} of {pages}
        </span>
        <Link
          href={href(page + 1)}
          aria-disabled={page >= pages}
          tabIndex={page >= pages ? -1 : undefined}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= pages && "pointer-events-none opacity-50")}
        >
          Next <ChevronRight aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
