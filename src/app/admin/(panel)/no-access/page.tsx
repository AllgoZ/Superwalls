import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "No access" };

export default function NoAccessPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border bg-white px-6 py-14 text-center">
      <ShieldAlert className="size-10 text-brand-yellow" aria-hidden />
      <h1 className="text-xl font-extrabold text-ink">You don&apos;t have access to this area</h1>
      <p className="text-sm text-muted-foreground">
        Your role doesn&apos;t include this section. If you need it, ask a super admin to change your role.
      </p>
      <Link href="/admin" className={buttonVariants({ size: "sm" })}>
        Back to dashboard
      </Link>
    </div>
  );
}
