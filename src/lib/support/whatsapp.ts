import { siteConfig } from "@/lib/config/site";
import { supportConfig } from "@/lib/config/support";

/**
 * WhatsApp support via a plain click-to-chat link (https://wa.me/...).
 *
 * This only opens a chat with a prefilled message. It does NOT send
 * notifications, track orders or receive replies in the app; that needs the
 * WhatsApp Business API plus a webhook (see README).
 *
 * Messages never include personal data (address, phone); only an order number.
 */
export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${supportConfig.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function generalSupportMessage(): string {
  return `Hi ${siteConfig.name}, I need some help.`;
}

export function orderSupportMessage(orderNumber: string): string {
  return `Hi ${siteConfig.name}, I need help with my order ${orderNumber}.`;
}

export function getSupportUrl(orderNumber?: string): string {
  return buildWhatsAppUrl(orderNumber ? orderSupportMessage(orderNumber) : generalSupportMessage());
}
