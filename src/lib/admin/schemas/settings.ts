import { z } from "zod";

/** Shared by the settings forms, the operations that save them, and the code that reads them back. */
const text = (max: number) => z.string().trim().max(max);

export const deliverySettingsSchema = z.object({
  deliveryFeePaise: z.number().int().min(0).max(10_000_000),
  /** null = delivery is never free. */
  freeDeliveryThresholdPaise: z.number().int().min(0).max(1_000_000_000).nullable(),
  minOrderPaise: z.number().int().min(0).max(1_000_000_000),
  /** When not empty, ONLY these PIN codes can order (takes priority over cities). */
  serviceablePincodes: z.array(z.string().regex(/^[1-9][0-9]{5}$/, "PIN codes are 6 digits.")).max(5000),
  /** Used only when no PIN codes are listed. */
  serviceableCities: z.array(text(60).min(1)).max(200),
  policyText: text(2000),
});
export type DeliverySettings = z.infer<typeof deliverySettingsSchema>;

export const DEFAULT_DELIVERY: DeliverySettings = {
  deliveryFeePaise: 4900,
  freeDeliveryThresholdPaise: 49900,
  minOrderPaise: 0,
  serviceablePincodes: [],
  serviceableCities: [],
  policyText: "",
};

export const storeSettingsSchema = z.object({
  businessName: text(80).min(2, "Enter the business name."),
  tagline: text(120),
  logoUrl: z.string().trim().max(600).nullish().transform((value) => value || null),
  contactEmail: z.union([z.literal(""), z.email().max(254)]),
  contactPhone: text(30),
  address: text(300),
  websiteUrl: z.union([z.literal(""), z.url({ protocol: /^https?$/ }).max(300)]),
  currency: z.literal("INR"),
  timezone: z.literal("Asia/Kolkata"),
});
export type StoreSettings = z.infer<typeof storeSettingsSchema>;

export const DEFAULT_STORE: StoreSettings = {
  businessName: "SuperWalls",
  tagline: "",
  logoUrl: null,
  contactEmail: "",
  contactPhone: "",
  address: "",
  websiteUrl: "",
  currency: "INR",
  timezone: "Asia/Kolkata",
};

export const contactSettingsSchema = z.object({
  supportPhone: text(30),
  supportEmail: z.union([z.literal(""), z.email().max(254)]),
  /** Digits with country code, no plus sign (for example 919876543210). */
  whatsappNumber: z.union([z.literal(""), z.string().trim().regex(/^[1-9][0-9]{9,14}$/, "Use digits with country code, no + (for example 919876543210).")]),
  availability: text(200),
});
export type ContactSettings = z.infer<typeof contactSettingsSchema>;

export const DEFAULT_CONTACT: ContactSettings = { supportPhone: "", supportEmail: "", whatsappNumber: "", availability: "" };

export const notificationSettingsSchema = z.object({
  orderConfirmation: z.boolean(),
  orderProcessing: z.boolean(),
  shippingUpdates: z.boolean(),
  deliveryUpdates: z.boolean(),
  lowStockAlerts: z.boolean(),
});
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  orderConfirmation: false,
  orderProcessing: false,
  shippingUpdates: false,
  deliveryUpdates: false,
  lowStockAlerts: false,
};
