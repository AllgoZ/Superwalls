import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseEnv } from "@/lib/config/env";

let browserClient: SupabaseClient | null = null;

/**
 * Lazily creates the browser Supabase client with the public anon key.
 * Returns null when the env vars are missing, so the app keeps running in demo mode.
 *
 * Never put a service-role key in a NEXT_PUBLIC_ variable or in client code.
 * Privileged operations belong in a server-side route handler or database function.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  browserClient ??= createClient(supabaseEnv.url, supabaseEnv.anonKey);
  return browserClient;
}
