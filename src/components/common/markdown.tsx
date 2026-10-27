import Link from "next/link";
import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";

/**
 * Renders CMS-authored Markdown safely. It never injects raw HTML: `skipHtml` drops any HTML in the source,
 * react-markdown's default URL filter removes `javascript:` and similar links, and images are not rendered at all
 * (imagery comes from banners; this also rules out tracking pixels). Output is React elements, not an HTML string.
 */
function SafeLink({ href, children }: ComponentProps<"a">) {
  if (!href) return <>{children}</>;
  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} className="font-semibold text-brand-blue underline-offset-2 hover:underline">
        {children}
      </Link>
    );
  }
  if (/^https:\/\//i.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-brand-blue underline-offset-2 hover:underline">
        {children}
      </a>
    );
  }
  if (/^(mailto|tel):/i.test(href)) {
    return (
      <a href={href} className="font-semibold text-brand-blue underline-offset-2 hover:underline">
        {children}
      </a>
    );
  }
  return <>{children}</>;
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
      <ReactMarkdown
        skipHtml
        components={{
          a: SafeLink,
          img: () => null,
          h1: ({ children: c }) => <h2 className="pt-2 text-xl font-extrabold text-ink">{c}</h2>,
          h2: ({ children: c }) => <h2 className="pt-2 text-lg font-bold text-ink">{c}</h2>,
          h3: ({ children: c }) => <h3 className="pt-1 text-base font-bold text-ink">{c}</h3>,
          ul: ({ children: c }) => <ul className="list-disc space-y-1 pl-5">{c}</ul>,
          ol: ({ children: c }) => <ol className="list-decimal space-y-1 pl-5">{c}</ol>,
          blockquote: ({ children: c }) => <blockquote className="border-l-4 border-brand-yellow pl-3 italic">{c}</blockquote>,
          code: ({ children: c }) => <code className="rounded bg-soft px-1 py-0.5 text-[0.85em] text-ink">{c}</code>,
          hr: () => <hr className="my-4" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
