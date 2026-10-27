"use client";

import { MessageCircle } from "lucide-react";
import { getSupportUrl } from "@/lib/support/whatsapp";
import { cn } from "@/lib/utils";
import { useSupport } from "./support-provider";

interface WhatsAppLinkProps {
  orderNumber?: string;
  label?: string;
  className?: string;
}

/**
 * Click-to-chat link. While the business number is still a placeholder it
 * renders an honest "coming soon" note instead of a link to a fake number.
 */
export function WhatsAppLink({ orderNumber, label = "Chat on WhatsApp", className }: WhatsAppLinkProps) {
  const support = useSupport();
  const base =
    "inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold";

  if (support.isWhatsappPlaceholder) {
    return (
      <span className={cn(base, "bg-soft text-muted-foreground", className)}>
        <MessageCircle className="size-4" aria-hidden />
        WhatsApp support coming soon
      </span>
    );
  }

  return (
    <a
      href={getSupportUrl(support.whatsappNumber, orderNumber)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(base, "bg-success-soft text-success hover:bg-success-soft/70", className)}
    >
      <MessageCircle className="size-4" aria-hidden />
      {label}
    </a>
  );
}
