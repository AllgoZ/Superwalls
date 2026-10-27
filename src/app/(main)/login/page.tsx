import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/common/states";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-md px-4 py-5 sm:px-6 md:pt-8">
      <h1 className="mb-1 text-2xl font-extrabold text-ink">Log in</h1>
      <p className="mb-5 text-sm text-muted-foreground">See your orders and use your saved details at checkout.</p>
      <Suspense fallback={<ListSkeleton rows={2} />}>
        {searchParams.then(({ next, verified }) => (
          <LoginForm next={typeof next === "string" ? next : undefined} justVerified={verified === "1"} />
        ))}
      </Suspense>
    </div>
  );
}
