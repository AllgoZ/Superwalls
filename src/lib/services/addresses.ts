import type { Address, SaveAddressInput } from "@/lib/types";
import { repositories } from "./repositories";

export function getAddresses(): Promise<Address[]> {
  return repositories.addresses.list();
}

export function saveAddress(input: SaveAddressInput): Promise<Address> {
  return repositories.addresses.save(input);
}
