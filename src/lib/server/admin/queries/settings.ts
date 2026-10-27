import "server-only";
import {
  DEFAULT_CONTACT,
  DEFAULT_DELIVERY,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_STORE,
  contactSettingsSchema,
  deliverySettingsSchema,
  notificationSettingsSchema,
  storeSettingsSchema,
  type ContactSettings,
  type DeliverySettings,
  type NotificationSettings,
  type StoreSettings,
} from "@/lib/admin/schemas/settings";
import { query } from "../../db";
import { assertCan, type AdminContext } from "../session";

export interface AllSettings {
  store: StoreSettings;
  delivery: DeliverySettings;
  contact: ContactSettings;
  notifications: NotificationSettings;
}

export async function getAllSettings(admin: AdminContext): Promise<AllSettings> {
  assertCan(admin, "settings.manage");
  const rows = await query<{ key: string; value: unknown }>("select key, value from store_settings where key in ('store', 'delivery', 'contact', 'notifications')");
  const by = new Map(rows.map((r) => [r.key, r.value]));
  return {
    store: storeSettingsSchema.safeParse(by.get("store")).data ?? DEFAULT_STORE,
    delivery: deliverySettingsSchema.safeParse(by.get("delivery")).data ?? DEFAULT_DELIVERY,
    contact: contactSettingsSchema.safeParse(by.get("contact")).data ?? DEFAULT_CONTACT,
    notifications: notificationSettingsSchema.safeParse(by.get("notifications")).data ?? DEFAULT_NOTIFICATIONS,
  };
}
