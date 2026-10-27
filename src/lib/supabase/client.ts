import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseEnv } from "@/lib/config/env";

let browserClient: SupabaseClient | null = null;

/**
 * Lazily creates the browser Supabase client with the public publishable key. Everything it can read or
 * write is limited by Row Level Security. Returns null when the env vars are missing.
 *
 * Never put a service-role key or a database URL in client code. Privileged operations (creating orders,
 * taking payments, changing stock) run in server route handlers only.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  browserClient ??= createClient(supabaseEnv.url, supabaseEnv.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return browserClient;
}
