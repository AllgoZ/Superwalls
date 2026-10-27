import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/login-form";
import { LogoFull } from "@/components/brand/logo";
import { safeAdminNext } from "@/lib/admin/cookies";
import { getAdminContext } from "@/lib/server/admin/session";

export const metadata = { title: "Sign in" };

async function LoginContent({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  const { next } = await searchParams;
  const target = safeAdminNext(typeof next === "string" ? next : null);
  // Already signed in as staff: skip the form.
  if (await getAdminContext()) redirect(target);
  return <AdminLoginForm next={target} />;
}

export default function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main id="main" className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <LogoFull className="h-28" />
          <h1 className="text-xl font-extrabold text-ink">Admin sign in</h1>
          <p className="text-sm text-muted-foreground">Staff only. Customer accounts can&apos;t sign in here.</p>
        </div>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white" />}>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
