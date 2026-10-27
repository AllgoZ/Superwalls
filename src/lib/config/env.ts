/**
 * Public Supabase settings (safe for the browser). Supabase counts as configured when both are present.
 * The key is the *publishable* (formerly "anon") key: it can only do what Row Level Security allows.
 * Never put a service-role key or database URL in a NEXT_PUBLIC_ variable; those stay server-side.
 *
 * Without these the storefront still browses the demo catalog, but accounts, orders and checkout
 * are unavailable (they need the backend).
 */
export const supabaseEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  publishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
} as const;

export const isSupabaseConfigured = Boolean(supabaseEnv.url && supabaseEnv.publishableKey);
