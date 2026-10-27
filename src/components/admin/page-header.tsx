import type { ReactNode } from "react";

/** Title row used at the top of every admin page. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3 print:mb-3">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold text-ink sm:text-2xl">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div> : null}
    </div>
  );
}
