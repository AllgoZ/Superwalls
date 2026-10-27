import { deliverySettingsSchema } from "@/lib/admin/schemas/settings";
import { commerceConfig, type CommerceConfig } from "@/lib/config/commerce";
import { isSupabaseConfigured } from "@/lib/config/env";
import { requireClient } from "./supabase/client";

/**
 * The delivery rules the cart DISPLAYS. They come from the public copy of the settings row (Row Level Security
 * exposes only `is_public` rows). The server applies the authoritative copy again at checkout, so a stale or
 * tampered display can never change what is charged.
 */
export async function getCommerceConfig(): Promise<CommerceConfig> {
  if (!isSupabaseConfigured) return commerceConfig;
  try {
    const { data, error } = await requireClient().from("store_settings").select("value").eq("key", "delivery").maybeSingle();
    if (error || !data) return commerceConfig;
    const parsed = deliverySettingsSchema.safeParse(data.value);
    if (!parsed.success) return commerceConfig;
    return {
      ...commerceConfig,
      deliveryFeePaise: parsed.data.deliveryFeePaise,
      freeDeliveryThresholdPaise: parsed.data.freeDeliveryThresholdPaise,
      minOrderPaise: parsed.data.minOrderPaise,
    };
  } catch {
    return commerceConfig;
  }
}
