/**
 * Customer-support configuration.
 *
 * `whatsappNumber` is a PLACEHOLDER. Set NEXT_PUBLIC_WHATSAPP_NUMBER (digits
 * with country code, no "+") once the real business number is available.
 */
const PLACEHOLDER_NUMBER = "910000000000";
const configuredNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

export const supportConfig = {
  whatsappNumber: configuredNumber || PLACEHOLDER_NUMBER,
  isWhatsappPlaceholder: !configuredNumber,
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "",
} as const;
