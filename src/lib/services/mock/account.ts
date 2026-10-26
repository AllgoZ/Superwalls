import type {
  Address,
  CustomerProfile,
  SaveAddressInput,
  Session,
  UpdateProfileInput,
} from "@/lib/types";
import { emitDataChange } from "../events";
import { ServiceError } from "../errors";
import type { AddressesRepository, AuthRepository, ProfileRepository } from "../contracts";
import { generateId } from "@/lib/id";
import { delay, readStored, STORAGE_KEYS, writeStored } from "./storage";

/**
 * Mock authentication. This is NOT real security: there is no password and
 * "signing in" only flips a flag in localStorage. Replace with Supabase Auth.
 */
const DEFAULT_PROFILE: CustomerProfile = {
  id: "demo-user",
  fullName: "Demo Customer",
  email: "demo.customer@example.com",
  mobile: "",
  isDemo: true,
};

function isSignedIn(): boolean {
  return readStored<boolean>(STORAGE_KEYS.session, false);
}

function currentSession(): Session {
  return { signedIn: isSignedIn(), isDemo: true };
}

export const mockAuth: AuthRepository = {
  async getSession() {
    return currentSession();
  },
  async signIn() {
    await delay(300);
    writeStored(STORAGE_KEYS.session, true);
    emitDataChange();
    return currentSession();
  },
  async signOut() {
    await delay(150);
    writeStored(STORAGE_KEYS.session, false);
    emitDataChange();
    return currentSession();
  },
};

export const mockProfile: ProfileRepository = {
  async get() {
    if (!isSignedIn()) return null;
    return readStored<CustomerProfile>(STORAGE_KEYS.profile, DEFAULT_PROFILE);
  },
  async update(input: UpdateProfileInput) {
    if (!isSignedIn()) throw new ServiceError("UNAUTHENTICATED", "Please sign in to edit your profile.");
    await delay(300);
    const current = readStored<CustomerProfile>(STORAGE_KEYS.profile, DEFAULT_PROFILE);
    const updated: CustomerProfile = { ...current, ...input };
    writeStored(STORAGE_KEYS.profile, updated);
    emitDataChange();
    return updated;
  },
};

export const mockAddresses: AddressesRepository = {
  async list() {
    return readStored<Address[]>(STORAGE_KEYS.addresses, []);
  },
  async save(input: SaveAddressInput) {
    await delay(250);
    const all = readStored<Address[]>(STORAGE_KEYS.addresses, []);
    const existing = input.id ? all.find((address) => address.id === input.id) : undefined;
    const { id: _ignored, isDefault, ...fields } = input;
    void _ignored;

    const saved: Address = {
      ...fields,
      id: existing?.id ?? generateId("addr"),
      // The first saved address becomes the default.
      isDefault: isDefault ?? existing?.isDefault ?? all.length === 0,
    };

    let next = existing
      ? all.map((address) => (address.id === saved.id ? saved : address))
      : [...all, saved];
    if (saved.isDefault) {
      next = next.map((address) =>
        address.id === saved.id ? address : { ...address, isDefault: false },
      );
    }
    writeStored(STORAGE_KEYS.addresses, next);
    emitDataChange();
    return saved;
  },
};
