import "server-only";
import {
  contactSettingsSchema,
  deliverySettingsSchema,
  notificationSettingsSchema,
  storeSettingsSchema,
} from "@/lib/admin/schemas/settings";
import { queryOne } from "../../db";
import { assertAllowedImageUrl } from "../media";
import { defineOp } from "../op";

async function upsert(key: string, value: unknown, isPublic: boolean, actor: string): Promise<{ before: unknown }> {
  const row = await queryOne<{ before: unknown }>(
    `with prev as (select value from store_settings where key = $1)
     insert into store_settings (key, value, is_public, updated_by) values ($1, $2::jsonb, $3, $4)
     on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by
     returning (select value from prev) as before`,
    [key, JSON.stringify(value), isPublic, actor],
  );
  return { before: row?.before ?? null };
}

/** Business settings. Everything here needs `settings.manage` (super admin by default). */
export const settingsOps = [
  defineOp({
    name: "settings.saveStore",
    permission: "settings.manage",
    input: storeSettingsSchema,
    revalidate: ["content:settings"],
    async run({ admin }, input) {
      if (input.logoUrl) assertAllowedImageUrl(input.logoUrl);
      return upsert("store", input, true, admin.userId);
    },
    audit: (input, result) => ({ action: "settings.store", entityType: "settings", entityId: "store", summary: "Updated store settings", metadata: { before: result.before, after: input } }),
  }),

  defineOp({
    name: "settings.saveDelivery",
    permission: "settings.manage",
    input: deliverySettingsSchema,
    // Checkout reads this row on every order, so there is nothing to invalidate there; the storefront display is cached.
    revalidate: ["content:settings"],
    async run({ admin }, input) {
      return upsert("delivery", input, true, admin.userId);
    },
    audit: (input, result) => ({
      action: "settings.delivery",
      entityType: "settings",
      entityId: "delivery",
      summary: "Updated delivery settings",
      metadata: {
        before: result.before,
        after: { ...input, serviceablePincodes: `${input.serviceablePincodes.length} PIN codes`, serviceableCities: input.serviceableCities },
      },
    }),
  }),

  defineOp({
    name: "settings.saveContact",
    permission: "settings.manage",
    input: contactSettingsSchema,
    revalidate: ["content:settings"],
    async run({ admin }, input) {
      return upsert("contact", input, true, admin.userId);
    },
    audit: (input, result) => ({ action: "settings.contact", entityType: "settings", entityId: "contact", summary: "Updated contact settings", metadata: { before: result.before, after: input } }),
  }),

  defineOp({
    name: "settings.saveNotifications",
    permission: "settings.manage",
    input: notificationSettingsSchema,
    async run({ admin }, input) {
      // Private row. These switches only record intent: no email or WhatsApp is sent by this application yet.
      return upsert("notifications", input, false, admin.userId);
    },
    audit: (input, result) => ({ action: "settings.notifications", entityType: "settings", entityId: "notifications", summary: "Updated notification preferences", metadata: { before: result.before, after: input } }),
  }),
];
