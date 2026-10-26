import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsGroup({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id?: string;
}) {
  const headingId = `${id ?? title.toLowerCase().replace(/\W+/g, "-")}-heading`;
  return (
    <section aria-labelledby={headingId} id={id} className="scroll-mt-header">
      <h2 id={headingId} className="mb-2 px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        {title}
      </h2>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-white">{children}</ul>
    </section>
  );
}

const rowClass = "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left";

function RowContent({
  icon: Icon,
  label,
  detail,
  trailing,
}: {
  icon: LucideIcon;
  label: string;
  detail?: string;
  trailing?: ReactNode;
}) {
  return (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-blue-soft text-brand-blue">
        <Icon className="size-[1.125rem]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {detail ? <span className="block truncate text-xs text-muted-foreground">{detail}</span> : null}
      </span>
      {trailing}
    </>
  );
}

export function SettingsLink({
  href,
  ...content
}: { href: string; icon: LucideIcon; label: string; detail?: string }) {
  return (
    <li>
      <Link href={href} className={cn(rowClass, "transition-colors hover:bg-soft")}>
        <RowContent {...content} trailing={<ChevronRight className="size-4 text-muted-foreground" aria-hidden />} />
      </Link>
    </li>
  );
}

export function SettingsButton({
  onClick,
  ...content
}: { onClick: () => void; icon: LucideIcon; label: string; detail?: string }) {
  return (
    <li>
      <button type="button" onClick={onClick} className={cn(rowClass, "transition-colors hover:bg-soft")}>
        <RowContent {...content} trailing={<ChevronRight className="size-4 text-muted-foreground" aria-hidden />} />
      </button>
    </li>
  );
}

/** Non-interactive row (version, placeholders). */
export function SettingsInfo({
  trailing,
  ...content
}: { icon: LucideIcon; label: string; detail?: string; trailing?: ReactNode }) {
  return (
    <li className={rowClass}>
      <RowContent {...content} trailing={trailing} />
    </li>
  );
}
