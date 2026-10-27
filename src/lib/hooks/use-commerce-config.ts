"use client";

import { commerceConfig, type CommerceConfig } from "@/lib/config/commerce";
import { getCommerceConfig } from "@/lib/services/commerce-config";
import { useServiceQuery } from "./use-service-query";

/** Delivery rules for display. Falls back to the built-in defaults while loading or if the settings can't be read. */
export function useCommerceConfig(): CommerceConfig {
  const query = useServiceQuery(getCommerceConfig);
  return query.data ?? commerceConfig;
}
