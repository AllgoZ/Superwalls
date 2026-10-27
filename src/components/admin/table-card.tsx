import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** White card that holds a table and its filters. */
export function TableCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-xl border bg-white shadow-xs print:border-0 print:shadow-none", className)}>{children}</div>;
}

export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function EmptyRows({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-14 text-center">
      <p className="text-base font-bold text-ink">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-white shadow-xs print:shadow-none", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
