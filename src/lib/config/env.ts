/**
 * Demo vs production mode.
 *
 * Supabase counts as configured only when both public env vars are present.
 * Even then, the repositories in `services/repositories.ts` keep using the
 * mock implementations until Supabase-backed ones are written; `dataSource`
 * (see `services/repositories.ts`) reports what is actually in use, so the UI
 * never claims a connection that does not exist.
 */
export const supabaseEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
} as const;

export const isSupabaseConfigured = Boolean(supabaseEnv.url && supabaseEnv.anonKey);
