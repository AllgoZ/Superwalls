import type { ContactSettings } from "@/lib/admin/schemas/settings";

/**
 * Customer-support configuration.
 *
 * The WhatsApp number and support email are managed in the admin panel (Settings > Contact). The environment
 * variables NEXT_PUBLIC_WHATSAPP_NUMBER / NEXT_PUBLIC_SUPPORT_EMAIL remain as a fallback. Until a real number is set,
 * the UI shows "coming soon" rather than a link to a made-up number.
 */
const PLACEHOLDER_NUMBER = "910000000000";
const envNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
const envEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "";

export interface SupportInfo {
  whatsappNumber: string;
  isWhatsappPlaceholder: boolean;
  supportEmail: string;
  supportPhone: string;
  availability: string;
}

export function resolveSupport(contact?: Partial<ContactSettings>): SupportInfo {
  const number = contact?.whatsappNumber || envNumber || "";
  return {
    whatsappNumber: number || PLACEHOLDER_NUMBER,
    isWhatsappPlaceholder: !number,
    supportEmail: contact?.supportEmail || envEmail,
    supportPhone: contact?.supportPhone ?? "",
    availability: contact?.availability ?? "",
  };
}

/** Environment-only value, kept for code that runs before the settings are available. */
export const supportConfig = resolveSupport();
