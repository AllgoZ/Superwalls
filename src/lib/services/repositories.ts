import { isSupabaseConfigured } from "@/lib/config/env";
import type { Repositories } from "./contracts";
import { mockAddresses, mockAuth, mockProfile } from "./mock/account";
import { mockOrders } from "./mock/orders";
import { mockProducts } from "./mock/products";

/**
 * The one place that decides which backend the app talks to.
 *
 * TODO(supabase): once Supabase-backed repositories exist, return them here
 * when `isSupabaseConfigured` is true. Until then the app always runs on demo
 * data, and `dataSource` says so.
 */
const mockRepositories: Repositories = {
  products: mockProducts,
  orders: mockOrders,
  profile: mockProfile,
  addresses: mockAddresses,
  auth: mockAuth,
};

export const repositories: Repositories = mockRepositories;

export const dataSource = {
  /** What the app is really using right now. */
  mode: "demo" as "demo" | "supabase",
  /** True when credentials exist but no Supabase repositories are wired up yet. */
  credentialsDetectedButUnused: isSupabaseConfigured,
};
