import type { Address, CustomerProfile, SaveAddressInput } from "@/lib/types";
import { ServiceError } from "../errors";
import { emitDataChange } from "../events";
import type { AddressesRepository, ProfileRepository } from "../contracts";
import { currentUserId, requireClient, requireUserId } from "./client";

interface ProfileRow {
  id: string;
  full_name: string;
  email: string | null;
  mobile: string | null;
}

interface AddressRow {
  id: string;
  full_name: string;
  mobile: string;
  line1: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  instructions: string;
  is_default: boolean;
}

const toProfile = (row: ProfileRow): CustomerProfile => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email ?? undefined,
  mobile: row.mobile ?? undefined,
});

const toAddress = (row: AddressRow): Address => ({
  id: row.id,
  fullName: row.full_name,
  mobile: row.mobile,
  line1: row.line1,
  area: row.area,
  city: row.city,
  state: row.state,
  pincode: row.pincode,
  instructions: row.instructions,
  isDefault: row.is_default,
});

export const supabaseProfile: ProfileRepository = {
  async get() {
    const userId = await currentUserId();
    if (!userId) return null;
    const { data, error } = await requireClient()
      .from("profiles")
      .select("id,full_name,email,mobile")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new ServiceError("UNKNOWN", "We couldn't load your profile.");
    return data ? toProfile(data as ProfileRow) : null;
  },

  async update(input) {
    const userId = await requireUserId();
    const { data, error } = await requireClient()
      .from("profiles")
      .update({ full_name: input.fullName, mobile: input.mobile ?? "" })
      .eq("id", userId)
      .select("id,full_name,email,mobile")
      .single();
    if (error) throw new ServiceError("VALIDATION", "We couldn't save your profile. Please check the details.");
    emitDataChange();
    return toProfile(data as ProfileRow);
  },
};

export const supabaseAddresses: AddressesRepository = {
  async list() {
    if (!(await currentUserId())) return [];
    const { data, error } = await requireClient()
      .from("addresses")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new ServiceError("UNKNOWN", "We couldn't load your saved addresses.");
    return (data as AddressRow[]).map(toAddress);
  },

  async save(input: SaveAddressInput) {
    const userId = await requireUserId();
    const client = requireClient();
    const fields = {
      full_name: input.fullName,
      mobile: input.mobile,
      line1: input.line1,
      area: input.area,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      instructions: input.instructions ?? "",
    };

    let row: AddressRow | null = null;
    if (input.id) {
      const { data, error } = await client
        .from("addresses")
        .update({ ...fields, ...(input.isDefault === undefined ? {} : { is_default: input.isDefault }) })
        .eq("id", input.id)
        .select("*")
        .single();
      if (error) throw new ServiceError("VALIDATION", "We couldn't save that address. Please check the details.");
      row = data as AddressRow;
    } else {
      // The first address a customer saves becomes their default.
      const { count } = await client.from("addresses").select("id", { count: "exact", head: true });
      const { data, error } = await client
        .from("addresses")
        .insert({ ...fields, user_id: userId, is_default: input.isDefault ?? (count ?? 0) === 0 })
        .select("*")
        .single();
      if (error) throw new ServiceError("VALIDATION", "We couldn't save that address. Please check the details.");
      row = data as AddressRow;
    }
    emitDataChange();
    return toAddress(row);
  },
};
