import type {
  Address,
  CustomerProfile,
  Order,
  Product,
  SaveAddressInput,
  Session,
  SignUpInput,
  UpdateProfileInput,
} from "@/lib/types";

/**
 * Data-access contracts for everything the browser may touch directly. The browser can only READ the catalog,
 * and read / edit its own profile, addresses and orders, because Row Level Security enforces it.
 * Creating orders and taking payments is NOT here: that is server-side (see `services/checkout.ts`).
 */

export interface ProductsRepository {
  list(): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
}

export interface OrdersRepository {
  /** The signed-in customer's own orders, newest first. */
  list(): Promise<Order[]>;
  getByNumber(orderNumber: string): Promise<Order | null>;
}

export interface ProfileRepository {
  /** Returns null when nobody is signed in. */
  get(): Promise<CustomerProfile | null>;
  update(input: UpdateProfileInput): Promise<CustomerProfile>;
}

export interface AddressesRepository {
  list(): Promise<Address[]>;
  save(input: SaveAddressInput): Promise<Address>;
}

export interface AuthRepository {
  getSession(): Promise<Session>;
  /** Returns true when the account is created but the email must be verified before signing in. */
  signUp(input: SignUpInput): Promise<{ needsEmailVerification: boolean }>;
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<Session>;
  /** The current access token, or null when signed out. Sent to our own API as a bearer token. */
  getAccessToken(): Promise<string | null>;
}

export interface Repositories {
  products: ProductsRepository;
  orders: OrdersRepository;
  profile: ProfileRepository;
  addresses: AddressesRepository;
  auth: AuthRepository;
}
