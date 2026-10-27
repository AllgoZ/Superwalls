import { ServiceError } from "./errors";
import type { AddressesRepository, AuthRepository, OrdersRepository, ProfileRepository } from "./contracts";

/**
 * Used only when Supabase env vars are missing. Browsing still works on the demo catalog, but there is no
 * pretend account, order or checkout: anything that needs the backend says so instead of faking success.
 */
const unavailable = () =>
  new ServiceError("BACKEND_NOT_CONFIGURED", "Accounts and orders aren't available until the store backend is connected.");

export const unavailableOrders: OrdersRepository = {
  list: async () => [],
  getByNumber: async () => null,
};

export const unavailableProfile: ProfileRepository = {
  get: async () => null,
  update: async () => {
    throw unavailable();
  },
};

export const unavailableAddresses: AddressesRepository = {
  list: async () => [],
  save: async () => {
    throw unavailable();
  },
};

export const unavailableAuth: AuthRepository = {
  getSession: async () => ({ signedIn: false }),
  signUp: async () => {
    throw unavailable();
  },
  signIn: async () => {
    throw unavailable();
  },
  signOut: async () => ({ signedIn: false }),
  getAccessToken: async () => null,
};
