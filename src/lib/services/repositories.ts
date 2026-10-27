import { isSupabaseConfigured } from "@/lib/config/env";
import type { Repositories } from "./contracts";
import { mockProducts } from "./mock/products";
import { supabaseAddresses, supabaseProfile } from "./supabase/account";
import { supabaseAuth } from "./supabase/auth";
import { supabaseOrders } from "./supabase/orders";
import { supabaseProducts } from "./supabase/products";
import { unavailableAddresses, unavailableAuth, unavailableOrders, unavailableProfile } from "./unavailable";

/**
 * The one place that decides which backend the app talks to.
 *
 * With Supabase configured, products / profile / addresses / orders come from Postgres through Row Level
 * Security. Without it, only the demo catalog works; there is no fake account or order store.
 */
const supabaseRepositories: Repositories = {
  products: supabaseProducts,
  orders: supabaseOrders,
  profile: supabaseProfile,
  addresses: supabaseAddresses,
  auth: supabaseAuth,
};

const offlineRepositories: Repositories = {
  products: mockProducts,
  orders: unavailableOrders,
  profile: unavailableProfile,
  addresses: unavailableAddresses,
  auth: unavailableAuth,
};

export const repositories: Repositories = isSupabaseConfigured ? supabaseRepositories : offlineRepositories;

export const dataSource = {
  mode: (isSupabaseConfigured ? "supabase" : "offline") as "supabase" | "offline",
};
