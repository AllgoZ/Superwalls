export interface CustomerProfile {
  id: string;
  fullName: string;
  email?: string;
  mobile?: string;
}

export interface UpdateProfileInput {
  fullName: string;
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
  userId?: string;
  email?: string;
}

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  mobile?: string;
}
