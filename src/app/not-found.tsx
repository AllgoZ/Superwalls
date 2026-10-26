import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={<SearchX />}
          title="We couldn't find that page"
          description="The page or product you're looking for doesn't exist or may have moved."
          action={
            <Link href="/" className={buttonVariants({ size: "lg" })}>
              Back to shopping
            </Link>
          }
        />
      </main>
    </>
  );
}
