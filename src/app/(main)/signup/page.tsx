import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/common/states";
import { SignUpForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage({ searchParams }: PageProps<"/signup">) {
  return (
    <div className="mx-auto max-w-md px-4 py-5 sm:px-6 md:pt-8">
      <h1 className="mb-1 text-2xl font-extrabold text-ink">Create an account</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Optional. You can always check out as a guest. An account gives you order history and saved addresses.
      </p>
      <Suspense fallback={<ListSkeleton rows={2} />}>
        {searchParams.then(({ next }) => (
          <SignUpForm next={typeof next === "string" ? next : undefined} />
        ))}
      </Suspense>
    </div>
  );
}
