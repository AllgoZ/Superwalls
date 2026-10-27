import type { Metadata } from "next";
import { Suspense } from "react";
import { SandboxPay } from "@/components/checkout/sandbox-pay";

export const metadata: Metadata = { title: "Test payment", robots: { index: false } };

/** DEV ONLY test gateway page. The API behind it returns 404 unless the sandbox gateway is enabled outside production. */
export default function SandboxPayPage({ searchParams }: PageProps<"/pay/sandbox">) {
  return (
    <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <Suspense fallback={null}>
        {searchParams.then(({ o }) => (
          <SandboxPay providerOrderId={typeof o === "string" ? o : ""} />
        ))}
      </Suspense>
    </main>
  );
}
