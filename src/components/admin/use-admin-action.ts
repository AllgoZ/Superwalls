"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/admin/client";

/** Runs an admin mutation with a busy flag, success/error toasts and a server-data refresh afterwards. */
export function useAdminAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run<T>(action: () => Promise<T>, options: { success?: string; refresh?: boolean } = {}): Promise<T | undefined> {
    setBusy(true);
    try {
      const result = await action();
      if (options.success) toast.success(options.success);
      if (options.refresh !== false) router.refresh();
      return result;
    } catch (error) {
      toast.error(errorMessage(error));
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  return { run, busy, router };
}
