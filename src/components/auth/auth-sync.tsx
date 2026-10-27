"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { claimGuestOrders } from "@/lib/services/checkout";
import { emitDataChange } from "@/lib/services/events";

/**
 * Keeps the UI in step with Supabase Auth and, once per sign-in, asks the server to attach this customer's
 * earlier guest orders to their account (the server decides what is eligible; see claim_guest_orders).
 */
export function AuthSync() {
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;

    const { data } = client.auth.onAuthStateChange((event, session) => {
      emitDataChange();
      const userId = session?.user.id;
      if (!userId || (event !== "SIGNED_IN" && event !== "INITIAL_SESSION")) return;
      // Defer: calling Supabase from inside this callback can deadlock the auth lock.
      setTimeout(() => {
        claimGuestOrders(userId).then((count) => {
          if (count > 0) {
            toast.success(count === 1 ? "We added your earlier order to your account." : `We added ${count} earlier orders to your account.`);
          }
        });
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return null;
}
