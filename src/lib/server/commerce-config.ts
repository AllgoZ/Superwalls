import "server-only";
import { DEFAULT_DELIVERY, deliverySettingsSchema, type DeliverySettings } from "@/lib/admin/schemas/settings";
import { commerceConfig, type CommerceConfig } from "@/lib/config/commerce";
import { queryOne } from "./db";

/**
 * Delivery rules as the TRUSTED backend applies them at checkout. The cart in the browser shows the same numbers
 * (it reads the public copy of this row), but only this function decides what is charged.
 * A missing or malformed row falls back to the built-in defaults rather than blocking checkout.
 */
export async function getDeliverySettings(): Promise<DeliverySettings> {
  const row = await queryOne<{ value: unknown }>("select value from store_settings where key = 'delivery'");
  const parsed = deliverySettingsSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : DEFAULT_DELIVERY;
}

export function toCommerceConfig(settings: DeliverySettings): CommerceConfig {
  return {
    ...commerceConfig,
    deliveryFeePaise: settings.deliveryFeePaise,
    freeDeliveryThresholdPaise: settings.freeDeliveryThresholdPaise,
    minOrderPaise: settings.minOrderPaise,
  };
}

/** Whether an address can be delivered to. PIN codes, when listed, take priority; otherwise cities; otherwise everywhere. */
export function isServiceable(settings: DeliverySettings, address: { pincode: string; city: string }): boolean {
  if (settings.serviceablePincodes.length > 0) return settings.serviceablePincodes.includes(address.pincode);
  if (settings.serviceableCities.length > 0) {
    const city = address.city.trim().toLowerCase();
    return settings.serviceableCities.some((candidate) => candidate.toLowerCase() === city);
  }
  return true;
}
