import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ServiceError } from "../errors";

export function requireClient(): SupabaseClient {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new ServiceError("BACKEND_NOT_CONFIGURED", "The store backend isn't connected yet.");
  }
  return client;
}

/** The signed-in user's id, or null. Reads the locally stored session (no network round trip). */
export async function currentUserId(client: SupabaseClient = requireClient()): Promise<string | null> {
  const { data } = await client.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) throw new ServiceError("UNAUTHENTICATED", "Please sign in to continue.");
  return id;
}
