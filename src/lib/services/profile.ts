import type { CustomerProfile, UpdateProfileInput } from "@/lib/types";
import { repositories } from "./repositories";

export function getProfile(): Promise<CustomerProfile | null> {
  return repositories.profile.get();
}

export function updateProfile(input: UpdateProfileInput): Promise<CustomerProfile> {
  return repositories.profile.update(input);
}
