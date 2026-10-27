import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAttention } from "@/lib/server/admin/queries/attention";
import { requireAdmin, toSummary } from "@/lib/server/admin/session";

/** Reads the session cookie, so it must stream behind Suspense (Cache Components). */
async function PanelGate({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const attention = await getAttention(admin).catch(() => []);
  return (
    <AdminShell admin={toSummary(admin)} attention={attention}>
      {children}
    </AdminShell>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-screen" aria-busy="true">
      <div className="hidden w-64 shrink-0 border-r bg-white lg:block" />
      <div className="flex-1">
        <div className="h-14 border-b bg-white" />
      </div>
    </div>
  );
}

export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <PanelGate>{children}</PanelGate>
    </Suspense>
  );
}
