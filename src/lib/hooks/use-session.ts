"use client";

import { getSession } from "@/lib/services/auth";
import { getProfile } from "@/lib/services/profile";
import { useServiceQuery } from "./use-service-query";

export function useSession() {
  return useServiceQuery(getSession);
}

export function useProfile() {
  return useServiceQuery(getProfile);
}
