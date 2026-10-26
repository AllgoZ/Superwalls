import type {
  Address,
  CreateOrderInput,
  CustomerProfile,
  Order,
  PaymentMethodId,
  PaymentStatus,
  Paise,
  Product,
  SaveAddressInput,
  Session,
  UpdateProfileInput,
} from "@/lib/types";

/**
 * Data-access contracts. The mock implementations (`./mock`) satisfy these
 * today; Supabase-backed implementations will satisfy the same interfaces, so
 * the UI does not change when the backend is connected.
 */

export interface ProductsRepository {
  list(): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
}

export interface OrdersRepository {
  list(): Promise<Order[]>;
  getById(id: string): Promise<Order | null>;
  /**
   * Creates an order. Implementations must recompute prices, discounts,
   * delivery and totals server-side from authoritative data; the input carries
   * no amounts on purpose.
   */
  create(input: CreateOrderInput): Promise<Order>;
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
  /** Mock only: there is no real security. Replace with Supabase Auth. */
  signIn(): Promise<Session>;
  signOut(): Promise<Session>;
}

export interface PaymentRequest {
  orderReference: string;
  method: PaymentMethodId;
  amountPaise: Paise;
}

export interface PaymentResult {
  /** Payment status to record on the order. */
  status: PaymentStatus;
  /** Provider reference, once a real gateway exists. */
  providerReference?: string;
}

/** One provider per payment method. Real gateways implement this interface. */
export interface PaymentProvider {
  method: PaymentMethodId;
  process(request: PaymentRequest): Promise<PaymentResult>;
}

export interface Repositories {
  products: ProductsRepository;
  orders: OrdersRepository;
  profile: ProfileRepository;
  addresses: AddressesRepository;
  auth: AuthRepository;
}
