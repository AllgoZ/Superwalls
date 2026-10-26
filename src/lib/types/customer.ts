export interface CustomerProfile {
  id: string;
  fullName: string;
  email?: string;
  mobile?: string;
  /** True when the profile comes from the mock auth service. */
  isDemo: boolean;
}

export interface UpdateProfileInput {
  fullName: string;
  email?: string;
  mobile?: string;
}

/** Fields collected by the delivery form. */
export interface AddressFields {
  fullName: string;
  mobile: string;
  line1: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  instructions?: string;
}

export interface Address extends AddressFields {
  id: string;
  isDefault: boolean;
}

export interface SaveAddressInput extends AddressFields {
  /** Present when editing an existing address. */
  id?: string;
  isDefault?: boolean;
}

export interface Session {
  signedIn: boolean;
  /** True while sign-in is the mock implementation (no real security). */
  isDemo: boolean;
}
